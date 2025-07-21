import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing!")
}

export const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!)

// Helper functions for database operations
export const dbHelpers = {
  // Player operations
  async getPlayerByTelegramId(telegramUserId: number) {
    const { data, error } = await supabase.from("players").select("*").eq("telegram_user_id", telegramUserId).single()
    if (error && error.code !== "PGRST116") {
      // PGRST116 means "no rows found", which is fine for a lookup
      console.error("Error fetching player:", error)
      throw error
    }
    return data
  },

  async createPlayer(
    telegramUserId: number,
    username?: string,
    firstName?: string,
    lastName?: string,
    photoUrl?: string,
  ) {
    const { data, error } = await supabase
      .from("players")
      .insert({
        telegram_user_id: telegramUserId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        photo_url: photoUrl,
      })
      .select()
      .single()
    if (error) {
      console.error("Error creating player:", error)
      throw error
    }
    return data
  },

  async getPlayerInventory(playerId: string) {
    const { data, error } = await supabase
      .from("player_gifts")
      .select("*, gifts(*)") // Select all from player_gifts and join gifts table
      .eq("player_id", playerId)
    if (error) {
      console.error("Error fetching player inventory:", error)
      throw error
    }
    return data
  },

  // Game operations
  async getCurrentGame(rollNumber: number) {
    // Try to find an active game first
    const { data: activeGame, error: activeError } = await supabase
      .from("games")
      .select("*, game_participants(*)")
      .eq("status", "waiting")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (activeError && activeError.code !== "PGRST116") {
      console.error("Error fetching active game:", activeError)
      throw activeError
    }

    if (activeGame) {
      return activeGame
    }

    // If no active game, create a new one only if rollNumber is provided (i.e., not 0 for initial load)
    if (rollNumber > 0) {
      const { data: newGame, error: createError } = await supabase
        .from("games")
        .insert({ roll_number: rollNumber, status: "waiting" })
        .select("*, game_participants(*)")
        .single()
      if (createError) {
        console.error("Error creating new game:", createError)
        throw createError
      }
      return newGame
    }

    return null // No active game and not creating a new one
  },

  async getGameParticipants(gameId: string) {
    const { data, error } = await supabase
      .from("game_participants")
      .select("*, players(*)") // Select participant data and join player info
      .eq("game_id", gameId)
    if (error) {
      console.error("Error fetching game participants:", error)
      throw error
    }
    return data
  },

  async addGiftsToGame(
    gameId: string,
    playerId: string,
    giftSelections: { giftId: string; quantity: number; totalValue: number }[],
    playerColor: string,
    playerPosition: number,
    playerName: string,
  ) {
    const { data, error } = await supabase.rpc("add_gifts_to_game", {
      p_game_id: gameId,
      p_player_id: playerId,
      p_gift_selections: giftSelections,
      p_player_color: playerColor,
      p_player_position: playerPosition,
      p_player_name: playerName,
    })

    if (error) {
      console.error("Error calling add_gifts_to_game RPC:", error)
      throw error
    }
    return data
  },

  async completeGame(gameId: string, winnerPlayerId: string, winnerChance: number, totalPot: number) {
    const { data, error } = await supabase
      .from("games")
      .update({
        status: "completed",
        winner_player_id: winnerPlayerId,
        winner_chance: winnerChance,
        total_pot_balance: totalPot,
        ended_at: new Date().toISOString(),
      })
      .eq("id", gameId)
      .select()
      .single()
    if (error) {
      console.error("Error completing game:", error)
      throw error
    }
    return data
  },

  // Game logs
  async addGameLog(gameId: string, playerId: string | null, logType: string, message: string) {
    const { data, error } = await supabase
      .from("game_logs")
      .insert({
        game_id: gameId,
        player_id: playerId,
        log_type: logType,
        message: message,
      })
      .select()
      .single()
    if (error) {
      console.error("Error adding game log:", error)
      throw error
    }
    return data
  },

  async getGameLogs(gameId: string) {
    const { data, error } = await supabase
      .from("game_logs")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(20) // Limit to last 20 logs
    if (error) {
      console.error("Error fetching game logs:", error)
      throw error
    }
    return data
  },

  // Match history
  async getMatchHistory(limit = 10) {
    const { data, error } = await supabase
      .from("games")
      .select("*, winner_player:players!winner_player_id(*), game_participants(*, players(*))")
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(limit)
    if (error) {
      console.error("Error fetching match history:", error)
      throw error
    }
    return data
  },

  // Realtime subscriptions
  subscribeToGameParticipants(gameId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`game_participants:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "game_participants",
          filter: `game_id=eq.${gameId}`,
        },
        callback,
      )
      .subscribe()
  },

  subscribeToGameLogs(gameId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`game_logs:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT", // Only listen to new logs
          schema: "public",
          table: "game_logs",
          filter: `game_id=eq.${gameId}`,
        },
        callback,
      )
      .subscribe()
  },

  subscribeToGames(gameId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`games:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE", // Listen to game status changes (e.g., countdown)
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        callback,
      )
      .subscribe()
  },
}
