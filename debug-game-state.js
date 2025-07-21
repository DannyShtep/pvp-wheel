const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugGameState() {
  console.log('🔍 Debugging game state and visibility...\n')

  try {
    // 1. Check all games
    console.log('1. Checking all games...')
    const { data: allGames, error: allGamesError } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (allGamesError) {
      console.error('❌ Error fetching games:', allGamesError)
      return
    }

    console.log(`Found ${allGames?.length || 0} recent games:`)
    allGames?.forEach((game, index) => {
      console.log(`   ${index + 1}. Game ${game.id.slice(0, 8)}... (Roll: ${game.roll_number}, Status: ${game.status}, Created: ${new Date(game.created_at).toLocaleString()})`)
    })

    // 2. Check waiting games specifically
    console.log('\n2. Checking waiting games...')
    const { data: waitingGames, error: waitingError } = await supabase
      .from('games')
      .select(`
        *,
        game_participants (
          *,
          players (username, first_name)
        )
      `)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })

    if (waitingError) {
      console.error('❌ Error fetching waiting games:', waitingError)
      return
    }

    if (waitingGames && waitingGames.length > 0) {
      console.log(`✅ Found ${waitingGames.length} waiting game(s):`)
      waitingGames.forEach((game, index) => {
        console.log(`\n   Game ${index + 1}:`)
        console.log(`   - ID: ${game.id}`)
        console.log(`   - Roll Number: ${game.roll_number}`)
        console.log(`   - Created: ${new Date(game.created_at).toLocaleString()}`)
        console.log(`   - Participants: ${game.game_participants?.length || 0}`)
        
        if (game.game_participants && game.game_participants.length > 0) {
          console.log('   - Players:')
          game.game_participants.forEach((participant, pIndex) => {
            const playerName = participant.players?.username || participant.players?.first_name || 'Unknown'
            console.log(`     ${pIndex + 1}. ${playerName} (Balance: ${participant.balance || 0}, Color: ${participant.color})`)
          })
        }
      })

      // Check if there are multiple waiting games (this is a problem)
      if (waitingGames.length > 1) {
        console.log(`\n⚠️  WARNING: Found ${waitingGames.length} waiting games. There should only be 1.`)
        console.log('   This can cause users to join different games.')
        console.log('   Run the cleanup script to fix this.')
      }
    } else {
      console.log('ℹ️  No waiting games found')
    }

    // 3. Check recent players
    console.log('\n3. Checking recent players...')
    const { data: recentPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (playersError) {
      console.error('❌ Error fetching players:', playersError)
    } else {
      console.log(`Found ${recentPlayers?.length || 0} recent players:`)
      recentPlayers?.forEach((player, index) => {
        console.log(`   ${index + 1}. ${player.username || player.first_name || 'Unknown'} (ID: ${player.id.slice(0, 8)}..., Games: ${player.total_games_played})`)
      })
    }

    // 4. Check for real-time capability
    console.log('\n4. Testing real-time capability...')
    const channel = supabase
      .channel('debug_test')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, (payload) => {
        console.log('📡 Real-time test received:', payload.eventType)
      })
      .subscribe((status) => {
        console.log(`📡 Real-time subscription: ${status}`)
      })

    // Wait a moment then cleanup
    setTimeout(() => {
      supabase.removeChannel(channel)
      console.log('\n✅ Debug complete! Check the output above for issues.')
      process.exit(0)
    }, 2000)

  } catch (error) {
    console.error('❌ Debug failed:', error)
    process.exit(1)
  }
}

// Also provide cleanup function
async function cleanupMultipleGames() {
  console.log('🧹 Cleaning up multiple waiting games...\n')

  try {
    // Get all waiting games
    const { data: waitingGames, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('❌ Error fetching waiting games:', fetchError)
      return
    }

    if (!waitingGames || waitingGames.length <= 1) {
      console.log('✅ No cleanup needed - found 0 or 1 waiting games')
      return
    }

    // Keep the most recent game, cancel the rest
    const keepGame = waitingGames[0]
    const cancelGames = waitingGames.slice(1)

    console.log(`Keeping game: ${keepGame.id} (Roll: ${keepGame.roll_number})`)
    console.log(`Cancelling ${cancelGames.length} older games...`)

    for (const game of cancelGames) {
      const { error: updateError } = await supabase
        .from('games')
        .update({ status: 'cancelled' })
        .eq('id', game.id)

      if (updateError) {
        console.error(`❌ Error cancelling game ${game.id}:`, updateError)
      } else {
        console.log(`✅ Cancelled game ${game.id.slice(0, 8)}... (Roll: ${game.roll_number})`)
      }
    }

    console.log('\n✅ Cleanup complete!')
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
  }
}

// Run based on command line argument
const command = process.argv[2]
if (command === 'cleanup') {
  cleanupMultipleGames()
} else {
  debugGameState()
}
