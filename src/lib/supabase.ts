import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../database.types"

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing!")
}

export const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!)

export const dbHelpers = {
  // Initialize or get player by Telegram user ID
  initializePlayer: async (telegramUser: {
    id: number
    username?: string
    first_name?: string
    last_name?: string
    photo_url?: string
  }) => {
    const { data, error } = await supabase
      .from("players")
      .upsert(
        {
          telegram_user_id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          photo_url: telegramUser.photo_url,
          last_active: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" },
      )
      .select()
      .single()

    if (error) {
      console.error("Error initializing player:", error)
      throw error
    }
    return data
  },

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
      .gt("quantity", 0) // Only show gifts with quantity > 0

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

  joinGame: async (
    gameId: string,
    playerId: string,
    giftSelections: { giftId: string; quantity: number; totalValue: number }[],
    playerColor: string,
    playerPosition: number,
    playerName: string,
  ) => {
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
    // Fetch current participants for snapshot
    const { data: participants, error: participantsError } = await supabase
      .from("game_participants")
      .select(
        "player_id, player_name, gift_value, chance_percentage, color, telegram_user_id:players(telegram_user_id, username, first_name, last_name, photo_url)",
      )
      .eq("game_id", gameId)

    if (participantsError) {
      console.error("Error fetching participants for snapshot:", participantsError)
      throw participantsError
    }

    const { data: winnerData, error: winnerError } = await supabase
      .from("players")
      .select("username, first_name, last_name")
      .eq("id", winnerPlayerId)
      .single()

    if (winnerError) {
      console.error("Error fetching winner data:", winnerError)
      throw winnerError
    }

    const winnerName = winnerData?.username || winnerData?.first_name || "Unknown Winner"

    const { data, error } = await supabase
      .from("games")
      .update({
        status: "completed",
        winner_player_id: winnerPlayerId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", gameId)
      .select("roll_number")
      .single()

    if (error) {
      console.error("Error completing game:", error)
      throw error
    }

    // Add to match history
    const { error: historyError } = await supabase.from("match_history").insert({
      game_id: gameId,
      roll_number: data.roll_number,
      winner_player_id: winnerPlayerId,
      winner_name: winnerName,
      winner_chance: winnerChance,
      total_pot: totalPot,
      players_snapshot: participants,
    })

    if (historyError) {
      console.error("Error adding to match history:", historyError)
      throw historyError
    }

    return data
  },

  // Game logs
  async addGameLog(gameId: string, playerId: string | null, type: string, message: string) {
    const { data, error } = await supabase
      .from("game_logs")
      .insert({
        game_id: gameId,
        player_id: playerId,
        log_type: type,
        message: message,
      })
      .select()
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
      .from("match_history")
      .select(
        "*, winner:players(id, username, first_name, last_name, photo_url), players_snapshot:game_participants(player_id, player_name, gift_value, chance_percentage, color, telegram_user_id:players(telegram_user_id, username, first_name, last_name, photo_url))",
      )
      .order("timestamp", { ascending: false })
      .limit(limit)
    if (error) {
      console.error("Error fetching match history:", error)
      throw error
    }

    // Map players_snapshot to the Player interface
    const formattedData = data.map((match) => ({
      ...match,
      winner: {
        id: match.winner?.id,
        name: match.winner?.username || match.winner?.first_name || "Unknown",
        balance: 0, // Not stored in match history directly
        color: "#000000", // Placeholder, not stored in winner object
        gifts: [], // Not stored in winner object
        giftValue: 0, // Not stored in winner object
        telegramUser: match.winner
          ? {
              id: match.winner.id,
              username: match.winner.username || undefined,
              first_name: match.winner.first_name || undefined,
              last_name: match.winner.last_name || undefined,
              photo_url: match.winner.photo_url || undefined,
            }
          : undefined,
      },
      players:
        match.players_snapshot?.map((p: any) => ({
          id: p.player_id,
          name: p.player_name,
          balance: 0, // Not stored in snapshot directly
          color: p.color,
          gifts: [], // Emojis are not stored in snapshot, only value
          giftValue: p.gift_value,
          telegramUser: p.telegram_user_id
            ? {
                id: p.telegram_user_id.telegram_user_id,
                username: p.telegram_user_id.username || undefined,
                first_name: p.telegram_user_id.first_name || undefined,
                last_name: p.telegram_user_id.last_name || undefined,
                photo_url: p.telegram_user_id.photo_url || undefined,
              }
            : undefined,
        })) || [],
    }))

    return formattedData
  },

  // Available gifts
  async getAvailableGifts() {
    const { data, error } = await supabase.from("gifts").select("*")
    if (error) {
      console.error("Error fetching available gifts:", error)
      throw error
    }
    return data
  },

  // Start game countdown
  startGameCountdown: async (gameId: string, duration: number) => {
    // This function might be more complex if you want to store countdown state in DB
    // For now, it's a placeholder for client-side countdown management
    console.log(`Starting countdown for game ${gameId} for ${duration} seconds.`)
  },

  // Get game countdown (if stored in DB)
  getGameCountdown: async (gameId: string) => {
    // This would fetch countdown from DB if it were stored there
    return null // For now, client-side manages countdown
  },

  // Realtime subscriptions
  subscribeToGameParticipants: (gameId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`game_participants:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `game_id=eq.${gameId}`,
        },
        callback,
      )
      .subscribe()
  },

  subscribeToGameLogs: (gameId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`game_logs:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_logs",
          filter: `game_id=eq.${gameId}`,
        },
        callback,
      )
      .subscribe()
  },

  subscribeToPlayerInventory: (playerId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`player_inventory:${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_gifts",
          filter: `player_id=eq.${playerId}`,
        },
        callback,
      )
      .subscribe()
  },

  subscribeToGames: (gameId: string, callback: (payload: any) => void) => {
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

export default supabase
