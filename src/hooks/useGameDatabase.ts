import { useState, useEffect, useCallback } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, dbHelpers } from '../lib/supabase'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

interface Player {
  id: string
  name: string
  balance: number
  color: string
  gifts: string[]
  giftValue: number
  telegramUser?: TelegramUser
}

interface GameLog {
  id: string
  message: string
  timestamp: Date
  type: 'join' | 'spin' | 'winner' | 'info'
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

interface Game {
  id: string;
  status: string;
  created_at: string;
  winner_id?: string | null;
}

interface GameParticipant {
  id: string;
  game_id: string;
  user_id: string;
  balance: number;
  created_at: string;
}

interface ConnectionTestResult {
  success: boolean;
  error?: Error | string | null;
}

export const useGameDatabase = () => {
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)
  const [dbPlayers, setDbPlayers] = useState<any[]>([])
  const [dbGameLogs, setDbGameLogs] = useState<GameLog[]>([])
  const [dbMatchHistory, setDbMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [playerInventory, setPlayerInventory] = useState<any[]>([])
  const [availableGifts, setAvailableGifts] = useState<any[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<any>(null)
  const [gameCountdown, setGameCountdown] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State for managing subscriptions
  const [globalSubscription, setGlobalSubscription] = useState<RealtimeChannel | null>(null)
  const [gameSubscription, setGameSubscription] = useState<RealtimeChannel | null>(null)

  // Initialize player from Telegram data
  const initializePlayer = useCallback(async (telegramUser: TelegramUser) => {
    try {
      setLoading(true)
      
      // First check if Supabase is properly configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables not configured')
        setError('Database not configured. Please check environment variables.')
        return null
      }
      
      console.log('Attempting to initialize player:', telegramUser.id, telegramUser.username)
      
      const { data: player, error } = await dbHelpers.getOrCreatePlayer(telegramUser)
      
      if (error) {
        console.error('Error creating player:', error)
        console.error('Error details:', {
          message: (error as any).message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: (error as any).code
        })
        setError(`Failed to initialize player: ${(error as any).message}`)
        return null
      }
      
      console.log('Player initialized successfully:', player)
      setCurrentPlayer(player)
      return player
    } catch (err) {
      console.error('Error initializing player:', err)
      setError('Failed to initialize player')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Load available gifts
  const loadAvailableGifts = useCallback(async () => {
    try {
      const { data: gifts, error } = await dbHelpers.getAllGifts()
      
      if (error) {
        console.error('Error loading gifts:', error)
        return
      }
      
      setAvailableGifts(gifts || [])
    } catch (err) {
      console.error('Error loading gifts:', err)
    }
  }, [])

  // Load player inventory
  const loadPlayerInventory = useCallback(async (playerId: string) => {
    try {
      const { data: inventory, error } = await dbHelpers.getPlayerGifts(playerId)
      
      if (error) {
        console.error('Error loading player inventory:', error)
        return
      }
      
      setPlayerInventory(inventory || [])
    } catch (err) {
      console.error('Error loading player inventory:', err)
    }
  }, [])

  // Participant subscription setup
  const setupParticipantSubscription = async (gameId: string) => {
    const participantSubscription = supabase
      .channel(`game_participants_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_participants',
          filter: `game_id=eq.${gameId}`
        },
        async (payload) => {
          console.log('Participant state changed:', payload)
          try {
            // Force refresh participants on any change
            await loadGameParticipants(gameId)
            // Also refresh game state in case it was affected
            await getCurrentGame()
          } catch (err) {
            console.error('Error handling participant change:', err)
          }
        }
      )
      .subscribe((status) => {
        console.log(`Participant subscription status for game ${gameId}:`, status)
      })

    return participantSubscription
  }

  // Type-safe game helper functions
  const getFreshGames = async (): Promise<Game[]> => {
    try {
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error
      return games || []
    } catch (err) {
      console.error('Error fetching fresh games:', err)
      return []
    }
  }

  const getCurrentGame = async (): Promise<Game | null> => {
    if (!currentGameId) return null
    try {
      const { data: game, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', currentGameId)
        .single()

      if (error) throw error
      return game
    } catch (err) {
      console.error('Error fetching current game:', err)
      return null
    }
  }

  // Get fresh games data with caching
  const getFreshGamesData = async () => {
    try {
      const cacheKey = 'current_games'
      const cacheTime = 2000 // 2 seconds cache

      // Check memory cache first
      const cachedData = (window as any).__gamesCache?.[cacheKey]
      const now = Date.now()
      if (cachedData && (now - cachedData.timestamp) < cacheTime) {
        return cachedData.data
      }

      // If no cache or expired, fetch fresh data
      const { data: games, error } = await supabase
        .from('games')
        .select(`
          *,
          game_participants (
            id,
            player_id,
            balance,
            color,
            position_index,
            players (
              id,
              username,
              first_name
            )
          )
        `)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching fresh games:', error)
        return []
      }

      // Update cache
      if (!(window as any).__gamesCache) {
        (window as any).__gamesCache = {}
      }
      (window as any).__gamesCache[cacheKey] = {
        data: games,
        timestamp: now
      }

      return games
    } catch (err) {
      console.error('Error in getFreshGames:', err)
      return []
    }
  }

  // Get or create current game
  const getCurrentGameData = useCallback(async (rollNumber: number) => {
    try {
      console.log('🎯 Loading current game...', rollNumber > 0 ? `Roll #${rollNumber}` : 'Existing game')
      setLoading(true)
      
      // First, try to get current waiting game
      const { data: currentGame, error: fetchError } = await dbHelpers.getCurrentGame()
      
      if (fetchError) {
        console.error('❌ Error fetching current game:', fetchError)
        setError('Failed to load current game')
        return null
      }
      
      if (currentGame) {
        console.log('✅ Found existing game:', currentGame.roll_number, 'with', currentGame.game_participants?.length || 0, 'players')
        setCurrentGameId(currentGame.id)
        
        // Load participants for this game
        const participants = currentGame.game_participants || []
        
        // Transform participants to match Player interface
        const transformedPlayers = participants.map((participant: any) => {
          // Build gifts array from game_participant_gifts
          const gifts: string[] = []
          if (participant.game_participant_gifts) {
            participant.game_participant_gifts.forEach((giftEntry: any) => {
              const emoji = giftEntry.gifts?.emoji || '🎁'
              for (let i = 0; i < giftEntry.quantity; i++) {
                gifts.push(emoji)
              }
            })
          }
          
          return {
            id: participant.id,
            name: participant.players?.username || participant.players?.first_name || 'Unknown',
            balance: participant.balance || 0,
            color: participant.color,
            gifts: gifts,
            giftValue: participant.gift_value || 0,
            telegramUser: participant.players
          }
        })
        
        setDbPlayers(transformedPlayers)
        
        // Check if there's an existing countdown for this game
        const { timeLeft } = await dbHelpers.getGameCountdown(currentGame.id)
        if (timeLeft !== null && timeLeft > 0) {
          console.log('✅ Found existing countdown:', timeLeft, 'seconds remaining')
          setGameCountdown(timeLeft)
        } else {
          console.log('ℹ️ No active countdown for this game')
          setGameCountdown(null)
        }
        
        return currentGame
      }
      
      // If no current game, create a new one ONLY if we have a valid roll number
      // This prevents creating multiple games unnecessarily
      if (rollNumber && rollNumber > 0) {
        console.log('🆕 Creating new game for Roll #' + rollNumber)
        const { data: newGame, error: createError } = await dbHelpers.createGame(rollNumber)
        
        if (createError) {
          console.error('❌ Error creating new game:', createError)
          setError('Failed to create new game')
          return null
        }
        
        console.log('✅ Created new game:', newGame.id)
        setCurrentGameId(newGame.id)
        setDbPlayers([]) // Empty players for new game
        setGameCountdown(null) // Reset countdown for new game
        return newGame
      } else {
        console.log('ℹ️ No current game found')
        return null
      }
    } catch (err) {
      console.error('❌ Error getting current game:', err)
      setError('Failed to get current game')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Join game with gifts
  const joinGameWithGifts = useCallback(async (
    gameId: string,
    playerId: string,
    giftSelections: { giftId: string; quantity: number; totalValue: number }[],
    color: string,
    positionIndex: number
  ) => {
    try {
      setLoading(true)
      
      console.log('Joining game with gifts:', { gameId, playerId, giftSelections, color, positionIndex })
      
      // Validate inputs
      if (!gameId || !playerId || !giftSelections || giftSelections.length === 0) {
        throw new Error('Invalid parameters for joining game')
      }
      
      // Join the game
      const { data: participant, error: joinError } = await dbHelpers.joinGame(
        gameId,
        playerId,
        giftSelections,
        color,
        positionIndex
      )
      
      if (joinError) {
        console.error('Error joining game:', joinError)
        console.error('Join error details:', {
          message: joinError.message,
          details: joinError.details,
          hint: joinError.hint,
          code: joinError.code
        })
        const errorMessage = joinError.message || 'Unknown database error'
        setError(`Failed to join game: ${errorMessage}`)
        return null
      }
      
      console.log('Successfully joined game:', participant)
      
      // Update player inventory (reduce gift quantities)
      for (const selection of giftSelections) {
        try {
          await dbHelpers.updatePlayerGifts(playerId, selection.giftId, -selection.quantity)
        } catch (inventoryError) {
          console.error('Error updating player gifts:', inventoryError)
          // Continue with other gifts even if one fails
        }
      }
      
      // Reload player inventory
      await loadPlayerInventory(playerId)
      
      return participant
    } catch (err) {
      console.error('Error joining game with gifts:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to join game: ${errorMessage}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [loadPlayerInventory])

  // Load game participants
  const loadGameParticipants = useCallback(async (gameId: string) => {
    try {
      console.log('Loading participants for game:', gameId)
      
      const { data: participants, error } = await supabase
        .from('game_participants')
        .select(`
          *,
          players (
            id,
            username,
            first_name,
            last_name,
            photo_url,
            is_premium
          ),
          game_participant_gifts (
            quantity,
            gifts (
              emoji,
              name,
              base_value
            )
          )
        `)
        .eq('game_id', gameId)
        .order('position_index')
      
      if (error) {
        console.error('Error loading game participants:', error)
        return []
      }
      
      console.log('Loaded participants:', participants)
      
      // Transform to match the Player interface
      const transformedPlayers = (participants || []).map((participant: any) => {
        // Build gifts array from game_participant_gifts
        const gifts: string[] = []
        if (participant.game_participant_gifts) {
          participant.game_participant_gifts.forEach((giftEntry: any) => {
            const emoji = giftEntry.gifts?.emoji || '🎁'
            for (let i = 0; i < giftEntry.quantity; i++) {
              gifts.push(emoji)
            }
          })
        }
        
        return {
          id: participant.id,
          name: participant.players?.username || participant.players?.first_name || 'Unknown',
          balance: participant.balance || 0,
          color: participant.color,
          gifts: gifts,
          giftValue: participant.gift_value || 0,
          telegramUser: participant.players ? {
            id: participant.players.id,
            first_name: participant.players.first_name,
            last_name: participant.players.last_name,
            username: participant.players.username,
            photo_url: participant.players.photo_url,
            is_premium: participant.players.is_premium
          } : undefined
        }
      })
      
      setDbPlayers(transformedPlayers)
      return transformedPlayers
    } catch (err) {
      console.error('Error loading game participants:', err)
      return []
    }
  }, [])
  const completeGame = useCallback(async (
    gameId: string,
    winnerId: string,
    winnerChance: number,
    totalGiftValue: number
  ) => {
    try {
      setLoading(true)
      
      // Update game status to completed
      const { data: completedGame, error } = await dbHelpers.updateGameStatus(
        gameId,
        'completed',
        {
          winner_id: winnerId,
          winner_chance: winnerChance,
          total_gift_value: totalGiftValue,
          completed_at: new Date().toISOString()
        }
      )
      
      if (error) {
        console.error('Error completing game:', error)
        setError('Failed to complete game')
        return null
      }
      
      // Award gifts to winner
      // This would typically involve adding gifts to winner's inventory
      // For now, we'll just log it
      await dbHelpers.addGameLog(
        gameId,
        winnerId,
        'winner',
        `Won ${totalGiftValue.toFixed(3)} TON in gifts!`
      )
      
      return completedGame
    } catch (err) {
      console.error('Error completing game:', err)
      setError('Failed to complete game')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Add game log
  const addGameLog = useCallback(async (
    gameId: string,
    playerId: string | null,
    logType: 'join' | 'spin' | 'winner' | 'info',
    message: string
  ) => {
    try {
      await dbHelpers.addGameLog(gameId, playerId, logType, message)
    } catch (err) {
      console.error('Error adding game log:', err)
    }
  }, [])

  // Load game logs
  const loadGameLogs = useCallback(async (gameId: string) => {
    try {
      const { data: logs, error } = await dbHelpers.getGameLogs(gameId)
      
      if (error) {
        console.error('Error loading game logs:', error)
        return
      }
      
      const formattedLogs: GameLog[] = (logs || []).map(log => ({
        id: log.id,
        message: log.message,
        timestamp: new Date(log.created_at),
        type: log.log_type as any
      }))
      
      setDbGameLogs(formattedLogs)
    } catch (err) {
      console.error('Error loading game logs:', err)
    }
  }, [])

  // Load match history
  const loadMatchHistory = useCallback(async () => {
    try {
      const { data: history, error } = await dbHelpers.getMatchHistory()
      
      if (error) {
        console.error('Error loading match history:', error)
        return
      }
      
      // Transform database format to component format
      const formattedHistory: MatchHistoryEntry[] = (history || []).map(game => ({
        id: game.id,
        rollNumber: game.roll_number,
        timestamp: new Date(game.completed_at || game.created_at),
        players: game.game_participants?.map((p: any) => ({
          id: p.player_id,
          name: p.players?.username || p.players?.first_name || 'Unknown',
          balance: p.balance,
          color: p.color,
          gifts: [], // Would need to load from game_participant_gifts
          giftValue: p.gift_value,
          telegramUser: undefined
        })) || [],
        winner: {
          id: game.winner_id || '',
          name: game.players?.username || game.players?.first_name || 'Unknown',
          balance: 0,
          color: '#000000',
          gifts: [],
          giftValue: 0,
          telegramUser: undefined
        },
        totalPot: game.total_gift_value || 0,
        winnerChance: game.winner_chance || 0
      }))
      
      setDbMatchHistory(formattedHistory)
    } catch (err) {
      console.error('Error loading match history:', err)
    }
  }, [])

  // Error handling and retry utilities
  const INITIAL_RETRY_DELAY = 1000 // 1 second
  const MAX_RETRY_DELAY = 10000 // 10 seconds
  const MAX_RETRIES = 5

  const withRetry = async (operation: () => Promise<any>, context: string) => {
    let retryCount = 0
    let delay = INITIAL_RETRY_DELAY

    while (retryCount < MAX_RETRIES) {
      try {
        return await operation()
      } catch (err) {
        console.error(`Error in ${context} (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err)
        retryCount++
        
        if (retryCount === MAX_RETRIES) {
          throw new Error(`Failed ${context} after ${MAX_RETRIES} attempts`)
        }

        await new Promise(resolve => setTimeout(resolve, delay))
        delay = Math.min(delay * 2, MAX_RETRY_DELAY)
      }
    }
  }

  // Enhanced subscription setup with state management
  const setupSubscriptions = async () => {
    await withRetry(async () => {
      // Clean up existing subscriptions
      if (globalSubscription) {
        await supabase.removeChannel(globalSubscription)
      }
      if (gameSubscription) {
        await supabase.removeChannel(gameSubscription)
      }

      // Global subscription for all waiting games
      const newGlobalSub = supabase
        .channel('global_games')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'games' },
          async (payload) => {
            console.log('Global game state changed:', payload)
            await withRetry(async () => {
              const freshGames = await getFreshGames()
              if (freshGames?.length > 0) {
                const latestGame = freshGames[0]
                console.log('Refreshing to latest game:', latestGame.id)
                setCurrentGameId(latestGame.id)
                await loadGameParticipants(latestGame.id)
              }
            }, 'refresh game state')
          }
        )
        .subscribe()

      setGlobalSubscription(newGlobalSub)

      // Set up participant subscription if we have a current game
      if (currentGameId) {
        const newGameSub = await setupParticipantSubscription(currentGameId)
        setGameSubscription(newGameSub)
      }

      // Cleanup function
      return () => {
        console.log('Cleaning up subscriptions')
        if (globalSubscription) {
          supabase.removeChannel(globalSubscription)
        }
        if (gameSubscription) {
          supabase.removeChannel(gameSubscription)
        }
        setGlobalSubscription(null)
        setGameSubscription(null)
      }
    }, 'subscription setup')
  }

  // Cache management
  const cache = new Map<string, { data: any; timestamp: number }>()
  const CACHE_TTL = 5000 // 5 seconds

  const withCache = async (key: string, operation: () => Promise<any>) => {
    const now = Date.now()
    const cached = cache.get(key)
    
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    const data = await operation()
    cache.set(key, { data, timestamp: now })
    return data
  }

  // Initialize data on mount
  useEffect(() => {
    let mounted = true;
    const initTimeout = setTimeout(() => {
      if (mounted && !error) {
        setError('Database connection timed out. Please refresh the page.');
        setLoading(false);
      }
    }, 15000); // 15 second timeout

    // Dummy Supabase initialization function (replace with real logic if needed)
    const initializeSupabase = async (): Promise<boolean> => {
      // If you have custom initialization logic, add it here.
      // For now, just check if supabase is defined.
      if (supabase) return true;
      return false;
    };

    const initializeData = async () => {
      try {
        if (!mounted) return;
        
        console.log('🎮 Initializing PvP Wheel database...');
        setLoading(true);
        
        // Initialize Supabase first
        const initialized = await initializeSupabase();
        if (!initialized) {
          throw new Error('Failed to initialize database connection');
        }
        
        if (!mounted) return;
        
        console.log('✅ Database connected, loading game data...');
        
        // Load initial data in parallel
        await Promise.all([
          loadAvailableGifts().catch(err => {
            console.error('Failed to load gifts:', err);
            return null;
          }),
          loadMatchHistory().catch(err => {
            console.error('Failed to load match history:', err);
            return null;
          })
        ]);
        
        if (!mounted) return;
        
        console.log('✅ Game data loaded successfully');
        clearTimeout(initTimeout);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        
        console.error('❌ Error during data initialization:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to initialize application data: ${errorMessage}`);
        setLoading(false);
      }
    };

    initializeData();
    
    return () => {
      mounted = false;
      clearTimeout(initTimeout);
    };
  }, [loadAvailableGifts, loadMatchHistory])

  // Load player inventory when current player changes
  useEffect(() => {
    if (currentPlayer?.id) {
      loadPlayerInventory(currentPlayer.id)
    }
  }, [currentPlayer, loadPlayerInventory])

  // Load game logs when current game changes
  useEffect(() => {
    if (currentGameId) {
      loadGameLogs(currentGameId)
    }
  }, [currentGameId, loadGameLogs])

  // Real-time subscriptions and polling setup
  useEffect(() => {
    console.log('Setting up real-time subscriptions and polling...')
    let retryCount = 0
    const MAX_RETRIES = 5
    const RETRY_DELAY = 2000 // 2 seconds
    const POLL_INTERVAL = 3000 // 3 seconds
    let pollInterval: NodeJS.Timeout | null = null

    const pollForUpdates = async () => {
      try {
        const freshGames = await getFreshGames()
        if (freshGames?.length > 0) {
          const latestGame = freshGames[0]
          if (latestGame.id !== currentGameId) {
            console.log('Poll detected new game:', latestGame.id)
            setCurrentGameId(latestGame.id)
            await loadGameParticipants(latestGame.id)
          } else if (currentGameId) {
            // Even if game ID hasn't changed, refresh participants
            await loadGameParticipants(currentGameId)
          }
        }
      } catch (err) {
        console.error('Error in polling update:', err)
      }
    }

    const setupSubscriptions = async () => {
      try {
        // Global subscription for all waiting games
        const globalGameSubscription = supabase
          .channel('global_games')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'games'
            },
            async (payload) => {
              console.log('Global game state changed:', payload)
              try {
                // Force immediate refresh regardless of change type
                const freshGames = await getFreshGames()
                if (freshGames?.length > 0) {
                  const latestGame = freshGames[0]
                  console.log('Refreshing to latest game:', latestGame.id)
                  setCurrentGameId(latestGame.id)
                  await loadGameParticipants(latestGame.id)
                }
              } catch (err) {
                console.error('Error handling game state change:', err)
                if (retryCount < MAX_RETRIES) {
                  retryCount++
                  setTimeout(setupSubscriptions, RETRY_DELAY)
                }
              }
            }
          )
          .subscribe((status) => {
            console.log('Global game subscription status:', status)
            if (status === 'SUBSCRIBED') {
              retryCount = 0
              // Start polling when subscription is active
              if (!pollInterval) {
                pollInterval = setInterval(pollForUpdates, POLL_INTERVAL)
              }
            } else if (status === 'CHANNEL_ERROR' && retryCount < MAX_RETRIES) {
              retryCount++
              setTimeout(setupSubscriptions, RETRY_DELAY)
            }
          })

        // Enhanced game-specific subscription
        let gameSubscription: any = null
        if (currentGameId) {
          gameSubscription = supabase
            .channel(`game_${currentGameId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${currentGameId}`
              },
              async (payload) => {
                console.log('Game state changed:', payload)
                // Force immediate refresh of game state
                const freshGames = await getFreshGames()
                const currentGame = freshGames.find(g => g.id === currentGameId)
                if (currentGame) {
                  await loadGameParticipants(currentGame.id)
                  
                  // Check for countdown updates
                  const { timeLeft } = await dbHelpers.getGameCountdown(currentGame.id)
                  if (timeLeft !== null) {
                    console.log('Real-time countdown update:', timeLeft, 'seconds remaining')
                    setGameCountdown(timeLeft)
                  }
                }
              }
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'game_participants',
                filter: `game_id=eq.${currentGameId}`
              },
              async () => {
                // Immediate participant reload
                await loadGameParticipants(currentGameId)
              }
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'game_logs',
                filter: `game_id=eq.${currentGameId}`
              },
              async () => {
                await loadGameLogs(currentGameId)
              }
            )
            .subscribe((status) => {
              console.log('Game-specific subscription status:', status)
              if (status === 'CHANNEL_ERROR') {
                // Attempt immediate reconnection
                gameSubscription?.unsubscribe()
                setupSubscriptions()
              }
            })
        }

        return () => {
          console.log('Cleaning up real-time subscriptions and polling')
          if (pollInterval) {
            clearInterval(pollInterval)
          }
          supabase.removeChannel(globalGameSubscription)
          if (gameSubscription) {
            supabase.removeChannel(gameSubscription)
          }
        }
      } catch (err) {
        console.error('Error in subscription setup:', err)
        if (retryCount < MAX_RETRIES) {
          retryCount++
          setTimeout(setupSubscriptions, RETRY_DELAY * retryCount)
        }
      }
    }

    // Initial setup
    setupSubscriptions()
  }, [currentGameId, loadGameLogs, loadGameParticipants, getCurrentGame, getFreshGames])

  // Countdown management
  const startGameCountdown = useCallback(async (gameId: string) => {
    try {
      console.log('Starting countdown for game:', gameId)
      const { data, error } = await dbHelpers.startGameCountdown(gameId, 60)
      
      if (error) {
        console.error('Error starting countdown:', error)
        return false
      }
      
      console.log('Countdown started successfully')
      return true
    } catch (err) {
      console.error('Error starting countdown:', err)
      return false
    }
  }, [])

  const getGameCountdown = useCallback(async (gameId: string) => {
    try {
      const { timeLeft, error } = await dbHelpers.getGameCountdown(gameId)
      
      if (error) {
        console.error('Error getting countdown:', error)
        return null
      }
      
      setGameCountdown(timeLeft)
      return timeLeft
    } catch (err) {
      console.error('Error getting countdown:', err)
      return null
    }
  }, [])

  // Auto-start countdown when game reaches 2 players
  useEffect(() => {
    if (currentGameId && dbPlayers.length === 2) {
      // Check if countdown is already running
      const checkAndStartCountdown = async () => {
        const { timeLeft } = await dbHelpers.getGameCountdown(currentGameId)
        if (timeLeft === null || timeLeft <= 0) {
          console.log('Game has 2 players, starting countdown...')
          startGameCountdown(currentGameId)
        } else {
          console.log('Game has 2 players, countdown already running:', timeLeft, 'seconds remaining')
          setGameCountdown(timeLeft)
        }
      }
      
      checkAndStartCountdown()
    }
  }, [currentGameId, dbPlayers.length, startGameCountdown])

  // Initialize countdown on component mount if game already has countdown
  useEffect(() => {
    if (currentGameId && gameCountdown === null) {
      const initializeCountdown = async () => {
        const { timeLeft } = await dbHelpers.getGameCountdown(currentGameId)
        if (timeLeft !== null && timeLeft > 0) {
          console.log('Initializing countdown on mount:', timeLeft, 'seconds remaining')
          setGameCountdown(timeLeft)
        }
      }
      
      initializeCountdown()
    }
  }, [currentGameId, gameCountdown])

  // Countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (currentGameId) {
      // Initial countdown check
      const checkCountdown = async () => {
        const timeLeft = await getGameCountdown(currentGameId)
        if (timeLeft !== null) {
          setGameCountdown(timeLeft)
          if (timeLeft <= 0) {
            console.log('Countdown reached zero, should trigger spin')
          }
        }
      }
      
      // Check immediately
      checkCountdown()
      
      // Update countdown every second
      interval = setInterval(async () => {
        const timeLeft = await getGameCountdown(currentGameId)
        if (timeLeft !== null) {
          setGameCountdown(timeLeft)
          if (timeLeft <= 0) {
            console.log('Countdown reached zero, should trigger spin')
            // Stop the interval once countdown reaches 0
            if (interval) {
              clearInterval(interval)
              interval = null
            }
          }
        }
      }, 1000)
    } else {
      // Reset countdown when no game
      setGameCountdown(null)
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [currentGameId, getGameCountdown])

  return {
    // State
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

    // Actions
    initializePlayer,
    getCurrentGame: getCurrentGameData,
    joinGameWithGifts,
    completeGame,
    addGameLog,
    loadGameLogs,
    loadMatchHistory,
    loadPlayerInventory,
    loadAvailableGifts,
    loadGameParticipants,
    startGameCountdown,
    getGameCountdown,

    // Utilities
    clearError: () => setError(null)
  }
}

export default useGameDatabase
