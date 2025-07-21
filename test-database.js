/**
 * Database Test Script
 * Run this to test your Supabase database connection
 * Usage: node test-database.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testDatabase() {
  console.log('🔍 Testing Supabase Database Connection...\n');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Environment variables not found!');
    console.log('Please check your .env.local file:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return;
  }
  
  console.log('✅ Environment variables found');
  console.log('📡 Supabase URL:', supabaseUrl);
  console.log('🔑 API Key:', supabaseKey.substring(0, 20) + '...\n');
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: Basic connection
    console.log('🧪 Test 1: Basic Connection');
    const { data, error } = await supabase.from('players').select('count');
    
    if (error) {
      console.error('❌ Basic connection failed:', error.message);
      console.error('Error details:', error);
      
      if (error.message.includes('relation "players" does not exist')) {
        console.log('\n💡 Solution: The database tables haven\'t been created yet!');
        console.log('1. Go to your Supabase project dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Copy and paste the contents of supabase-schema.sql');
        console.log('4. Run the script to create all tables');
      }
      return;
    }
    
    console.log('✅ Basic connection successful\n');
    
    // Test 2: Check table structure
    console.log('🧪 Test 2: Table Structure');
    const tables = ['players', 'games', 'gifts', 'game_participants', 'player_gifts', 'game_logs'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.error(`❌ Table "${table}" error:`, error.message);
        } else {
          console.log(`✅ Table "${table}" exists`);
        }
      } catch (err) {
        console.error(`❌ Table "${table}" error:`, err.message);
      }
    }
    
    console.log('\n🧪 Test 3: Test Player Creation');
    
    // Test 3: Create a test player
    const testPlayer = {
      telegram_id: 123456789,
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      photo_url: null,
      is_premium: false,
      language_code: 'en'
    };
    
    // First, try to delete any existing test player
    await supabase.from('players').delete().eq('telegram_id', testPlayer.telegram_id);
    
    // Now create the test player
    const { data: newPlayer, error: createError } = await supabase
      .from('players')
      .insert(testPlayer)
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Player creation failed:', createError.message);
      console.error('Error details:', createError);
    } else {
      console.log('✅ Player creation successful');
      console.log('Player data:', newPlayer);
      
      // Clean up test player
      await supabase.from('players').delete().eq('id', newPlayer.id);
      console.log('✅ Test player cleaned up');
    }
    
    console.log('\n🧪 Test 4: Gifts Table');
    
    // Test 4: Check gifts
    const { data: gifts, error: giftsError } = await supabase
      .from('gifts')
      .select('*')
      .limit(3);
    
    if (giftsError) {
      console.error('❌ Gifts query failed:', giftsError.message);
    } else {
      console.log('✅ Gifts query successful');
      console.log('Sample gifts:', gifts);
    }
    
    console.log('\n🎉 All tests completed!');
    console.log('Your Supabase database is configured correctly.');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    console.error('Full error:', err);
  }
}

// Run the test
testDatabase().catch(console.error);
