const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGiftsLoading() {
  console.log('🎁 Testing gifts loading in game participants...');
  
  try {
    // Check if there are any current games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting');
    
    if (gamesError) {
      console.error('❌ Error loading games:', gamesError);
      return;
    }
    
    console.log(`📊 Found ${games.length} waiting games`);
    
    if (games.length === 0) {
      console.log('ℹ️ No waiting games found. Creating test data...');
      
      // Create a test player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          telegram_id: 123456789,
          username: 'testgifts',
          first_name: 'Test',
          last_name: 'Gifts'
        })
        .select()
        .single();
      
      if (playerError) {
        console.error('❌ Error creating test player:', playerError);
        return;
      }
      
      console.log('✅ Created test player:', player.id);
      
      // Create a test game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          roll_number: 9999,
          status: 'waiting'
        })
        .select()
        .single();
      
      if (gameError) {
        console.error('❌ Error creating test game:', gameError);
        return;
      }
      
      console.log('✅ Created test game:', game.id);
      
      // Create a test participant
      const { data: participant, error: participantError } = await supabase
        .from('game_participants')
        .insert({
          game_id: game.id,
          player_id: player.id,
          balance: 0,
          gift_value: 0.7,
          color: '#FF6B6B',
          position_index: 0
        })
        .select()
        .single();
      
      if (participantError) {
        console.error('❌ Error creating test participant:', participantError);
        return;
      }
      
      console.log('✅ Created test participant:', participant.id);
      
      // Get available gifts
      const { data: gifts, error: giftsError } = await supabase
        .from('gifts')
        .select('*')
        .limit(3);
      
      if (giftsError) {
        console.error('❌ Error loading gifts:', giftsError);
        return;
      }
      
      console.log('✅ Found', gifts.length, 'gifts');
      
      // Add some test gifts to the participant
      for (let i = 0; i < gifts.length; i++) {
        const gift = gifts[i];
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 gifts
        
        const { error: giftError } = await supabase
          .from('game_participant_gifts')
          .insert({
            game_participant_id: participant.id,
            gift_id: gift.id,
            quantity: quantity,
            value_per_gift: gift.base_value,
            total_value: gift.base_value * quantity
          });
        
        if (giftError) {
          console.error('❌ Error adding gift:', giftError);
        } else {
          console.log(`✅ Added ${quantity}x ${gift.emoji} ${gift.name}`);
        }
      }
      
      console.log('✅ Test data created successfully!');
    }
    
    // Now test the getCurrentGame query with gifts
    console.log('🔍 Testing getCurrentGame query with gifts...');
    
    const { data: currentGame, error: currentError } = await supabase
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
      .limit(1);
    
    if (currentError) {
      console.error('❌ Error loading current game:', currentError);
      return;
    }
    
    const game = currentGame?.[0];
    if (!game) {
      console.log('❌ No current game found');
      return;
    }
    
    console.log('✅ Current game found:', game.roll_number);
    console.log('👥 Participants:', game.game_participants?.length || 0);
    
    if (game.game_participants) {
      game.game_participants.forEach((participant, index) => {
        console.log(`\n🎮 Participant ${index + 1}:`);
        console.log(`   Name: ${participant.players?.username || participant.players?.first_name || 'Unknown'}`);
        console.log(`   Gift Value: ${participant.gift_value} TON`);
        console.log(`   Color: ${participant.color}`);
        
        if (participant.game_participant_gifts && participant.game_participant_gifts.length > 0) {
          console.log('   Gifts:');
          participant.game_participant_gifts.forEach((giftEntry) => {
            const emoji = giftEntry.gifts?.emoji || '🎁';
            const name = giftEntry.gifts?.name || 'Unknown';
            const quantity = giftEntry.quantity;
            console.log(`     ${quantity}x ${emoji} ${name}`);
          });
          
          // Build the gifts array as the app would
          const gifts = [];
          participant.game_participant_gifts.forEach((giftEntry) => {
            const emoji = giftEntry.gifts?.emoji || '🎁';
            for (let i = 0; i < giftEntry.quantity; i++) {
              gifts.push(emoji);
            }
          });
          console.log(`   Gifts Array: [${gifts.join(', ')}]`);
        } else {
          console.log('   ⚠️ No gifts found for this participant');
        }
      });
    }
    
    console.log('\n🎉 Gifts loading test completed!');
    
  } catch (error) {
    console.error('❌ Error testing gifts loading:', error);
  }
}

testGiftsLoading().then(() => {
  console.log('✅ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
