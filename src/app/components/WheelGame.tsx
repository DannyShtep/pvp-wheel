'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Users, Trophy, Timer, History, ChevronLeft, Filter, MessageCircle } from 'lucide-react';
import { useGameDatabase } from '../../hooks/useGameDatabase';

// Telegram WebApp types
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  openLink: (url: string) => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface Player {
  id: string;
  name: string;
  balance: number;
  color: string;
  gifts: string[]; // Array of gift emojis
  giftValue: number; // Total TON value of gifts
  telegramUser?: TelegramUser; // Store Telegram user data for avatar
}

interface GameLog {
  id: string;
  message: string;
  timestamp: Date;
  type: 'join' | 'spin' | 'winner' | 'info';
}

interface MatchHistoryEntry {
  id: string;
  rollNumber: number;
  timestamp: Date;
  players: Player[];
  winner: Player;
  totalPot: number;
  winnerChance: number;
}

interface Gift {
  id: string;
  emoji: string;
  name: string;
  value: number; // TON value
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  quantity: number;
  nft_address?: string; // TON NFT collection address
  nft_item_id?: string; // Specific NFT item ID
  is_nft?: boolean; // Whether this is an NFT gift
}

type HistoryFilter = 'time' | 'luckiest' | 'fattest';

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#D7BDE2'
];

const SPIN_DURATION = 4000;
const COUNTDOWN_DURATION = 60;

// NFT Deposit configuration - Telegram-based
const NFT_DEPOSIT_TELEGRAM = '@pwpwheel'; // Telegram username for NFT gift transfers

