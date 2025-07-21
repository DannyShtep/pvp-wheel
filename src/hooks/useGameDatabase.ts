"use client"

import { useState, useEffect, useCallback } from "react"
import { dbHelpers } from "../lib/supabase"
import type { Database } from "../../database.types"

// Define types for clarity
type Player = {
  id: string
  name: string
  balance: number
  color: string
  gifts: string[] // Array of gift emojis
  giftValue: number // Total TON value of gifts
  telegramUser?: {
    id: number
    username?: string
    first_name?: string
    last_name?: string
    photo_url?: string
  }
}

type GameLog = {
  id: string
  message: string
  timestamp: Date
  type: "join" | "spin" | "winner" | "info"
}

type MatchHistoryEntry = {
  id: string
  rollNumber: number
  timestamp: Date
  players: Player[]
  winner: Player
  totalPot: number
  winnerChance: number
}

type GiftType = {
  id: string
  emoji: string
  name: string
  value: number // TON value
  rarity: "common" | "rare" | "epic" | "legendary"
  quantity: number
  nft_address?: string // TON NFT collection address
  nft_item_id?: string // Specific NFT item ID
  is_nft?: boolean // Whether this is an NFT gift
}

export function useGameDatabase() {
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Database["public"]["Tables"]["players"]["Row"] | null>(null)
  const [dbPlayers, setDbPlayers] = useState<Player[]>([])
  const [dbGameLogs, setDbGameLogs] = useState<GameLog[]>([])
  const [dbMatchHistory, setDbMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [playerInventory, setPlayerInventory] = useState<
    (Database["public"]["Tables"]["player_gifts"]["Row"] & {
      gifts: Database["public"]["Tables"]["gifts"]["Row"] | null
    })[]
  >([])
  const [availableGifts, setAvailableGifts] = useState<Database["public"]["Tables"]["gifts"]["Row"][]>([])
  const [gameCountdown, setGameCountdown] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Helper to map DB player data to frontend Player interface
  const mapDbPlayerToFrontendPlayer = useCallback(
    (
      dbPlayer:
        | Database["public"]["Tables"]["players"]["Row"]
        | (Database["public"]["Tables"]["game_participants"]["Row"] & {
            players: Database["public"]["Tables"]["players"]["Row"] | null
          }),
      color: string,
      giftValue: number,
      giftsEmojis: string[],
    ): Player => {
      const telegramUser = {
        id: dbPlayer.telegram_user_id || 0, // Assuming telegram_user_id is always present for DB players
        username: dbPlayer.username || undefined,
        first_name: dbPlayer.first_name || undefined,
        last_name: dbPlayer.last_name || undefined,
        photo_url: dbPlayer.photo_url || undefined,
      }

      return {
        id: dbPlayer.id,
        name: dbPlayer.username || dbPlayer.first_name || `User${dbPlayer.telegram_user_id}`,
        balance: 0, // Balance is not managed here, only gift value
        color: color,
        gifts: giftsEmojis,
        giftValue: giftValue,
        telegramUser: telegramUser,
      }
    },
    [],
  )

  // Initialize player
  const initializePlayer = useCallback(
    async (telegramUser: {
      id: number
      username?: string
      first_name?: string
      last_name?: string
      photo_url?: string
    }) => {
      setLoading(true)
      try {
        const player = await dbHelpers.initializePlayer(telegramUser)
        setCurrentPlayer(player)
        // Load player inventory immediately after initialization
        if (player) {
          await loadPlayerInventory(player.id)
        }
        return player
      } catch (err: any) {
        console.error("Error initializing player:", err)
        setError(err.message || "Failed to initialize player.")
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Get current game or create new
  const getCurrentGame = useCallback(async (rollNumber: number) => {
    setLoading(true)
    try {
      const game = await dbHelpers.getCurrentGame(rollNumber)
      setCurrentGameId(game.id)
      return game
    } catch (err: any) {
      console.error("Error getting current game:", err)
      setError(err.message || "Failed to get current game.")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Load game participants for a given game ID
  const loadGameParticipants = useCallback(
    async (gameId: string) => {
      setLoading(true)
      try {
        const { data, error } = await dbHelpers.supabase
          .from("game_participants")
          .select("*, players(*), game_participant_gifts(gifts(emoji))")
          .eq("game_id", gameId)
          .order("position", { ascending: true })

        if (error) throw error

        const mappedPlayers: Player[] = data.map((p) => {
          const giftEmojis = p.game_participant_gifts.map((gpg) => gpg.gifts?.emoji).filter(Boolean) as string[]
          return mapDbPlayerToFrontendPlayer(p.players!, p.color, p.gift_value, giftEmojis)
        })
        setDbPlayers(mappedPlayers)
      } catch (err: any) {
        console.error("Error loading game participants:", err)
        setError(err.message || "Failed to load game participants.")
      } finally {
        setLoading(false)
      }
    },
    [mapDbPlayerToFrontendPlayer],
  )

  // Join game with gifts (uses RPC)
  const joinGameWithGifts = useCallback(
    async (
      gameId: string,
      playerId: string,
      giftSelections: { giftId: string; quantity: number; totalValue: number }[],
      playerColor: string,
      playerPosition: number,
      playerName: string,
    ) => {
      setLoading(true)
      try {
        await dbHelpers.joinGame(gameId, playerId, giftSelections, playerColor, playerPosition, playerName)
        // Subscriptions will handle state updates for players and inventory
      } catch (err: any) {
        console.error("Error joining game with gifts:", err)
        setError(err.message || "Failed to join game with gifts.")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Complete game
  const completeGame = useCallback(
    async (gameId: string, winnerPlayerId: string, winnerChance: number, totalPot: number) => {
      setLoading(true)
      try {
        await dbHelpers.completeGame(gameId, winnerPlayerId, winnerChance, totalPot)
      } catch (err: any) {
        console.error("Error completing game:", err)
        setError(err.message || "Failed to complete game.")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Add game log
  const addGameLog = useCallback(async (gameId: string, playerId: string | null, type: string, message: string) => {
    try {
      await dbHelpers.addGameLog(gameId, playerId, type, message)
    } catch (err: any) {
      console.error("Error adding game log:", err)
      setError(err.message || "Failed to add game log.")
    }
  }, [])

  // Load match history
  const loadMatchHistory = useCallback(async (limit?: number) => {
    setLoading(true)
    try {
      const history = await dbHelpers.getMatchHistory(limit)
      setDbMatchHistory(history)
    } catch (err: any) {
      console.error("Error loading match history:", err)
      setError(err.message || "Failed to load match history.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Load player inventory
  const loadPlayerInventory = useCallback(async (playerId: string) => {
    setLoading(true)
    try {
      const inventory = await dbHelpers.getPlayerInventory(playerId)
      setPlayerInventory(inventory)
    } catch (err: any) {
      console.error("Error loading player inventory:", err)
      setError(err.message || "Failed to load player inventory.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Load available gifts
  const loadAvailableGifts = useCallback(async () => {
    setLoading(true)
    try {
      const gifts = await dbHelpers.getAvailableGifts()
      setAvailableGifts(gifts)
    } catch (err: any) {
      console.error("Error loading available gifts:", err)
      setError(err.message || "Failed to load available gifts.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Start game countdown (client-side for now)
  const startGameCountdown = useCallback(async (gameId: string, duration: number) => {
    setGameCountdown(duration)
    // In a real app, you might trigger a server-side countdown here
  }, [])

  // Get game countdown (client-side for now)
  const getGameCountdown = useCallback(async (gameId: string) => {
    // In a real app, you might fetch countdown from server here
    return null
  }, [])

  // --- Subscriptions ---
  useEffect(() => {
    if (!currentGameId) return

    const participantsChannel = dbHelpers.subscribeToGameParticipants(currentGameId, (payload) => {
      console.log("Participants change:", payload)
      // Reload participants to get updated data including gift emojis
      loadGameParticipants(currentGameId)
    })

    const logsChannel = dbHelpers.subscribeToGameLogs(currentGameId, (payload) => {
      console.log("Game log change:", payload)
      const newLog: GameLog = {
        id: payload.new.id,
        message: payload.new.message,
        timestamp: new Date(payload.new.created_at),
        type: payload.new.log_type,
      }
      setDbGameLogs((prev) => [newLog, ...prev.slice(0, 19)])
    })

    return () => {
      participantsChannel.unsubscribe()
      logsChannel.unsubscribe()
    }
  }, [currentGameId, loadGameParticipants])

  useEffect(() => {
    if (!currentPlayer?.id) return

    const inventoryChannel = dbHelpers.subscribeToPlayerInventory(currentPlayer.id, (payload) => {
      console.log("Player inventory change:", payload)
      // Reload player inventory to get updated data
      loadPlayerInventory(currentPlayer.id)
    })

    return () => {
      inventoryChannel.unsubscribe()
    }
  }, [currentPlayer?.id, loadPlayerInventory])

  // Initial load of available gifts
  useEffect(() => {
    loadAvailableGifts()
  }, [loadAvailableGifts])

  return {
    currentGameId,
    currentPlayer,
    dbPlayers,
    dbGameLogs,
    dbMatchHistory,
    playerInventory,
    availableGifts,
    gameCountdown,
    loading,
    error,
    clearError,
    initializePlayer,
    getCurrentGame,
    joinGameWithGifts,
    completeGame,
    addGameLog,
    loadMatchHistory,
    loadGameParticipants,
    startGameCountdown,
    getGameCountdown,
    loadPlayerInventory,
  }
}
