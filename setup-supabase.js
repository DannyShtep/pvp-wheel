#!/usr/bin/env node

/**
 * Supabase Setup Script
 * This script helps set up the Supabase integration for the PvP Wheel webapp
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 PvP Wheel - Supabase Setup');
console.log('================================\n');

// Check if environment file exists
const envPath = path.join(process.cwd(), '.env.local');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📋 Copying .env.example to .env.local...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Environment file created!\n');
  } else {
    console.log('❌ .env.example file not found!\n');
    process.exit(1);
  }
} else {
  console.log('✅ .env.local file already exists!\n');
}

console.log('🔧 Setup Instructions:');
console.log('======================');
console.log('1. Create a Supabase project at https://supabase.com');
console.log('2. Go to Project Settings > API');
console.log('3. Copy your project URL and anon key');
console.log('4. Update the values in .env.local:');
console.log('   - NEXT_PUBLIC_SUPABASE_URL');
console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
console.log('5. Run the SQL schema in your Supabase SQL Editor:');
console.log('   - Copy contents of supabase-schema.sql');
console.log('   - Paste and run in Supabase SQL Editor');
console.log('6. Start the development server: npm run dev\n');

console.log('📚 Documentation:');
console.log('==================');
console.log('- Full integration guide: SUPABASE_INTEGRATION.md');
console.log('- Database schema: supabase-schema.sql');
console.log('- Environment template: .env.example\n');

console.log('🚀 Ready to go! Your PvP Wheel is now connected to Supabase!');
console.log('   Visit http://localhost:3000 to test the integration.\n');

// Check if required packages are installed
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const hasSupabase = packageJson.dependencies['@supabase/supabase-js'];
  
  if (!hasSupabase) {
    console.log('⚠️  WARNING: @supabase/supabase-js not found in dependencies!');
    console.log('   Run: npm install @supabase/supabase-js');
  } else {
    console.log('✅ Supabase package found in dependencies');
  }
}

console.log('\n🎮 Happy gaming!');
