import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    console.log('🔍 API: Testing database connection from API route...')
    
    // Test environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    const hasUrl = !!supabaseUrl
    const hasKey = !!supabaseAnonKey
    
    console.log('🔍 API: Environment variables:', { hasUrl, hasKey })
    console.log('🔍 API: Supabase URL:', supabaseUrl?.slice(0, 50) + '...')
    
    if (!hasUrl || !hasKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        details: { hasUrl, hasKey }
      })
    }
    
    // Create a fresh Supabase client
    console.log('🔍 API: Creating Supabase client...')
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!)
    
    // Test with a simple query first
    console.log('🔍 API: Testing simple query...')
    const { data: testData, error: testError } = await supabase
      .from('games')
      .select('id, roll_number, status')
      .limit(1)
    
    if (testError) {
      console.error('🔍 API: Simple query error:', testError)
      return NextResponse.json({
        success: false,
        error: 'Simple query failed',
        details: {
          message: testError.message,
          details: testError.details,
          hint: testError.hint,
          code: testError.code
        }
      })
    }
    
    console.log('🔍 API: Simple query successful, found games:', testData?.length || 0)
    
    // Test the specific query that's failing
    console.log('🔍 API: Testing waiting games query...')
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting')
      .limit(1)
    
    if (error) {
      console.error('🔍 API: Waiting games query error:', error)
      return NextResponse.json({
        success: false,
        error: 'Waiting games query failed',
        details: {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        }
      })
    }
    
    const currentGame = games?.[0]
    
    console.log('🔍 API: Waiting games query successful, game found:', !!currentGame)
    
    return NextResponse.json({
      success: true,
      hasCurrentGame: !!currentGame,
      totalGames: testData?.length || 0,
      currentGame: currentGame ? {
        id: currentGame.id,
        rollNumber: currentGame.roll_number,
        status: currentGame.status,
        created: currentGame.created_at
      } : null,
      environment: {
        hasUrl,
        hasKey,
        nodeEnv: process.env.NODE_ENV,
        urlPreview: supabaseUrl?.slice(0, 50) + '...'
      }
    })
    
  } catch (error) {
    console.error('🔍 API: Unexpected error:', error)
    console.error('🔍 API: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      }
    })
  }
}
