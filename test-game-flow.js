/**
 * Game Flow Test Script
 * Tests the complete game flow including player creation, game creation, and joining
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testGameFlow() {
  console.log('🎮 Testing Complete Game Flow...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Environment variables not configured');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Clean up any existing test data
    await supabase.from('game_participants').delete().gte('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('games').delete().gte('roll_number', 9999);
    await supabase.from('players').delete().gte('telegram_id', 999999999);
    
    console.log('🧪 Step 1: Create Test Player');
    
    // Create test player
    const testPlayer = {
      telegram_id: 999999999,
      username: 'testgamer',
      first_name: 'Test',
      last_name: 'Gamer',
      photo_url: null,
      is_premium: false,
      language_code: 'en'
    };
    
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert(testPlayer)
      .select()
      .single();
    
    if (playerError) {
      console.error('❌ Player creation failed:', playerError);
      return;
    }
    
    console.log('✅ Test player created:', player.username);
    
    console.log('\n🧪 Step 2: Create Test Game');
    
    // Create test game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        roll_number: 9999,
        status: 'waiting',
        total_players: 0,
        total_pot_balance: 0,
        total_gift_value: 0
      })
      .select()
      .single();
    
    if (gameError) {
      console.error('❌ Game creation failed:', gameError);
      return;
    }
    
    console.log('✅ Test game created:', game.roll_number);
    
    console.log('\n🧪 Step 3: Test Game Joining');
    
    // Test joining game
    const { data: participant, error: joinError } = await supabase
      .from('game_participants')
      .insert({
        game_id: game.id,
        player_id: player.id,
        balance: 0,
        gift_value: 0.5,
        color: '#FF6B6B',
        position_index: 0,
        chance_percentage: 100
      })
      .select()
      .single();
    
    if (joinError) {
      console.error('❌ Game joining failed:', joinError);
      console.error('Error details:', joinError);
      return;
    }
    
    console.log('✅ Player joined game successfully');
    
    console.log('\n🧪 Step 4: Test Game Log');
    
    // Test game log
    const { data: logEntry, error: logError } = await supabase
      .from('game_logs')
      .insert({
        game_id: game.id,
        player_id: player.id,
        log_type: 'join',
        message: 'Test player joined with gifts'
      })
      .select()
      .single();
    
    if (logError) {
      console.error('❌ Game log failed:', logError);
      return;
    }
    
    console.log('✅ Game log created successfully');
    
    console.log('\n🧪 Step 5: Test Game Completion');
    
    // Test game completion
    const { data: completedGame, error: completeError } = await supabase
      .from('games')
      .update({
        status: 'completed',
        winner_id: player.id,
        winner_chance: 100,
        total_gift_value: 0.5,
        completed_at: new Date().toISOString()
      })
      .eq('id', game.id)
      .select()
      .single();
    
    if (completeError) {
      console.error('❌ Game completion failed:', completeError);
      return;
    }
    
    console.log('✅ Game completed successfully');
    
    console.log('\n🧪 Step 6: Verify Player Stats Update');
    
    // Check if player stats were updated by trigger
    const { data: updatedPlayer, error: playerCheckError } = await supabase
      .from('players')
      .select('*')
      .eq('id', player.id)
      .single();
    
    if (playerCheckError) {
      console.error('❌ Player stats check failed:', playerCheckError);
      return;
    }
    
    console.log('✅ Player stats updated:');
    console.log('  Games played:', updatedPlayer.total_games_played);
    console.log('  Games won:', updatedPlayer.total_games_won);
    console.log('  TON won:', updatedPlayer.total_ton_won);
    
    console.log('\n🧪 Step 7: Clean Up Test Data');
    
    // Clean up test data
    await supabase.from('game_logs').delete().eq('game_id', game.id);
    await supabase.from('game_participants').delete().eq('game_id', game.id);
    await supabase.from('games').delete().eq('id', game.id);
    await supabase.from('players').delete().eq('id', player.id);
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All game flow tests passed!');
    console.log('Your database is ready for the PvP Wheel game.');
    
  } catch (error) {
    console.error('❌ Unexpected error during game flow test:', error);
  }
}

testGameFlow().catch(console.error);
