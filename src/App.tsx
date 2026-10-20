import { useState, useEffect, useRef, useCallback } from 'react'
import { DevFrameMeter } from './ui/DevFrameMeter'
import { DevControls } from './ui/DevControls'
import {
  setHitRegion,
  getIslandView,
  getDynamicDimensions,
} from './core/windowSizing'
import {
  globalTimerEngine,
  type TimerData,
} from './core/timer'
import { globalMediaEngine, type MediaData } from './core/media'
import { getT } from './core/i18n'
import { globalSettingsEngine, type AppSettings } from './core/settings'
import { useIslandStore } from './core/islandStore'
import { Shell } from './components/island/Shell'
import { LeftBubble } from './components/island/LeftBubble'
import { RightBubble } from './components/island/RightBubble'
import { IslandContent } from './components/island/IslandContent'
import { globalAudioDeviceEngine, type AudioDeviceNotification } from './core/audioDevice'
import { useSystemClock } from './hooks/useSystemClock'
import { useIslandDrag } from './hooks/useIslandDrag'
import { useIslandEvents } from './hooks/useIslandEvents'

export default function App() {
  const {
    expandedActivity,
    homePage,
    systemMode,
    hoveredTarget,
    isDragOver,
    showCustomInput,
    setExpandedActivity,
    setHomePage,
    setSystemMode,
    setHoveredTarget,
    setIsDragOver,
    setShowCustomInput,
    setIsTransitioning,
    collapseAll,
  } = useIslandStore()

  // 1. App Settings Engine subscription
  const [settings, setSettings] = useState<AppSettings>(() => globalSettingsEngine.getSettings())
  useEffect(() => {
    return globalSettingsEngine.subscribe((newSettings) => {
      setSettings({ ...newSettings })
    })
  }, [])
  const t = getT(settings.language)

  // 2. Timer Engine subscription
  const [timerData, setTimerData] = useState<TimerData | null>(() => globalTimerEngine.getData())
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => globalTimerEngine.getRemainingSeconds())
  const [allTimers, setAllTimers] = useState<TimerData[]>(() => globalTimerEngine.getTimers())
  useEffect(() => {
    return globalTimerEngine.subscribe((data, remaining, timers) => {
      setTimerData(data ? { ...data } : null)
      setRemainingSeconds(remaining)
      setAllTimers(timers ? timers.map((t) => ({ ...t })) : [])
      if (data?.status === 'completed') {
        useIslandStore.getState().setExpandedActivity(null)
      } else {
        globalMediaEngine.poll()
      }
    })
  }, [])

  // 3. SMTC Media Engine subscription
  const [mediaData, setMediaData] = useState<MediaData | null>(() => globalMediaEngine.getData())
  useEffect(() => {
    return globalMediaEngine.subscribe((data) => {
      setMediaData(data ? { ...data } : null)
    })
  }, [])

  // 4. Audio & Bluetooth Device Engine subscription
  const [deviceNotification, setDeviceNotification] = useState<AudioDeviceNotification | null>(
    () => globalAudioDeviceEngine.getActiveNotification(),
  )
  useEffect(() => {
    return globalAudioDeviceEngine.subscribe((notif) => {
      setDeviceNotification(notif ? { ...notif } : null)
    })
  }, [])

  // 5. System Clock hook
  const { timeStr, dateStr } = useSystemClock(settings.timeFormat, settings.language)

  // 6. Multi-activity & dynamic view calculation
  const isTimerActive = allTimers.some((t) => t.status === 'running' || t.status === 'paused')
  const isMediaActive = mediaData !== null && mediaData.isActive
  const isExpanded = expandedActivity !== null || timerData?.status === 'completed'
  const hasMusic = isMediaActive && !isExpanded && !isDragOver
  const hasTimer = isTimerActive && !isExpanded && !isDragOver
  const hasLeftAux = hasMusic
  const hasRightAux = hasTimer

  const currentView = getIslandView(
    expandedActivity,
    timerData,
    isDragOver,
    deviceNotification,
  )
  const dims = getDynamicDimensions(
    currentView,
    showCustomInput,
    hasMusic,
    hasTimer,
  )

  // 7. Asymmetric Spring Physics tracking (Melebar vs Menciut)
  const [prevShell, setPrevShell] = useState(dims.shell)
  const [isGrowing, setIsGrowing] = useState(false)

  if (dims.shell.width !== prevShell.width || dims.shell.height !== prevShell.height) {
    setIsGrowing(dims.shell.width > prevShell.width || dims.shell.height > prevShell.height)
    setPrevShell(dims.shell)
  }

  // 8. Downward physical nudge (+4px) on new events
  const [nudge, setNudge] = useState(false)
  const lastNudgeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const currentNudgeKey =
      deviceNotification?.id ||
      (timerData?.status === 'completed' ? 'timer-alert' : null) ||
      null

    if (currentNudgeKey && currentNudgeKey !== lastNudgeKeyRef.current) {
      lastNudgeKeyRef.current = currentNudgeKey
      setNudge(true)
      const timer = setTimeout(() => setNudge(false), 320)
      return () => clearTimeout(timer)
    }
  }, [deviceNotification?.id, timerData?.status])

  // 11. Window Stage Hit Region Choreography & Motion Polishing (Fase 8b & 8c)
  // Stage width = 460, height = 420 (pinned at y = 0)
  const STAGE_WIDTH = 460
  const STAGE_HEIGHT = 420
  const hitRegionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Total row width must include LeftBubble and RightBubble (plus symmetry balancer) when active
    const leftWidth = hasLeftAux ? 44 : (hasRightAux ? 40 : 0)
    const rightWidth = hasRightAux ? 44 : (hasLeftAux ? 40 : 0)
    const totalContentW =
      !isExpanded && !isDragOver
        ? dims.shell.width + leftWidth + rightWidth
        : dims.shell.width

    const marginX = 28
    const marginY = 32

    const bboxW = Math.min(STAGE_WIDTH, totalContentW + marginX * 2)
    const bboxH = Math.min(STAGE_HEIGHT, dims.shell.height + marginY)
    const bboxX = (STAGE_WIDTH - bboxW) / 2
    const bboxY = 0

    if (hitRegionTimerRef.current) {
      clearTimeout(hitRegionTimerRef.current)
      hitRegionTimerRef.current = null
    }

    // Flag transition active so heavy loops (blinking, waveforms) pause
    setIsTransitioning(true)
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false)
      transitionTimerRef.current = null
    }, 280)

    if (isGrowing) {
      // Melebar: expand hit region FIRST, then animate shell
      setHitRegion(bboxX, bboxY, bboxW, bboxH)
    } else {
      // Menciut: animate shell FIRST, shrink hit region after spring settlement
      hitRegionTimerRef.current = setTimeout(() => {
        setHitRegion(bboxX, bboxY, bboxW, bboxH)
        hitRegionTimerRef.current = null
      }, 260)
    }
  }, [
    dims.shell.width,
    dims.shell.height,
    hasLeftAux,
    hasRightAux,
    isExpanded,
    isDragOver,
    isGrowing,
    setIsTransitioning,
  ])

  // 12. Hover Dwell (2s) and Auto-Collapse handlers
  const hoverDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openedViaHoverRef = useRef(false)

  // Unmount cleanup for timers
  useEffect(() => {
    return () => {
      if (hitRegionTimerRef.current) {
        clearTimeout(hitRegionTimerRef.current)
        hitRegionTimerRef.current = null
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
      if (hoverDwellTimerRef.current) {
        clearTimeout(hoverDwellTimerRef.current)
        hoverDwellTimerRef.current = null
      }
      if (leaveCollapseTimerRef.current) {
        clearTimeout(leaveCollapseTimerRef.current)
        leaveCollapseTimerRef.current = null
      }
    }
  }, [])

  const handleBubblePointerEnter = useCallback((type: 'timer' | 'music') => {
    if (leaveCollapseTimerRef.current) {
      clearTimeout(leaveCollapseTimerRef.current)
      leaveCollapseTimerRef.current = null
    }
    if (hoverDwellTimerRef.current) {
      clearTimeout(hoverDwellTimerRef.current)
      hoverDwellTimerRef.current = null
    }
    setHoveredTarget(type)
    hoverDwellTimerRef.current = setTimeout(() => {
      openedViaHoverRef.current = true
      setExpandedActivity(type)
      setHoveredTarget(null)
      hoverDwellTimerRef.current = null
    }, 2000)
  }, [setHoveredTarget, setExpandedActivity])

  const handleBubblePointerLeave = useCallback(() => {
    if (hoverDwellTimerRef.current) {
      clearTimeout(hoverDwellTimerRef.current)
      hoverDwellTimerRef.current = null
    }
    setHoveredTarget(null)
  }, [setHoveredTarget])

  const handleExpandedPointerEnter = useCallback(() => {
    if (leaveCollapseTimerRef.current) {
      clearTimeout(leaveCollapseTimerRef.current)
      leaveCollapseTimerRef.current = null
    }
  }, [])

  const handleExpandedPointerLeave = useCallback(() => {
    if (
      openedViaHoverRef.current &&
      (expandedActivity === 'timer' || expandedActivity === 'music')
    ) {
      leaveCollapseTimerRef.current = setTimeout(() => {
        setExpandedActivity(null)
        openedViaHoverRef.current = false
      }, 250)
    }
  }, [expandedActivity, setExpandedActivity])

  // 13. Dev controls in standard browser dev mode
  const isBrowserDev =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !('__TAURI_INTERNALS__' in window)
  const [showDevControls, setShowDevControls] = useState(isBrowserDev)

  // 14. Island dragging hook
  const {
    isDragging,
    isMagnetSnapped,
    setIsMagnetSnapped,
    setHorizontalOffset,
    handleShellPointerDown,
    handleShellPointerMove,
    handleShellPointerUp,
    handleShellPointerCancel,
    handleShellDoubleClick,
    handleShellClick,
  } = useIslandDrag({
    currentView,
    initialOffset: settings.horizontalOffset,
    isBrowserDev,
    onExpandHome: (page) => {
      openedViaHoverRef.current = false
      setExpandedActivity('home')
      setHomePage(page)
    },
  })

  // 15. OS & window events hook
  useIslandEvents({
    currentView,
    expandedActivity,
    timerStatus: timerData?.status,
    settings,
    systemMode,
    setSystemMode,
    setExpandedActivity,
    setHomePage,
    setIsDragOver,
    collapseAll,
  })

  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget && expandedActivity !== null) {
      collapseAll()
    }
  }

  return (
    <div
      className="w-full h-full relative select-none overflow-hidden flex flex-col items-center justify-start"
      onPointerDown={handleBackdropPointerDown}
    >
      {/* CENTERED CONTAINER FOR ATTACHED PONI (Y=0) AND MULTI-BUBBLE 3-TASK ISLAND */}
      <div
        className="flex items-start justify-center z-40 gap-2.5 pt-0 relative"
        onPointerDown={handleBackdropPointerDown}
      >
        {/* LEFT BUBBLE: MUSIC (PRIMARY) */}
        <LeftBubble
          isExpanded={isExpanded}
          isDragOver={isDragOver}
          isMediaActive={isMediaActive}
          mediaData={mediaData}
          hoveredTarget={hoveredTarget}
          musicTitle={t.music}
          clickToOpenTitle={t.clickToOpen}
          onBubblePointerEnter={handleBubblePointerEnter}
          onBubblePointerLeave={handleBubblePointerLeave}
          onOpenMedia={() => {
            openedViaHoverRef.current = false
            setExpandedActivity('music')
          }}
        />

        {/* SYMMETRY BALANCER: If only right aux is active, balance left side so capsule stays centered */}
        {!isExpanded && !isDragOver && !hasLeftAux && hasRightAux && (
          <div style={{ width: 28, height: 28 }} className="invisible shrink-0 pointer-events-none" />
        )}

        {/* SINGLE PERSISTENT SHELL (ATTACHED PONI AT Y=0) */}
        <Shell
          shellConfig={dims.shell}
          currentView={currentView}
          growing={isGrowing}
          nudge={nudge}
          isDragging={isDragging}
          onClick={handleShellClick}
          onDoubleClick={handleShellDoubleClick}
          onPointerDown={handleShellPointerDown}
          onPointerMove={handleShellPointerMove}
          onPointerUp={handleShellPointerUp}
          onPointerCancel={handleShellPointerCancel}
          onMouseEnter={handleExpandedPointerEnter}
          onMouseLeave={handleExpandedPointerLeave}
        >
          <IslandContent
            currentView={currentView}
            homePage={homePage}
            setHomePage={setHomePage}
            dateStr={dateStr}
            timeStr={timeStr}
            timerData={timerData}
            allTimers={allTimers}
            remainingSeconds={remainingSeconds}
            mediaData={mediaData}
            isDragOver={isDragOver}
            showCustomInput={showCustomInput}
            setShowCustomInput={setShowCustomInput}
            deviceNotification={deviceNotification}
            isMagnetSnapped={isMagnetSnapped}
            settings={settings}
            dropFilesHereText={t.dropFilesHere}
            isTimerActive={isTimerActive}
            systemMode={systemMode}
            onClose={collapseAll}
            onOpenSettings={() => setExpandedActivity('settings')}
            onOpenTimer={() => setExpandedActivity('timer')}
            onOpenMusic={() => {
              setExpandedActivity('home')
              setHomePage(0)
            }}
            onOpenFileShelf={() => {
              setExpandedActivity('home')
              setHomePage(2)
            }}
          />
        </Shell>

        {/* RIGHT BUBBLE: TIMER */}
        <RightBubble
          isExpanded={isExpanded}
          isDragOver={isDragOver}
          isTimerActive={isTimerActive}
          timerData={timerData}
          allTimers={allTimers}
          remainingSeconds={remainingSeconds}
          hoveredTarget={hoveredTarget}
          timerTitle={t.timer}
          clickToOpenTitle={t.clickToOpen}
          onBubblePointerEnter={handleBubblePointerEnter}
          onBubblePointerLeave={handleBubblePointerLeave}
          onOpenTimer={() => {
            openedViaHoverRef.current = false
            setExpandedActivity('timer')
          }}
        />

        {/* SYMMETRY BALANCER: If only left aux is active, balance right side so capsule stays centered */}
        {!isExpanded && !isDragOver && hasLeftAux && !hasRightAux && (
          <div style={{ width: 28, height: 28 }} className="invisible shrink-0 pointer-events-none" />
        )}
      </div>

      {/* Dev Controls */}
      {isBrowserDev && showDevControls && (
        <DevControls
          onClose={() => setShowDevControls(false)}
          onSetHorizontalOffset={(offset) => setHorizontalOffset(offset)}
          onTriggerSnap={() => {
            setHorizontalOffset(0)
            setIsMagnetSnapped(true)
            setTimeout(() => setIsMagnetSnapped(false), 2600)
          }}
        />
      )}
      {import.meta.env.DEV && <DevFrameMeter />}
    </div>
  )
}
