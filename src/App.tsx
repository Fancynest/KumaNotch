import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, Sparkles, Pause } from 'lucide-react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import {
  WINDOW_SIZES,
  SHELL_CONFIGS,
  resizeWindow,
  type WindowSize,
} from './core/windowSizing'
import {
  globalTimerEngine,
  formatTimeDisplay,
  type TimerData,
} from './core/timer'
import { globalShelfEngine } from './core/shelf'
import { globalMediaEngine, type MediaData } from './core/media'
import { AudioWaveform } from './features/media/AudioWaveform'
import { ExpandedMusic } from './features/media/ExpandedMusic'
import { getT } from './core/i18n'
import { globalSettingsEngine, type AppSettings } from './core/settings'
import { SettingsView } from './features/settings/SettingsView'
import {
  useIslandStore,
  type IslandView,
  type DisplayState,
  type ExpandedActivity,
} from './core/islandStore'
import { Shell } from './components/island/Shell'
import { ClockCapsule } from './components/island/ClockCapsule'
import { Droplet } from './components/island/Droplet'
import { HomePager } from './components/island/HomePager'
import { TimerCard } from './components/island/TimerCard'
import { AlertCard } from './components/island/AlertCard'

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

function getIslandView(
  displayState: DisplayState,
  expandedActivity: ExpandedActivity,
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

function getDynamicDimensions(
  view: IslandView,
  isCustom: boolean,
  musicActive: boolean,
  timerActive: boolean,
) {
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

export default function App() {
  const {
    displayState,
    expandedActivity,
    homePage,
    systemMode,
    isDwelling,
    hoveredTarget,
    isDragOver,
    showCustomInput,
    setDisplayState,
    setExpandedActivity,
    setHomePage,
    setSystemMode,
    setIsDwelling,
    setHoveredTarget,
    setIsDragOver,
    setShowCustomInput,
    collapseAll,
  } = useIslandStore()

  // App Settings Engine subscription
  const [settings, setSettings] = useState<AppSettings>(() => globalSettingsEngine.getSettings())
  useEffect(() => {
    return globalSettingsEngine.subscribe((newSettings) => {
      setSettings({ ...newSettings })
    })
  }, [])
  const t = getT(settings.language)

  // Timer Engine subscription
  const [timerData, setTimerData] = useState<TimerData | null>(() => globalTimerEngine.getData())
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => globalTimerEngine.getRemainingSeconds())
  useEffect(() => {
    return globalTimerEngine.subscribe((data, remaining) => {
      setTimerData(data ? { ...data } : null)
      setRemainingSeconds(remaining)
      if (data?.status === 'completed') {
        useIslandStore.getState().setExpandedActivity(null)
      }
    })
  }, [])

  // SMTC Media Engine subscription
  const [mediaData, setMediaData] = useState<MediaData | null>(() => globalMediaEngine.getData())
  useEffect(() => {
    return globalMediaEngine.subscribe((data) => {
      setMediaData(data ? { ...data } : null)
    })
  }, [])

  // Dev controls in standard browser dev mode
  const isBrowserDev =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !('__TAURI_INTERNALS__' in window)
  const [showDevControls, setShowDevControls] = useState(isBrowserDev)

  // System Clock format & strings
  const [clockFormat, setClockFormat] = useState<'auto' | '12h' | '24h'>('auto')
  useEffect(() => {
    invoke<string>('get_system_time_format')
      .then((fmt) => {
        if (fmt === '12h' || fmt === '24h') setClockFormat(fmt)
      })
      .catch(() => {})
  }, [])

  const [timeStr, setTimeStr] = useState(() => formatClockTime(new Date(), 'auto'))
  const [dateStr, setDateStr] = useState(() => {
    return new Date().toLocaleDateString(typeof navigator !== 'undefined' ? navigator.language : undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  })

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

  // Drag and drop listener for File Shelf
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
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
  }, [setIsDragOver, setHomePage, setExpandedActivity])

  // Multi-activity flags
  const isTimerActive = timerData !== null && (timerData.status === 'running' || timerData.status === 'paused')
  const isMediaActive = mediaData !== null && mediaData.isActive
  const isExpanded = expandedActivity !== null || timerData?.status === 'completed'
  const hasMusic = isMediaActive && !isExpanded
  const hasTimer = isTimerActive && !isExpanded

  // Dynamic dimensions & window synchronization
  const currentView = getIslandView(displayState, expandedActivity, timerData, isDragOver)
  const dims = getDynamicDimensions(currentView, showCustomInput, hasMusic, hasTimer)
  const currentWindowSizeRef = useRef<WindowSize>(dims.win)
  const targetWinWidth = dims.win.width
  const targetWinHeight = dims.win.height

  useEffect(() => {
    if (
      currentWindowSizeRef.current.width !== targetWinWidth ||
      currentWindowSizeRef.current.height !== targetWinHeight
    ) {
      currentWindowSizeRef.current = { width: targetWinWidth, height: targetWinHeight }
      resizeWindow(targetWinWidth, targetWinHeight)
    }
  }, [targetWinWidth, targetWinHeight])

  // Hover Dwell (2s) and Auto-Collapse handlers
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

  // OS Foreground mode events
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
    })
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => {})

    return () => {
      if (unlisten) unlisten()
    }
  }, [setSystemMode])

  // Tray events
  useEffect(() => {
    const unlisteners: Array<() => void> = []

    listen('open_settings', () => {
      setExpandedActivity('settings')
    })
      .then((fn) => unlisteners.push(fn))
      .catch(() => {})

    listen('toggle_personality', () => {
      const curr = globalSettingsEngine.getSettings().personalityEnabled
      globalSettingsEngine.update({ personalityEnabled: !curr })
    })
      .then((fn) => unlisteners.push(fn))
      .catch(() => {})

    listen<boolean>('autostart_changed', (e) => {
      globalSettingsEngine.update({ autostart: e.payload })
    })
      .then((fn) => unlisteners.push(fn))
      .catch(() => {})

    return () => {
      unlisteners.forEach((fn) => fn())
    }
  }, [setExpandedActivity])

  // In app mode, auto droplet after inactivity
  useEffect(() => {
    if (
      !settings.autoDroplet ||
      systemMode !== 'app' ||
      displayState !== 'capsule' ||
      expandedActivity !== null ||
      currentView === 'alert'
    )
      return

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
  }, [
    systemMode,
    displayState,
    expandedActivity,
    currentView,
    settings.autoDroplet,
    settings.inactivitySeconds,
    setDisplayState,
  ])

  // Dwell hover on droplet re-emerges capsule
  useEffect(() => {
    if (!isDwelling || displayState !== 'droplet') return

    const dwellMs = (settings.dwellSeconds || 2) * 1000
    const dwellTimer = setTimeout(() => {
      setIsDwelling(false)
      setDisplayState('capsule')
    }, dwellMs)

    return () => clearTimeout(dwellTimer)
  }, [isDwelling, displayState, settings.dwellSeconds, setIsDwelling, setDisplayState])

  // Alert Auto-Dismiss after 30s
  useEffect(() => {
    if (currentView !== 'alert' && timerData?.status !== 'completed') return
    const timer = setTimeout(() => {
      globalTimerEngine.dismissAlert()
    }, 30000)
    return () => clearTimeout(timer)
  }, [currentView, timerData?.status])

  // Collapse on Escape & Window blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentView === 'alert' || timerData?.status === 'completed') {
          globalTimerEngine.dismissAlert()
        } else {
          collapseAll()
        }
      }
    }
    const handleBlur = () => {
      if (currentView !== 'alert') collapseAll()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleBlur)

    let unlisten: (() => void) | undefined
    try {
      getCurrentWebviewWindow()
        .onFocusChanged(({ payload: focused }) => {
          if (!focused && currentView !== 'alert') collapseAll()
        })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
    } catch {}

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleBlur)
      if (unlisten) unlisten()
    }
  }, [currentView, timerData?.status, collapseAll])

  // Inactivity collapse for Home (10s)
  useEffect(() => {
    if (expandedActivity !== 'home') return

    let timer = setTimeout(() => {
      collapseAll()
    }, 10000)

    const resetInactivity = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        collapseAll()
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
  }, [expandedActivity, collapseAll])

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

  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget && expandedActivity !== null) {
      collapseAll()
    }
  }

  const timerProgress =
    timerData && timerData.totalDurationSeconds > 0
      ? Math.min(1, Math.max(0, remainingSeconds / timerData.totalDurationSeconds))
      : 0
  const isPomodoroBreak = timerData?.isPomodoro && timerData.pomodoroPhase !== 'focus'

  return (
    <div
      className="w-full h-full relative select-none overflow-hidden flex flex-col items-center justify-start"
      onPointerDown={handleBackdropPointerDown}
    >
      {/* Ripple progress cue during 2s dwell hover on droplet */}
      {currentView === 'droplet' && isDwelling && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0.9 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 1.8, ease: 'easeOut', repeat: Infinity }}
          style={{
            position: 'absolute',
            top: dims.shell.y + 8 + dims.shell.height / 2,
            left: '50%',
            x: '-50%',
            y: '-50%',
            width: dims.shell.width,
            height: dims.shell.height,
            borderRadius: '9999px',
            border: '2px solid rgba(255, 255, 255, 0.65)',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        />
      )}

      {/* CENTERED CONTAINER FOR MULTI-BUBBLE 3-TASK ISLAND */}
      <div
        className="pt-2 flex items-center justify-center z-40 gap-2.5"
        onPointerDown={handleBackdropPointerDown}
      >
        {/* LEFT BUBBLE: MUSIC */}
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
        <Shell
          shellConfig={dims.shell}
          currentView={currentView}
          onClick={handleShellClick}
          onMouseEnter={() => {
            if (currentView === 'droplet') setIsDwelling(true)
            handleExpandedPointerEnter()
          }}
          onMouseLeave={() => {
            setIsDwelling(false)
            handleExpandedPointerLeave()
          }}
        >
          {currentView === 'home' && (
            <HomePager
              homePage={homePage}
              setHomePage={setHomePage}
              dateStr={dateStr}
              timeStr={timeStr}
              timerData={timerData}
              remainingSeconds={remainingSeconds}
              mediaData={mediaData}
              isDragOver={isDragOver}
              showCustomInput={showCustomInput}
              setShowCustomInput={setShowCustomInput}
              onClose={collapseAll}
              onOpenSettings={() => setExpandedActivity('settings')}
              onOpenTimer={() => setExpandedActivity('timer')}
            />
          )}

          {currentView === 'expandedTimer' && timerData && (
            <TimerCard
              timerData={timerData}
              remainingSeconds={remainingSeconds}
              mediaData={mediaData}
              onClose={collapseAll}
              onOpenMusic={() => {
                setExpandedActivity('home')
                setHomePage(0)
              }}
              onOpenFileShelf={() => {
                setExpandedActivity('home')
                setHomePage(2)
              }}
            />
          )}

          {currentView === 'alert' && (
            <AlertCard
              timerData={timerData}
              onDismiss={() => globalTimerEngine.dismissAlert()}
            />
          )}

          {currentView === 'droplet' && (
            <Droplet timerData={timerData} mediaData={mediaData} />
          )}

          {currentView === 'expandedMusic' && (
            <div
              className="absolute inset-0 px-5 pt-3.5 pb-2.5 flex flex-col justify-between text-white cursor-default overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <ExpandedMusic
                onClose={collapseAll}
                onOpenTimer={() => setExpandedActivity('timer')}
                isTimerActive={isTimerActive}
              />
            </div>
          )}

          {currentView === 'idle' && (
            <ClockCapsule
              timeStr={timeStr}
              personalityEnabled={settings.personalityEnabled}
              idleBeforeEyesSeconds={settings.idleBeforeEyesSeconds}
              systemMode={systemMode}
              isIdleView={currentView === 'idle'}
            />
          )}

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

          {currentView === 'settings' && (
            <SettingsView onClose={collapseAll} />
          )}
        </Shell>

        {/* RIGHT BUBBLE: TIMER */}
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

              {timerData?.status === 'paused' ? (
                <Pause className="w-2.5 h-2.5 text-amber-400 fill-amber-400 relative z-10" />
              ) : (
                <span className="text-[9px] font-mono font-bold text-amber-300 tracking-tighter relative z-10 leading-none">
                  {formatCompactRemaining(remainingSeconds)}
                </span>
              )}

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

      {/* Dev Controls */}
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
