"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { dbHelpers } from "../lib/supabase"
import type { Database } from "../../types/supabase"

// Define types for better readability and type safety
type PlayerDB = Database["public"]["Tables"]["players"]["Row"]
type GameDB = Database["public"]["Tables"]["games"]["Row"] & {
  game_participants?: (Database["public"]["Tables"]["game_participants"]["Row"] & {
    players?: PlayerDB
  })[]
}
type GameParticipantDB = Database["public"]["Tables"]["game_participants"]["Row"] & {
  players?: PlayerDB
}
type GameLogDB = Database["public"]["Tables"]["game_logs"]["Row"]
type PlayerGiftDB = Database["public"]["Tables"]["player_gifts"]["Row"] & {
  gifts?: Database["public"]["Tables"]["gifts"]["Row"]
}
type GiftTypeDB = Database["public"]["Tables"]["gifts"]["Row"]

interface Player {
  id: string
  name: string
  balance: number // This might be removed if only gifts are used
  color: string
  gifts: string[] // Array of gift emojis
  giftValue: number // Total TON value of gifts
  telegramUser?: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
  }
}

interface GameLog {
  id: string
  message: string
  timestamp: Date
  type: "join" | "spin" | "winner" | "info"
}

interface MatchHistoryEntry {
  id: string
  rollNumber: number
  timestamp: Date
  players: Player[]
  winner: Player
  totalPot: number
  winnerChance: number
}