export default function WheelGame() {
  // Database integration
  const {
    currentGameId,
    currentPlayer,
    dbPlayers,
    dbGameLogs,
    dbMatchHistory,
    playerInventory,
    availableGifts,
    gameCountdown,
    loading: dbLoading,
    error: dbError,
    initializePlayer,
    getCurrentGame,
    joinGameWithGifts,
    completeGame,
    addGameLog: addDbGameLog,
    loadMatchHistory,
    loadGameParticipants,
    startGameCountdown,
    getGameCountdown,
    clearError
  } = useGameDatabase();

  const [players, setPlayers] = useState<Player[]>([]);
  const [gameLog, setGameLog] = useState<GameLog[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerBalance, setPlayerBalance] = useState('');
  const [activeTab, setActiveTab] = useState<'pvp' | 'gifts' | 'earn'>('pvp');
  const [rollNumber, setRollNumber] = useState(8343); // Persistent roll number
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('time');
  const [userInventory, setUserInventory] = useState<Gift[]>([]);
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [selectedGifts, setSelectedGifts] = useState<{id: string, quantity: number}[]>([]);
  const [showPlayerGiftsPopup, setShowPlayerGiftsPopup] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  
  // NFT Deposit states
  const [showNftDepositPopup, setShowNftDepositPopup] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  
  // Telegram WebApp state
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Avatar cache to store loaded images
  const avatarCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Helper function to load and cache Telegram avatars
  const loadTelegramAvatar = useCallback(async (photoUrl: string): Promise<HTMLImageElement> => {
    // Check cache first
    if (avatarCache.current.has(photoUrl)) {
      return avatarCache.current.get(photoUrl)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      // Remove crossOrigin to avoid CORS issues with Telegram avatars
      img.onload = () => {
        console.log('Avatar loaded successfully:', photoUrl);
        avatarCache.current.set(photoUrl, img);
        resolve(img);
      };
      img.onerror = (error) => {
        console.error('Avatar failed to load:', photoUrl, error);
        reject(error);
      };
      img.src = photoUrl;
    });
  }, []);

  // Preload all player avatars
  const preloadAvatars = useCallback(async () => {
    const promises = players
      .filter(player => player.telegramUser?.photo_url)
      .map(player => {
        console.log('Preloading avatar for:', player.name, 'URL:', player.telegramUser?.photo_url);
        return loadTelegramAvatar(player.telegramUser!.photo_url!);
      });
    
    console.log('Found', promises.length, 'avatars to preload');
    
    try {
      await Promise.all(promises);
      console.log('All avatars preloaded successfully');
      return true; // Return success status
    } catch (error) {
      console.warn('Some avatars failed to load:', error);
      return false;
    }
  }, [players, loadTelegramAvatar]);

  const addToLog = useCallback((message: string, type: GameLog['type'] = 'info') => {
    const newLog: GameLog = {
      id: Date.now().toString(),
      message,
      timestamp: new Date(),
      type
    };
    setGameLog(prev => [newLog, ...prev.slice(0, 19)]);
    
    // Add haptic feedback for Telegram WebApp
    if (webApp?.HapticFeedback) {
      switch (type) {
        case 'winner':
          webApp.HapticFeedback.notificationOccurred('success');
          break;
        case 'join':
          webApp.HapticFeedback.impactOccurred('light');
          break;
        case 'spin':
          webApp.HapticFeedback.impactOccurred('medium');
          break;
      }
    }
  }, [webApp]);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 140;

    ctx.clearRect(0, 0, canvas.width, canvas.width);

    // Use activePlayers instead of players
    const activePlayers = dbPlayers.length > 0 ? dbPlayers : players;

    if (activePlayers.length === 0) {
      // Draw empty wheel with transparent background
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(75, 85, 99, 0.3)');
      gradient.addColorStop(1, 'rgba(55, 65, 81, 0.5)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      return;
    }

    const totalValue = activePlayers.reduce((sum, player) => sum + player.balance + player.giftValue, 0);
    let currentAngle = -Math.PI / 2; // Start at top (12 o'clock position) where the arrow points

    activePlayers.forEach((player) => {
      const playerValue = player.balance + player.giftValue;
      const segmentAngle = (playerValue / totalValue) * 2 * Math.PI;
      
      // Draw segment
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + segmentAngle);
      ctx.closePath();
      ctx.fill();
      
      // Remove the white border between segments
      
      // Draw avatar and value if segment is large enough
      if (segmentAngle > 0.2) {
        const textAngle = currentAngle + segmentAngle / 2;
        const textRadius = radius * 0.7;
        const textX = centerX + Math.cos(textAngle) * textRadius;
        const textY = centerY + Math.sin(textAngle) * textRadius;
        
        ctx.save();
        ctx.translate(textX, textY);
        // Remove rotation adjustment since we want avatars to stay upright
        
        // Draw avatar circle
        const avatarRadius = 14; // Reduced from 18 to 14
        
        // Check if player has Telegram photo and it's cached
        if (player.telegramUser?.photo_url && avatarCache.current.has(player.telegramUser.photo_url)) {
          console.log('Drawing cached avatar for:', player.name);
          const avatarImg = avatarCache.current.get(player.telegramUser.photo_url)!;
          
          try {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, avatarRadius, 0, 2 * Math.PI); // Changed from (0, -8) to (0, 0)
            ctx.clip();
            ctx.drawImage(avatarImg, -avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.restore();
            
            // Draw white border around avatar
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, avatarRadius, 0, 2 * Math.PI); // Changed from (0, -8) to (0, 0)
            ctx.stroke();
          } catch (error) {
            console.error('Error drawing avatar for:', player.name, error);
            drawFallbackAvatar();
          }
        } else {
          // Draw fallback avatar
          console.log('Drawing fallback avatar for:', player.name, 'Has photo URL:', !!player.telegramUser?.photo_url, 'Is cached:', player.telegramUser?.photo_url ? avatarCache.current.has(player.telegramUser.photo_url) : false);
          drawFallbackAvatar();
        }
        
        // Function to draw fallback avatar
        function drawFallbackAvatar() {
          if (!ctx) return;
          
          const gradient = ctx.createLinearGradient(-avatarRadius, -avatarRadius, avatarRadius, avatarRadius);
          gradient.addColorStop(0, '#60A5FA'); // blue-400
          gradient.addColorStop(1, '#A855F7'); // purple-500
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, avatarRadius, 0, 2 * Math.PI); // Changed from (0, -8) to (0, 0)
          ctx.fill();
          
          // Draw white border around avatar
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Draw user initial in avatar
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px DM Sans';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(player.name.charAt(0).toUpperCase(), 0, 0); // Changed from (0, -8) to (0, 0)
        }
        
        ctx.restore();
      }
      
      currentAngle += segmentAngle;
    });

    // Draw outer border
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
  }, [players, dbPlayers]);

  const addPlayer = () => {
    const name = playerName.trim();
    const balance = parseInt(playerBalance);
    
    if (!name || !balance || balance < 1 || balance > 10000) {
      alert('Please enter a valid name and balance (1-10,000)!');
      return;
    }
    
    if (players.some(p => p.name === name)) {
      alert('Player name already exists!');
      return;
    }
    
    if (players.length >= 15) {
      alert('Maximum 15 players allowed!');
      return;
    }
    
    const newPlayer: Player = {
      id: Date.now().toString(),
      name,
      balance,
      color: COLORS[players.length % COLORS.length],
      gifts: ['🎁', '💎', '⭐'].slice(0, Math.floor(Math.random() * 3) + 1), // Random 1-3 gifts
      giftValue: Math.random() * 0.5 + 0.1 // Random gift value between 0.1-0.6 TON
      // No telegramUser for test players - they'll get fallback avatars
    };
    
    setPlayers(prev => [...prev, newPlayer]);
    addToLog(`🎉 ${name} joined with $${balance.toLocaleString()}!`, 'join');
    setPlayerName('');
    setPlayerBalance('');
  };

  const spinWheel = useCallback(async () => {
    // Use activePlayers for consistency with display
    const activePlayers = dbPlayers.length > 0 ? dbPlayers : players;
    
    if (activePlayers.length < 2) {
      addToLog('⚠️ Need at least 2 players to spin the wheel!', 'info');
      return;
    }
    
    if (isSpinning) return;
    
    setIsSpinning(true);
    addToLog('🎰 Wheel is spinning... Good luck everyone!', 'spin');
    
    // Add to database log
    if (currentGameId) {
      await addDbGameLog(currentGameId, null, 'spin', '🎰 Wheel is spinning... Good luck everyone!');
    }
    
    // Preload avatars before spinning
    await preloadAvatars();
    
    const totalValue = activePlayers.reduce((sum, player) => sum + player.balance + player.giftValue, 0);
    const randomValue = Math.random() * totalValue;
    
    let currentSum = 0;
    let selectedWinner: Player | null = null;
    
    for (const player of activePlayers) {
      const playerValue = player.balance + player.giftValue;
      currentSum += playerValue;
      if (randomValue <= currentSum) {
        selectedWinner = player;
        break;
      }
    }
    
    // Animate wheel rotation
    const canvas = canvasRef.current;
    if (canvas) {
      const spins = 5 + Math.random() * 3;
      const finalRotation = spins * 360 + (Math.random() * 360);
      canvas.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      canvas.style.transform = `rotate(${finalRotation}deg)`;
    }
    
    spinTimeoutRef.current = setTimeout(async () => {
      if (selectedWinner) {
        const totalBalance = activePlayers.reduce((sum, player) => sum + player.balance, 0);
        const totalGiftValue = activePlayers.reduce((sum, player) => sum + player.giftValue, 0);
        const playerValue = selectedWinner.balance + selectedWinner.giftValue;
        const winnerChance = (playerValue / totalValue) * 100;
        
        // Complete game in database
        if (currentGameId && currentPlayer) {
          try {
            await completeGame(currentGameId, currentPlayer.id, winnerChance, totalGiftValue);
            
            // Add winner log to database
            await addDbGameLog(
              currentGameId,
              currentPlayer.id,
              'winner',
              `🎉 ${selectedWinner.name} won ${totalGiftValue.toFixed(3)} TON in gifts!`
            );
            
            // Reload match history
            await loadMatchHistory();
          } catch (error) {
            console.error('Failed to complete game in database:', error);
          }
        }
        
        // Add to match history
        const matchEntry: MatchHistoryEntry = {
          id: Date.now().toString(),
          rollNumber: rollNumber,
          timestamp: new Date(),
          players: [...activePlayers], // Use activePlayers for consistency
          winner: selectedWinner,
          totalPot: totalGiftValue, // Only TON gifts now
          winnerChance: winnerChance
        };
        setMatchHistory(prev => [matchEntry, ...prev]);
        
        setWinner(selectedWinner);
        setShowWinnerModal(true);
        addToLog(`🎉 ${selectedWinner.name} won ${totalGiftValue.toFixed(3)} TON in gifts!`, 'winner');
        setRollNumber(prev => prev + 1); // Increment roll number for next game
      }        setTimeout(async () => {
          setIsSpinning(false);
          setPlayers([]);
          setWinner(null);
          setShowWinnerModal(false);
          
          // Create new game for next round
          if (currentPlayer) {
            try {
              await getCurrentGame(rollNumber + 1);
            } catch (error) {
              console.error('Failed to create new game:', error);
            }
          }
          
          if (canvas) {
            canvas.style.transition = 'none';
            canvas.style.transform = 'rotate(0deg)';
          }
        }, 3000);
    }, SPIN_DURATION);
  }, [players, isSpinning, addToLog, preloadAvatars, rollNumber, currentGameId, currentPlayer, addDbGameLog, completeGame, loadMatchHistory, getCurrentGame]);

  // Auto-spin when countdown reaches 0
  useEffect(() => {
    const activePlayers = dbPlayers.length > 0 ? dbPlayers : players;
    if (gameCountdown === 0 && !isSpinning && activePlayers.length >= 2) {
      console.log('Database countdown reached 0, spinning wheel');
      spinWheel();
    }
  }, [gameCountdown, isSpinning, dbPlayers.length, players.length, spinWheel]);

  // Draw wheel when players change
  useEffect(() => {
    const loadAndDrawWheel = async () => {
      const avatarsLoaded = await preloadAvatars();
      drawWheel();
      // If avatars were loaded, force another redraw to ensure they appear
      if (avatarsLoaded && players.some(p => p.telegramUser?.photo_url)) {
        setTimeout(() => drawWheel(), 200);
      }
    };
    loadAndDrawWheel();
  }, [players, drawWheel, preloadAvatars]);

  // Redraw wheel when database players change
  useEffect(() => {
    const loadAndDrawWheel = async () => {
      const avatarsLoaded = await preloadAvatars();
      drawWheel();
      // If avatars were loaded, force another redraw to ensure they appear
      if (avatarsLoaded && dbPlayers.some(p => p.telegramUser?.photo_url)) {
        setTimeout(() => drawWheel(), 200);
      }
    };
    loadAndDrawWheel();
  }, [dbPlayers, drawWheel, preloadAvatars]);

  // Redraw wheel when switching back to PvP tab or closing match history
  useEffect(() => {
    if (activeTab === 'pvp' && !showMatchHistory) {
      const loadAndDrawWheel = async () => {
        await preloadAvatars();
        drawWheel();
      };
      loadAndDrawWheel();
    }
  }, [activeTab, showMatchHistory, drawWheel, preloadAvatars]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current);
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  // Initialize inventory from database (real player inventory)
  useEffect(() => {
    // Use real player inventory instead of simulated data
    if (playerInventory && playerInventory.length > 0) {
      const realInventory = playerInventory.map(item => ({
        id: item.gift_id,
        emoji: item.gifts?.emoji || '🎁',
        name: item.gifts?.name || 'Unknown Gift',
        value: item.gifts?.base_value || 0,
        rarity: item.gifts?.rarity || 'common',
        quantity: item.quantity || 0,
        nft_address: item.gifts?.nft_address,
        nft_item_id: item.gifts?.nft_item_id,
        is_nft: item.gifts?.is_nft || false
      }));
      setUserInventory(realInventory);
    } else {
      // Clear inventory if no gifts in database
      setUserInventory([]);
    }
  }, [playerInventory]);

  // Load current game on component mount (for cross-device visibility)
  useEffect(() => {
    const loadCurrentGame = async () => {
      try {
        console.log('🎮 PvP Wheel: Loading current game state...');
        
        // Pass 0 as rollNumber to only load existing games, not create new ones
        const game = await getCurrentGame(0);
        if (game) {
          console.log('✅ Current game loaded:', game.roll_number, 'with', game.game_participants?.length || 0, 'players');
          
          // Load participants for this game
          await loadGameParticipants(game.id);
        } else {
          console.log('ℹ️ No current game - will create when first user joins');
        }
      } catch (error) {
        console.error('❌ Failed to load current game:', error);
      }
    };

    // Only load if we don't already have a current game
    if (!currentGameId) {
      loadCurrentGame();
    }
  }, [getCurrentGame, loadGameParticipants, currentGameId]);

  // Initialize Telegram WebApp with database integration
  useEffect(() => {
    // Wait for Telegram WebApp to be available
    const initTelegram = async () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        setWebApp(tg);
        
        // Initialize the WebApp
        tg.ready();
        tg.expand();
        
        // Configure main button (hidden by default)
        tg.MainButton.hide();
        
        // Get user data from Telegram
        const user = tg.initDataUnsafe?.user;
        if (user) {
          console.log('Telegram user data:', user);
          setTelegramUser(user);
          
          // Initialize player in database
          try {
            console.log('Initializing player in database...');
            const dbPlayer = await initializePlayer(user);
            if (dbPlayer) {
              console.log('Database player initialized:', dbPlayer);
              
              // Auto-fill the player name with Telegram user info
              const displayName = user.username || user.first_name || `User${user.id}`;
              setPlayerName(displayName);
              
              addToLog(`🎯 Welcome back, ${displayName}! Ready to win big? 🏆`, 'info');
              
              // Get or create current game
              const game = await getCurrentGame(rollNumber);
              if (game) {
                console.log('Current game:', game);
                
                // Load participants for this game
                await loadGameParticipants(game.id);
              }
            } else {
              console.log('Failed to initialize player in database, using offline mode');
              addToLog('⚠️ Database connection failed. Playing in offline mode.', 'info');
            }
          } catch (error) {
            console.error('Failed to initialize player:', error);
            addToLog('⚠️ Failed to connect to database. Using offline mode.', 'info');
          }
          
          // Show welcome notification
          tg.HapticFeedback?.notificationOccurred('success');
        } else {
          console.log('No Telegram user data found');
          addToLog('⚡ Telegram WebApp ready! Join the wheel to win TON and gifts! 🎁', 'info');
        }
      } else {
        // Retry initialization if Telegram WebApp is not ready yet
        setTimeout(initTelegram, 100);
      }
    };
    
    initTelegram();
  }, [addToLog, initializePlayer, getCurrentGame, rollNumber]);

  // Sync database players with local state for wheel rendering
  useEffect(() => {
    if (dbPlayers.length > 0) {
      console.log('🔄 Syncing', dbPlayers.length, 'players from database');
      // Update local players to match database state
      setPlayers(dbPlayers);
    }
  }, [dbPlayers]);

  // Use database players if available, otherwise fall back to local players
  const activePlayers = dbPlayers.length > 0 ? dbPlayers : players;

  const totalPot = activePlayers.reduce((sum, player) => sum + player.gifts.length, 0);
  const totalGiftValue = activePlayers.reduce((sum, player) => sum + player.giftValue, 0);
  const totalValue = totalPot + totalGiftValue;

  const getRarityColor = (rarity: Gift['rarity']) => {
    switch (rarity) {
      case 'common': return 'text-gray-400 border-gray-500';
      case 'rare': return 'text-blue-400 border-blue-500';
      case 'epic': return 'text-purple-400 border-purple-500';
      case 'legendary': return 'text-yellow-400 border-yellow-500';
      default: return 'text-gray-400 border-gray-500';
    }
  };

  const handleGiftSelection = (giftId: string, quantity: number) => {
    setSelectedGifts(prev => {
      const existing = prev.find(g => g.id === giftId);
      if (existing) {
        if (quantity === 0) {
          return prev.filter(g => g.id !== giftId);
        }
        return prev.map(g => g.id === giftId ? { ...g, quantity } : g);
      } else if (quantity > 0) {
        return [...prev, { id: giftId, quantity }];
      }
      return prev;
    });
  };

  const getTotalGiftValue = () => {
    return selectedGifts.reduce((total, selected) => {
      const gift = userInventory.find(g => g.id === selected.id);
      return total + (gift ? gift.value * selected.quantity : 0);
    }, 0);
  };

  const selectAllGifts = () => {
    const allAvailableGifts = userInventory
      .filter(gift => gift.quantity > 0)
      .map(gift => ({ id: gift.id, quantity: gift.quantity }));
    setSelectedGifts(allAvailableGifts);
    webApp?.HapticFeedback?.impactOccurred('medium');
  };

  // NFT Deposit Functions
  const openNftDepositPopup = () => {
    setShowNftDepositPopup(true);
    webApp?.HapticFeedback?.impactOccurred('light');
  };

  const copyDepositAddress = () => {
    navigator.clipboard.writeText(NFT_DEPOSIT_TELEGRAM);
    webApp?.HapticFeedback?.notificationOccurred('success');
    addToLog('📋 Telegram address copied to clipboard!', 'info');
  };

  const copyUserMessage = () => {
    const message = `Hi! I want to deposit my NFT gifts for PvP Wheel. My username: @${telegramUser?.username || telegramUser?.first_name || 'user'}`;
    navigator.clipboard.writeText(message);
    webApp?.HapticFeedback?.notificationOccurred('success');
    addToLog('📋 Message copied to clipboard!', 'info');
  };

  const openTelegramDeposit = () => {
    if (!telegramUser) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Please connect your Telegram account first!');
      return;
    }

    const message = `Hi! I want to deposit my NFT gifts for PvP Wheel. My username: @${telegramUser?.username || telegramUser?.first_name || 'user'}`;
    const telegramUrl = `https://t.me/pwpwheel?text=${encodeURIComponent(message)}`;
    
    if (webApp) {
      webApp.openLink(telegramUrl);
    } else {
      window.open(telegramUrl, '_blank');
    }
    
    webApp?.HapticFeedback?.impactOccurred('medium');
    addToLog('📱 Opening Telegram to contact @pwpwheel for NFT deposit', 'info');
  };

  const startNftDeposit = async () => {
    if (!telegramUser) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Please connect your Telegram account first!');
      return;
    }

    setIsDepositing(true);
    webApp?.HapticFeedback?.impactOccurred('medium');

    try {
      // Open Telegram chat with @pwpwheel for NFT gift transfer
      openTelegramDeposit();
      
      addToLog('📱 Contact @pwpwheel in Telegram to deposit your NFT gifts!', 'info');
      
      // Reset depositing state after a moment
      setTimeout(() => {
        setIsDepositing(false);
        addToLog('� Send your NFT gifts to @pwpwheel and mention your username.', 'info');
      }, 2000);
      
    } catch (error) {
      console.error('NFT deposit error:', error);
      webApp?.HapticFeedback?.notificationOccurred('error');
      addToLog('❌ Failed to open Telegram. Please manually contact @pwpwheel.', 'info');
      setIsDepositing(false);
    }
  };

  const refreshInventory = async () => {
    if (!currentPlayer) return;
    
    webApp?.HapticFeedback?.impactOccurred('light');
    addToLog('🔄 Refreshing inventory...', 'info');
    
    try {
      // This would typically call a database function to reload the player's inventory
      // For now, we'll just show a message
      setTimeout(() => {
        addToLog('✅ Inventory refreshed!', 'info');
      }, 1000);
    } catch (error) {
      console.error('Inventory refresh error:', error);
      addToLog('❌ Failed to refresh inventory.', 'info');
    }
  };

  const confirmGiftSelection = async () => {
    if (selectedGifts.length === 0) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      return;
    }

    const name = telegramUser 
      ? (telegramUser.username || telegramUser.first_name || `User${telegramUser.id}`)
      : playerName.trim();

    if (!name) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Unable to get player name!');
      return;
    }

    if (players.length >= 15) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Maximum 15 players allowed!');
      return;
    }

    // Haptic feedback for successful join/add
    webApp?.HapticFeedback?.notificationOccurred('success');

    // Create gifts array and calculate total value
    const selectedGiftEmojis: string[] = [];
    let totalGiftValue = 0;
    const giftSelections: { giftId: string; quantity: number; totalValue: number }[] = [];

    selectedGifts.forEach(selected => {
      const gift = userInventory.find(g => g.id === selected.id);
      if (gift) {
        for (let i = 0; i < selected.quantity; i++) {
          selectedGiftEmojis.push(gift.emoji);
        }
        const selectionValue = gift.value * selected.quantity;
        totalGiftValue += selectionValue;
        giftSelections.push({
          giftId: gift.id,
          quantity: selected.quantity,
          totalValue: selectionValue
        });
      }
    });

    // Database integration: Join game with gifts
    if (currentPlayer) {
      try {
        console.log('Attempting to join game with database integration...');
        console.log('Current player:', currentPlayer);
        console.log('Current game ID:', currentGameId);
        
        // Ensure we have a current game
        let gameId = currentGameId;
        if (!gameId) {
          console.log('No current game found, creating new game...');
          const game = await getCurrentGame(rollNumber);
          if (game) {
            gameId = game.id;
          } else {
            console.error('Failed to get or create game');
            webApp?.HapticFeedback?.notificationOccurred('error');
            alert('Failed to create game. Please try again.');
            return;
          }
        }

        console.log('Using game ID:', gameId);
        
        if (!gameId) {
          console.error('No valid game ID available');
          webApp?.HapticFeedback?.notificationOccurred('error');
          alert('Failed to join game. Please try again.');
          return;
        }
        
        const participant = await joinGameWithGifts(
          gameId,
          currentPlayer.id,
          giftSelections,
          COLORS[players.length % COLORS.length],
          players.length
        );

        if (participant) {
          console.log('Successfully joined game:', participant);
          
          // Add to game log
          await addDbGameLog(
            gameId,
            currentPlayer.id,
            'join',
            `🎁 ${name} joined with ${totalGiftValue.toFixed(3)} TON in gifts!`
          );
        } else {
          console.error('Failed to join game - no participant returned');
          webApp?.HapticFeedback?.notificationOccurred('error');
          // Continue with local game logic as fallback
        }
      } catch (error) {
        console.error('Failed to join game with database:', error);
        webApp?.HapticFeedback?.notificationOccurred('error');
        // Continue with local game logic as fallback
      }
    } else {
      console.log('No current player found, using local game logic only');
    }

    // Local game logic (always run for immediate UI feedback)
    const existingPlayer = players.find(p => p.name === name);
    
    if (existingPlayer) {
      // Add gifts to existing player
      setPlayers(prev => prev.map(player => {
        if (player.name === name) {
          return {
            ...player,
            gifts: [...player.gifts, ...selectedGiftEmojis],
            giftValue: player.giftValue + totalGiftValue
          };
        }
        return player;
      }));
      addToLog(`🎁 ${name} added ${totalGiftValue.toFixed(3)} TON more gifts!`, 'join');
    } else {
      // Create new player
      const newPlayer: Player = {
        id: Date.now().toString(),
        name,
        balance: 0, // No balance when joining with gifts
        color: COLORS[players.length % COLORS.length],
        gifts: selectedGiftEmojis,
        giftValue: totalGiftValue,
        telegramUser: telegramUser || undefined
      };

      setPlayers(prev => [...prev, newPlayer]);
      addToLog(`🎁 ${name} joined with ${totalGiftValue.toFixed(3)} TON in gifts!`, 'join');
    }

    // Update inventory (reduce quantities)
    setUserInventory(prev => prev.map(gift => {
      const selected = selectedGifts.find(s => s.id === gift.id);
      if (selected) {
        return { ...gift, quantity: gift.quantity - selected.quantity };
      }
      return gift;
    }));

    setSelectedGifts([]);
    setShowGiftPopup(false);
  };

  const joinWithGifts = () => {
    if (selectedGifts.length === 0) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Please select at least one gift!');
      return;
    }

    const name = playerName.trim();
    if (!name) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Please enter your name!');
      return;
    }

    if (players.some(p => p.name === name)) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Player name already exists!');
      return;
    }

    if (players.length >= 15) {
      webApp?.HapticFeedback?.notificationOccurred('error');
      alert('Maximum 15 players allowed!');
      return;
    }

    // Haptic feedback for successful join
    webApp?.HapticFeedback?.notificationOccurred('success');

    // Create gifts array and calculate total value
    const selectedGiftEmojis: string[] = [];
    let totalGiftValue = 0;

    selectedGifts.forEach(selected => {
      const gift = userInventory.find(g => g.id === selected.id);
      if (gift) {
        for (let i = 0; i < selected.quantity; i++) {
          selectedGiftEmojis.push(gift.emoji);
        }
        totalGiftValue += gift.value * selected.quantity;
      }
    });

    const newPlayer: Player = {
      id: Date.now().toString(),
      name,
      balance: 0, // No balance when joining with gifts
      color: COLORS[players.length % COLORS.length],
      gifts: selectedGiftEmojis,
      giftValue: totalGiftValue
    };

    // Update inventory (reduce quantities)
    setUserInventory(prev => prev.map(gift => {
      const selected = selectedGifts.find(s => s.id === gift.id);
      if (selected) {
        return { ...gift, quantity: gift.quantity - selected.quantity };
      }
      return gift;
    }));

    setPlayers(prev => [...prev, newPlayer]);
    addToLog(`🎁 ${name} joined with ${totalGiftValue.toFixed(3)} TON in gifts!`, 'join');
    setPlayerName('');
    setSelectedGifts([]);
    setShowGiftPopup(false);
  };

  const getFilteredHistory = () => {
    // Use database match history if available, otherwise use local state
    const history = dbMatchHistory.length > 0 ? dbMatchHistory : matchHistory;
    let filtered = [...history];
    
    switch (historyFilter) {
      case 'time':
        // Already sorted by timestamp (newest first)
        return filtered;
      case 'luckiest':
        // Sort by lowest winning chance (luckiest wins)
        return filtered.sort((a, b) => a.winnerChance - b.winnerChance);
      case 'fattest':
        // Sort by highest total pot (biggest wins)
        return filtered.sort((a, b) => b.totalPot - a.totalPot);
      default:
        return filtered;
    }
  };

  const renderMatchHistory = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setShowMatchHistory(false);
            // Force redraw wheel when returning
            setTimeout(() => drawWheel(), 0);
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-lg font-semibold text-white">Match History</h2>
        <div className="w-16"></div> {/* Spacer */}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'time' as HistoryFilter, label: 'By Time', icon: '🕒' },
          { key: 'luckiest' as HistoryFilter, label: 'Luckiest', icon: '🍀' },
          { key: 'fattest' as HistoryFilter, label: 'Fattest', icon: '💰' }
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setHistoryFilter(filter.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              historyFilter === filter.key
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span>{filter.icon}</span>
            {filter.label}
          </button>
        ))}
      </div>

      {/* History List */}
      <div className="space-y-3">
        {getFilteredHistory().length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No matches played yet</p>
          </div>
        ) : (
          getFilteredHistory().map((match) => (
            <div
              key={match.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-purple-400">
                    Roll #{match.rollNumber}
                  </div>
                  <div className="text-xs text-gray-500">
                    {match.timestamp.toLocaleString()}
                  </div>
                </div>
                <div className="text-sm font-semibold text-blue-400">
                  {match.totalPot.toFixed(3)} TON
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: match.winner.color }}
                  />
                  <span className="text-white font-medium">
                    @{match.winner.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    won with {match.winnerChance.toFixed(1)}% chance
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {match.players.length} players
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPvPContent = () => (
    <div className="space-y-4">
      {/* Total Pot Display */}
      <div className="text-center mb-6 relative">
        {/* Match History Icon - Left edge of total pot div */}
        <button
          onClick={() => setShowMatchHistory(true)}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 p-2 text-gray-300 hover:text-white transition-colors bg-gray-800/40 rounded-full border border-gray-600 hover:bg-gray-700 shadow-md"
          title="Match History"
        >
          <History className="w-4 h-4" strokeWidth={2} />
        </button>
        
        {/* Chat Icon - Right edge of total pot div */}
        <button
          onClick={() => window.open('https://t.me/your_telegram_channel', '_blank')}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 p-2 text-gray-300 hover:text-white transition-colors bg-gray-800/40 rounded-full border border-gray-600 hover:bg-gray-700 shadow-md"
          title="Join Telegram Channel"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={2} />
        </button>
        
        <div className="text-xs text-gray-400 font-medium">Total Pot</div>
        <div className="text-lg font-bold text-yellow-400 flex items-center justify-center gap-1">
          {activePlayers.reduce((sum, player) => sum + player.gifts.length, 0)} 🎁 | {totalGiftValue.toFixed(2)} 💎
        </div>
      </div>
      
      {/* Wheel - Free floating */}
      <div className="relative w-full max-w-xs mx-auto mb-6">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="w-full h-auto rounded-full"
            style={{ background: 'transparent' }}
          />
          {/* Pointer - pointing down from top */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[20px] border-t-red-500 drop-shadow-lg"></div>
          </div>
          {/* Center - Timer Status */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center shadow-lg border-4 border-gray-600">
            <div className="text-center">
              {activePlayers.length < 2 ? (
                <div className="text-xs text-blue-400 font-bold">Waiting</div>
              ) : isSpinning ? (
                <div className="text-xs text-red-400 font-bold animate-pulse">Live</div>
              ) : gameCountdown !== null && gameCountdown > 0 ? (
                <>
                  <div className="text-xs text-gray-300 font-medium">Next</div>
                  <div className={`text-sm font-bold ${gameCountdown <= 10 ? 'text-red-400 animate-pulse' : 'text-purple-400'}`}>
                    {gameCountdown}s
                  </div>
                </>
              ) : gameCountdown === 0 ? (
                <div className="text-xs text-orange-400 font-bold animate-pulse">Spinning!</div>
              ) : (
                <>
                  <div className="text-xs text-gray-300 font-medium">Ready</div>
                  <div className="text-xs text-green-400 font-bold">GO!</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Action Buttons - Free floating */}
      <div className="text-center mb-6">
        {isSpinning ? (
          <div className="bg-orange-500/20 text-orange-300 px-4 py-2 rounded-xl font-semibold text-sm animate-pulse border border-orange-500/30">
            🎮 Game in progress...
          </div>
        ) : (
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => {
                setShowGiftPopup(true);
                webApp?.HapticFeedback?.impactOccurred('light');
              }}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-sm"
            >
              🎁 Add Gift
            </button>
            <button 
              onClick={() => addToLog('💎 TON feature coming soon!', 'info')}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-sm"
            >
              💎 Add TON
            </button>
          </div>
        )}
      </div>

      {/* Joined Players Roll */}
      {activePlayers.length > 0 && (
        <div className="mb-6">
          {/* Roll Header */}
          <div className="text-center mb-4">
            <div className="text-gray-400 text-sm font-mono">
              --------------ROLL #{rollNumber}---------------
            </div>
          </div>
          
          {/* Players List */}
          <div className="space-y-3">
            {activePlayers.map((player, index) => {
              const totalValue = activePlayers.reduce((sum, p) => sum + p.balance + p.giftValue, 0);
              const playerValue = player.balance + player.giftValue;
              const chancePercentage = totalValue > 0 ? ((playerValue / totalValue) * 100).toFixed(1) : '0.0';
              
              return (
                <div 
                  key={player.id} 
                  className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 border border-gray-700/50 cursor-pointer hover:bg-gray-800/70 transition-all duration-200"
                  onClick={() => {
                    setSelectedPlayer(player);
                    setShowPlayerGiftsPopup(true);
                    webApp?.HapticFeedback?.impactOccurred('light');
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Telegram Avatar */}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                        {player.telegramUser?.photo_url ? (
                          <img 
                            src={player.telegramUser.photo_url} 
                            alt={player.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to initial if image fails to load
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{player.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      
                      {/* Username */}
                      <div className="text-white text-sm font-medium">
                        @{player.name.toLowerCase()}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Chance Percentage */}
                      <div className="text-green-400 text-sm font-bold">
                        {chancePercentage}%
                      </div>
                      
                      {/* Gift Value in TON */}
                      <div className="text-blue-400 text-sm font-medium">
                        {player.giftValue.toFixed(3)} TON
                      </div>
                    </div>
                  </div>
                  
                  {/* Gift Avatars Row */}
                  <div className="flex items-center flex-wrap gap-1 mt-2 ml-11">
                    {player.gifts.slice(0, 8).map((gift: string, giftIndex: number) => (
                      <div key={giftIndex} className="text-sm">
                        {gift}
                      </div>
                    ))}
                    {player.gifts.length > 8 && (
                      <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">
                        +{player.gifts.length - 8} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Total Gifts Summary */}
          <div className="mt-4 text-center">
            <div className="text-gray-400 text-sm">
              Total Gifts: {activePlayers.reduce((sum, player) => sum + player.giftValue, 0).toFixed(3)} TON
            </div>
            <div className="text-gray-500 text-xs mt-1">
              Winner takes all gifts!
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGiftsContent = () => (
    <div className="space-y-4">
      {/* NFT Deposit Button */}
      <div className="flex justify-center">
        <button
          onClick={openNftDepositPopup}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
        >
          📱 Deposit NFT Gifts
        </button>
      </div>

      <div className="bg-gray-800/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">My Gifts</h2>
          <button
            onClick={refreshInventory}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
            title="Refresh Inventory"
          >
            🔄
          </button>
        </div>
        
        {userInventory.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-4">🎁</div>
            <div className="text-lg font-medium mb-2 text-gray-300">No gifts yet</div>
            <div className="text-sm mb-4">Transfer NFT gifts to get started!</div>
            <div className="text-xs text-gray-500">
              Contact {NFT_DEPOSIT_TELEGRAM} in Telegram to deposit your NFT gifts
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {userInventory.map((gift) => (
              <div key={gift.id} className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{gift.emoji}</div>
                    <div>
                      <div className="text-white font-medium">
                        {gift.name}
                        {gift.is_nft && (
                          <span className="ml-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
                            NFT
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {gift.value} TON each
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${
                        gift.rarity === 'common' ? 'bg-gray-600 text-gray-300' :
                        gift.rarity === 'rare' ? 'bg-blue-600 text-blue-200' :
                        gift.rarity === 'epic' ? 'bg-purple-600 text-purple-200' :
                        'bg-yellow-600 text-yellow-200'
                      }`}>
                        {gift.rarity}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">{gift.quantity}</div>
                    <div className="text-sm text-gray-400">owned</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-600/50">
                  <div className="text-sm text-gray-300">
                    Total Value: <span className="text-blue-400 font-medium">{(gift.value * gift.quantity).toFixed(3)} TON</span>
                  </div>
                  {gift.is_nft && gift.nft_address && (
                    <div className="text-xs text-gray-500 mt-1">
                      NFT Collection: {gift.nft_address.slice(0, 8)}...{gift.nft_address.slice(-6)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Total Inventory Value */}
        {userInventory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-600/50">
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                Total Inventory Value: <span className="text-blue-400">
                  {userInventory.reduce((sum, gift) => sum + (gift.value * gift.quantity), 0).toFixed(3)} TON
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderEarnContent = () => (
    <div className="space-y-4">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 text-center">Earn TON</h2>
        <div className="space-y-4">
          {/* Invite Friends Section */}
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">👥</div>
              <div>
                <h3 className="text-white font-medium">Invite Friends</h3>
                <p className="text-sm text-gray-400">Share this game with your Telegram friends</p>
              </div>
            </div>
            <button
              onClick={() => {
                webApp?.HapticFeedback?.impactOccurred('light');
                if (webApp) {
                  const shareText = "🎯 Join me in PvP Wheel! Winner takes all TON and gifts! 🎁";
                  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`;
                  webApp.openLink(shareUrl);
                }
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Share in Telegram
            </button>
          </div>

          {/* Coming Soon Features */}
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-4">💎</div>
            <div className="text-lg font-medium mb-2 text-gray-300">More earn features coming soon</div>
            <div className="text-sm">Complete tasks to earn TON and gifts!</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 pb-16">
      {dbLoading && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 max-w-md w-full mx-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="animate-spin h-16 w-16 border-4 border-purple-500 rounded-full border-t-transparent"></div>
              <h3 className="text-xl font-bold text-white">Connecting to database...</h3>
              <p className="text-gray-400 text-sm">
                This might take a few moments. If it doesn't connect, please refresh the page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Database Error Banner */}
      {dbError && (
        <div className="bg-red-900/50 border-b border-red-500/50 p-3 text-center">
          <div className="text-red-200 text-sm">
            ⚠️ Database Error: {dbError}
          </div>
          <button
            onClick={clearError}
            className="text-red-300 hover:text-red-100 text-xs underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Loading Overlay */}
      {dbLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-3"></div>
            <div className="text-white text-sm">Connecting to database...</div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-4">
        {/* Main Content */}
        <div className="mb-4">
          {showMatchHistory ? (
            renderMatchHistory()
          ) : (
            <>
              {activeTab === 'pvp' && renderPvPContent()}
              {activeTab === 'gifts' && renderGiftsContent()}
              {activeTab === 'earn' && renderEarnContent()}
            </>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      {!showMatchHistory && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 z-40">
        <div className="flex justify-around items-center py-1">
          <button
            onClick={() => setActiveTab('pvp')}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
              activeTab === 'pvp' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-purple-400'
            }`}
          >
            <div className="text-xl">🎰</div>
            <span className="text-xs font-medium">PvP</span>
          </button>
          <button
            onClick={() => setActiveTab('gifts')}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
              activeTab === 'gifts' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-purple-400'
            }`}
          >
            <div className="text-xl">🎁</div>
            <span className="text-xs font-medium">My Gifts</span>
          </button>
          <button
            onClick={() => setActiveTab('earn')}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
              activeTab === 'earn' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-purple-400'
            }`}
          >
            <div className="text-xl">💎</div>
            <span className="text-xs font-medium">Earn</span>
          </button>
        </div>
      </div>
      )}

      {/* Gift Selection Popup */}
      {showGiftPopup && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowGiftPopup(false);
            webApp?.HapticFeedback?.impactOccurred('light');
          }}
        >
          <div 
            className="bg-gray-800 rounded-2xl max-w-lg w-full h-[85vh] overflow-hidden border border-gray-700 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowGiftPopup(false);
                webApp?.HapticFeedback?.impactOccurred('light');
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            >
              ✕
            </button>
            
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white text-center">Select Gifts to Join</h3>
              <p className="text-sm text-gray-400 text-center mt-1">Choose gifts to add to the wheel</p>
            </div>
            
            {/* Gifts Grid */}
            <div className="p-4 flex-1 overflow-y-auto" style={{ height: 'calc(85vh - 180px)' }}>
              {userInventory.filter(gift => gift.quantity > 0).length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-4xl mb-2">📦</div>
                  <p>No gifts available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {userInventory.filter(gift => gift.quantity > 0).map((gift) => {
                    const selected = selectedGifts.find(s => s.id === gift.id);
                    const selectedQuantity = selected ? selected.quantity : 0;
                    
                    return (
                      <div 
                        key={gift.id} 
                        className={`relative bg-gray-700/50 rounded-xl p-3 border-2 transition-all duration-200 ${
                          selectedQuantity > 0 
                            ? 'border-purple-500 bg-purple-500/20' 
                            : 'border-gray-600/50 hover:border-gray-500'
                        }`}
                      >
                        {/* Tap Area for Selection */}
                        <button
                          onClick={() => {
                            if (selectedQuantity < gift.quantity) {
                              setSelectedGifts(prev => {
                                const existing = prev.find(s => s.id === gift.id);
                                if (existing) {
                                  return prev.map(s => s.id === gift.id ? 
                                    { ...s, quantity: s.quantity + 1 } : s
                                  );
                                } else {
                                  return [...prev, { id: gift.id, quantity: 1 }];
                                }
                              });
                              webApp?.HapticFeedback?.selectionChanged();
                            }
                          }}
                          disabled={selectedQuantity >= gift.quantity}
                          className="w-full text-left"
                        >
                          <div className="text-center mb-2">
                            <div className="text-3xl mb-1">{gift.emoji}</div>
                            <div className="text-white font-medium text-sm">{gift.name}</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-xs text-gray-400 mb-1">
                              {gift.value} TON · {gift.quantity} available
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                              gift.rarity === 'common' ? 'bg-gray-600 text-gray-300' :
                              gift.rarity === 'rare' ? 'bg-blue-600 text-blue-200' :
                              gift.rarity === 'epic' ? 'bg-purple-600 text-purple-200' :
                              'bg-yellow-600 text-yellow-200'
                            }`}>
                              {gift.rarity}
                            </div>
                          </div>
                        </button>
                        
                        {/* Quantity Controls */}
                        {selectedQuantity > 0 && (
                          <div className="absolute -top-2 -right-2 bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {selectedQuantity}
                          </div>
                        )}
                        
                        {/* Minus Button (only show if selected) */}
                        {selectedQuantity > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGifts(prev => 
                                prev.map(s => s.id === gift.id ? 
                                  { ...s, quantity: s.quantity - 1 } : s
                                ).filter(s => s.quantity > 0)
                              );
                            }}
                            className="absolute -bottom-2 -left-2 w-6 h-6 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                          >
                            -
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={selectAllGifts}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={confirmGiftSelection}
                  disabled={selectedGifts.length === 0}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NFT Deposit Popup */}
      {showNftDepositPopup && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowNftDepositPopup(false);
            webApp?.HapticFeedback?.impactOccurred('light');
          }}
        >
          <div 
            className="bg-gray-800 rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden border border-gray-700 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowNftDepositPopup(false);
                webApp?.HapticFeedback?.impactOccurred('light');
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            >
              ✕
            </button>
            
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white text-center mb-2">Deposit NFT Gifts</h3>
              <p className="text-sm text-gray-400 text-center">Transfer your NFT gifts via Telegram</p>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
              <div className="space-y-4">
                {/* Instructions */}
                <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
                  <h4 className="text-white font-medium mb-2">How to Deposit:</h4>
                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                    <li>Contact {NFT_DEPOSIT_TELEGRAM} in Telegram</li>
                    <li>Tell them you want to deposit NFT gifts</li>
                    <li>Provide your username: @{telegramUser?.username || telegramUser?.first_name || 'your_username'}</li>
                    <li>Transfer your NFT gifts to them</li>
                    <li>Wait for confirmation and inventory update</li>
                  </ol>
                </div>

                {/* Telegram Contact */}
                <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
                  <h4 className="text-white font-medium mb-2">Contact:</h4>
                  <div className="bg-gray-900 rounded-lg p-3 mb-2">
                    <div className="text-sm text-gray-300 font-mono text-center">
                      {NFT_DEPOSIT_TELEGRAM}
                    </div>
                  </div>
                  <button
                    onClick={copyDepositAddress}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    📋 Copy Username
                  </button>
                </div>

                {/* Pre-written Message */}
                <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
                  <h4 className="text-white font-medium mb-2">Ready Message:</h4>
                  <div className="bg-gray-900 rounded-lg p-3 mb-2">
                    <div className="text-sm text-gray-300">
                      "Hi! I want to deposit my NFT gifts for PvP Wheel. My username: @{telegramUser?.username || telegramUser?.first_name || 'your_username'}"
                    </div>
                  </div>
                  <button
                    onClick={copyUserMessage}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    📋 Copy Message
                  </button>
                </div>

                {/* Warning */}
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 text-lg">ℹ️</span>
                    <div>
                      <h4 className="text-blue-400 font-medium mb-1">Important:</h4>
                      <ul className="text-sm text-blue-200 space-y-1">
                        <li>• Only supported NFT gifts will be accepted</li>
                        <li>• Always mention your exact username</li>
                        <li>• Transfers are processed manually by @pwpwheel</li>
                        <li>• Contact support if your gifts don't appear</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-700">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNftDepositPopup(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startNftDeposit}
                  disabled={isDepositing}
                  className={`flex-1 ${isDepositing ? 'bg-gray-600' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'} text-white py-3 px-4 rounded-xl font-medium transition-colors`}
                >
                  {isDepositing ? 'Opening Telegram...' : 'Contact @pwpwheel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Gifts Popup */}
      {showPlayerGiftsPopup && selectedPlayer && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowPlayerGiftsPopup(false);
            setSelectedPlayer(null);
            webApp?.HapticFeedback?.impactOccurred('light');
          }}
        >
          <div 
            className="bg-gray-800 rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden border border-gray-700 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowPlayerGiftsPopup(false);
                setSelectedPlayer(null);
                webApp?.HapticFeedback?.impactOccurred('light');
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            >
              ✕
            </button>
            
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                  {selectedPlayer.telegramUser?.photo_url ? (
                    <img 
                      src={selectedPlayer.telegramUser.photo_url} 
                      alt={selectedPlayer.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to initial if image fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{selectedPlayer.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">@{selectedPlayer.name.toLowerCase()}</h3>
                  <p className="text-sm text-gray-400">{selectedPlayer.giftValue.toFixed(3)} TON in gifts</p>
                </div>
              </div>
            </div>
            
            {/* Gifts List */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 160px)' }}>
              {selectedPlayer.gifts.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-4xl mb-2">🎁</div>
                  <p>No gifts joined with</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group gifts by type and show counts */}
                  {(() => {
                    const giftCounts = selectedPlayer.gifts.reduce((counts, gift) => {
                      counts[gift] = (counts[gift] || 0) + 1;
                      return counts;
                    }, {} as Record<string, number>);
                    
                    return Object.entries(giftCounts).map(([giftEmoji, count]) => {
                      // Find the gift info from inventory to get name and value
                      const giftInfo = userInventory.find(g => g.emoji === giftEmoji);
                      
                      return (
                        <div key={giftEmoji} className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-3xl">{giftEmoji}</div>
                              <div>
                                <div className="text-white font-medium">
                                  {giftInfo?.name || 'Unknown Gift'}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {giftInfo?.value || 0} TON each
                                </div>
                                {giftInfo && (
                                  <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${
                                    giftInfo.rarity === 'common' ? 'bg-gray-600 text-gray-300' :
                                    giftInfo.rarity === 'rare' ? 'bg-blue-600 text-blue-200' :
                                    giftInfo.rarity === 'epic' ? 'bg-purple-600 text-purple-200' :
                                    'bg-yellow-600 text-yellow-200'
                                  }`}>
                                    {giftInfo.rarity}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-white font-bold text-lg">×{count}</div>
                              <div className="text-sm text-gray-400">quantity</div>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-600/50">
                            <div className="text-sm text-gray-300">
                              Total Value: <span className="text-blue-400 font-medium">
                                {((giftInfo?.value || 0) * count).toFixed(3)} TON
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-700">
              <div className="text-center">
                <div className="text-sm text-gray-400">
                  Total Gifts: {selectedPlayer.gifts.length}
                </div>
                <div className="text-lg font-bold text-blue-400">
                  {selectedPlayer.giftValue.toFixed(3)} TON
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {showWinnerModal && winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center animate-bounce">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Winner!</h2>
            <div className="text-xl text-gray-600 mb-2">{winner.name}</div>
            <div className="text-2xl font-bold text-blue-600 mb-2">
              Won: {activePlayers.reduce((sum, player) => sum + player.giftValue, 0).toFixed(3)} TON
            </div>
            <button
              onClick={() => setShowWinnerModal(false)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-8 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
