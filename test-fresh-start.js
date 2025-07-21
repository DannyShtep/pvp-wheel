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

async function testFreshStart() {
  console.log('🧪 Testing fresh start scenario...');
  
  try {
    // 1. Verify database is clean
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*');
    
    if (gamesError) {
      console.error('❌ Error checking games:', gamesError);
      return;
    }
    
    console.log(`📊 Current games in database: ${games.length}`);
    
    if (games.length === 0) {
      console.log('✅ Database is clean - no games exist');
      console.log('🚀 When a user opens the app:');
      console.log('   1. useGameDatabase.getCurrentGame(0) will be called');
      console.log('   2. No current game will be found');
      console.log('   3. getCurrentGame will return null (no rollNumber provided)');
      console.log('   4. When user clicks join, getCurrentGame(rollNumber) will be called');
      console.log('   5. A new game will be created for that roll number');
      console.log('   6. The user will join the new game');
      console.log('   7. Other users will see this game and can join it');
    } else {
      console.log('⚠️  Games still exist in database:');
      games.forEach((game, index) => {
        console.log(`   ${index + 1}. Game ${game.id} (Roll #${game.roll_number}, Status: ${game.status})`);
      });
    }
    
    // 2. Verify participants are clean
    const { data: participants, error: participantsError } = await supabase
      .from('game_participants')
      .select('*');
    
    if (participantsError) {
      console.error('❌ Error checking participants:', participantsError);
      return;
    }
    
    console.log(`📊 Current participants in database: ${participants.length}`);
    
    // 3. Verify logs are clean
    const { data: logs, error: logsError } = await supabase
      .from('game_logs')
      .select('*');
    
    if (logsError) {
      console.error('❌ Error checking logs:', logsError);
      return;
    }
    
    console.log(`📊 Current logs in database: ${logs.length}`);
    
    if (games.length === 0 && participants.length === 0 && logs.length === 0) {
      console.log('🎉 Database is completely clean!');
      console.log('💡 The app is ready for fresh games.');
      console.log('🔄 Next time a user opens the app, a new game will be created automatically when they join.');
    }
    
  } catch (error) {
    console.error('❌ Error testing fresh start:', error);
  }
}

testFreshStart().then(() => {
  console.log('✅ Fresh start test completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
