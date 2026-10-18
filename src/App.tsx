import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  Folder,
  Timer as TimerIcon,
  Sparkles,
  Bell,
  Coffee,
  Brain,
  UploadCloud,
  Hourglass,
  Music2,
  Settings,
} from 'lucide-react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import {
  WINDOW_SIZES,
  SHELL_CONFIGS,
  resizeWindow,
  type WindowSize,
  type ShellConfig,
} from './core/windowSizing'
import {
  globalTimerEngine,
  formatTimeDisplay,
  type TimerData,
} from './core/timer'
import { globalShelfEngine } from './core/shelf'
import { FileShelf } from './features/shelf/FileShelf'
import { globalMediaEngine, type MediaData } from './core/media'
import { ExpandedMusic } from './features/media/ExpandedMusic'
import { AudioWaveform } from './features/media/AudioWaveform'
import { getT } from './core/i18n'
import { globalSettingsEngine, type AppSettings } from './core/settings'
import { SettingsView } from './features/settings/SettingsView'

// Authentic Apple Dynamic Island spring transition curve
const springTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
  restDelta: 0.5,
  restSpeed: 0.5,
}

// Format clock time respecting system OS 12h/24h preferences
function formatClockTime(now: Date, mode: 'auto' | '12h' | '24h' = 'auto'): string {
  if (mode === '12h') {
    return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  if (mode === '24h') {
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatCompactRemaining(secs: number): string {
  if (secs <= 0) return '0s'
  if (secs < 60) return `${secs}s`
  const m = Math.ceil(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(secs / 3600)
  return `${h}h`
}

type IslandView =
  | 'droplet'
  | 'idle'
  | 'home'
  | 'expandedTimer'
  | 'expandedMusic'
  | 'alert'
  | 'dropTarget'
  | 'settings'

function getIslandView(
  displayState: 'capsule' | 'droplet',
  expandedActivity: 'home' | 'timer' | 'music' | 'settings' | null,
  timerData: TimerData | null,
  isDragOver: boolean,
): IslandView {
  if (timerData?.status === 'completed') return 'alert'
  if (expandedActivity === 'settings') return 'settings'
  if (expandedActivity === 'music') return 'expandedMusic'
  if (expandedActivity === 'home') return 'home'
  if (expandedActivity === 'timer') return 'expandedTimer'
  if (isDragOver) return 'dropTarget'
  if (displayState === 'droplet') return 'droplet'
  return 'idle'
}

export default function App() {
  // App Settings Engine subscription (Spec Fase 5)
  const [settings, setSettings] = useState<AppSettings>(() => globalSettingsEngine.getSettings())

  useEffect(() => {
    return globalSettingsEngine.subscribe((newSettings) => {
      setSettings({ ...newSettings })
    })
  }, [])

  const t = getT(settings.language)

  // Global Timestamp-based Timer Engine subscription (Spec Fase 2)
  const [timerData, setTimerData] = useState<TimerData | null>(() => globalTimerEngine.getData())
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => globalTimerEngine.getRemainingSeconds())

  useEffect(() => {
    return globalTimerEngine.subscribe((data, remaining) => {
      setTimerData(data ? { ...data } : null)
      setRemainingSeconds(remaining)
    })
  }, [])

  // Global SMTC Media Engine subscription (Spec Fase 4)
  const [mediaData, setMediaData] = useState<MediaData | null>(() => globalMediaEngine.getData())

  useEffect(() => {
    return globalMediaEngine.subscribe((data) => {
      setMediaData(data ? { ...data } : null)
    })
  }, [])

  // OS Foreground Application State & Droplet Mode (Spec 5.1 & Fase 1b)
  const [systemMode, setSystemMode] = useState<'desktop' | 'app' | 'hidden'>('desktop')
  const [displayState, setDisplayState] = useState<'capsule' | 'droplet'>('capsule')
  const [isDwelling, setIsDwelling] = useState(false)

  // Expanded focus state: null (compact), 'home', 'timer', 'music', or 'settings'
  const [expandedActivity, setExpandedActivity] = useState<'home' | 'timer' | 'music' | 'settings' | null>(null)

  // Auto-clear expanded activity when timer completes so alert pops into view
  useEffect(() => {
    if (timerData?.status === 'completed') {
      setExpandedActivity(null)
    }
  }, [timerData?.status])

  // Custom timer duration inputs on Home card (Jam, Menit, Detik - all default to 0)
  const [customHours, setCustomHours] = useState<string>('0')
  const [customMins, setCustomMins] = useState<string>('0')
  const [customSecs, setCustomSecs] = useState<string>('0')
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false)
  const customMinsInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustomInput && customMinsInputRef.current) {
      customMinsInputRef.current.focus({ preventScroll: true })
      customMinsInputRef.current.select()
    }
  }, [showCustomInput])

  // Dev controls active ONLY in normal browser development mode (NOT inside Tauri window)
  const isBrowserDev =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !('__TAURI_INTERNALS__' in window)
  const [showDevControls, setShowDevControls] = useState(isBrowserDev)

  // User system clock format preference ('auto' | '12h' | '24h')
  const [clockFormat, setClockFormat] = useState<'auto' | '12h' | '24h'>('auto')

  // Query OS 12h/24h time setting from Windows via Tauri
  useEffect(() => {
    invoke<string>('get_system_time_format')
      .then((fmt) => {
        if (fmt === '12h' || fmt === '24h') {
          setClockFormat(fmt)
        }
      })
      .catch(() => {})
  }, [])

  // System Clock state
  const [timeStr, setTimeStr] = useState(() => {
    return formatClockTime(new Date(), 'auto')
  })
  const [dateStr, setDateStr] = useState(() => {
    return new Date().toLocaleDateString(typeof navigator !== 'undefined' ? navigator.language : undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  })

  // Drag and drop listener for File Shelf (Spec Fase 3)
  const [isDragOver, setIsDragOver] = useState(false)
  const [homePage, setHomePage] = useState<number>(1)

  // Always reset to Clock (Page 1) and close custom input when card is collapsed/closed
  useEffect(() => {
    if (expandedActivity === null) {
      setHomePage(1)
      setShowCustomInput(false)
    }
  }, [expandedActivity])

  useEffect(() => {
    // HTML5 dragover & dragenter preventDefault ensures WebView2 allows dropping folders without OS forbidden cursor
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('drop', handleDrop)

    let unlisten: (() => void) | undefined
    try {
      getCurrentWebviewWindow()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDragOver(true)
            setHomePage(2)
          } else if (event.payload.type === 'leave') {
            setIsDragOver(false)
          } else if (event.payload.type === 'drop') {
            setIsDragOver(false)
            setHomePage(2)
            if (event.payload.paths && event.payload.paths.length > 0) {
              globalShelfEngine.addPaths(event.payload.paths)
              setExpandedActivity('home')
            }
          }
        })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
    } catch {}

    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('drop', handleDrop)
      if (unlisten) unlisten()
    }
  }, [])

  // Wheel and swipe gesture handling for Home 3-page pager (0 = Musik, 1 = Jam/Timer, 2 = Shelf)
  const lastWheelTime = useRef<number>(0)
  const pointerStartX = useRef<number | null>(null)
  const isSwiping = useRef<boolean>(false)

  const handleHomeWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheelTime.current < 260) return

    const dx = e.deltaX
    const dy = e.deltaY

    // If on Page 2 (File Shelf) and cursor is over the file list, preserve vertical list scrolling
    const target = e.target as HTMLElement | null
    const fileList = target?.closest('.shelf-file-list') as HTMLElement | null

    if (homePage === 2 && fileList) {
      const canScrollDown = fileList.scrollHeight > fileList.clientHeight &&
        fileList.scrollTop + fileList.clientHeight < fileList.scrollHeight - 2
      const canScrollUp = fileList.scrollTop > 2

      // Only preserve list scrolling if the list can actually scroll in that direction
      if (dy > 10 && canScrollDown) return
      if (dy < -10 && canScrollUp) return
    }

    // Direction detection:
    // Next page (advance right: 0 -> 1 -> 2): mouse wheel down (dy > 15) OR swipe left (dx > 15)
    // Prev page (advance left: 2 -> 1 -> 0): mouse wheel up (dy < -15) OR swipe right (dx < -15)
    if (dx > 15 || dy > 15) {
      if (homePage === 0) {
        lastWheelTime.current = now
        setHomePage(1)
      } else if (homePage === 1) {
        lastWheelTime.current = now
        setHomePage(2)
      }
    } else if (dx < -15 || dy < -15) {
      if (homePage === 2) {
        lastWheelTime.current = now
        setHomePage(1)
      } else if (homePage === 1) {
        lastWheelTime.current = now
        setHomePage(0)
      }
    }
  }

  const handleHomePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target?.closest('button, input, select, textarea, [data-shelf-item], .shelf-item')) return
    pointerStartX.current = e.clientX
    isSwiping.current = true
  }

  const handleHomePointerUp = (e: React.PointerEvent) => {
    if (!isSwiping.current || pointerStartX.current === null) return
    const diffX = e.clientX - pointerStartX.current
    const threshold = 30

    if (diffX < -threshold) {
      // Swipe left -> slide rightward
      if (homePage === 0) setHomePage(1)
      else if (homePage === 1) setHomePage(2)
    } else if (diffX > threshold) {
      // Swipe right -> slide leftward
      if (homePage === 2) setHomePage(1)
      else if (homePage === 1) setHomePage(0)
    }

    isSwiping.current = false
    pointerStartX.current = null
  }

  // Multi-activity flags for layout
  const isTimerActive = timerData !== null && (timerData.status === 'running' || timerData.status === 'paused')
  const isMediaActive = mediaData !== null && mediaData.isActive
  const isExpanded = expandedActivity !== null || timerData?.status === 'completed'
  const hasMusic = isMediaActive && !isExpanded
  const hasTimer = isTimerActive && !isExpanded

  // Hover Dwell (2s) and Auto-Collapse handlers (Spec: hover 2s expands, cursor moves away collapses)
  const [hoveredTarget, setHoveredTarget] = useState<'timer' | 'music' | null>(null)
  const hoverDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBubblePointerEnter = (type: 'timer' | 'music') => {
    if (leaveCollapseTimerRef.current) {
      clearTimeout(leaveCollapseTimerRef.current)
      leaveCollapseTimerRef.current = null
    }

    setHoveredTarget(type)

    hoverDwellTimerRef.current = setTimeout(() => {
      setExpandedActivity(type)
      setHoveredTarget(null)
    }, 2000)
  }

  const handleBubblePointerLeave = () => {
    if (hoverDwellTimerRef.current) {
      clearTimeout(hoverDwellTimerRef.current)
      hoverDwellTimerRef.current = null
    }
    setHoveredTarget(null)
  }

  const handleExpandedPointerEnter = () => {
    if (leaveCollapseTimerRef.current) {
      clearTimeout(leaveCollapseTimerRef.current)
      leaveCollapseTimerRef.current = null
    }
  }

  const handleExpandedPointerLeave = () => {
    if (expandedActivity === 'timer' || expandedActivity === 'music') {
      leaveCollapseTimerRef.current = setTimeout(() => {
        setExpandedActivity(null)
      }, 250)
    }
  }

  // Dynamically resolve shell and window dimensions
  const getDynamicDimensions = (
    view: IslandView,
    isCustom: boolean,
    musicActive: boolean,
    timerActive: boolean,
  ) => {
    const baseShell = { ...SHELL_CONFIGS[view] }
    const baseWin = { ...WINDOW_SIZES[view] }

    if (view === 'idle') {
      if (musicActive && timerActive) {
        baseWin.width = 260
      } else if (musicActive || timerActive) {
        baseWin.width = 220
      } else {
        baseWin.width = 170
      }
    }

    if (view === 'home') {
      const height = isCustom ? 268 : 230
      const winHeight = isCustom ? 310 : 270
      baseShell.height = height
      baseWin.height = winHeight
    }

    return { shell: baseShell, win: baseWin }
  }

  // Synchronized persistent shell state
  const targetView = getIslandView(displayState, expandedActivity, timerData, isDragOver)
  const [currentView, setCurrentView] = useState<IslandView>(targetView)
  const initialDims = getDynamicDimensions(targetView, showCustomInput, hasMusic, hasTimer)
  const [shellConfig, setShellConfig] = useState<ShellConfig>(initialDims.shell)
  const currentWindowSizeRef = useRef<WindowSize>(initialDims.win)

  // Synchronize OS window bounds and shell spring animation
  useEffect(() => {
    const { shell: nextShell, win: nextWin } = getDynamicDimensions(
      targetView,
      showCustomInput,
      hasMusic,
      hasTimer,
    )

    if (
      currentWindowSizeRef.current.width !== nextWin.width ||
      currentWindowSizeRef.current.height !== nextWin.height
    ) {
      currentWindowSizeRef.current = nextWin
      resizeWindow(nextWin.width, nextWin.height)
    }

    setCurrentView(targetView)
    setShellConfig(nextShell)
  }, [targetView, showCustomInput, hasMusic, hasTimer])

  const handleAnimationComplete = () => {
    // No-op: window resize is now handled synchronously for both expand and collapse
  }

  // Alert Auto-Dismiss after 30s of inactivity (Spec Section 5 item 5)
  useEffect(() => {
    if (currentView !== 'alert' && timerData?.status !== 'completed') return
    const timer = setTimeout(() => {
      globalTimerEngine.dismissAlert()
    }, 30000)
    return () => clearTimeout(timer)
  }, [currentView, timerData?.status])

  // Listen to OS foreground state changes from Rust detector (event-driven)
  useEffect(() => {
    let unlisten: (() => void) | undefined

    invoke<string>('get_app_mode')
      .then((mode) => {
        if (mode === 'app' || mode === 'desktop' || mode === 'hidden') {
          setSystemMode(mode)
        }
      })
      .catch(() => {})

    listen<{ mode: 'desktop' | 'app' | 'hidden' }>('app_mode_changed', (event) => {
      setSystemMode(event.payload.mode)
    }).then((fn) => {
      unlisten = fn
    }).catch(() => {})

    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  // Auto-restore capsule when user returns to desktop (Spec 5.1 point 5)
  useEffect(() => {
    if (systemMode === 'desktop') {
      setDisplayState('capsule')
      setIsDwelling(false)
    }
  }, [systemMode])

  // In app mode, enter droplet after inactivitySeconds of no interaction (Spec 5.1 point 2)
  useEffect(() => {
    if (
      !settings.autoDroplet ||
      systemMode !== 'app' ||
      displayState !== 'capsule' ||
      expandedActivity !== null ||
      currentView === 'alert'
    ) return

    const timeoutMs = (settings.inactivitySeconds || 10) * 1000
    let timer = setTimeout(() => {
      setDisplayState('droplet')
    }, timeoutMs)

    const resetDropletTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setDisplayState('droplet')
      }, timeoutMs)
    }

    window.addEventListener('mousemove', resetDropletTimer)
    window.addEventListener('mousedown', resetDropletTimer)
    window.addEventListener('keydown', resetDropletTimer)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', resetDropletTimer)
      window.removeEventListener('mousedown', resetDropletTimer)
      window.removeEventListener('keydown', resetDropletTimer)
    }
  }, [systemMode, displayState, expandedActivity, currentView, settings.autoDroplet, settings.inactivitySeconds])

  // Dwell hover: dwellSeconds on droplet re-emerges capsule with spring (Spec 5.1 point 4)
  useEffect(() => {
    if (!isDwelling || displayState !== 'droplet') return

    const dwellMs = (settings.dwellSeconds || 2) * 1000
    const dwellTimer = setTimeout(() => {
      setIsDwelling(false)
      setDisplayState('capsule')
    }, dwellMs)

    return () => clearTimeout(dwellTimer)
  }, [isDwelling, displayState, settings.dwellSeconds])

  // Align clock updates to minute boundaries and follow system 12h/24h setting and language
  useEffect(() => {
    const effectiveFormat = settings.timeFormat === 'auto' ? clockFormat : settings.timeFormat
    const updateTime = () => {
      const now = new Date()
      setTimeStr(formatClockTime(now, effectiveFormat))
      const locale =
        settings.language === 'id'
          ? 'id-ID'
          : settings.language === 'en'
          ? 'en-US'
          : typeof navigator !== 'undefined'
          ? navigator.language
          : undefined
      setDateStr(
        now.toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
      )
    }

    updateTime()
    const now = new Date()
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()

    let intervalId: ReturnType<typeof setInterval>
    const timeoutId = setTimeout(() => {
      updateTime()
      intervalId = setInterval(updateTime, 60000)
    }, msToNextMinute)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [clockFormat, settings.timeFormat, settings.language])

  // Listen to tray events from Tauri backend (Settings, Personality, Autostart)
  useEffect(() => {
    const unlisteners: Array<() => void> = []

    listen('open_settings', () => {
      setExpandedActivity('settings')
    }).then((fn) => unlisteners.push(fn)).catch(() => {})

    listen('toggle_personality', () => {
      const curr = globalSettingsEngine.getSettings().personalityEnabled
      globalSettingsEngine.update({ personalityEnabled: !curr })
    }).then((fn) => unlisteners.push(fn)).catch(() => {})

    listen<boolean>('autostart_changed', (e) => {
      globalSettingsEngine.update({ autostart: e.payload })
    }).then((fn) => unlisteners.push(fn)).catch(() => {})

    return () => {
      unlisteners.forEach((fn) => fn())
    }
  }, [])

  // Personality - Mata Kuma Blinking Eyes State (Spec 178)
  const [isPersonalityIdle, setIsPersonalityIdle] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)

  // Trigger Mata Kuma eyes after inactivity delay when in idle mode
  useEffect(() => {
    if (
      currentView !== 'idle' ||
      !settings.personalityEnabled ||
      systemMode === 'hidden'
    ) {
      setIsPersonalityIdle(false)
      return
    }

    const idleDelayMs = (settings.idleBeforeEyesSeconds || 6) * 1000
    let timerId = setTimeout(() => {
      setIsPersonalityIdle(true)
    }, idleDelayMs)

    const handleActivity = () => {
      setIsPersonalityIdle(false)
      clearTimeout(timerId)
      timerId = setTimeout(() => {
        setIsPersonalityIdle(true)
      }, idleDelayMs)
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('mousedown', handleActivity)
    window.addEventListener('keydown', handleActivity)

    return () => {
      clearTimeout(timerId)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [currentView, settings.personalityEnabled, settings.idleBeforeEyesSeconds, systemMode])

  // Randomized blink scheduler (3s - 6s) - completely stops when hidden or inactive (Spec 178)
  useEffect(() => {
    if (
      currentView !== 'idle' ||
      !isPersonalityIdle ||
      !settings.personalityEnabled ||
      systemMode === 'hidden'
    ) {
      setIsBlinking(false)
      return
    }

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null
    let resetTimeout: ReturnType<typeof setTimeout> | null = null
    let active = true

    const scheduleNextBlink = () => {
      const delay = Math.floor(Math.random() * 3000) + 3000
      blinkTimeout = setTimeout(() => {
        if (!active) return
        setIsBlinking(true)
        resetTimeout = setTimeout(() => {
          if (!active) return
          setIsBlinking(false)
          scheduleNextBlink()
        }, 140)
      }, delay)
    }

    scheduleNextBlink()

    return () => {
      active = false
      if (blinkTimeout) clearTimeout(blinkTimeout)
      if (resetTimeout) clearTimeout(resetTimeout)
      setIsBlinking(false)
    }
  }, [currentView, isPersonalityIdle, settings.personalityEnabled, systemMode])

  // Collapse on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentView === 'alert' || timerData?.status === 'completed') {
          globalTimerEngine.dismissAlert()
        } else {
          setExpandedActivity(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView, timerData?.status])

  // Collapse on window blur / loss of focus
  useEffect(() => {
    const handleBlur = () => {
      if (currentView !== 'alert') {
        setExpandedActivity(null)
      }
    }
    window.addEventListener('blur', handleBlur)

    let unlisten: (() => void) | undefined
    try {
      const win = getCurrentWebviewWindow()
      win.onFocusChanged(({ payload: focused }) => {
        if (!focused && currentView !== 'alert') {
          setExpandedActivity(null)
        }
      }).then((fn) => {
        unlisten = fn
      }).catch(() => {})
    } catch {}

    return () => {
      window.removeEventListener('blur', handleBlur)
      if (unlisten) unlisten()
    }
  }, [currentView])

  // Inactivity auto-collapse for Home (10s without mouse/keyboard interaction)
  useEffect(() => {
    if (expandedActivity !== 'home') return

    let timer = setTimeout(() => {
      setExpandedActivity(null)
    }, 10000)

    const resetInactivity = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setExpandedActivity(null)
      }, 10000)
    }

    window.addEventListener('mousemove', resetInactivity)
    window.addEventListener('mousedown', resetInactivity)
    window.addEventListener('keydown', resetInactivity)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', resetInactivity)
      window.removeEventListener('mousedown', resetInactivity)
      window.removeEventListener('keydown', resetInactivity)
    }
  }, [expandedActivity])

  // Shell click handler
  const handleShellClick = () => {
    if (currentView === 'idle') {
      setExpandedActivity('home')
      setHomePage(1)
    } else if (currentView === 'droplet') {
      setIsDwelling(false)
      setDisplayState('capsule')
      setExpandedActivity('home')
      setHomePage(1)
    } else if (currentView === 'dropTarget') {
      setExpandedActivity('home')
      setHomePage(2)
    }
  }
  // Digits-only duration input handler: blocks non-digits, strips leading 0 seamlessly, clamps to max
  const handleDurationInput = (
    raw: string,
    max: number,
    setter: (val: string) => void,
  ) => {
    const digits = raw.replace(/\D/g, '')
    if (digits === '') {
      setter('')
      return
    }
    const stripped = digits.replace(/^0+(?=\d)/, '')
    const num = parseInt(stripped, 10) || 0
    const clamped = Math.min(max, num)
    setter(clamped.toString())
  }

  // Handle custom duration start (Jam, Menit, Detik)
  const handleStartCustom = (e: React.FormEvent) => {
    e.preventDefault()
    const h = parseInt(customHours, 10) || 0
    const m = parseInt(customMins, 10) || 0
    const s = parseInt(customSecs, 10) || 0
    const totalSecs = Math.max(0, h) * 3600 + Math.max(0, m) * 60 + Math.max(0, s)
    if (totalSecs > 0) {
      globalTimerEngine.startTimerSeconds(totalSecs)
      setShowCustomInput(false)
      setExpandedActivity(null)
    }
  }

  // Progress calculations for compact ring and expanded bar
  const timerProgress = timerData && timerData.totalDurationSeconds > 0
    ? Math.min(1, Math.max(0, remainingSeconds / timerData.totalDurationSeconds))
    : 0

  const isTimerRunning = timerData?.status === 'running'
  const isPomodoroBreak = timerData?.isPomodoro && timerData.pomodoroPhase !== 'focus'

  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget && expandedActivity !== null) {
      setExpandedActivity(null)
    }
  }

  return (
    <div
      className="w-full h-full relative select-none overflow-hidden flex flex-col items-center justify-start"
      onPointerDown={handleBackdropPointerDown}
    >
      {/* Ripple progress cue during 2s dwell hover - outside shell so not clipped by overflow-hidden */}
      {currentView === 'droplet' && isDwelling && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0.9 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 1.8, ease: 'easeOut', repeat: Infinity }}
          style={{
            position: 'absolute',
            top: shellConfig.y + 8 + shellConfig.height / 2, // exact droplet vertical center y = 24px
            left: '50%',
            x: '-50%',
            y: '-50%',
            width: shellConfig.width,
            height: shellConfig.height,
            borderRadius: '9999px',
            border: '2px solid rgba(255, 255, 255, 0.65)',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        />
      )}

      {/* CENTERED SHELL & MULTI-TASK BUBBLES CONTAINER */}
      <div
        className="pt-2 flex items-center justify-center z-40 gap-2.5"
        onPointerDown={handleBackdropPointerDown}
      >
        {/* LEFT BUBBLE: MUSIC (Spec: bubble on left of main capsule) */}
        <AnimatePresence>
          {isMediaActive && !isExpanded && (
            <motion.div
              key="bubble-music"
              initial={{
                x: 38,
                scaleX: 1.55,
                scaleY: 0.6,
                scale: 0.35,
                opacity: 0,
              }}
              animate={{
                x: 0,
                scaleX: 1,
                scaleY: 1,
                scale: 1,
                opacity: 1,
              }}
              exit={{
                x: 38,
                scaleX: 1.4,
                scaleY: 0.6,
                scale: 0.2,
                opacity: 0,
                transition: { duration: 0.22, ease: 'easeIn' },
              }}
              transition={{
                type: 'spring',
                stiffness: 450,
                damping: 24,
                mass: 0.7,
              }}
              whileHover={{ scale: 1.14 }}
              whileTap={{ scale: 0.94 }}
              onPointerEnter={() => handleBubblePointerEnter('music')}
              onPointerLeave={handleBubblePointerLeave}
              onClick={(e) => {
                e.stopPropagation()
                handleBubblePointerLeave()
                setExpandedActivity('music')
              }}
              style={{
                width: 32,
                height: 32,
                transformOrigin: 'right center',
              }}
              className="relative rounded-full bg-black border border-[#1ed760]/40 shadow-[0_2px_12px_rgba(30,215,96,0.25)] flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
              title={`${mediaData?.title || t.music} • ${t.clickToOpen}`}
            >
              {mediaData?.thumbnailBase64 ? (
                <img
                  src={mediaData.thumbnailBase64}
                  alt={mediaData.title}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <AudioWaveform
                  isPlaying={mediaData?.playbackStatus === 'playing'}
                  barCount={3}
                  size="sm"
                />
              )}

              {/* Hover Dwell Progress Aura */}
              {hoveredTarget === 'music' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border-2 border-[#1ed760] pointer-events-none"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SINGLE PERSISTENT SHELL */}
        <motion.div
          animate={{
            width: shellConfig.width,
            height: shellConfig.height,
            borderRadius: shellConfig.borderRadius,
            boxShadow: shellConfig.boxShadow,
            y: shellConfig.y,
          }}
          transition={springTransition}
          onAnimationComplete={handleAnimationComplete}
          onClick={handleShellClick}
          onMouseEnter={() => {
            if (currentView === 'droplet') setIsDwelling(true)
            handleExpandedPointerEnter()
          }}
          onMouseLeave={() => {
            setIsDwelling(false)
            handleExpandedPointerLeave()
          }}
          onScroll={(e) => {
            e.currentTarget.scrollLeft = 0
            e.currentTarget.scrollTop = 0
          }}
          className={`bg-black border overflow-hidden cursor-pointer relative shrink-0 ${
            currentView === 'alert'
              ? 'border-amber-500/50'
              : currentView === 'dropTarget'
              ? 'border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
              : 'border-white/20'
          }`}
        >

          {/* 1. EXPANDED HOME VIEW (Horizontal Multi-Page Pager) */}
          {currentView === 'home' && (
            <div
              className="absolute inset-0 flex flex-col justify-between text-white cursor-default overflow-hidden select-none touch-none"
              onClick={(e) => e.stopPropagation()}
              onWheel={handleHomeWheel}
              onPointerDown={handleHomePointerDown}
              onPointerUp={handleHomePointerUp}
              onPointerLeave={handleHomePointerUp}
              onPointerCancel={handleHomePointerUp}
              onScroll={(e) => {
                e.currentTarget.scrollLeft = 0
                e.currentTarget.scrollTop = 0
              }}
            >
              {/* Horizontal Slider Content */}
              <div
                className="relative flex-1 w-full overflow-hidden"
                onScroll={(e) => {
                  e.currentTarget.scrollLeft = 0
                  e.currentTarget.scrollTop = 0
                }}
              >
                <motion.div
                  animate={{
                    x: homePage === 0 ? '0%' : homePage === 1 ? '-33.333333%' : '-66.666666%',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="flex w-[300%] h-full"
                >
                  {/* Page 0: Dedicated Music Player (Kiri) */}
                  <div className="w-1/3 h-full px-5 pt-3.5 pb-1 flex flex-col justify-between shrink-0">
                    <ExpandedMusic
                      onClose={() => setExpandedActivity(null)}
                      onOpenTimer={() => setExpandedActivity('timer')}
                      isTimerActive={isTimerActive}
                    />
                  </div>

                  {/* Page 1: Clock & Quick Timer (Tengah / Default) */}
                  <div className="w-1/3 h-full px-5 pt-3.5 pb-1 flex flex-col justify-between shrink-0">
                    <div>
                      {/* Top Bar: Date & Collapse Button */}
                      <div className="flex items-center justify-between">
                        <span
                          onClick={() => setExpandedActivity(null)}
                          className="text-xs font-semibold text-white/50 hover:text-white/80 cursor-pointer uppercase tracking-wider transition-colors"
                          title={t.clickToCollapse}
                        >
                          {dateStr}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedActivity('settings')}
                            className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                            title={t.settings}
                            aria-label={t.settings}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setExpandedActivity(null)}
                            className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                            title={t.collapse}
                            aria-label={t.collapse}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div
                        onClick={() => setExpandedActivity(null)}
                        className="text-3xl font-bold tracking-tight text-white/95 mt-1 font-mono cursor-pointer hover:text-amber-300 transition-colors inline-block"
                        title={t.clickToCollapse}
                      >
                        {timeStr}
                      </div>
                    </div>

                    {/* Active Running Timer Banner if timer is ticking */}
                    {isTimerActive && (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 my-0.5">
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={isTimerRunning ? { rotate: [0, 0, 180, 180, 360] } : { rotate: 0 }}
                            transition={{ duration: 5.0, times: [0, 0.38, 0.50, 0.88, 1.0], repeat: Infinity, ease: 'easeInOut' }}
                            className="text-amber-400"
                          >
                            <Hourglass className="w-3.5 h-3.5 fill-amber-400/20" />
                          </motion.div>
                          <span className="text-xs font-mono font-bold text-amber-300">
                            {formatTimeDisplay(remainingSeconds)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isTimerRunning) {
                                globalTimerEngine.pause()
                              } else {
                                globalTimerEngine.resume()
                              }
                            }}
                            className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition-colors"
                          >
                            {isTimerRunning ? t.pause : t.resume}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedActivity('timer')
                            }}
                            className="px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold transition-transform active:scale-95"
                          >
                            {t.openTimer}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Active Media Banner if music is active */}
                    {isMediaActive && mediaData && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          setHomePage(0)
                        }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer my-0.5 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          {mediaData.thumbnailBase64 ? (
                            <img
                              src={mediaData.thumbnailBase64}
                              alt={mediaData.title}
                              className="w-4 h-4 rounded object-cover shrink-0"
                            />
                          ) : (
                            <Music2 className="w-3.5 h-3.5 text-[#1ed760] shrink-0" />
                          )}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                              {mediaData.title}
                            </span>
                            <span className="text-[10px] text-white/50 truncate flex-1">
                              {mediaData.artist}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setHomePage(0)
                          }}
                          className="px-2.5 py-0.5 rounded-lg bg-[#1ed760] hover:bg-[#1ed760]/90 text-black text-[10px] font-bold transition-transform active:scale-95 shrink-0"
                        >
                          {t.openFile}
                        </button>
                      </div>
                    )}

                    {/* Quick Timer Presets */}
                    <div className="flex flex-col gap-1.5 pt-0.5">
                      <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                        {t.quickTimer}
                      </span>

                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          {
                            label: '5m',
                            action: () => {
                              globalTimerEngine.startTimer(5)
                              setExpandedActivity(null)
                            },
                          },
                          {
                            label: '15m',
                            action: () => {
                              globalTimerEngine.startTimer(15)
                              setExpandedActivity(null)
                            },
                          },
                          {
                            label: '25m',
                            action: () => {
                              globalTimerEngine.startTimer(25)
                              setExpandedActivity(null)
                            },
                          },
                          {
                            label: t.focus,
                            action: () => {
                              globalTimerEngine.startPomodoro('focus', 1)
                              setExpandedActivity(null)
                            },
                            highlight: true,
                          },
                          {
                            label: t.custom,
                            action: () => setShowCustomInput(!showCustomInput),
                            active: showCustomInput,
                          },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            onClick={preset.action}
                            className={`py-1.5 px-1 rounded-xl text-xs font-medium transition-all text-center active:scale-95 ${
                              preset.active
                                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                                : preset.highlight
                                ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {showCustomInput && (
                        <form onSubmit={handleStartCustom} className="flex items-center gap-1.5 mt-1 pt-1 border-t border-white/10">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={customHours}
                              onChange={(e) => handleDurationInput(e.target.value, 99, setCustomHours)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => {
                                if (!customHours) setCustomHours('0')
                              }}
                              className="w-11 bg-white/10 border border-white/20 rounded-lg py-1 text-center text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                              placeholder="0"
                            />
                            <span className="text-[11px] text-white/50 font-mono">{t.hourUnit}</span>
                          </div>
                          <span className="text-white/30 text-xs font-mono">:</span>
                          <div className="flex items-center gap-1">
                            <input
                              ref={customMinsInputRef}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={customMins}
                              onChange={(e) => handleDurationInput(e.target.value, 59, setCustomMins)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => {
                                if (!customMins) setCustomMins('0')
                              }}
                              className="w-11 bg-white/10 border border-white/20 rounded-lg py-1 text-center text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                              placeholder="0"
                            />
                            <span className="text-[11px] text-white/50 font-mono">{t.minUnit}</span>
                          </div>
                          <span className="text-white/30 text-xs font-mono">:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={customSecs}
                              onChange={(e) => handleDurationInput(e.target.value, 59, setCustomSecs)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => {
                                if (!customSecs) setCustomSecs('0')
                              }}
                              className="w-11 bg-white/10 border border-white/20 rounded-lg py-1 text-center text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                              placeholder="0"
                            />
                            <span className="text-[11px] text-white/50 font-mono">{t.secUnit}</span>
                          </div>
                          <button
                            type="submit"
                            className="px-3.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors ml-auto active:scale-95 shadow-sm"
                          >
                            {t.start}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Page 2: Dedicated File Shelf (Kanan) */}
                  <div className="w-1/3 h-full px-5 pt-3.5 pb-1 flex flex-col justify-between shrink-0">
                    <FileShelf
                      isDragOver={isDragOver}
                      onClose={() => setExpandedActivity(null)}
                    />
                  </div>
                </motion.div>
              </div>

              {/* Bottom Pagination Dots (3 Pages: 0 = Musik, 1 = Jam/Timer, 2 = Shelf) */}
              <div className="flex items-center justify-center gap-1.5 pb-2 pt-0.5 shrink-0">
                <button
                  onClick={() => setHomePage(0)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    homePage === 0 ? 'w-4 bg-[#1ed760]' : 'w-1.5 bg-white/25 hover:bg-white/50'
                  }`}
                  aria-label={t.music}
                  title={t.music}
                />
                <button
                  onClick={() => setHomePage(1)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    homePage === 1 ? 'w-4 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/50'
                  }`}
                  aria-label={t.clockAndTimer}
                  title={t.clockAndTimer}
                />
                <button
                  onClick={() => setHomePage(2)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    homePage === 2 ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/25 hover:bg-white/50'
                  }`}
                  aria-label={t.fileShelf}
                  title={t.fileShelf}
                />
              </div>
            </div>
          )}

          {/* 2. EXPANDED TIMER VIEW */}
          {currentView === 'expandedTimer' && timerData && (
            <div
              className="absolute inset-0 p-5 flex flex-col gap-3 text-white cursor-default overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isPomodoroBreak ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {isPomodoroBreak ? <Coffee className="w-3.5 h-3.5" /> : timerData.isPomodoro ? <Brain className="w-3.5 h-3.5" /> : <TimerIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white/80 block leading-tight">
                      {timerData.label}
                    </span>
                    {timerData.isPomodoro && (
                      <span className="text-[10px] text-white/40 block leading-tight">
                        {t.round(timerData.pomodoroCycle || 1, 4)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isMediaActive && (
                    <button
                      onClick={() => {
                        setExpandedActivity('home')
                        setHomePage(0)
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1ed760]/20 hover:bg-[#1ed760]/30 text-[#1ed760] text-[10px] font-medium transition-all active:scale-95 border border-[#1ed760]/30"
                      title={t.openMusic}
                    >
                      <Music2 className="w-3 h-3" />
                      <span>{t.music}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setExpandedActivity('home')
                      setHomePage(2)
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-medium transition-all active:scale-95"
                    title={t.fileShelf}
                  >
                    <Folder className="w-3 h-3 text-amber-400" />
                    <span>{t.fileShelf}</span>
                  </button>
                  <button
                    onClick={() => setExpandedActivity(null)}
                    className="text-white/40 hover:text-white transition-colors p-1"
                    title={t.collapse}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Massive time countdown */}
              <div className="flex flex-col items-center justify-center py-0.5">
                <div className="text-4xl font-semibold tracking-tight font-mono text-white">
                  {formatTimeDisplay(remainingSeconds)}
                </div>
                {/* Horizontal progress track */}
                <div className="w-48 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isPomodoroBreak ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${timerProgress * 100}%` }}
                  />
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    globalTimerEngine.reset()
                    setExpandedActivity(null)
                  }}
                  className="px-3 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center gap-1.5 transition-transform active:scale-90 text-xs font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.reset}</span>
                </button>
                <button
                  onClick={() => {
                    if (isTimerRunning) {
                      globalTimerEngine.pause()
                    } else {
                      globalTimerEngine.resume()
                    }
                  }}
                  className={`px-5 h-9 rounded-full font-semibold text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-md ${
                    isPomodoroBreak
                      ? 'bg-emerald-400 text-black shadow-emerald-400/20'
                      : 'bg-[#ff9500] text-black shadow-[#ff9500]/20'
                  }`}
                >
                  {isTimerRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isTimerRunning ? t.pause : t.resume}</span>
                </button>
                <button
                  onClick={() => globalTimerEngine.addOneMinute()}
                  className="px-3 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center transition-transform active:scale-90 font-mono text-xs font-medium"
                >
                  +1m
                </button>
              </div>
            </div>
          )}

          {/* 3. ALERT VIEW - Automatically Expands when Timer Completes (Spec 5.1 point 6 & line 156) */}
          {currentView === 'alert' && (
            <div
              className="absolute inset-0 p-4 flex flex-col justify-between text-white cursor-default overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center animate-bounce">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-400 block leading-tight">
                      {timerData?.isPomodoro ? `${timerData.label} ${t.completedSuffix}` : t.timeUp}
                    </span>
                    <span className="text-[10px] text-white/50 block leading-tight">
                      {timerData?.isPomodoro
                        ? isPomodoroBreak
                          ? t.timeToRefocus
                          : t.timeForBreak
                        : t.timerCompleted}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => globalTimerEngine.dismissAlert()}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center font-mono font-bold text-2xl text-white tracking-tight py-1">
                00:00
              </div>

              {/* Alert Next Step Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => globalTimerEngine.dismissAlert()}
                  className="px-3.5 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-sm bg-red-400" />
                  <span>{t.stop}</span>
                </button>

                {timerData?.isPomodoro ? (
                  isPomodoroBreak ? (
                    <button
                      onClick={() => {
                        const nextCycle = ((timerData?.pomodoroCycle || 1) % 4) + 1
                        globalTimerEngine.startPomodoro('focus', nextCycle)
                      }}
                      className="px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-transform active:scale-95"
                    >
                      {t.startFocusSession}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const cycle = timerData?.pomodoroCycle || 1
                        const nextPhase = cycle === 4 ? 'longBreak' : 'shortBreak'
                        globalTimerEngine.startPomodoro(nextPhase, cycle)
                      }}
                      className="px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-transform active:scale-95"
                    >
                      {t.startBreak(timerData?.pomodoroCycle === 4 ? '15m' : '5m')}
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => {
                      const secs = timerData?.totalDurationSeconds || 60
                      globalTimerEngine.startTimerSeconds(secs)
                    }}
                    className="px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-transform active:scale-95"
                  >
                    {t.repeatTimer}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. DROPLET VIEW */}
          {currentView === 'droplet' && (
            <motion.div
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
            >
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/40 blur-[0.2px]" />
              {isTimerActive ? (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPomodoroBreak
                      ? 'bg-emerald-400 shadow-[0_0_4px_#10b981]'
                      : 'bg-[#ff9500] shadow-[0_0_4px_#ff9500]'
                  } ${isTimerRunning ? 'animate-pulse' : 'opacity-80'}`}
                />
              ) : isMediaActive ? (
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-[#1ed760] shadow-[0_0_4px_#1ed760] ${
                    mediaData?.playbackStatus === 'playing' ? 'animate-pulse' : 'opacity-80'
                  }`}
                />
              ) : null}
            </motion.div>
          )}

          {/* 3. EXPANDED MUSIC VIEW */}
          {currentView === 'expandedMusic' && (
            <div
              className="absolute inset-0 px-5 pt-3.5 pb-2.5 flex flex-col justify-between text-white cursor-default overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <ExpandedMusic
                onClose={() => setExpandedActivity(null)}
                onOpenTimer={() => setExpandedActivity('timer')}
                isTimerActive={isTimerActive}
              />
            </div>
          )}

          {/* 4. IDLE CLOCK / MATA KUMA VIEW (Spec 178) */}
          {currentView === 'idle' && (
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onMouseEnter={() => setIsPersonalityIdle(false)}
              className="absolute inset-0 px-3 flex items-center justify-center text-white overflow-hidden whitespace-nowrap"
            >
              {isPersonalityIdle && settings.personalityEnabled ? (
                <div className="flex items-center justify-center gap-2.5">
                  {/* Left eye */}
                  <motion.div
                    animate={{ scaleY: isBlinking ? 0.1 : 1 }}
                    transition={{ duration: 0.1 }}
                    className="w-1.5 h-1.5 rounded-full bg-white/95"
                  />
                  {/* Cute subtle bear nose */}
                  <div className="w-1 h-0.5 rounded-full bg-white/30" />
                  {/* Right eye */}
                  <motion.div
                    animate={{ scaleY: isBlinking ? 0.1 : 1 }}
                    transition={{ duration: 0.1 }}
                    className="w-1.5 h-1.5 rounded-full bg-white/95"
                  />
                </div>
              ) : (
                <span className="text-xs font-semibold text-white/95 font-mono tracking-tight">
                  {timeStr}
                </span>
              )}
            </motion.div>
          )}

          {/* 5. DROP TARGET COMPACT CAPSULE VIEW */}
          {currentView === 'dropTarget' && (
            <motion.div
              whileHover={{ scale: 1.04 }}
              className="absolute inset-0 px-3 flex items-center justify-center gap-2 text-amber-300 overflow-hidden whitespace-nowrap"
            >
              <UploadCloud className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
              <span className="text-xs font-semibold tracking-tight font-medium">
                {t.dropFilesHere}
              </span>
            </motion.div>
          )}

          {/* 6. SETTINGS VIEW (Spec 179) */}
          {currentView === 'settings' && (
            <SettingsView onClose={() => setExpandedActivity(null)} />
          )}
        </motion.div>

        {/* RIGHT BUBBLE: TIMER (Spec: water droplet separation animation from main capsule) */}
        <AnimatePresence>
          {isTimerActive && !isExpanded && (
            <motion.div
              key="bubble-timer"
              initial={{
                x: -38,
                scaleX: 1.55,
                scaleY: 0.6,
                scale: 0.35,
                opacity: 0,
              }}
              animate={{
                x: 0,
                scaleX: 1,
                scaleY: 1,
                scale: 1,
                opacity: 1,
              }}
              exit={{
                x: -38,
                scaleX: 1.4,
                scaleY: 0.6,
                scale: 0.2,
                opacity: 0,
                transition: { duration: 0.22, ease: 'easeIn' },
              }}
              transition={{
                type: 'spring',
                stiffness: 450,
                damping: 24,
                mass: 0.7,
              }}
              whileHover={{ scale: 1.14 }}
              whileTap={{ scale: 0.94 }}
              onPointerEnter={() => handleBubblePointerEnter('timer')}
              onPointerLeave={handleBubblePointerLeave}
              onClick={(e) => {
                e.stopPropagation()
                handleBubblePointerLeave()
                setExpandedActivity('timer')
              }}
              style={{
                width: 32,
                height: 32,
                transformOrigin: 'left center',
              }}
              className="relative rounded-full bg-black border border-amber-500/40 shadow-[0_2px_12px_rgba(245,158,11,0.25)] flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
              title={`${timerData?.label || 'Timer'}: ${formatTimeDisplay(remainingSeconds)} • ${t.clickToOpen}`}
            >
              {/* SVG Circular Progress Ring */}
              <svg className="w-6 h-6 -rotate-90 absolute" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  fill="none"
                  stroke={isPomodoroBreak ? '#10b981' : '#ff9500'}
                  strokeWidth="2"
                  strokeDasharray={53.4}
                  strokeDashoffset={53.4 * (1 - timerProgress)}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>

              {/* Center Countdown / Status */}
              {timerData?.status === 'paused' ? (
                <Pause className="w-2.5 h-2.5 text-amber-400 fill-amber-400 relative z-10" />
              ) : (
                <span className="text-[9px] font-mono font-bold text-amber-300 tracking-tighter relative z-10 leading-none">
                  {formatCompactRemaining(remainingSeconds)}
                </span>
              )}

              {/* Hover Dwell Progress Aura */}
              {hoveredTarget === 'timer' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dev Controls - Visible ONLY when developing in standard browser, never inside Tauri window */}
      {isBrowserDev && showDevControls && (
        <div className="absolute bottom-2 z-50 flex items-center gap-1.5 bg-black/90 border border-white/15 px-3 py-1 rounded-full text-[11px] text-white/80 shadow-lg">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <button
            onClick={() => globalTimerEngine.startTimer(5)}
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
          >
            Start 5m
          </button>
          <button
            onClick={() => globalTimerEngine.reset()}
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
          >
            Stop
          </button>
          <button
            onClick={() => setShowDevControls(false)}
            className="text-white/40 hover:text-white ml-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
