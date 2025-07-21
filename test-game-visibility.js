const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testGameVisibility() {
  console.log('🔍 Testing game visibility between users...\n')

  try {
    // 1. Check if there's a current waiting game
    console.log('1. Checking for current waiting game...')
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
      console.log('✅ Found current waiting game:')
      console.log(`   - Game ID: ${game.id}`)
      console.log(`   - Roll Number: ${game.roll_number}`)
      console.log(`   - Status: ${game.status}`)
      console.log(`   - Created: ${new Date(game.created_at).toLocaleString()}`)
      console.log(`   - Participants: ${game.game_participants?.length || 0}`)
      
      if (game.game_participants && game.game_participants.length > 0) {
        console.log('\n   Participants:')
        game.game_participants.forEach((participant, index) => {
          console.log(`   ${index + 1}. ${participant.players?.username || participant.players?.first_name || 'Unknown'} (Balance: ${participant.balance || 0}, Color: ${participant.color})`)
        })
      }
    } else {
      console.log('ℹ️ No current waiting game found')
    }

    // 2. Test creating a new game
    console.log('\n2. Testing game creation...')
    const rollNumber = Math.floor(Math.random() * 10000) + 1000
    const { data: newGame, error: createError } = await supabase
      .from('games')
      .insert({
        roll_number: rollNumber,
        status: 'waiting'
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Error creating new game:', createError)
    } else {
      console.log('✅ Created new game:')
      console.log(`   - Game ID: ${newGame.id}`)
      console.log(`   - Roll Number: ${newGame.roll_number}`)
      console.log(`   - Status: ${newGame.status}`)
    }

    // 3. Test that the new game is now the current game
    console.log('\n3. Verifying new game is visible...')
    const { data: verifyGame, error: verifyError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)

    if (verifyError) {
      console.error('❌ Error verifying game:', verifyError)
    } else if (verifyGame && verifyGame.length > 0) {
      console.log('✅ Current waiting game is now:')
      console.log(`   - Game ID: ${verifyGame[0].id}`)
      console.log(`   - Roll Number: ${verifyGame[0].roll_number}`)
      console.log(`   - Status: ${verifyGame[0].status}`)
      
      if (newGame && verifyGame[0].id === newGame.id) {
        console.log('✅ Game visibility test PASSED - New game is visible')
      } else {
        console.log('❌ Game visibility test FAILED - New game is not the current game')
      }
    }

    // 4. Test real-time subscription setup
    console.log('\n4. Testing real-time subscription...')
    const gameId = verifyGame && verifyGame[0] ? verifyGame[0].id : null
    
    if (gameId) {
      console.log(`   Setting up real-time subscription for game: ${gameId}`)
      
      const channel = supabase
        .channel(`test_game_${gameId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_participants',
            filter: `game_id=eq.${gameId}`
          },
          (payload) => {
            console.log('📡 Real-time update received:', payload)
          }
        )
        .subscribe((status) => {
          console.log(`📡 Real-time subscription status: ${status}`)
        })

      // Wait a moment to establish connection
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Test the subscription by inserting a test participant
      console.log('   Testing real-time updates...')
      // Note: This would require a valid player ID, so we'll just show the setup works
      
      setTimeout(() => {
        console.log('   Real-time subscription test setup complete')
        supabase.removeChannel(channel)
        process.exit(0)
      }, 2000)
    } else {
      console.log('❌ No game ID available for real-time test')
      process.exit(0)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testGameVisibility()
