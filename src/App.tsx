import { useState, useEffect } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  Timer as TimerIcon,
  Clock,
  Sparkles,
} from 'lucide-react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { WINDOW_SIZES, resizeWindow, type WindowSize } from './core/windowSizing'

// Authentic Apple Dynamic Island spring transition curve
const springTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
}

export default function App() {
  // Activity states - First-run default: NO activities active
  const musicActive = false
  const [timerActive, setTimerActive] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)

  // OS Foreground Application State & Droplet Mode (Spec 5.1 & Fase 1b)
  const [systemMode, setSystemMode] = useState<'desktop' | 'app' | 'hidden'>('desktop')
  const [displayState, setDisplayState] = useState<'capsule' | 'droplet'>('capsule')
  const [isDwelling, setIsDwelling] = useState(false)

  // Expanded focus state: null (compact), 'home', 'timer', or 'music'
  const [expandedActivity, setExpandedActivity] = useState<'home' | 'timer' | 'music' | null>(null)

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
    if (systemMode !== 'app' || displayState !== 'capsule' || expandedActivity !== null) return

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
  }, [systemMode, displayState, expandedActivity])

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
        setExpandedActivity(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Collapse on window blur / loss of focus
  useEffect(() => {
    const handleBlur = () => {
      setExpandedActivity(null)
    }
    window.addEventListener('blur', handleBlur)

    let unlisten: (() => void) | undefined
    try {
      const win = getCurrentWebviewWindow()
      win.onFocusChanged(({ payload: focused }) => {
        if (!focused) {
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
  }, [])

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

  // Determine current active mode
  const isSplit = musicActive && timerActive && !expandedActivity

  // Choreographed window sizing
  useEffect(() => {
    let target: WindowSize = WINDOW_SIZES.idle
    if (displayState === 'droplet' && !expandedActivity) {
      target = WINDOW_SIZES.droplet
    } else if (expandedActivity === 'home') {
      target = WINDOW_SIZES.home
    } else if (expandedActivity === 'timer') {
      target = WINDOW_SIZES.expandedTimer
    } else if (expandedActivity === 'music') {
      target = WINDOW_SIZES.expandedMusic
    } else if (isSplit) {
      target = WINDOW_SIZES.split
    } else if (timerActive) {
      target = WINDOW_SIZES.singleTimer
    } else if (musicActive) {
      target = WINDOW_SIZES.singleMusic
    }

    // Expanding from droplet/compact: resize window first so no clipping occurs
    const isExpanding = (displayState === 'capsule' && target !== WINDOW_SIZES.droplet) || expandedActivity !== null

    if (isExpanding) {
      resizeWindow(target.width, target.height)
    } else {
      // Collapsing into droplet/compact: wait for spring animation before shrinking window
      const timer = setTimeout(() => {
        resizeWindow(target.width, target.height)
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [displayState, expandedActivity, isSplit, musicActive, timerActive])

  // Timer countdown effect - pure updater without side-effects
  useEffect(() => {
    if (!timerActive || !timerRunning) return

    if (timerSeconds <= 0) {
      setTimerRunning(false)
      // Alert auto-expands from droplet (Spec 5.1 point 6)
      setDisplayState('capsule')
      setExpandedActivity('timer')
      return
    }

    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [timerActive, timerRunning, timerSeconds])

  // Start timer helper
  const startPresetTimer = (minutes: number) => {
    setTimerSeconds(minutes * 60)
    setTimerActive(true)
    setTimerRunning(true)
    setExpandedActivity(null)
  }

  // Format time helper (mm:ss)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-start pt-2 select-none relative">
      {/* Dynamic Island Container */}
      <div className="relative z-50 flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {/* 1. EXPANDED HOME VIEW (Clock & Quick Actions) */}
          {expandedActivity === 'home' && (
            <motion.div
              key="expanded-home"
              layoutId="island-core"
              transition={springTransition}
              className="bg-black text-white rounded-[36px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.6)] border border-white/20 w-[350px] flex flex-col gap-3"
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

              {/* Quick Timer Presets */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                  Mulai Timer Cepat
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '5m', mins: 5 },
                    { label: '15m', mins: 15 },
                    { label: '25m', mins: 25 },
                    { label: 'Pomodoro', mins: 25 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => startPresetTimer(preset.mins)}
                      className="py-1.5 px-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium transition-all text-center"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. EXPANDED TIMER VIEW */}
          {expandedActivity === 'timer' && (
            <motion.div
              key="expanded-timer"
              layoutId="island-core"
              transition={springTransition}
              className="bg-black text-white rounded-[36px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.6)] border border-white/20 w-[330px] flex flex-col gap-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#ff9500]/20 flex items-center justify-center">
                    <TimerIcon className="w-3.5 h-3.5 text-[#ff9500]" />
                  </div>
                  <span className="text-xs font-semibold text-white/70">Timer</span>
                </div>
                <button
                  onClick={() => setExpandedActivity(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-center py-1">
                <div className="text-4xl font-semibold tracking-tight font-mono text-white">
                  {formatTime(timerSeconds)}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setTimerActive(false)
                    setTimerRunning(false)
                    setTimerSeconds(0)
                    setExpandedActivity(null)
                  }}
                  className="px-3 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center gap-1.5 transition-transform active:scale-90 text-xs font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="px-5 h-9 rounded-full bg-[#ff9500] text-black font-semibold text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-md shadow-[#ff9500]/20"
                >
                  {timerRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{timerRunning ? 'Jeda' : 'Lanjut'}</span>
                </button>
                <button
                  onClick={() => setTimerSeconds((prev) => prev + 60)}
                  className="px-3 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center transition-transform active:scale-90 font-mono text-xs font-medium"
                >
                  +1m
                </button>
              </div>
            </motion.div>
          )}

          {/* 3. MODE DROPLET (Spec Section 5.1 & Fase 1b) */}
          {!expandedActivity && displayState === 'droplet' && (
            <motion.div
              key="droplet"
              layoutId="island-core"
              transition={springTransition}
              onMouseEnter={() => setIsDwelling(true)}
              onMouseLeave={() => setIsDwelling(false)}
              onClick={() => {
                setIsDwelling(false)
                setDisplayState('capsule')
                setExpandedActivity('home')
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="relative flex items-center justify-center cursor-pointer select-none"
            >
              {/* Ripple progress cue during 2s dwell hover */}
              {isDwelling && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.9 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  transition={{ duration: 1.8, ease: 'easeOut', repeat: Infinity }}
                  className="absolute w-4 h-4 rounded-full border-2 border-white/60 pointer-events-none"
                />
              )}

              {/* ~14px black circle with water droplet highlight */}
              <div className="relative w-3.5 h-3.5 rounded-full bg-black border border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
                <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/40 blur-[0.2px]" />

                {/* Activity Dots: Orange for timer, Emerald for media */}
                {timerActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500] shadow-[0_0_4px_#ff9500]" />
                )}
                {!timerActive && musicActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#10b981]" />
                )}
              </div>
            </motion.div>
          )}

          {/* 4. ACTIVE TIMER COMPACT CAPSULE */}
          {!expandedActivity && displayState === 'capsule' && timerActive && (
            <motion.div
              key="compact-timer"
              layoutId="island-core"
              onClick={() => setExpandedActivity('timer')}
              transition={springTransition}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="bg-black text-white h-8 px-3.5 rounded-full flex items-center gap-2 cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.45)] border border-white/20"
            >
              <TimerIcon className="w-3.5 h-3.5 text-[#ff9500]" />
              <span className="text-xs font-mono font-semibold text-white tracking-tight">
                {formatTime(timerSeconds)}
              </span>
            </motion.div>
          )}

          {/* 5. DEFAULT IDLE CLOCK CAPSULE (Spec Section 1 & 4 & 5) */}
          {!expandedActivity && displayState === 'capsule' && !timerActive && !musicActive && (
            <motion.div
              key="idle-clock"
              layoutId="island-core"
              onClick={() => setExpandedActivity('home')}
              transition={springTransition}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="bg-black text-white h-8 px-3 rounded-full flex items-center justify-center gap-2 cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.45)] border border-white/20"
            >
              <Clock className="w-3.5 h-3.5 text-white/70" />
              <span className="text-xs font-semibold text-white/95 font-mono tracking-tight">
                {timeStr}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dev Controls - Visible ONLY when developing in standard browser, never inside Tauri window */}
      {isBrowserDev && showDevControls && (
        <div className="mt-3 flex items-center gap-1.5 bg-black/90 border border-white/15 px-3 py-1 rounded-full text-[11px] text-white/80 shadow-lg">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <button
            onClick={() => startPresetTimer(5)}
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
          >
            Start 5m
          </button>
          <button
            onClick={() => {
              setTimerActive(false)
              setTimerSeconds(0)
            }}
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
