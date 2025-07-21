# PvP Wheel Game - Telegram WebApp

A **Telegram-exclusive** Next.js-based PvP wheel game where users compete with their gifts and TON balance in a "winner takes all" spinning wheel game. Designed specifically for Telegram WebApp with native integrations.

## Features

- **🎯 Telegram-Only Experience**: Built exclusively for Telegram WebApp - no browser version
- **⚡ Auto-Authentication**: Seamless login with Telegram user data
- **🎁 Gift System**: Join games with gifts from your inventory instead of balance
- **📱 Mobile-Optimized**: Perfect touch experience for Telegram mobile users
- **🎨 Native UI**: Telegram-style interface with haptic feedback
- **🔄 Real-time Updates**: Live game status and instant notifications
- **📊 Match History**: Track your wins and losses with detailed filters
- **🎮 Proportional Wheel**: Fair play with weighted probability system
- **⏰ Auto-Spinning**: 60-second countdown with automatic wheel spinning
- **🏆 Winner Takes All**: Complete pot distribution to the winner

## Telegram WebApp Features

- **🤖 Native Integration**: Runs seamlessly inside Telegram mobile app
- **👤 User Profile**: Automatic access to Telegram avatar, username, and ID
- **📳 Haptic Feedback**: Rich tactile feedback for all interactions
- **🎨 Theme Adaptation**: Automatically adapts to Telegram's dark theme
- **🔒 Secure**: Uses Telegram's built-in security and authentication

## Technical Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: React with hooks
- **Canvas**: HTML5 Canvas for wheel rendering
- **Icons**: Lucide React
- **Telegram**: Telegram WebApp API integration

## Getting Started

**⚠️ This app is designed exclusively for Telegram WebApp and requires Telegram to function properly.**

Install the dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

For testing, you'll need to expose your local server using ngrok:

```bash
npx ngrok http 3000
```

Then use the HTTPS URL from ngrok as your Telegram WebApp URL.

## Telegram WebApp Setup

### 1. Create a Telegram Bot
- Contact @BotFather on Telegram
- Send `/newbot` and follow the instructions
- Save your bot token

### 2. Set WebApp URL
- Send `/setmenubutton` to @BotFather
- Select your bot
- Provide your ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 3. Test the WebApp
- Open your bot in Telegram
- Tap the menu button to launch the WebApp
- The app will automatically authenticate with your Telegram account

## Testing with ngrok

To test with multiple Telegram accounts:

1. **Start development server**: `npm run dev`
2. **Start ngrok tunnel**: `npx ngrok http 3000`
3. **Copy HTTPS URL**: Use the ngrok URL in your bot settings
4. **Test with multiple accounts**: Open the bot from different Telegram accounts to simulate multiplayer

## How to Play

### 🎁 Joining with Gifts (Recommended)
1. **Tap "Add Gift"**: Opens your personal gift inventory
2. **Select Gifts**: Tap to select gifts you want to bet
3. **Review Selection**: See total TON value of selected gifts
4. **Join Game**: Confirm to join the wheel with your gifts

### 💰 Joining with Balance
1. **Enter Name**: Your Telegram name is pre-filled
2. **Set Balance**: Choose amount ($10-$10,000)
3. **Join Game**: Tap to join the wheel

### 🎯 Game Flow
1. **Wait for Players**: Minimum 2 players required
2. **Countdown**: 60-second timer starts when 2+ players join
3. **Wheel Spins**: Automatic spin when countdown reaches 0
4. **Winner Takes All**: Winner receives the entire pot (balance + gifts)
5. **New Round**: Game resets automatically for next round

## Game Rules

- **💎 Minimum Gift Value**: 0.1 TON equivalent
- **💰 Balance Range**: $10 - $10,000 (if using balance)
- **👥 Player Limit**: 2-15 players per game
- **⏰ Timer**: 60 seconds countdown once 2+ players join
- **🎯 Fair Play**: Winner probability proportional to total value
- **🏆 Winner Takes All**: Complete pot distribution
- **📝 Game History**: All actions logged with timestamps
- **🔄 Auto-Reset**: New game starts immediately after each round

## Navigation

- **🎮 PvP**: Main game wheel and player actions
- **🎁 My Gifts**: View your gift inventory
- **💰 Earn**: Future feature for earning gifts/balance

## Development Features

- **TypeScript**: Full type safety and better DX
- **Tailwind CSS**: Utility-first styling
- **React Hooks**: Modern state management
- **Canvas API**: Smooth wheel rendering and animations
- **Lucide Icons**: Beautiful, consistent iconography
- **Telegram WebApp API**: Native Telegram integration

## Future Enhancements

- **🔗 Real-time Multiplayer**: WebSocket/Socket.IO integration
- **💾 Persistent Data**: User balances and gift inventories
- **🎁 Gift Marketplace**: Buy/sell/trade gifts with other users
- **🏆 Leaderboards**: Global and weekly rankings
- **🔊 Sound Effects**: Audio feedback for better engagement
- **✨ Enhanced Animations**: Smoother wheel spinning and effects
- **📱 Push Notifications**: Game alerts via Telegram
- **🎨 Custom Themes**: Personalized UI customization
