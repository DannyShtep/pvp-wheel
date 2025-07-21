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

async function updateGameSchema() {
  console.log('🔄 Updating games table schema to add countdown timer...');
  
  try {
    // Add countdown_ends_at column to games table
    const { error } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE games 
        ADD COLUMN IF NOT EXISTS countdown_ends_at TIMESTAMP WITH TIME ZONE;
      `
    });
    
    if (error) {
      console.error('❌ Error updating schema:', error);
      
      // Try alternative approach using direct SQL
      console.log('🔄 Trying direct SQL approach...');
      
      const { error: directError } = await supabase
        .from('games')
        .select('countdown_ends_at')
        .limit(1);
      
      if (directError && directError.code === '42703') {
        console.log('✅ Column does not exist, this is expected. Schema needs to be updated manually.');
        console.log('📝 Please run this SQL in your Supabase SQL Editor:');
        console.log('   ALTER TABLE games ADD COLUMN countdown_ends_at TIMESTAMP WITH TIME ZONE;');
        return false;
      } else if (!directError) {
        console.log('✅ Column already exists');
        return true;
      }
    } else {
      console.log('✅ Schema updated successfully');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    return false;
  }
}

updateGameSchema().then((success) => {
  if (success) {
    console.log('🎉 Schema update completed successfully!');
  } else {
    console.log('⚠️ Schema update may need manual intervention');
  }
  process.exit(0);
}).catch(error => {
  console.error('💥 Schema update failed:', error);
  process.exit(1);
});
