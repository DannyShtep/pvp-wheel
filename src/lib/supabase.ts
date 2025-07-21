import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Initialize Supabase connection with retry logic
export const initializeSupabase = async () => {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 2000 // 2 seconds

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 Attempting to connect to Supabase (attempt ${attempt}/${MAX_RETRIES})...`)
      
      // Test the connection with a simple query
      const { data, error } = await supabase
        .from('games')
        .select('id')
        .limit(1)

      if (error) throw error
      
      console.log('✅ Supabase client initialized for PvP Wheel')
      return true
    } catch (err) {
      console.error(`❌ Failed to connect (attempt ${attempt}/${MAX_RETRIES}):`, err)
      
      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying in ${RETRY_DELAY/1000} seconds...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      } else {
        console.error('❌ All connection attempts failed')
        return false
      }
    }
  }
  return false
}

// Database types
export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string
          telegram_id: number
          username: string
          first_name: string | null
          last_name: string | null
          photo_url: string | null
          is_premium: boolean
          language_code: string | null
          total_games_played: number
          total_games_won: number
          total_ton_won: number
          total_gifts_won: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          telegram_id: number
          username: string
          first_name?: string | null
          last_name?: string | null
          photo_url?: string | null
          is_premium?: boolean
          language_code?: string | null
          total_games_played?: number
          total_games_won?: number
          total_ton_won?: number
          total_gifts_won?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          telegram_id?: number
          username?: string
          first_name?: string | null
          last_name?: string | null
          photo_url?: string | null
          is_premium?: boolean
          language_code?: string | null
          total_games_played?: number
          total_games_won?: number
          total_ton_won?: number
          total_gifts_won?: number
          created_at?: string
          updated_at?: string
        }
      }
      games: {
        Row: {
          id: string
          roll_number: number
          status: 'waiting' | 'spinning' | 'completed' | 'cancelled'
          total_players: number
          total_pot_balance: number
          total_gift_value: number
          winner_id: string | null
          winner_chance: number | null
          spin_timestamp: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          roll_number: number
          status?: 'waiting' | 'spinning' | 'completed' | 'cancelled'
          total_players?: number
          total_pot_balance?: number
          total_gift_value?: number
          winner_id?: string | null
          winner_chance?: number | null
          spin_timestamp?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          roll_number?: number
          status?: 'waiting' | 'spinning' | 'completed' | 'cancelled'
          total_players?: number
          total_pot_balance?: number
          total_gift_value?: number
          winner_id?: string | null
          winner_chance?: number | null
          spin_timestamp?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      game_participants: {
        Row: {
          id: string
          game_id: string
          player_id: string
          balance: number
          gift_value: number
          color: string
          position_index: number
          chance_percentage: number | null
          joined_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          balance?: number
          gift_value?: number
          color: string
          position_index: number
          chance_percentage?: number | null
          joined_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          balance?: number
          gift_value?: number
          color?: string
          position_index?: number
          chance_percentage?: number | null
          joined_at?: string
        }
      }
      gifts: {
        Row: {
          id: string
          emoji: string
          name: string
          base_value: number
          rarity: 'common' | 'rare' | 'epic' | 'legendary'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          emoji: string
          name: string
          base_value: number
          rarity: 'common' | 'rare' | 'epic' | 'legendary'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          emoji?: string
          name?: string
          base_value?: number
          rarity?: 'common' | 'rare' | 'epic' | 'legendary'
          is_active?: boolean
          created_at?: string
        }
      }
      player_gifts: {
        Row: {
          id: string
          player_id: string
          gift_id: string
          quantity: number
          total_value: number
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          gift_id: string
          quantity?: number
          total_value?: number
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          gift_id?: string
          quantity?: number
          total_value?: number
          updated_at?: string
        }
      }
      game_participant_gifts: {
        Row: {
          id: string
          game_participant_id: string
          gift_id: string
          quantity: number
          value_per_gift: number
          total_value: number
        }
        Insert: {
          id?: string
          game_participant_id: string
          gift_id: string
          quantity?: number
          value_per_gift: number
          total_value: number
        }
        Update: {
          id?: string
          game_participant_id?: string
          gift_id?: string
          quantity?: number
          value_per_gift?: number
          total_value?: number
        }
      }
      game_logs: {
        Row: {
          id: string
          game_id: string
          player_id: string | null
          log_type: 'join' | 'spin' | 'winner' | 'info'
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id?: string | null
          log_type: 'join' | 'spin' | 'winner' | 'info'
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string | null
          log_type?: 'join' | 'spin' | 'winner' | 'info'
          message?: string
          created_at?: string
        }
      }
    }
  }
}

// Helper functions for database operations
export const dbHelpers = {
  // Test database connection
  async testConnection() {
    try {
      console.log('Testing database connection...')
      const { data, error } = await supabase.from('players').select('count').limit(1)
      
      if (error) {
        console.error('Database connection test failed:', error)
        return { success: false, error }
      }
      
      console.log('Database connection test successful')
      return { success: true, data }
    } catch (err) {
      console.error('Database connection test error:', err)
      return { success: false, error: err }
    }
  },

  // Players
  async getOrCreatePlayer(telegramUser: any) {
    try {
      console.log('Searching for existing player with telegram_id:', telegramUser.id)
      
      const { data: existingPlayer, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('telegram_id', telegramUser.id)
        .single()

      if (fetchError) {
        console.log('Fetch error (expected if player not found):', fetchError.message)
        
        // If player not found, create new one
        if (fetchError.code === 'PGRST116') {
          console.log('Player not found, creating new player...')
          
          const newPlayerData = {
            telegram_id: telegramUser.id,
            username: telegramUser.username || telegramUser.first_name || `User${telegramUser.id}`,
            first_name: telegramUser.first_name || null,
            last_name: telegramUser.last_name || null,
            photo_url: telegramUser.photo_url || null,
            is_premium: telegramUser.is_premium || false,
            language_code: telegramUser.language_code || null
          }
          
          console.log('Creating player with data:', newPlayerData)
          
          const { data: newPlayer, error: createError } = await supabase
            .from('players')
            .insert(newPlayerData)
            .select()
            .single()

          if (createError) {
            console.error('Error creating new player:', createError)
            return { data: null, error: createError }
          }
          
          console.log('New player created successfully:', newPlayer)
          return { data: newPlayer, error: null }
        }
        
        // Other errors
        return { data: null, error: fetchError }
      }

      console.log('Found existing player:', existingPlayer)
      return { data: existingPlayer, error: null }
    } catch (err) {
      console.error('Unexpected error in getOrCreatePlayer:', err)
      return { data: null, error: err }
    }
  },

  // Games
  async getCurrentGame() {
    const { data, error } = await supabase
      .from('games')
      .select(`
        *,
        game_participants (
          *,
          players (*),
          game_participant_gifts (
            quantity,
            gifts (
              emoji,
              name,
              base_value
            )
          )
        )
      `)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)

    return { data: data?.[0] || null, error }
  },

  async createGame(rollNumber: number) {
    // Set countdown to end 60 seconds from now when first participant joins
    const { data, error } = await supabase
      .from('games')
      .insert({
        roll_number: rollNumber,
        status: 'waiting'
      })
      .select()
      .single()

    return { data, error }
  },

  async startGameCountdown(gameId: string, durationSeconds: number = 60) {
    const countdownEndsAt = new Date(Date.now() + durationSeconds * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('games')
      .update({ countdown_ends_at: countdownEndsAt })
      .eq('id', gameId)
      .select()
      .single()

    return { data, error }
  },

  async getGameCountdown(gameId: string) {
    const { data, error } = await supabase
      .from('games')
      .select('countdown_ends_at')
      .eq('id', gameId)
      .single()

    if (error || !data?.countdown_ends_at) {
      return { timeLeft: null, error }
    }

    const now = new Date()
    const endsAt = new Date(data.countdown_ends_at)
    const timeLeft = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000))

    return { timeLeft, error: null }
  },

  async updateGameStatus(gameId: string, status: string, updates: any = {}) {
    const { data, error } = await supabase
      .from('games')
      .update({ status, ...updates })
      .eq('id', gameId)
      .select()
      .single()

    return { data, error }
  },

  // Game Participants
  async joinGame(gameId: string, playerId: string, giftSelections: any[], color: string, positionIndex: number) {
    const totalGiftValue = giftSelections.reduce((sum, selection) => sum + selection.totalValue, 0)
    
    const { data, error } = await supabase
      .from('game_participants')
      .insert({
        game_id: gameId,
        player_id: playerId,
        balance: 0,
        gift_value: totalGiftValue,
        color,
        position_index: positionIndex
      })
      .select()
      .single()

    return { data, error }
  },

  // Gifts
  async getAllGifts() {
    const { data, error } = await supabase
      .from('gifts')
      .select('*')
      .eq('is_active', true)
      .order('rarity', { ascending: true })

    return { data, error }
  },

  async getPlayerGifts(playerId: string) {
    const { data, error } = await supabase
      .from('player_gifts')
      .select(`
        *,
        gifts (*)
      `)
      .eq('player_id', playerId)
      .gt('quantity', 0)

    return { data, error }
  },

  async updatePlayerGifts(playerId: string, giftId: string, quantityChange: number) {
    // First, try to get existing record
    const { data: existing } = await supabase
      .from('player_gifts')
      .select('*')
      .eq('player_id', playerId)
      .eq('gift_id', giftId)
      .single()

    if (existing) {
      // Update existing record
      const newQuantity = existing.quantity + quantityChange
      const { data, error } = await supabase
        .from('player_gifts')
        .update({ quantity: newQuantity })
        .eq('id', existing.id)
        .select()
        .single()

      return { data, error }
    } else if (quantityChange > 0) {
      // Create new record
      const { data, error } = await supabase
        .from('player_gifts')
        .insert({
          player_id: playerId,
          gift_id: giftId,
          quantity: quantityChange,
          total_value: 0 // Will be calculated by trigger
        })
        .select()
        .single()

      return { data, error }
    }

    return { data: null, error: null }
  },

  // Game Logs
  async addGameLog(gameId: string, playerId: string | null, logType: string, message: string) {
    const { data, error } = await supabase
      .from('game_logs')
      .insert({
        game_id: gameId,
        player_id: playerId,
        log_type: logType,
        message
      })
      .select()
      .single()

    return { data, error }
  },

  async getGameLogs(gameId: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('game_logs')
      .select(`
        *,
        players (username, first_name)
      `)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  // Match History
  async getMatchHistory(limit: number = 50) {
    const { data, error } = await supabase
      .from('games')
      .select(`
        *,
        players!games_winner_id_fkey (username, first_name),
        game_participants (
          *,
          players (username, first_name)
        )
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  // Get game participants with related data
  async getGameParticipants(gameId: string) {
    try {
      const { data, error } = await supabase
        .from('game_participants')
        .select(`
          *,
          players:player_id (*),
          game_participant_gifts(
            *,
            gifts:gift_id (*)
          )
        `)
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching game participants:', error)
        return { error }
      }

      return { data }
    } catch (error) {
      console.error('Error in getGameParticipants:', error)
      return { error }
    }
  },
}

export default supabase
