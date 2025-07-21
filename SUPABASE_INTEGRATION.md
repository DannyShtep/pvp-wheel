# Supabase Integration Guide

This document explains how to set up and use the Supabase database integration for the PvP Wheel webapp.

## Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Project Setup**: Create a new Supabase project

## Database Setup

### 1. Create Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-schema.sql` into the editor
4. Run the SQL script to create all tables, indexes, and functions

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env.local`
2. Update the following values from your Supabase project settings:

```bash
# Go to Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Database Schema Overview

### Core Tables

#### `players`
- Stores Telegram user information
- Tracks player statistics (games played, won, TON earned)
- Links to Telegram user data for avatars and profile info

#### `games`
- Represents individual wheel game sessions
- Tracks game status (waiting, spinning, completed)
- Stores roll numbers and game results

#### `game_participants`
- Junction table linking players to games
- Stores player's contribution (balance, gifts)
- Tracks color assignment and position

#### `gifts`
- Master table of available gifts
- Defines emoji, name, value, and rarity
- Pre-populated with default gifts

#### `player_gifts`
- Player inventory system
- Tracks gift quantities owned by each player
- Updated when gifts are used or won

#### `game_logs`
- Stores game events and messages
- Provides audit trail for game actions
- Used for real-time game feed

### Key Features

1. **Real-time Updates**: Uses Supabase real-time subscriptions for live game updates
2. **Player Statistics**: Automatically tracks wins, losses, and earnings
3. **Gift System**: Complete inventory management for in-game gifts
4. **Game History**: Persistent storage of all completed games
5. **Telegram Integration**: Seamless connection with Telegram WebApp data

## Integration Points

### 1. Player Management

```typescript
// Initialize player from Telegram data
const { initializePlayer } = useGameDatabase()
const player = await initializePlayer(telegramUser)
```

### 2. Game Flow

```typescript
// Get or create current game
const game = await getCurrentGame(rollNumber)

// Join game with gifts
const participant = await joinGameWithGifts(
  gameId, playerId, giftSelections, color, positionIndex
)

// Complete game with winner
await completeGame(gameId, winnerId, winnerChance, totalGiftValue)
```

### 3. Real-time Features

The system automatically subscribes to:
- Game participant changes
- Game log updates
- Player inventory changes

### 4. Gift Management

```typescript
// Load player inventory
await loadPlayerInventory(playerId)

// Use gifts in game (automatically deducted)
await joinGameWithGifts(/* ... */)

// Gift quantities are automatically updated
```

## API Reference

### Database Helpers (`src/lib/supabase.ts`)

#### Player Operations
- `getOrCreatePlayer(telegramUser)` - Get existing or create new player
- `updatePlayerGifts(playerId, giftId, quantityChange)` - Update inventory

#### Game Operations
- `getCurrentGame()` - Get current waiting game
- `createGame(rollNumber)` - Create new game session
- `updateGameStatus(gameId, status, updates)` - Update game state

#### Gift Operations
- `getAllGifts()` - Get all available gifts
- `getPlayerGifts(playerId)` - Get player's inventory

#### History Operations
- `getMatchHistory(limit)` - Get completed games
- `getGameLogs(gameId, limit)` - Get game event logs

### Custom Hook (`src/hooks/useGameDatabase.ts`)

The `useGameDatabase` hook provides:
- State management for database entities
- Real-time subscriptions
- Error handling
- Loading states

## Security Considerations

1. **Row Level Security (RLS)**: Currently disabled for simplicity, but can be enabled
2. **API Keys**: Use environment variables for sensitive data
3. **Data Validation**: Server-side validation through database constraints
4. **Real-time Security**: Supabase handles authentication for real-time features

## Development Workflow

1. **Database Changes**: Update `supabase-schema.sql` and run in SQL Editor
2. **Type Safety**: Update TypeScript interfaces in `supabase.ts`
3. **Testing**: Use Supabase dashboard to inspect data and test queries
4. **Real-time**: Monitor real-time subscriptions in browser dev tools

## Troubleshooting Scripts

Several scripts are available to help diagnose and fix issues:

### Available Scripts

```bash
# Test database connection and setup
npm run test:database

# Test complete game flow
npm run test:game-flow

# Debug current game state and visibility
npm run debug:game-state

# Clean up multiple waiting games
npm run cleanup:games
```

### Script Descriptions

- **`test:database`**: Verifies database connection, tables, and basic operations
- **`test:game-flow`**: Simulates a complete game from player creation to completion
- **`debug:game-state`**: Shows all games, players, and identifies sync issues
- **`cleanup:games`**: Fixes multiple waiting games by canceling duplicates

## Database Cleanup

### Complete Database Reset

To completely reset the database (remove all games, participants, and logs):

```bash
npm run cleanup:database
```

This will:
- Delete all game participants
- Delete all game logs
- Delete all games (including waiting games)
- Verify the database is clean

### Test Fresh Start

To verify the database is clean and ready for new games:

```bash
npm run test:fresh-start
```

This will confirm that:
- No games exist in the database
- No participants exist
- No logs exist
- The app is ready for fresh games

### When to Use Cleanup

- **Testing**: Before testing new features
- **Deployment**: When moving from development to production
- **Troubleshooting**: When debugging game state issues
- **Maintenance**: Periodically to clear old data

**⚠️ Warning**: Database cleanup is irreversible and will remove all game data!

## Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure `.env.local` is properly configured
2. **Database Connection**: Check Supabase project status and API keys
3. **Real-time**: Verify WebSocket connections in browser dev tools
4. **Data Types**: Ensure TypeScript interfaces match database schema
5. **Database Tables**: Make sure all tables are created from the schema

### Specific Error Solutions

#### "Error creating player: {}"

This error usually indicates that the database tables haven't been created yet. To fix:

1. **Verify Database Schema**:
   - Go to your Supabase project dashboard
   - Navigate to **Table Editor**
   - Check if you see tables like `players`, `games`, `gifts`, etc.
   - If not, the schema hasn't been run yet

2. **Run Database Schema**:
   - Go to **SQL Editor** in Supabase dashboard
   - Copy the entire contents of `supabase-schema.sql`
   - Paste into the SQL editor
   - Click **Run** to execute the schema

3. **Check Environment Variables**:
   - Verify `.env.local` has correct values
   - Make sure URLs don't have trailing slashes
   - Ensure API keys are copied correctly

4. **Test Database Connection**:
   - Check browser console for detailed error messages
   - Look for network errors in browser dev tools
   - Verify Supabase project is not paused

#### "Games created by one user are not visible to others"

This is a real-time synchronization issue. Here's how to fix it:

1. **Check Real-time Subscriptions**:
   - Open browser dev tools (F12) on both devices
   - Look for console messages about "Real-time subscription status"
   - Should see "SUBSCRIBED" for both global and game-specific subscriptions

2. **Verify Game State**:
   - Check the database directly in Supabase dashboard
   - Go to Table Editor → `games` table
   - Look for games with status 'waiting'
   - Only one game should have status 'waiting' at a time

3. **Test Cross-Device Sync**:
   - Open the app on two different devices/browsers
   - Clear browser cache on both devices
   - Refresh both pages
   - User A creates/joins a game
   - User B should see the game within 1-2 seconds

4. **Force Reload Game State**:
   - If users aren't seeing the same game, refresh the page
   - The app will automatically load the current waiting game on mount
   - All users should see the same game participants

5. **Debug Steps**:
   ```javascript
   // In browser console, check current game state:
   console.log('Current game ID:', currentGameId)
   console.log('DB players:', dbPlayers)
   console.log('Local players:', players)
   ```

6. **Common Causes**:
   - Multiple games created simultaneously (fixed with improved logic)
   - Real-time subscription not established
   - Network connectivity issues
   - Browser cache conflicts

7. **Manual Fix**:
   If the issue persists, use the debug and cleanup scripts:
   ```bash
   # Check current game state
   npm run debug:game-state
   
   # Clean up multiple waiting games
   npm run cleanup:games
   ```
   
   Or manually in Supabase SQL Editor:
   ```sql
   -- Cancel all but the most recent waiting game
   UPDATE games SET status = 'cancelled' 
   WHERE status = 'waiting' AND id != (
     SELECT id FROM games 
     WHERE status = 'waiting' 
     ORDER BY created_at DESC 
     LIMIT 1
   );
   ```

#### "Failed to initialize player"

1. **Check Table Structure**: Verify the `players` table exists with correct columns
2. **Permissions**: Ensure RLS policies allow inserts (currently disabled in schema)
3. **Data Validation**: Check if all required fields are being provided

#### "Game not visible to other players"

This indicates that game state synchronization isn't working properly. To fix:

1. **Check Real-time Subscriptions**: Verify that real-time updates are working
2. **Game State Sync**: Ensure games are properly stored in database
3. **Player Sync**: Check that all players are loading the same game session

Steps to fix:
1. Open browser console on both devices
2. Check for real-time subscription errors
3. Verify that `getCurrentGame()` returns the same game for both players
4. Check the `games` table in Supabase dashboard for active games

### Debug Tips

1. **Console Logging**: Database operations include detailed error logging
2. **Supabase Dashboard**: Use the dashboard to inspect data directly
3. **Network Tab**: Monitor API calls and responses in browser dev tools
4. **SQL Editor**: Test queries directly in Supabase SQL Editor
5. **Real-time Logs**: Check Supabase real-time logs for subscription issues

### Quick Fixes

1. **Restart Development Server**: Sometimes environment changes need a restart
2. **Clear Browser Cache**: Clear cache and hard refresh the page
3. **Check Project Limits**: Ensure you haven't exceeded Supabase free tier limits
4. **Verify Project URL**: Make sure you're using the correct project URL

### Testing Database Connection

To test if your database is working:

1. Go to Supabase dashboard → Table Editor
2. Click on `players` table
3. Try inserting a test record manually
4. If successful, the database is working

### Emergency Fallback

If database issues persist, the app will automatically fall back to offline mode:
- Games will work locally without persistence
- Players can still join and play
- Match history will be local only
- No real-time sync between players

## Performance Optimization

1. **Indexes**: Database includes optimized indexes for common queries
2. **Pagination**: Implement pagination for large datasets
3. **Caching**: Consider client-side caching for frequently accessed data
4. **Subscriptions**: Limit real-time subscriptions to active games only

## Future Enhancements

1. **Authentication**: Add proper user authentication
2. **Permissions**: Implement row-level security
3. **Analytics**: Add game analytics and reporting
4. **Backup**: Implement database backup strategy
5. **Migration**: Add database migration system

## Support

For issues or questions:
1. Check Supabase documentation
2. Review error logs in browser console
3. Inspect database data in Supabase dashboard
4. Test queries in SQL Editor
