"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useGameDatabase } from "../../hooks/useGameDatabase"

// Shadcn UI components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Lucide React Icons
import {
  Gift,
  RefreshCw,
  Copy,
  ExternalLink,
  X,
  Info,
  History,
  Trophy,
  DollarSign,
  Users,
  Zap,
  AlertCircle,
  Play,
  Clock,
} from "lucide-react"
import Image from "next/image"

// Telegram WebApp types
interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
  }
  ready: () => void
  expand: () => void
  close: () => void
  openLink: (url: string) => void
  showPopup: (
    params: {
      title?: string
      message: string
      buttons?: Array<{
        id?: string
        type?: "default" | "ok" | "close" | "cancel" | "destructive"
        text: string
      }>
    },
    callback?: (buttonId: string) => void,
  ) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    show: () => void
    onClick: (callback: () => void) => void
    hide: () => void
    setText: (text: string) => void
    setParams: (params: { color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void
  }
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
  }
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred: (type: "error" | "success" | "warning") => void
    selectionChanged: () => void
  }
  viewportHeight: number
  viewportStableHeight: number
  isExpanded: boolean
  platform: string
  colorScheme: "light" | "dark"
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

interface Player {
  id: string
  name: string
  balance: number
  color: string
  gifts: string[] // Array of gift emojis
  giftValue: number // Total TON value of gifts
  telegramUser?: TelegramUser // Store Telegram user data for avatar
}

interface GameLog {
  id: string
  message: string
  timestamp: Date
  type: "join" | "spin" | "winner" | "info"
}

interface MatchHistoryEntry {
  id: string
  rollNumber: number
  timestamp: Date
  players: Player[]
  winner: Player
  totalPot: number
  winnerChance: number
}

interface GiftType {
  id: string
  emoji: string
  name: string
  value: number // TON value
  rarity: "common" | "rare" | "epic" | "legendary"
  quantity: number
  nft_address?: string // TON NFT collection address
  nft_item_id?: string // Specific NFT item ID
  is_nft?: boolean // Whether this is an NFT gift
}

type HistoryFilter = "time" | "luckiest" | "fattest"

const COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Light Blue
  "#96CEB4", // Mint Green
  "#FFEAA7", // Light Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Seafoam Green
  "#F7DC6F", // Gold
  "#BB8FCE", // Lavender
  "#85C1E9", // Sky Blue
  "#F8C471", // Orange
  "#82E0AA", // Emerald Green
  "#F1948A", // Coral
  "#85929E", // Slate Gray
  "#D7BDE2", // Light Purple
]

const SPIN_DURATION = 4000
const COUNTDOWN_DURATION = 60

