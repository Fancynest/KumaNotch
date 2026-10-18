import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  Timer as TimerIcon,
  Clock,
  Sparkles,
  Bell,
  Coffee,
  Brain,
  Plus,
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

// Authentic Apple Dynamic Island spring transition curve
const springTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
}

type IslandView = 'droplet' | 'idle' | 'singleTimer' | 'home' | 'expandedTimer' | 'alert'

function getIslandView(
  displayState: 'capsule' | 'droplet',
  expandedActivity: 'home' | 'timer' | 'music' | null,
  timerData: TimerData | null,
): IslandView {
  if (timerData?.status === 'completed') return 'alert'
  if (expandedActivity === 'home') return 'home'
  if (expandedActivity === 'timer') return 'expandedTimer'
  if (displayState === 'droplet') return 'droplet'
  if (timerData && (timerData.status === 'running' || timerData.status === 'paused')) {
    return 'singleTimer'
  }
  return 'idle'
}

export default function App() {
  // Global Timestamp-based Timer Engine subscription (Spec Fase 2)
  const [timerData, setTimerData] = useState<TimerData | null>(() => globalTimerEngine.getData())
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => globalTimerEngine.getRemainingSeconds())

  useEffect(() => {
    return globalTimerEngine.subscribe((data, remaining) => {
      setTimerData(data ? { ...data } : null)
      setRemainingSeconds(remaining)
    })
  }, [])

  // OS Foreground Application State & Droplet Mode (Spec 5.1 & Fase 1b)
  const [systemMode, setSystemMode] = useState<'desktop' | 'app' | 'hidden'>('desktop')
  const [displayState, setDisplayState] = useState<'capsule' | 'droplet'>('capsule')
  const [isDwelling, setIsDwelling] = useState(false)

  // Expanded focus state: null (compact), 'home', 'timer', or 'music'
  const [expandedActivity, setExpandedActivity] = useState<'home' | 'timer' | 'music' | null>(null)

  // Custom timer minutes input on Home card
  const [customMins, setCustomMins] = useState<string>('10')
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false)

  // Dev controls active ONLY in normal browser development mode (NOT inside Tauri window)
  const isBrowserDev =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !('__TAURI_INTERNALS__' in window)
  const [showDevControls, setShowDevControls] = useState(isBrowserDev)

  // System Clock state
  const [timeStr, setTimeStr] = useState(() => {
    const d = new Date()
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  })
  const [dateStr, setDateStr] = useState(() => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  })

  // Synchronized persistent shell state
  const targetView = getIslandView(displayState, expandedActivity, timerData)
  const [currentView, setCurrentView] = useState<IslandView>(targetView)
  const [shellConfig, setShellConfig] = useState<ShellConfig>(SHELL_CONFIGS[targetView])
  const pendingWindowResizeRef = useRef<WindowSize | null>(null)
  const currentWindowSizeRef = useRef<WindowSize>(WINDOW_SIZES[targetView])

  // Synchronize OS window bounds and shell spring animation
  useEffect(() => {
    if (targetView === currentView) return

    const prevSize = currentWindowSizeRef.current
    const nextSize = WINDOW_SIZES[targetView]
    const isExpanding = nextSize.width > prevSize.width || nextSize.height > prevSize.height

    let isMounted = true

    if (isExpanding) {
      // EXPAND FLOW:
      // 1. Resize OS window first so expansion is never clipped
      resizeWindow(nextSize.width, nextSize.height).then(() => {
        if (!isMounted) return
        currentWindowSizeRef.current = nextSize
        // 2. Wait 1-2 animation frames for OS/WebView viewport layout to settle
        requestAnimationFrame(() => {
          if (!isMounted) return
          requestAnimationFrame(() => {
            if (!isMounted) return
            // 3. Trigger shell spring animation to expand
            setCurrentView(targetView)
            setShellConfig(SHELL_CONFIGS[targetView])
          })
        })
      })
    } else {
      // COLLAPSE FLOW:
      // 1. Animate shell first to the smaller target dimensions
      pendingWindowResizeRef.current = nextSize
      setCurrentView(targetView)
      setShellConfig(SHELL_CONFIGS[targetView])
      // 2. Window will be resized in handleAnimationComplete once the spring settles
    }

    return () => {
      isMounted = false
    }
  }, [targetView, currentView])

  const handleAnimationComplete = () => {
    if (pendingWindowResizeRef.current) {
      const nextSize = pendingWindowResizeRef.current
      pendingWindowResizeRef.current = null
      currentWindowSizeRef.current = nextSize
      resizeWindow(nextSize.width, nextSize.height)
    }
  }

  // Alert Auto-Dismiss after 30s of inactivity (Spec Section 5 item 5)
  useEffect(() => {
    if (currentView !== 'alert') return
    const timer = setTimeout(() => {
      globalTimerEngine.dismissAlert()
    }, 30000)
    return () => clearTimeout(timer)
  }, [currentView])

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

  // In app mode, enter droplet after 10s of no interaction (Spec 5.1 point 2)
  useEffect(() => {
    if (systemMode !== 'app' || displayState !== 'capsule' || expandedActivity !== null || currentView === 'alert') return

    let timer = setTimeout(() => {
      setDisplayState('droplet')
    }, 10000)

    const resetDropletTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setDisplayState('droplet')
      }, 10000)
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
  }, [systemMode, displayState, expandedActivity, currentView])

  // Dwell hover: 2 seconds on droplet re-emerges capsule with spring (Spec 5.1 point 4)
  useEffect(() => {
    if (!isDwelling || displayState !== 'droplet') return

    const dwellTimer = setTimeout(() => {
      setIsDwelling(false)
      setDisplayState('capsule')
    }, 2000)

    return () => clearTimeout(dwellTimer)
  }, [isDwelling, displayState])

  // Align clock updates to minute boundaries
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
      setDateStr(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }))
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
  }, [])

  // Collapse on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentView === 'alert') {
          globalTimerEngine.dismissAlert()
        } else {
          setExpandedActivity(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView])

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
    } else if (currentView === 'singleTimer') {
      setExpandedActivity('timer')
    } else if (currentView === 'droplet') {
      setIsDwelling(false)
      setDisplayState('capsule')
      setExpandedActivity('home')
    }
  }

  // Handle custom duration start
  const handleStartCustom = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(customMins)
    if (!isNaN(parsed) && parsed > 0) {
      globalTimerEngine.startTimer(parsed)
      setShowCustomInput(false)
      setExpandedActivity(null)
    }
  }

  // Progress calculations for compact ring and expanded bar
  const timerProgress = timerData && timerData.totalDurationSeconds > 0
    ? Math.min(1, Math.max(0, remainingSeconds / timerData.totalDurationSeconds))
    : 0

  const isTimerRunning = timerData?.status === 'running'
  const isTimerActive = timerData !== null && (timerData.status === 'running' || timerData.status === 'paused')
  const isPomodoroBreak = timerData?.isPomodoro && timerData.pomodoroPhase !== 'focus'

  return (
    <div className="w-full h-full relative select-none overflow-hidden flex flex-col items-center justify-start">
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
        onMouseEnter={() => currentView === 'droplet' && setIsDwelling(true)}
        onMouseLeave={() => setIsDwelling(false)}
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          x: '-50%',
          transformOrigin: 'top center',
        }}
        className={`bg-black border overflow-hidden cursor-pointer z-40 ${
          currentView === 'alert' ? 'border-amber-500/50' : 'border-white/20'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {/* 1. EXPANDED HOME VIEW */}
          {currentView === 'home' && (
            <motion.div
              key="view-home"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="w-full h-full p-5 flex flex-col gap-3 text-white cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                    {dateStr}
                  </span>
                  <div className="text-3xl font-bold tracking-tight text-white/95 mt-0.5">
                    {timeStr}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedActivity(null)}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Timer Presets & Pomodoro Mode */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                    Mulai Timer Cepat
                  </span>
                  <button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className="text-[10px] text-white/50 hover:text-amber-400 transition-colors flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showCustomInput ? 'Tutup Custom' : 'Custom'}</span>
                  </button>
                </div>

                {showCustomInput ? (
                  <form onSubmit={handleStartCustom} className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      step="0.5"
                      value={customMins}
                      onChange={(e) => setCustomMins(e.target.value)}
                      className="w-24 bg-white/10 border border-white/20 rounded-xl px-2.5 py-1 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                      placeholder="Menit"
                      autoFocus
                    />
                    <span className="text-xs text-white/60">menit</span>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors ml-auto active:scale-95"
                    >
                      Mulai
                    </button>
                  </form>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '5m', action: () => globalTimerEngine.startTimer(5) },
                      { label: '15m', action: () => globalTimerEngine.startTimer(15) },
                      { label: '25m', action: () => globalTimerEngine.startTimer(25) },
                      {
                        label: 'Pomodoro',
                        action: () => globalTimerEngine.startPomodoro('focus', 1),
                        highlight: true,
                      },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          preset.action()
                          setExpandedActivity(null)
                        }}
                        className={`py-1.5 px-1 rounded-xl text-xs font-medium transition-all text-center active:scale-95 ${
                          preset.highlight
                            ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 2. EXPANDED TIMER VIEW */}
          {currentView === 'expandedTimer' && timerData && (
            <motion.div
              key="view-timer"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="w-full h-full p-5 flex flex-col gap-3 text-white cursor-default"
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
                        Putaran {timerData.pomodoroCycle || 1} dari 4
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedActivity(null)}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
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
                  <span>Reset</span>
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
                  <span>{isTimerRunning ? 'Jeda' : 'Lanjut'}</span>
                </button>
                <button
                  onClick={() => globalTimerEngine.addOneMinute()}
                  className="px-3 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center transition-transform active:scale-90 font-mono text-xs font-medium"
                >
                  +1m
                </button>
              </div>
            </motion.div>
          )}

          {/* 3. ALERT VIEW - Automatically Expands when Timer Completes (Spec 5.1 point 6 & line 156) */}
          {currentView === 'alert' && timerData && (
            <motion.div
              key="view-alert"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="w-full h-full p-4 flex flex-col justify-between text-white cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center animate-bounce">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-400 block leading-tight">
                      {timerData.isPomodoro ? `${timerData.label} Selesai!` : 'Waktu Habis!'}
                    </span>
                    <span className="text-[10px] text-white/50 block leading-tight">
                      {timerData.isPomodoro
                        ? isPomodoroBreak
                          ? 'Waktunya kembali fokus'
                          : 'Saatnya istirahat sejenak'
                        : 'Timer telah selesai'}
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
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-xs font-medium transition-colors"
                >
                  Selesai
                </button>

                {timerData.isPomodoro ? (
                  isPomodoroBreak ? (
                    <button
                      onClick={() => {
                        const nextCycle = ((timerData.pomodoroCycle || 1) % 4) + 1
                        globalTimerEngine.startPomodoro('focus', nextCycle)
                      }}
                      className="px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-transform active:scale-95"
                    >
                      Mulai Sesi Fokus
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const cycle = timerData.pomodoroCycle || 1
                        const nextPhase = cycle === 4 ? 'longBreak' : 'shortBreak'
                        globalTimerEngine.startPomodoro(nextPhase, cycle)
                      }}
                      className="px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-transform active:scale-95"
                    >
                      Mulai Istirahat ({timerData.pomodoroCycle === 4 ? '15m' : '5m'})
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => {
                      const mins = Math.max(1, Math.round(timerData.totalDurationSeconds / 60))
                      globalTimerEngine.startTimer(mins)
                    }}
                    className="px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-transform active:scale-95"
                  >
                    Ulangi Timer
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* 4. DROPLET VIEW */}
          {currentView === 'droplet' && (
            <motion.div
              key="view-droplet"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.14 }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="w-full h-full relative flex items-center justify-center overflow-hidden"
            >
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/40 blur-[0.2px]" />
              {isTimerActive && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPomodoroBreak
                      ? 'bg-emerald-400 shadow-[0_0_4px_#10b981]'
                      : 'bg-[#ff9500] shadow-[0_0_4px_#ff9500]'
                  } ${isTimerRunning ? 'animate-pulse' : 'opacity-80'}`}
                />
              )}
            </motion.div>
          )}

          {/* 5. COMPACT TIMER VIEW (Progress Ring + mm:ss - Spec line 156) */}
          {currentView === 'singleTimer' && timerData && (
            <motion.div
              key="view-singleTimer"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.14 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="w-full h-full px-3 flex items-center justify-center gap-2 text-white"
            >
              {/* Circular Progress Ring */}
              <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth="2.2"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke={isPomodoroBreak ? '#10b981' : '#ff9500'}
                    strokeWidth="2.2"
                    strokeDasharray={37.7}
                    strokeDashoffset={37.7 * (1 - timerProgress)}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                </svg>
                {/* Center dot/indicator */}
                <span
                  className={`w-1 h-1 rounded-full ${
                    isPomodoroBreak
                      ? 'bg-emerald-400 shadow-[0_0_4px_#10b981]'
                      : 'bg-[#ff9500] shadow-[0_0_4px_#ff9500]'
                  } ${isTimerRunning ? 'animate-pulse' : 'opacity-70'}`}
                />
              </div>

              {/* Time string */}
              <span className="text-xs font-mono font-semibold text-white tracking-tight">
                {formatTimeDisplay(remainingSeconds)}
              </span>
            </motion.div>
          )}

          {/* 6. IDLE CLOCK VIEW */}
          {currentView === 'idle' && (
            <motion.div
              key="view-idle"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.14 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="w-full h-full px-3 flex items-center justify-center gap-2 text-white"
            >
              <Clock className="w-3.5 h-3.5 text-white/70" />
              <span className="text-xs font-semibold text-white/95 font-mono tracking-tight">
                {timeStr}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

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
