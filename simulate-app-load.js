const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Simulate what the app does when it loads
async function simulateAppLoad() {
  console.log('🔄 Simulating app load process...\n')

  try {
    // 1. Simulate getCurrentGame(0) - what happens on component mount
    console.log('1. Simulating getCurrentGame(0) call (component mount)...')
    const { data: currentGame, error: fetchError } = await supabase
      .from('games')
      .select(`
        *,
        game_participants (
          *,
          players (*)
        )
      `)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('❌ Error fetching current game:', fetchError)
      return
    }

    if (currentGame && currentGame.length > 0) {
      const game = currentGame[0]
      console.log('✅ Found existing game:')
      console.log(`   - Game ID: ${game.id}`)
      console.log(`   - Roll Number: ${game.roll_number}`)
      console.log(`   - Status: ${game.status}`)
      console.log(`   - Participants: ${game.game_participants?.length || 0}`)
      
      // 2. Simulate loadGameParticipants call
      console.log('\n2. Simulating loadGameParticipants call...')
      const { data: participants, error: partError } = await supabase
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
          )
        `)
        .eq('game_id', game.id)
        .order('position_index')

      if (partError) {
        console.error('❌ Error loading participants:', partError)
      } else {
        console.log(`✅ Loaded ${participants?.length || 0} participants`)
        
        if (participants && participants.length > 0) {
          participants.forEach((participant, index) => {
            console.log(`   ${index + 1}. ${participant.players?.username || participant.players?.first_name || 'Unknown'} (Balance: ${participant.balance || 0})`)
          })
        } else {
          console.log('   No participants in this game yet')
        }
      }

      // 3. Show what the app state should be
      console.log('\n3. Expected app state:')
      console.log(`   - currentGameId: ${game.id}`)
      console.log(`   - dbPlayers: ${participants?.length || 0} players`)
      console.log(`   - activePlayers: ${participants?.length || 0} players`)
      console.log(`   - Game should be visible to users: ${game.id ? 'YES' : 'NO'}`)
      
      // 4. Simulate what happens when user tries to join
      console.log('\n4. What happens when user tries to join:')
      console.log(`   - Game ID available: ${game.id ? 'YES' : 'NO'}`)
      console.log(`   - User can join: ${game.id ? 'YES' : 'NO'}`)
      
    } else {
      console.log('❌ No current game found')
      console.log('   - currentGameId: null')
      console.log('   - dbPlayers: []')
      console.log('   - activePlayers: [] (falls back to local players)')
      console.log('   - Game should be visible to users: NO')
    }

    // 5. Check what happens with real-time subscription
    console.log('\n5. Testing real-time subscription setup...')
    if (currentGame && currentGame.length > 0) {
      const gameId = currentGame[0].id
      console.log(`   Setting up subscription for game: ${gameId}`)
      
      // Test subscription
      const channel = supabase
        .channel(`test_${gameId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_participants', filter: `game_id=eq.${gameId}` }, (payload) => {
          console.log('📡 Real-time update would trigger:', payload.eventType)
        })
        .subscribe((status) => {
          console.log(`📡 Subscription status: ${status}`)
        })

      // Wait and cleanup
      setTimeout(() => {
        supabase.removeChannel(channel)
        console.log('📡 Subscription cleaned up')
      }, 1000)
    } else {
      console.log('   No game to subscribe to')
    }

  } catch (error) {
    console.error('❌ Simulation failed:', error)
  }
}

simulateAppLoad()

// Wait for async operations
setTimeout(() => {
  console.log('\n🎯 DIAGNOSIS:')
  console.log('If users can\'t see the game, the issue is likely:')
  console.log('1. App is not loading the current game properly')
  console.log('2. Game state is not being displayed in the UI')
  console.log('3. Real-time subscriptions are not working')
  console.log('4. Environment variables are not loaded in the app')
  process.exit(0)
}, 2000)