export function useGameDatabase() {
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<PlayerDB | null>(null)
  const [dbPlayers, setDbPlayers] = useState<Player[]>([])
  const [dbGameLogs, setDbGameLogs] = useState<GameLog[]>([])
  const [dbMatchHistory, setDbMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [playerInventory, setPlayerInventory] = useState<PlayerGiftDB[]>([])
  const [availableGifts, setAvailableGifts] = useState<GiftTypeDB[]>([])
  const [gameCountdown, setGameCountdown] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const initializePlayer = useCallback(async (telegramUser: any) => {
    setLoading(true)
    setError(null)
    try {
      let player = await dbHelpers.getPlayerByTelegramId(telegramUser.id)
      if (!player) {
        player = await dbHelpers.createPlayer(
          telegramUser.id,
          telegramUser.username,
          telegramUser.first_name,
          telegramUser.last_name,
          telegramUser.photo_url,
        )
      }
      setCurrentPlayer(player)
      // Load inventory after player is initialized
    } catch (err: any) {
      console.error("Failed to initialize player:", err)
      setError(`Failed to initialize player: ${err.message || err.toString()}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const getCurrentGame = useCallback(async (rollNumber: number) => {
    setLoading(true)
    setError(null)
    try {
      const game = await dbHelpers.getCurrentGame(rollNumber)
      if (game) {
        setCurrentGameId(game.id)
        setGameCountdown(game.countdown_seconds) // Assuming countdown_seconds is a column in games table
        return game
      }
      return null
    } catch (err: any) {
      console.error("Failed to get current game:", err)
      setError(`Failed to get current game: ${err.message || err.toString()}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGameParticipants = useCallback(async (gameId: string) => {
    setLoading(true)
    setError(null)
    try {
      const participants = await dbHelpers.getGameParticipants(gameId)
      const formattedPlayers: Player[] = participants.map((p) => ({
        id: p.player_id,
        name: p.player_name || p.players?.username || p.players?.first_name || `Player ${p.player_id.substring(0, 4)}`,
        balance: 0, // Balance is not used for wheel logic, only giftValue
        color: p.color || "#CCCCCC", // Default color if not set
        gifts: p.gifts_array || [],
        giftValue: p.gift_value || 0,
        telegramUser: p.players
          ? {
              id: p.players.telegram_user_id,
              first_name: p.players.first_name || "",
              username: p.players.username || undefined,
              photo_url: p.players.photo_url || undefined,
            }
          : undefined,
      }))
      setDbPlayers(formattedPlayers)
    } catch (err: any) {
      console.error("Failed to load game participants:", err)
      setError(`Failed to load game participants: ${err.message || err.toString()}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const joinGameWithGifts = useCallback(
    async (
      gameId: string,
      playerId: string,
      giftSelections: { giftId: string; quantity: number; totalValue: number }[],
      playerColor: string,
      playerPosition: number,
      playerName: string, // Pass player name to RPC
    ) => {
      setLoading(true)
      setError(null)
      try {
        await dbHelpers.addGiftsToGame(gameId, playerId, giftSelections, playerColor, playerPosition, playerName)
        // Data will be updated via realtime subscription, no need to manually setDbPlayers
      } catch (err: any) {
        console.error("Failed to join game with gifts:", err)
        setError(`Failed to add gifts: ${err.message || err.toString()}`)
        throw err // Re-throw to allow UI to handle
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const completeGame = useCallback(
    async (gameId: string, winnerPlayerId: string, winnerChance: number, totalPot: number) => {
      setLoading(true)
      setError(null)
      try {
        await dbHelpers.completeGame(gameId, winnerPlayerId, winnerChance, totalPot)
        // Game status will be updated via subscription
      } catch (err: any) {
        console.error("Failed to complete game:", err)
        setError(`Failed to complete game: ${err.message || err.toString()}`)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const addGameLog = useCallback(async (gameId: string, playerId: string | null, logType: string, message: string) => {
    try {
      await dbHelpers.addGameLog(gameId, playerId, logType, message)
      // Log will be added via subscription
    } catch (err: any) {
      console.error("Failed to add game log:", err)
      // Don't set global error for logs, just console error
    }
  }, [])

  const loadGameLogs = useCallback(async (gameId: string) => {
    try {
      const logs = await dbHelpers.getGameLogs(gameId)
      const formattedLogs: GameLog[] = logs.map((log) => ({
        id: log.id,
        message: log.message,
        timestamp: new Date(log.created_at),
        type: log.log_type as GameLog["type"],
      }))
      setDbGameLogs(formattedLogs)
    } catch (err: any) {
      console.error("Failed to load game logs:", err)
      // Don't set global error for logs, just console error
    }
  }, [])

  const loadMatchHistory = useCallback(async (limit = 10) => {
    setLoading(true)
    setError(null)
    try {
      const history = await dbHelpers.getMatchHistory(limit)
      const formattedHistory: MatchHistoryEntry[] = history.map((game) => ({
        id: game.id,
        rollNumber: game.roll_number,
        timestamp: new Date(game.ended_at || game.created_at),
        players:
          game.game_participants?.map((p) => ({
            id: p.player_id,
            name:
              p.player_name || p.players?.username || p.players?.first_name || `Player ${p.player_id.substring(0, 4)}`,
            balance: 0,
            color: p.color || "#CCCCCC",
            gifts: p.gifts_array || [],
            giftValue: p.gift_value || 0,
            telegramUser: p.players
              ? {
                  id: p.players.telegram_user_id,
                  first_name: p.players.first_name || "",
                  username: p.players.username || undefined,
                  photo_url: p.players.photo_url || undefined,
                }
              : undefined,
          })) || [],
        winner: {
          id: game.winner_player_id!,
          name: game.winner_player?.username || game.winner_player?.first_name || "Unknown Winner",
          balance: 0,
          color: "#CCCCCC", // Placeholder, actual color not stored in winner_player
          gifts: [], // Not directly available here
          giftValue: game.total_pot_balance || 0,
          telegramUser: game.winner_player
            ? {
                id: game.winner_player.telegram_user_id,
                first_name: game.winner_player.first_name || "",
                username: game.winner_player.username || undefined,
                photo_url: game.winner_player.photo_url || undefined,
              }
            : undefined,
        },
        totalPot: game.total_pot_balance || 0,
        winnerChance: game.winner_chance || 0,
      }))
      setDbMatchHistory(formattedHistory)
    } catch (err: any) {
      console.error("Failed to load match history:", err)
      setError(`Failed to load match history: ${err.message || err.toString()}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPlayerInventory = useCallback(async (playerId: string) => {
    setLoading(true)
    setError(null)
    try {
      const inventory = await dbHelpers.getPlayerInventory(playerId)
      setPlayerInventory(inventory)
    } catch (err: any) {
      console.error("Failed to load player inventory:", err)
      setError(`Failed to load player inventory: ${err.message || err.toString()}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const startGameCountdown = useCallback(async (gameId: string, duration: number) => {
    // This function might be called by an admin or server action
    // For now, we'll just update the local state and rely on DB subscription
    // In a real app, this would trigger a server-side countdown
    setGameCountdown(duration)
    // Potentially update DB to start countdown
  }, [])

  const getGameCountdown = useCallback(async (gameId: string) => {
    // This function might fetch the current countdown from DB
    // For now, we rely on the subscription
  }, [])

  // Effect for realtime subscriptions
  useEffect(() => {
    if (!currentGameId) return

    // Subscribe to game participants
    const participantsSubscription = dbHelpers.subscribeToGameParticipants(currentGameId, (payload) => {
      console.log("Participants change:", payload)
      if (payload.eventType === "INSERT" || payload.eventType === "UPDATE" || payload.eventType === "DELETE") {
        loadGameParticipants(currentGameId) // Reload participants on any change
      }
    })

    // Subscribe to game logs
    const logsSubscription = dbHelpers.subscribeToGameLogs(currentGameId, (payload) => {
      console.log("Game log change:", payload)
      if (payload.eventType === "INSERT") {
        loadGameLogs(currentGameId) // Reload logs on new entry
      }
    })

    // Subscribe to game status/countdown changes
    const gameSubscription = dbHelpers.subscribeToGames(currentGameId, (payload) => {
      console.log("Game change:", payload)
      if (payload.eventType === "UPDATE" && payload.new.countdown_seconds !== undefined) {
        setGameCountdown(payload.new.countdown_seconds)
      }
      if (payload.eventType === "UPDATE" && payload.new.status === "completed") {
        // Game completed, clear players and reset game ID
        setDbPlayers([])
        setCurrentGameId(null)
        setGameCountdown(null)
        loadMatchHistory(10) // Reload recent match history
      }
    })

    // Initial load of participants and logs for the current game
    loadGameParticipants(currentGameId)
    loadGameLogs(currentGameId)
    loadMatchHistory(10) // Load initial recent match history

    return () => {
      participantsSubscription.unsubscribe()
      logsSubscription.unsubscribe()
      gameSubscription.unsubscribe()
    }
  }, [currentGameId, loadGameParticipants, loadGameLogs, loadMatchHistory])

  // Countdown timer effect
  useEffect(() => {
    if (gameCountdown !== null && gameCountdown > 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      countdownIntervalRef.current = setInterval(() => {
        setGameCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0))
      }, 1000)
    } else if (gameCountdown === 0 && countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [gameCountdown])

  return {
    currentGameId,
    currentPlayer,
    dbPlayers,
    dbGameLogs,
    dbMatchHistory,
    playerInventory,
    availableGifts, // This is not currently populated from DB, consider adding a loadAvailableGifts
    gameCountdown,
    loading,
    error,
    initializePlayer,
    getCurrentGame,
    joinGameWithGifts,
    completeGame,
    addGameLog,
    loadGameParticipants,
    loadMatchHistory, // Expose loadMatchHistory for manual refresh/full load
    startGameCountdown,
    getGameCountdown,
    clearError,
    loadPlayerInventory,
  }
}