// NFT Deposit configuration - Telegram-based
const NFT_DEPOSIT_TELEGRAM = "@grinchroll_bot" // Telegram username for NFT gift transfers

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
    clearError,
    loadPlayerInventory,
  } = useGameDatabase()

  const [players, setPlayers] = useState<Player[]>([])
  const [gameLog, setGameLog] = useState<GameLog[]>([])
  const [isSpinning, setIsSpinning] = useState(false)
  const [winner, setWinner] = useState<Player | null>(null)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [playerBalance, setPlayerBalance] = useState("")
  const [activeTab, setActiveTab] = useState<"pvp" | "gifts" | "earn">("pvp")
  const [rollNumber, setRollNumber] = useState(8343) // Persistent roll number
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [showMatchHistory, setShowMatchHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("time")
  const [userInventory, setUserInventory] = useState<GiftType[]>([])
  const [showGiftPopup, setShowGiftPopup] = useState(false)
  const [selectedGifts, setSelectedGifts] = useState<{ id: string; quantity: number }[]>([])
  const [showPlayerGiftsPopup, setShowPlayerGiftsPopup] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  // NFT Deposit states
  const [showNftDepositPopup, setShowNftDepositPopup] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)

  // Telegram WebApp state
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Avatar cache to store loaded images
  const avatarCache = useRef<Map<string, HTMLImageElement>>(new Map())

  // Helper function to load and cache Telegram avatars
  const loadTelegramAvatar = useCallback(async (photoUrl: string): Promise<HTMLImageElement> => {
    // Check cache first
    if (avatarCache.current.has(photoUrl)) {
      return avatarCache.current.get(photoUrl)!
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous" // Set crossOrigin for CORS
      img.onload = () => {
        console.log("Avatar loaded successfully:", photoUrl)
        avatarCache.current.set(photoUrl, img)
        resolve(img)
      }
      img.onerror = (error) => {
        console.error("Avatar failed to load:", photoUrl, error)
        reject(error)
      }
      img.src = photoUrl
    })
  }, [])

  // Preload all player avatars
  const preloadAvatars = useCallback(async () => {
    const promises = players
      .filter((player) => player.telegramUser?.photo_url)
      .map((player) => {
        console.log("Preloading avatar for:", player.name, "URL:", player.telegramUser?.photo_url)
        return loadTelegramAvatar(player.telegramUser!.photo_url!)
      })

    console.log("Found", promises.length, "avatars to preload")

    try {
      await Promise.all(promises)
      console.log("All avatars preloaded successfully")
      return true // Return success status
    } catch (error) {
      console.warn("Some avatars failed to load:", error)
      return false
    }
  }, [players, loadTelegramAvatar])

  const addToLog = useCallback(
    (message: string, type: GameLog["type"] = "info") => {
      const newLog: GameLog = {
        id: Date.now().toString(),
        message,
        timestamp: new Date(),
        type,
      }
      setGameLog((prev) => [newLog, ...prev.slice(0, 19)])

      // Add haptic feedback for Telegram WebApp
      if (webApp?.HapticFeedback) {
        switch (type) {
          case "winner":
            webApp.HapticFeedback.notificationOccurred("success")
            break
          case "join":
            webApp.HapticFeedback.impactOccurred("light")
            break
          case "spin":
            webApp.HapticFeedback.impactOccurred("medium")
            break
        }
      }
    },
    [webApp],
  )

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 140

    ctx.clearRect(0, 0, canvas.width, canvas.width)

    // Use activePlayers instead of players
    const activePlayers = dbPlayers.length > 0 ? dbPlayers : players

    if (activePlayers.length === 0) {
      // Draw empty wheel with transparent background
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
      gradient.addColorStop(0, "rgba(75, 85, 99, 0.3)")
      gradient.addColorStop(1, "rgba(55, 65, 81, 0.5)")

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.fill()

      ctx.strokeStyle = "rgba(156, 163, 175, 0.5)"
      ctx.lineWidth = 3
      ctx.stroke()

      return
    }

    const totalValue = activePlayers.reduce((sum, player) => sum + player.balance + player.giftValue, 0)
    let currentAngle = -Math.PI / 2 // Start at top (12 o'clock position) where the arrow points

    activePlayers.forEach((player) => {
      const playerValue = player.balance + player.giftValue
      const segmentAngle = (playerValue / totalValue) * 2 * Math.PI

      // Draw segment
      ctx.fillStyle = player.color
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + segmentAngle)
      ctx.closePath()
      ctx.fill()

      // Draw avatar and value if segment is large enough
      if (segmentAngle > 0.2) {
        const textAngle = currentAngle + segmentAngle / 2
        const textRadius = radius * 0.7
        const textX = centerX + Math.cos(textAngle) * textRadius
        const textY = centerY + Math.sin(textAngle) * textRadius

        ctx.save()
        ctx.translate(textX, textY)

        // Draw avatar circle
        const avatarRadius = 14

        // Check if player has Telegram photo and it's cached
        if (player.telegramUser?.photo_url && avatarCache.current.has(player.telegramUser.photo_url)) {
          console.log("Drawing cached avatar for:", player.name)
          const avatarImg = avatarCache.current.get(player.telegramUser.photo_url)!

          try {
            ctx.save()
            ctx.beginPath()
            ctx.arc(0, 0, avatarRadius, 0, 2 * Math.PI)
            ctx.clip()
            ctx.drawImage(avatarImg, -avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2)
            ctx.restore()

            // Draw white border around avatar
            ctx.strokeStyle = "#fff"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(0, 0, avatarRadius, 0, 2 * Math.PI)
            ctx.stroke()
          } catch (error) {
            console.error("Error drawing avatar for:", player.name, error)
            drawFallbackAvatar()
          }
        } else {
          drawFallbackAvatar()
        }

        // Function to draw fallback avatar
        function drawFallbackAvatar() {
          if (!ctx) return

          const gradient = ctx.createLinearGradient(-avatarRadius, -avatarRadius, avatarRadius, avatarRadius)
          gradient.addColorStop(0, "#60A5FA") // blue-400
          gradient.addColorStop(1, "#A855F7") // purple-500

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(0, 0, avatarRadius, 0, 2 * Math.PI)
          ctx.fill()

          // Draw white border around avatar
          ctx.strokeStyle = "#fff"
          ctx.lineWidth = 2
          ctx.stroke()

          // Draw user initial in avatar
          ctx.fillStyle = "#fff"
          ctx.font = "bold 16px DM Sans"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(player.name.charAt(0).toUpperCase(), 0, 0)
        }

        ctx.restore()
      }

      currentAngle += segmentAngle
    })

    // Draw outer border
    ctx.strokeStyle = "rgba(156, 163, 175, 0.7)"
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    ctx.stroke()
  }, [players, dbPlayers])

  const addPlayer = () => {
    const name = playerName.trim()
    const balance = Number.parseInt(playerBalance)

    if (!name || !balance || balance < 1 || balance > 10000) {
      webApp?.showAlert("Пожалуйста, введите корректное имя и баланс (1-10,000)!")
      return
    }

    if (players.some((p) => p.name === name)) {
      webApp?.showAlert("Игрок с таким именем уже существует!")
      return
    }

    if (players.length >= 15) {
      webApp?.showAlert("Максимум 15 игроков!")
      return
    }

    const newPlayer: Player = {
      id: Date.now().toString(),
      name,
      balance,
      color: COLORS[players.length % COLORS.length],
      gifts: ["🎁", "💎", "⭐"].slice(0, Math.floor(Math.random() * 3) + 1), // Random 1-3 gifts
      giftValue: Math.random() * 0.5 + 0.1, // Random gift value between 0.1-0.6 TON
    }

    setPlayers((prev) => [...prev, newPlayer])
    addToLog(`🎉 ${name} присоединился с $${balance.toLocaleString()}!`, "join")
    setPlayerName("")
    setPlayerBalance("")

    // Haptic feedback
    webApp?.HapticFeedback?.impactOccurred("light")
  }

  const spinWheel = useCallback(async () => {
    // Use activePlayers for consistency with display
    const activePlayers = dbPlayers.length > 0 ? dbPlayers : players

    if (activePlayers.length < 2) {
      addToLog("⚠️ Нужно минимум 2 игрока для запуска колеса!", "info")
      webApp?.showAlert("Нужно минимум 2 игрока для запуска колеса!")
      return
    }

    if (isSpinning) return

    setIsSpinning(true)
    addToLog("🎰 Колесо крутится... Удачи всем!", "spin")

    // Add to database log
    if (currentGameId) {
      await addDbGameLog(currentGameId, null, "spin", "🎰 Колесо крутится... Удачи всем!")
    }

    // Haptic feedback for spin
    webApp?.HapticFeedback?.impactOccurred("heavy")

    // Preload avatars before spinning
    await preloadAvatars()

    const totalValue = activePlayers.reduce((sum, player) => sum + player.balance + player.giftValue, 0)
    const randomValue = Math.random() * totalValue

    let currentSum = 0
    let selectedWinner: Player | null = null

    for (const player of activePlayers) {
      const playerValue = player.balance + player.giftValue
      currentSum += playerValue
      if (randomValue <= currentSum) {
        selectedWinner = player
        break
      }
    }

    // Animate wheel rotation
    const canvas = canvasRef.current
    if (canvas) {
      const spins = 5 + Math.random() * 3
      const finalRotation = spins * 360 + Math.random() * 360
      canvas.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
      canvas.style.transform = `rotate(${finalRotation}deg)`
    }

    spinTimeoutRef.current = setTimeout(async () => {
      if (selectedWinner) {
        const totalBalance = activePlayers.reduce((sum, player) => sum + player.balance, 0)
        const totalGiftValue = activePlayers.reduce((sum, player) => sum + player.giftValue, 0)
        const playerValue = selectedWinner.balance + selectedWinner.giftValue
        const winnerChance = (playerValue / totalValue) * 100

        // Complete game in database
        if (currentGameId && currentPlayer) {
          try {
            await completeGame(currentGameId, currentPlayer.id, winnerChance, totalGiftValue)

            // Add winner log to database
            await addDbGameLog(
              currentGameId,
              currentPlayer.id,
              "winner",
              `🎉 ${selectedWinner.name} выиграл ${totalGiftValue.toFixed(3)} TON в подарках!`,
            )

            // Reload match history
            await loadMatchHistory(10)
          } catch (error) {
            console.error("Failed to complete game in database:", error)
          }
        }

        // Add to match history (local state for immediate display)
        const matchEntry: MatchHistoryEntry = {
          id: Date.now().toString(),
          rollNumber: rollNumber,
          timestamp: new Date(),
          players: [...activePlayers],
          winner: selectedWinner,
          totalPot: totalGiftValue,
          winnerChance: winnerChance,
        }
        setMatchHistory((prev) => [matchEntry, ...prev])

        setWinner(selectedWinner)
        setShowWinnerModal(true)
        addToLog(`🎉 ${selectedWinner.name} выиграл ${totalGiftValue.toFixed(3)} TON в подарках!`, "winner")
        setRollNumber((prev) => prev + 1)

        // Winner haptic feedback
        webApp?.HapticFeedback?.notificationOccurred("success")
      }
      setIsSpinning(false)
      setPlayers([])
      setWinner(null)

      // Create new game for next round
      if (currentPlayer) {
        try {
          await getCurrentGame(rollNumber + 1)
        } catch (error) {
          console.error("Failed to create new game:", error)
        }
      }

      if (canvas) {
        canvas.style.transition = "none"
        canvas.style.transform = "rotate(0deg)"
      }
    }, SPIN_DURATION)
  }, [
    players,
    isSpinning,
    addToLog,
    preloadAvatars,
    rollNumber,
    currentGameId,
    currentPlayer,
    addDbGameLog,
    completeGame,
    loadMatchHistory,
    getCurrentGame,
    dbPlayers,
    webApp,
  ])

  // Auto-spin when countdown reaches 0
  useEffect(() => {
    const activePlayers = dbPlayers.length > 0 ? dbPlayers : players
    if (gameCountdown === 0 && !isSpinning && activePlayers.length >= 2) {
      console.log("Database countdown reached 0, spinning wheel")
      spinWheel()
    }
  }, [gameCountdown, isSpinning, dbPlayers, players, spinWheel])

  // Draw wheel when players change
  useEffect(() => {
    const loadAndDrawWheel = async () => {
      const avatarsLoaded = await preloadAvatars()
      drawWheel()
      // If avatars were loaded, force another redraw to ensure they appear
      if (avatarsLoaded && players.some((p) => p.telegramUser?.photo_url)) {
        setTimeout(() => drawWheel(), 200)
      }
    }
    loadAndDrawWheel()
  }, [players, drawWheel, preloadAvatars])

  // Redraw wheel when database players change
  useEffect(() => {
    const loadAndDrawWheel = async () => {
      const avatarsLoaded = await preloadAvatars()
      drawWheel()
      // If avatars were loaded, force another redraw to ensure they appear
      if (avatarsLoaded && dbPlayers.some((p) => p.telegramUser?.photo_url)) {
        setTimeout(() => drawWheel(), 200)
      }
    }
    loadAndDrawWheel()
  }, [dbPlayers, drawWheel, preloadAvatars])

  // Redraw wheel when switching back to PvP tab or closing match history
  useEffect(() => {
    if (activeTab === "pvp" && !showMatchHistory) {
      const loadAndDrawWheel = async () => {
        await preloadAvatars()
        drawWheel()
      }
      loadAndDrawWheel()
    }
  }, [activeTab, showMatchHistory, drawWheel, preloadAvatars])

  // Cleanup
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current)
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current)
    }
  }, [])

  // Initialize inventory from database (real player inventory)
  useEffect(() => {
    // Use real player inventory instead of simulated data
    if (playerInventory && playerInventory.length > 0) {
      const realInventory = playerInventory.map((item) => ({
        id: item.gift_id,
        emoji: item.gifts?.emoji || "🎁",
        name: item.gifts?.name || "Unknown Gift",
        value: item.gifts?.base_value || 0,
        rarity: (item.gifts?.rarity as "common" | "rare" | "epic" | "legendary") || "common",
        quantity: item.quantity || 0,
        nft_address: item.gifts?.nft_address,
        nft_item_id: item.gifts?.nft_item_id,
        is_nft: item.gifts?.is_nft || false,
      }))
      setUserInventory(realInventory)
    } else {
      // Clear inventory if no gifts in database
      setUserInventory([])
    }
  }, [playerInventory])

  // Load current game on component mount (for cross-device visibility)
  useEffect(() => {
    const loadCurrentGame = async () => {
      try {
        console.log("🎮 PvP Wheel: Loading current game state...")

        // Pass 0 as rollNumber to only load existing games, not create new ones
        const game = await getCurrentGame(0)
        if (game) {
          console.log(
            "✅ Current game loaded:",
            game.roll_number,
            "with",
            game.game_participants?.length || 0,
            "players",
          )

          // Load participants for this game
          await loadGameParticipants(game.id)
        } else {
          console.log("ℹ️ No current game - will create when first user joins")
        }
      } catch (error) {
        console.error("❌ Failed to load current game:", error)
      }
    }

    // Only load if we don't already have a current game
    if (!currentGameId) {
      loadCurrentGame()
    }
  }, [getCurrentGame, loadGameParticipants, currentGameId])

  // Initialize Telegram WebApp with database integration
  useEffect(() => {
    // Wait for Telegram WebApp to be available
    const initTelegram = async () => {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp
        setWebApp(tg)

        // Initialize the WebApp
        tg.ready()
        tg.expand()

        // Configure main button (hidden by default)
        tg.MainButton.hide()

        // Configure back button
        tg.BackButton.hide()

        // Set theme colors based on Telegram theme
        const root = document.documentElement
        if (tg.themeParams.bg_color) {
          root.style.setProperty("--tg-bg-color", tg.themeParams.bg_color)
        }
        if (tg.themeParams.text_color) {
          root.style.setProperty("--tg-text-color", tg.themeParams.text_color)
        }

        // Get user data from Telegram
        const user = tg.initDataUnsafe?.user
        if (user) {
          console.log("Telegram user data:", user)
          setTelegramUser(user)

          // Initialize player in database
          try {
            console.log("Initializing player in database...")
            const dbPlayer = await initializePlayer(user)
            if (dbPlayer) {
              console.log("Database player initialized:", dbPlayer)

              // Auto-fill the player name with Telegram user info
              const displayName = user.username || user.first_name || `User${user.id}`
              setPlayerName(displayName)

              addToLog(`🎯 Добро пожаловать, ${displayName}! Готовы выиграть? 🏆`, "info")

              // Get or create current game
              const game = await getCurrentGame(rollNumber)
              if (game) {
                console.log("Current game:", game)

                // Load participants for this game
                await loadGameParticipants(game.id)
              }
            } else {
              console.log("Failed to initialize player in database, using offline mode")
              addToLog("⚠️ Ошибка подключения к базе данных. Играем в оффлайн режиме.", "info")
            }
          } catch (error) {
            console.error("Failed to initialize player:", error)
            addToLog("⚠️ Не удалось подключиться к базе данных. Используем оффлайн режим.", "info")
          }

          // Show welcome notification
          tg.HapticFeedback?.notificationOccurred("success")
        } else {
          console.log("No Telegram user data found")
          addToLog("⚡ Telegram WebApp готов! Присоединяйтесь к колесу, чтобы выиграть TON и подарки! 🎁", "info")
        }

        // Handle viewport changes for mobile optimization
        const handleViewportChange = () => {
          if (tg.isExpanded) {
            document.body.style.height = `${tg.viewportHeight}px`
          }
        }

        // Listen for viewport changes
        window.addEventListener("resize", handleViewportChange)
        handleViewportChange()

        return () => {
          window.removeEventListener("resize", handleViewportChange)
        }
      } else {
        // Retry initialization if Telegram WebApp is not ready yet
        setTimeout(initTelegram, 100)
      }
    }

    initTelegram()
  }, [addToLog, initializePlayer, getCurrentGame, rollNumber, loadGameParticipants])

  // Sync database players with local state for wheel rendering
  useEffect(() => {
    if (dbPlayers.length > 0) {
      console.log("🔄 Syncing", dbPlayers.length, "players from database")
      // Update local players to match database state
      setPlayers(dbPlayers)
    }
  }, [dbPlayers])

  // Use database players if available, otherwise fall back to local players
  const activePlayers = dbPlayers.length > 0 ? dbPlayers : players

  const totalPot = activePlayers.reduce((sum, player) => sum + player.gifts.length, 0)
  const totalGiftValue = activePlayers.reduce((sum, player) => sum + player.giftValue, 0)
  const totalValue = totalPot + totalGiftValue

  const getRarityColor = (rarity: GiftType["rarity"]) => {
    switch (rarity) {
      case "common":
        return "text-gray-400 border-gray-500"
      case "rare":
        return "text-blue-400 border-blue-500"
      case "epic":
        return "text-purple-400 border-purple-500"
      case "legendary":
        return "text-yellow-400 border-yellow-500"
      default:
        return "text-gray-400 border-gray-500"
    }
  }

  const handleGiftSelection = (giftId: string, quantity: number) => {
    setSelectedGifts((prev) => {
      const existing = prev.find((g) => g.id === giftId)
      if (existing) {
        if (quantity === 0) {
          return prev.filter((g) => g.id !== giftId)
        }
        return prev.map((g) => (g.id === giftId ? { ...g, quantity } : g))
      } else if (quantity > 0) {
        return [...prev, { id: giftId, quantity }]
      }
      return prev
    })

    // Haptic feedback for selection
    webApp?.HapticFeedback?.selectionChanged()
  }

  const getTotalGiftValue = () => {
    return selectedGifts.reduce((total, selected) => {
      const gift = userInventory.find((g) => g.id === selected.id)
      return total + (gift ? gift.value * selected.quantity : 0)
    }, 0)
  }

  const selectAllGifts = () => {
    const allAvailableGifts = userInventory
      .filter((gift) => gift.quantity > 0)
      .map((gift) => ({ id: gift.id, quantity: gift.quantity }))
    setSelectedGifts(allAvailableGifts)
    webApp?.HapticFeedback?.impactOccurred("medium")
  }

  // NFT Deposit Functions
  const openNftDepositPopup = () => {
    setShowNftDepositPopup(true)
    webApp?.HapticFeedback?.impactOccurred("light")
  }

  const copyDepositAddress = () => {
    navigator.clipboard.writeText(NFT_DEPOSIT_TELEGRAM)
    webApp?.HapticFeedback?.notificationOccurred("success")
    addToLog("📋 Telegram адрес скопирован в буфер обмена!", "info")
  }

  const copyUserMessage = () => {
    const message = `Привет! Хочу внести свои NFT подарки для PvP Wheel. Мой username: @${telegramUser?.username || telegramUser?.first_name || "user"}`
    navigator.clipboard.writeText(message)
    webApp?.HapticFeedback?.notificationOccurred("success")
    addToLog("📋 Сообщение скопировано в буфер обмена!", "info")
  }

  const openTelegramDeposit = () => {
    if (!telegramUser) {
      webApp?.HapticFeedback?.notificationOccurred("error")
      webApp?.showAlert("Пожалуйста, сначала подключите свой Telegram аккаунт!")
      return
    }

    const message = `Привет! Хочу внести свои NFT подарки для PvP Wheel. Мой username: @${telegramUser.username || telegramUser.first_name || "user"}`
    const telegramUrl = `https://t.me/${NFT_DEPOSIT_TELEGRAM.substring(1)}?text=${encodeURIComponent(message)}`

    if (webApp) {
      webApp.openLink(telegramUrl)
    } else {
      window.open(telegramUrl, "_blank")
    }

    webApp?.HapticFeedback?.impactOccurred("medium")
    addToLog(`📱 Открываем Telegram для связи с ${NFT_DEPOSIT_TELEGRAM} для внесения NFT`, "info")
  }

  const startNftDeposit = async () => {
    if (!telegramUser) {
      webApp?.HapticFeedback?.notificationOccurred("error")
      webApp?.showAlert("Пожалуйста, сначала подключите свой Telegram аккаунт!")
      return
    }

    setIsDepositing(true)
    webApp?.HapticFeedback?.impactOccurred("medium")

    try {
      // Open Telegram chat with @grinchroll_bot for NFT gift transfer
      openTelegramDeposit()

      addToLog(`📱 Свяжитесь с ${NFT_DEPOSIT_TELEGRAM} в Telegram для внесения ваших NFT подарков!`, "info")

      // Reset depositing state after a moment
      setTimeout(() => {
        addToLog(`Отправьте ваши NFT подарки на ${NFT_DEPOSIT_TELEGRAM} и укажите ваш username.`, "info")
        setIsDepositing(false)
      }, 2000)
    } catch (error) {
      console.error("NFT deposit error:", error)
      webApp?.HapticFeedback?.notificationOccurred("error")
      addToLog(`❌ Не удалось открыть Telegram. Пожалуйста, свяжитесь с ${NFT_DEPOSIT_TELEGRAM} вручную.`, "info")
      setIsDepositing(false)
    }
  }

  const refreshInventory = async () => {
    if (!currentPlayer) return

    webApp?.HapticFeedback?.impactOccurred("light")
    addToLog("🔄 Обновляем инвентарь...", "info")

    try {
      await loadPlayerInventory(currentPlayer.id)
      addToLog("✅ Инвентарь обновлен!", "info")
      webApp?.HapticFeedback?.notificationOccurred("success")
    } catch (error) {
      console.error("Inventory refresh error:", error)
      addToLog("❌ Не удалось обновить инвентарь.", "info")
      webApp?.HapticFeedback?.notificationOccurred("error")
    }
  }

  const confirmGiftSelection = async () => {
    if (selectedGifts.length === 0) {
      webApp?.HapticFeedback?.notificationOccurred("error")
      webApp?.showAlert("Выберите хотя бы один подарок!")
      return
    }

    const name = telegramUser
      ? telegramUser.username || telegramUser.first_name || `User${telegramUser.id}`
      : playerName.trim()

    if (!name) {
      webApp?.HapticFeedback?.notificationOccurred("error")
      webApp?.showAlert("Не удалось получить имя игрока!")
      return
    }

    if (activePlayers.length >= 15) {
      webApp?.HapticFeedback?.notificationOccurred("error")
      webApp?.showAlert("Максимум 15 игроков!")
      return
    }

    // Haptic feedback for successful join/add
    webApp?.HapticFeedback?.notificationOccurred("success")

    // Create gifts array and calculate total value
    const giftSelections: { giftId: string; quantity: number; totalValue: number }[] = []
    let totalGiftValue = 0

    selectedGifts.forEach((selected) => {
      const gift = userInventory.find((g) => g.id === selected.id)
      if (gift) {
        totalGiftValue += gift.value * selected.quantity
        giftSelections.push({
          giftId: gift.id,
          quantity: selected.quantity,
          totalValue: gift.value * selected.quantity,
        })
      }
    })

    // Determine player color and position (only relevant for new participants)
    const playerColor = COLORS[activePlayers.length % COLORS.length]
    const playerPosition = activePlayers.length

    // Join game in database (this function now handles both new joins and adding more gifts)
    if (currentGameId && currentPlayer) {
      try {
        await joinGameWithGifts(currentGameId, currentPlayer.id, giftSelections, playerColor, playerPosition, name)
        setSelectedGifts([])
        setShowGiftPopup(false)
        // Participants and inventory will be reloaded by subscription
      } catch (error) {
        console.error("Failed to add gifts to game:", error)
        addToLog(`❌ Не удалось добавить подарки: ${dbError || "Неизвестная ошибка"}`, "info")
        webApp?.HapticFeedback?.notificationOccurred("error")
      }
    } else {
      // Fallback for offline mode (no database connection)
      const selectedGiftEmojis: string[] = []
      selectedGifts.forEach((selected) => {
        const gift = userInventory.find((g) => g.id === selected.id)
        if (gift) {
          selectedGiftEmojis.push(...Array(selected.quantity).fill(gift.emoji))
        }
      })

      const newPlayer: Player = {
        id: Date.now().toString(),
        name,
        balance: 0,
        color: playerColor,
        gifts: selectedGiftEmojis,
        giftValue: totalGiftValue,
        telegramUser: telegramUser,
      }

      setPlayers((prev) => [...prev, newPlayer])
      addToLog(
        `🎉 ${name} присоединился с ${selectedGiftEmojis.length} подарками на сумму ${totalGiftValue.toFixed(3)} TON! (Оффлайн)`,
        "join",
      )
      setSelectedGifts([])
      setShowGiftPopup(false)
    }
  }

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const sortedMatchHistory = [...dbMatchHistory].sort((a, b) => {
    if (historyFilter === "time") {
      return b.timestamp.getTime() - a.timestamp.getTime()
    } else if (historyFilter === "luckiest") {
      return b.winnerChance - a.winnerChance
    } else if (historyFilter === "fattest") {
      return b.totalPot - a.totalPot
    }
    return 0
  })

  // Render the component
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex flex-col items-center justify-center p-4 safe-area-inset">
      {dbError && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-2 text-center z-50 flex items-center justify-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{dbError}</span>
          <Button variant="ghost" size="sm" onClick={clearError} className="ml-4 text-white hover:bg-red-700">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card className="w-full max-w-md bg-gray-800/70 backdrop-blur-sm border-gray-700 text-white shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-2xl font-bold text-purple-300">PvP Wheel</CardTitle>
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="bg-gray-700 text-gray-300">
                    Раунд #{currentGameId ? rollNumber : "Оффлайн"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Номер текущего раунда</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className={`${currentGameId ? "bg-green-600" : "bg-red-600"} text-white`}>
                    {currentGameId ? "Онлайн" : "Оффлайн"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{currentGameId ? "Подключено к базе данных" : "Не подключено к базе данных"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as "pvp" | "gifts" | "earn")
              webApp?.HapticFeedback?.selectionChanged()
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 bg-gray-700/50">
              <TabsTrigger
                value="pvp"
                className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                <Users className="h-4 w-4 mr-2" /> PvP Колесо
              </TabsTrigger>
              <TabsTrigger
                value="gifts"
                className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                <Gift className="h-4 w-4 mr-2" /> Мои Подарки
              </TabsTrigger>
              <TabsTrigger
                value="earn"
                className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                <DollarSign className="h-4 w-4 mr-2" /> Заработать TON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pvp" className="mt-4 space-y-4">
              <div className="relative w-[300px] h-[300px] mx-auto">
                <canvas ref={canvasRef} width={300} height={300} className="rounded-full"></canvas>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[30px] border-b-red-500"></div>
              </div>

              <div className="text-center text-2xl font-bold text-yellow-300">
                Общий банк: {totalGiftValue.toFixed(3)} TON
              </div>

              <div className="text-center text-xl font-semibold text-green-300 flex items-center justify-center gap-2">
                {gameCountdown !== null && gameCountdown > 0 ? (
                  <>
                    <Clock className="h-5 w-5" />
                    <span>Запуск через: {formatTime(gameCountdown)}</span>
                  </>
                ) : (
                  <span>Ожидаем игроков...</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="font-semibold">Игроки ({activePlayers.length}/15)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      loadMatchHistory(50)
                      setShowMatchHistory(true)
                      webApp?.HapticFeedback?.impactOccurred("light")
                    }}
                    className="text-gray-300 hover:text-white"
                  >
                    <History className="h-4 w-4 mr-2" /> История
                  </Button>
                </div>
                <ScrollArea className="h-40 w-full rounded-md border border-gray-700 p-2 bg-gray-900/50">
                  {activePlayers.length === 0 ? (
                    <p className="text-center text-gray-400 py-4">Пока нет игроков. Будьте первым!</p>
                  ) : (
                    activePlayers.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          {player.telegramUser?.photo_url ? (
                            <Image
                              src={player.telegramUser.photo_url || "/placeholder.svg"}
                              alt={player.name}
                              width={32}
                              height={32}
                              className="rounded-full border-2 border-white"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                              style={{ backgroundColor: player.color }}
                            >
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-gray-200">{player.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPlayer(player)
                              setShowPlayerGiftsPopup(true)
                              webApp?.HapticFeedback?.impactOccurred("light")
                            }}
                            className="text-gray-400 hover:text-gray-200 p-1 h-auto"
                          >
                            <Gift className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-300 font-semibold">
                          {player.gifts.slice(0, 3).map((emoji, i) => (
                            <span key={i}>{emoji}</span>
                          ))}
                          {player.gifts.length > 3 && <span>+{player.gifts.length - 3}</span>}
                          <span>({player.giftValue.toFixed(3)} TON)</span>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>

              <div className="flex flex-col gap-2">
                {telegramUser && (
                  <Button
                    onClick={() => {
                      setShowGiftPopup(true)
                      webApp?.HapticFeedback?.impactOccurred("medium")
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg transition-colors"
                    disabled={isSpinning || dbLoading}
                  >
                    <Gift className="h-5 w-5 mr-2" /> Добавить Подарки и Играть
                  </Button>
                )}
                {!telegramUser && (
                  <>
                    <Input
                      type="text"
                      placeholder="Ваше Имя"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    />
                    <Input
                      type="number"
                      placeholder="Баланс (TON)"
                      value={playerBalance}
                      onChange={(e) => setPlayerBalance(e.target.value)}
                      className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    />
                    <Button
                      onClick={addPlayer}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg transition-colors"
                      disabled={isSpinning || dbLoading}
                    >
                      Присоединиться (Оффлайн)
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => {
                    spinWheel()
                    webApp?.HapticFeedback?.impactOccurred("heavy")
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  disabled={isSpinning || activePlayers.length < 2 || dbLoading}
                >
                  {isSpinning ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Крутится...
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Запустить Колесо
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-semibold text-gray-300">Лог Игры</span>
                <ScrollArea className="h-32 w-full rounded-md border border-gray-700 p-2 bg-gray-900/50">
                  {dbGameLogs.length === 0 && gameLog.length === 0 ? (
                    <p className="text-center text-gray-400 py-4">Пока нет событий игры.</p>
                  ) : (
                    (dbGameLogs.length > 0 ? dbGameLogs : gameLog).map((log) => (
                      <div key={log.id} className="text-sm text-gray-300 py-1">
                        <span className="text-gray-500 mr-2">{log.timestamp.toLocaleTimeString()}</span>
                        <span
                          className={`${
                            log.type === "join"
                              ? "text-green-400"
                              : log.type === "spin"
                                ? "text-blue-400"
                                : log.type === "winner"
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                          }`}
                        >
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="gifts" className="mt-4 space-y-4">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl text-purple-300">Мой Инвентарь</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshInventory}
                    className="text-gray-400 hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-60 w-full rounded-md border border-gray-700 p-2 bg-gray-800/50">
                    {userInventory.length === 0 ? (
                      <div className="text-center text-gray-400 py-4">
                        <p>В вашем инвентаре нет подарков.</p>
                        <p className="text-sm mt-2">Новые игроки получают стартовые подарки автоматически!</p>
                      </div>
                    ) : (
                      userInventory.map((gift) => (
                        <div
                          key={gift.id}
                          className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{gift.emoji}</span>
                            <div>
                              <span className="font-medium text-gray-200">{gift.name}</span>
                              {gift.is_nft && (
                                <Badge variant="outline" className="ml-2 bg-blue-800 text-blue-200 border-blue-700">
                                  NFT
                                </Badge>
                              )}
                              <p className={`text-sm ${getRarityColor(gift.rarity)}`}>
                                {gift.rarity === "common" && "Обычный"}
                                {gift.rarity === "rare" && "Редкий"}
                                {gift.rarity === "epic" && "Эпический"}
                                {gift.rarity === "legendary" && "Легендарный"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-yellow-300">{gift.value.toFixed(3)} TON</span>
                            <p className="text-sm text-gray-400">x{gift.quantity}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                  <Button
                    onClick={openNftDepositPopup}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    <Zap className="h-5 w-5 mr-2" /> Внести NFT Подарки
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="earn" className="mt-4 space-y-4">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-purple-300">Заработать Больше TON</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-gray-300">
                  <p>
                    Хотите получить больше подарков и увеличить свои шансы на победу? Вот несколько способов заработать
                    TON:
                  </p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>
                      <span className="font-semibold text-green-400">Участвуйте в играх:</span> Выигрывайте колесо,
                      чтобы получить весь банк подарков!
                    </li>
                    <li>
                      <span className="font-semibold text-blue-400">Приглашайте друзей:</span> Приводите новых игроков в
                      игру и получайте комиссию с их выигрышей.
                    </li>
                    <li>
                      <span className="font-semibold text-yellow-400">Выполняйте задания:</span> Следите за специальными
                      заданиями и акциями в нашем Telegram канале.
                    </li>
                    <li>
                      <span className="font-semibold text-purple-400">Стейкинг TON:</span> Изучите возможности стейкинга
                      для получения пассивного дохода.
                    </li>
                  </ul>
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-colors"
                    onClick={() => webApp?.HapticFeedback?.impactOccurred("light")}
                  >
                    <ExternalLink className="h-5 w-5 mr-2" /> Присоединиться к Telegram Каналу
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Winner Modal */}
      <Dialog open={showWinnerModal} onOpenChange={setShowWinnerModal}>
        <DialogContent className="sm:max-w-[425px] bg-gray-800/90 backdrop-blur-sm border-gray-700 text-white p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-yellow-400 text-center">🎉 Победитель! 🎉</DialogTitle>
          </DialogHeader>
          <div className="text-center my-4">
            {winner && (
              <>
                {winner.telegramUser?.photo_url ? (
                  <Image
                    src={winner.telegramUser.photo_url || "/placeholder.svg"}
                    alt={winner.name}
                    width={80}
                    height={80}
                    className="rounded-full border-4 border-yellow-400 mx-auto mb-4"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold text-white mx-auto mb-4 border-4 border-yellow-400"
                    style={{ backgroundColor: winner.color }}
                  >
                    {winner.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-3xl font-extrabold text-green-400">{winner.name}</p>
                <p className="text-xl text-gray-300 mt-2">
                  Выиграл <span className="font-bold text-yellow-300">{winner.giftValue.toFixed(3)} TON</span> в
                  подарках!
                </p>
              </>
            )}
          </div>
          <DialogFooter className="flex justify-center">
            <Button
              onClick={() => {
                setShowWinnerModal(false)
                webApp?.HapticFeedback?.impactOccurred("light")
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Играть Снова
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gift Selection Popup */}
      <Dialog open={showGiftPopup} onOpenChange={setShowGiftPopup}>
        <DialogContent className="sm:max-w-[425px] bg-gray-800/90 backdrop-blur-sm border-gray-700 text-white p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-300">Выберите Подарки для Игры</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-60 w-full rounded-md border border-gray-700 p-2 bg-gray-900/50">
            {userInventory.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                <p>Ваш инвентарь пуст.</p>
                <p className="text-sm mt-2">Внесите NFT подарки или заработайте больше TON!</p>
              </div>
            ) : (
              userInventory.map((gift) => (
                <div
                  key={gift.id}
                  className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{gift.emoji}</span>
                    <div>
                      <span className="font-medium text-gray-200">{gift.name}</span>
                      {gift.is_nft && (
                        <Badge variant="outline" className="ml-2 bg-blue-800 text-blue-200 border-blue-700">
                          NFT
                        </Badge>
                      )}
                      <p className={`text-sm ${getRarityColor(gift.rarity)}`}>
                        {gift.rarity === "common" && "Обычный"}
                        {gift.rarity === "rare" && "Редкий"}
                        {gift.rarity === "epic" && "Эпический"}
                        {gift.rarity === "legendary" && "Легендарный"} ({gift.value.toFixed(3)} TON)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleGiftSelection(gift.id, (selectedGifts.find((s) => s.id === gift.id)?.quantity || 0) - 1)
                      }
                      disabled={(selectedGifts.find((s) => s.id === gift.id)?.quantity || 0) === 0}
                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      -
                    </Button>
                    <span className="font-semibold text-gray-200 w-6 text-center">
                      {selectedGifts.find((s) => s.id === gift.id)?.quantity || 0}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleGiftSelection(gift.id, (selectedGifts.find((s) => s.id === gift.id)?.quantity || 0) + 1)
                      }
                      disabled={(selectedGifts.find((s) => s.id === gift.id)?.quantity || 0) >= gift.quantity}
                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
          <div className="flex justify-between items-center mt-4 text-lg font-semibold text-gray-200">
            <span>Общая стоимость:</span>
            <span className="text-yellow-300">{getTotalGiftValue().toFixed(3)} TON</span>
          </div>
          <DialogFooter className="flex flex-col gap-2 mt-4">
            <Button
              onClick={selectAllGifts}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={userInventory.length === 0}
            >
              Выбрать Все Доступные
            </Button>
            <Button
              onClick={confirmGiftSelection}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={selectedGifts.length === 0}
            >
              Подтвердить и Играть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Player Gifts Popup */}
      <Dialog open={showPlayerGiftsPopup} onOpenChange={setShowPlayerGiftsPopup}>
        <DialogContent className="sm:max-w-[425px] bg-gray-800/90 backdrop-blur-sm border-gray-700 text-white p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-300">
              Подарки игрока {selectedPlayer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="my-4">
            {selectedPlayer?.gifts && selectedPlayer.gifts.length > 0 ? (
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedPlayer.gifts.map((emoji, index) => (
                  <span key={index} className="text-4xl p-2 bg-gray-700 rounded-md">
                    {emoji}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400">Нет подарков.</p>
            )}
            <p className="text-center text-xl font-semibold text-yellow-300 mt-4">
              Общая стоимость: {selectedPlayer?.giftValue.toFixed(3) || "0.000"} TON
            </p>
          </div>
          <DialogFooter className="flex justify-center">
            <Button
              onClick={() => {
                setShowPlayerGiftsPopup(false)
                webApp?.HapticFeedback?.impactOccurred("light")
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NFT Deposit Popup */}
      <Dialog open={showNftDepositPopup} onOpenChange={setShowNftDepositPopup}>
        <DialogContent className="sm:max-w-[425px] bg-gray-800/90 backdrop-blur-sm border-gray-700 text-white p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-300">Внести NFT Подарки</DialogTitle>
          </DialogHeader>
          <div className="my-4 space-y-4 text-gray-300">
            <p>
              Чтобы внести ваши NFT подарки, пожалуйста, свяжитесь с нашим ботом в Telegram и переведите ваши NFT. Ваши
              подарки будут проверены вручную и добавлены в ваш игровой инвентарь.
            </p>
            <div className="flex items-center gap-2 bg-gray-700 p-3 rounded-md">
              <Info className="h-5 w-5 text-blue-400" />
              <span className="font-semibold">Telegram Бот:</span>
              <span className="ml-auto text-blue-300">{NFT_DEPOSIT_TELEGRAM}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyDepositAddress}
                className="text-gray-400 hover:text-white p-1 h-auto"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-gray-700 p-3 rounded-md space-y-2">
              <p className="font-semibold">Сообщение для отправки:</p>
              <p className="text-sm bg-gray-800 p-2 rounded-md break-all">
                {"Привет! Хочу внести свои NFT подарки для PvP Wheel. Мой username: @"}
                {telegramUser?.username || telegramUser?.first_name || "user"}
              </p>
              <Button onClick={copyUserMessage} className="w-full bg-gray-600 hover:bg-gray-500 text-white">
                <Copy className="h-4 w-4 mr-2" /> Скопировать Сообщение
              </Button>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 mt-4">
            <Button
              onClick={startNftDeposit}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors"
              disabled={isDepositing || !telegramUser}
            >
              {isDepositing ? "Открываем Telegram..." : "Связаться с Ботом и Внести"}
            </Button>
            {!telegramUser && (
              <p className="text-center text-sm text-red-400">
                Пожалуйста, подключите ваш Telegram аккаунт для внесения NFT.
              </p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match History Modal */}
      <Dialog open={showMatchHistory} onOpenChange={setShowMatchHistory}>
        <DialogContent className="sm:max-w-[600px] bg-gray-800/90 backdrop-blur-sm border-gray-700 text-white p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-300">История Матчей</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-2 my-4">
            <Button
              variant={historyFilter === "time" ? "default" : "outline"}
              onClick={() => {
                setHistoryFilter("time")
                webApp?.HapticFeedback?.selectionChanged()
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white data-[state=active]:bg-purple-700"
            >
              По Времени
            </Button>
            <Button
              variant={historyFilter === "luckiest" ? "default" : "outline"}
              onClick={() => {
                setHistoryFilter("luckiest")
                webApp?.HapticFeedback?.selectionChanged()
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white data-[state=active]:bg-purple-700"
            >
              Самые Удачные
            </Button>
            <Button
              variant={historyFilter === "fattest" ? "default" : "outline"}
              onClick={() => {
                setHistoryFilter("fattest")
                webApp?.HapticFeedback?.selectionChanged()
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white data-[state=active]:bg-purple-700"
            >
              Самый Большой Банк
            </Button>
          </div>
          <ScrollArea className="h-[400px] w-full rounded-md border border-gray-700 p-2 bg-gray-900/50">
            {sortedMatchHistory.length === 0 ? (
              <p className="text-center text-gray-400 py-4">Пока нет истории матчей.</p>
            ) : (
              sortedMatchHistory.map((match) => (
                <Card key={match.id} className="mb-4 bg-gray-800 border-gray-700 text-white">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-bold text-yellow-300">Раунд #{match.rollNumber}</span>
                      <span className="text-sm text-gray-400">{match.timestamp.toLocaleString()}</span>
                    </div>
                    <Separator className="bg-gray-700 my-2" />
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-5 w-5 text-green-400" />
                      <span className="font-semibold text-green-300">Победитель: {match.winner.name}</span>
                      <Badge variant="secondary" className="bg-green-800 text-green-200">
                        {match.winnerChance.toFixed(2)}% Шанс
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-yellow-400" />
                      <span className="font-semibold text-yellow-300">Общий банк: {match.totalPot.toFixed(3)} TON</span>
                    </div>
                    <div className="mt-3">
                      <span className="font-semibold text-gray-300">Игроки:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {match.players.map((player) => (
                          <Badge
                            key={player.id}
                            variant="outline"
                            className="bg-gray-700 text-gray-300 border-gray-600"
                          >
                            {player.name} ({player.giftValue.toFixed(3)} TON)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </ScrollArea>
          <DialogFooter className="flex justify-center mt-4">
            <Button
              onClick={() => {
                setShowMatchHistory(false)
                webApp?.HapticFeedback?.impactOccurred("light")
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
