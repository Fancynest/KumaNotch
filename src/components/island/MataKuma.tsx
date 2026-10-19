import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'

// ─── Emotion Types ────────────────────────────────────────────────
export type KumaEmotion =
  | 'neutral'   // Relaxed round eyes with reflection
  | 'happy'     // Bold curved smiling arcs ^_^ with rosy blush
  | 'sleepy'    // Half-closed relaxed eyelids with gentle pulse
  | 'curious'   // Inquisitive side glance
  | 'surprised' // Wide open enlarged eyes
  | 'content'   // Gentle pleased squint
  | 'thinking'  // Gaze tilted up-and-right
  | 'wink'      // Playful one-eye wink with blush

export interface MataKumaContext {
  isMusicPlaying?: boolean
  isTimerRunning?: boolean
  isTimerCompleted?: boolean
  freshFileDetected?: boolean
  deviceConnected?: boolean
  idleDurationMs?: number
  isOliviaRodrigo?: boolean
  isHovered?: boolean
}

interface MataKumaProps {
  emotion?: KumaEmotion
  isVisible: boolean
  context?: MataKumaContext
}

// ─── Vector Eye Renderer ──────────────────────────────────────────
interface VectorEyeProps {
  type: 'round' | 'arc' | 'sleepy' | 'winkSlit' | 'wide'
  offsetX?: number
  offsetY?: number
  scaleX?: number
  scaleY?: number
  isBlinking: boolean
}

const VectorEye: React.FC<VectorEyeProps> = React.memo(
  ({ type, offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1, isBlinking }) => {
    // When blinking, flatten the eye vertically
    const currentScaleY = isBlinking ? 0.08 : scaleY

    return (
      <motion.div
        animate={{
          x: offsetX,
          y: offsetY,
          scaleX,
          scaleY: currentScaleY,
        }}
        transition={{
          scaleY: { duration: isBlinking ? 0.06 : 0.22, ease: 'easeInOut' },
          scaleX: { type: 'spring', stiffness: 340, damping: 22, mass: 0.5 },
          x: { type: 'spring', stiffness: 260, damping: 20, mass: 0.5 },
          y: { type: 'spring', stiffness: 260, damping: 20, mass: 0.5 },
        }}
        className="w-3 h-3 flex items-center justify-center shrink-0 origin-center"
      >
        <svg viewBox="0 0 12 12" className="w-3 h-3 overflow-visible">
          {type === 'arc' && !isBlinking ? (
            // Smiling arc ^
            <path
              d="M 1.5 8 C 3 2.5, 9 2.5, 10.5 8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          ) : type === 'sleepy' && !isBlinking ? (
            // Sleepy droop arc
            <path
              d="M 1.8 5 C 4 8, 8 8, 10.2 5"
              fill="none"
              stroke="rgba(255, 255, 255, 0.75)"
              strokeWidth="2.0"
              strokeLinecap="round"
            />
          ) : type === 'winkSlit' && !isBlinking ? (
            // Wink horizontal smiling curve
            <path
              d="M 2 6.5 Q 6 3.5 10 6.5"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          ) : type === 'wide' ? (
            // Surprised wide eyes
            <>
              <circle cx="6" cy="6" r="4.6" fill="#ffffff" />
              <circle cx="7.2" cy="4.8" r="1.4" fill="rgba(0, 0, 0, 0.35)" />
            </>
          ) : (
            // Default round pupil with cute light shine
            <>
              <circle cx="6" cy="6" r="3.4" fill="#ffffff" />
              <circle cx="7.2" cy="4.8" r="1.1" fill="rgba(255, 255, 255, 0.95)" />
            </>
          )}
        </svg>
      </motion.div>
    )
  },
)

VectorEye.displayName = 'VectorEye'

// ─── Main MataKuma Component ──────────────────────────────────────
export const MataKuma: React.FC<MataKumaProps> = ({
  emotion: externalEmotion,
  isVisible,
  context,
}) => {
  const [isBlinking, setIsBlinking] = useState(false)
  const [idleSpontaneousEmotion, setIdleSpontaneousEmotion] = useState<KumaEmotion | null>(null)
  const [microGaze, setMicroGaze] = useState<'left' | 'right' | null>(null)
  const activeRef = useRef(true)

  // 1. External context flags
  const isOlivia = Boolean(context?.isOliviaRodrigo)
  const isMusic = Boolean(context?.isMusicPlaying)
  const isTimerDone = Boolean(context?.isTimerCompleted)
  const isTimerRunning = Boolean(context?.isTimerRunning)
  const isFresh = Boolean(context?.freshFileDetected)
  const isDeviceConnected = Boolean(context?.deviceConnected)
  const isHovered = Boolean(context?.isHovered)
  const isDeepSleepy = Boolean(context?.idleDurationMs && context.idleDurationMs > 35000)

  // 2. Derive base context emotion
  const contextualEmotion = useMemo<KumaEmotion>(() => {
    if (isOlivia) return 'happy'
    if (isDeviceConnected) return 'surprised'
    if (isTimerDone) return 'happy'
    if (isFresh) return 'curious'
    if (isHovered) return 'happy'
    if (isTimerRunning) return 'thinking'
    if (isMusic) return 'happy'
    if (isDeepSleepy) return 'sleepy'
    return idleSpontaneousEmotion || 'neutral'
  }, [
    isOlivia,
    isDeviceConnected,
    isTimerDone,
    isFresh,
    isHovered,
    isTimerRunning,
    isMusic,
    isDeepSleepy,
    idleSpontaneousEmotion,
  ])

  const currentEmotion: KumaEmotion = externalEmotion ?? contextualEmotion

  // ─── Autonomous Organic Mood Cycle During Idle ────────────────────
  // When no high-priority event is occurring, Kuma periodically cycles through
  // adorable spontaneous emotions (happy smile, wink, curiosity, content).
  useEffect(() => {
    if (!isVisible) return
    let active = true

    // Only run spontaneous mood cycles when idle (no active music/timer/device)
    const isBusy = isOlivia || isMusic || isTimerRunning || isTimerDone || isFresh || isDeviceConnected

    if (isBusy) {
      setIdleSpontaneousEmotion(null)
      return
    }

    const scheduleNextMood = () => {
      if (!active) return

      // Random delay between 8 and 15 seconds
      const delay = 8000 + Math.random() * 7000

      const timer = setTimeout(() => {
        if (!active) return

        const roll = Math.random()
        let nextMood: KumaEmotion = 'neutral'
        let duration = 3500

        if (roll < 0.35) {
          nextMood = 'happy'
          duration = 3800
        } else if (roll < 0.60) {
          nextMood = 'wink'
          duration = 2600
        } else if (roll < 0.80) {
          nextMood = 'content'
          duration = 3600
        } else {
          nextMood = 'curious'
          duration = 3200
        }

        setIdleSpontaneousEmotion(nextMood)

        // Return to neutral after duration
        setTimeout(() => {
          if (!active) return
          setIdleSpontaneousEmotion(null)
          scheduleNextMood()
        }, duration)
      }, delay)

      return timer
    }

    const initialTimer = scheduleNextMood()

    return () => {
      active = false
      if (initialTimer) clearTimeout(initialTimer)
    }
  }, [isVisible, isOlivia, isMusic, isTimerRunning, isTimerDone, isFresh, isDeviceConnected])

  // ─── Periodic Micro-Gaze (Looking Around) ─────────────────────────
  useEffect(() => {
    if (!isVisible) return
    let active = true

    const scheduleLook = () => {
      if (!active) return
      const delay = 6000 + Math.random() * 8000
      setTimeout(() => {
        if (!active) return
        setMicroGaze(Math.random() < 0.5 ? 'left' : 'right')

        setTimeout(() => {
          if (!active) return
          setMicroGaze(null)
          scheduleLook()
        }, 1000 + Math.random() * 800)
      }, delay)
    }

    scheduleLook()

    return () => {
      active = false
    }
  }, [isVisible])

  // ─── Natural Blink Engine with Double-Blink ───────────────────────
  useEffect(() => {
    if (!isVisible) return
    activeRef.current = true

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null
    let resetTimeout: ReturnType<typeof setTimeout> | null = null

    const scheduleNextBlink = () => {
      const isSleepy = currentEmotion === 'sleepy'
      const minDelay = isSleepy ? 1400 : 2600
      const maxDelay = isSleepy ? 3200 : 5600
      const delay = minDelay + Math.random() * (maxDelay - minDelay)

      blinkTimeout = setTimeout(() => {
        if (!activeRef.current) return
        setIsBlinking(true)

        const blinkDuration = isSleepy ? 220 : 130
        resetTimeout = setTimeout(() => {
          if (!activeRef.current) return
          setIsBlinking(false)

          // 25% chance of a quick organic double-blink
          if (Math.random() < 0.25) {
            setTimeout(() => {
              if (!activeRef.current) return
              setIsBlinking(true)
              setTimeout(() => {
                if (!activeRef.current) return
                setIsBlinking(false)
                scheduleNextBlink()
              }, 110)
            }, 120)
          } else {
            scheduleNextBlink()
          }
        }, blinkDuration)
      }, delay)
    }

    scheduleNextBlink()

    return () => {
      activeRef.current = false
      if (blinkTimeout) clearTimeout(blinkTimeout)
      if (resetTimeout) clearTimeout(resetTimeout)
    }
  }, [isVisible, currentEmotion])

  if (!isVisible) return null

  // ─── Eye Shape Configurations per Emotion ─────────────────────────
  const getEyeConfig = () => {
    const gazeOffset = microGaze === 'left' ? -1.8 : microGaze === 'right' ? 1.8 : 0

    switch (currentEmotion) {
      case 'happy':
        return {
          left: { type: 'arc' as const, scaleX: 1.15, scaleY: 1.1, offsetY: -0.5 },
          right: { type: 'arc' as const, scaleX: 1.15, scaleY: 1.1, offsetY: -0.5 },
          blush: true,
          noseOpacity: 0.45,
        }
      case 'wink':
        return {
          left: { type: 'arc' as const, scaleX: 1.1, scaleY: 1.0, offsetY: -0.5 },
          right: { type: 'round' as const, scaleX: 1.05, scaleY: 1.05, offsetX: gazeOffset },
          blush: true,
          noseOpacity: 0.4,
        }
      case 'sleepy':
        return {
          left: { type: 'sleepy' as const, scaleX: 1.0, scaleY: 0.9, offsetY: 0.8 },
          right: { type: 'sleepy' as const, scaleX: 1.0, scaleY: 0.9, offsetY: 0.8 },
          blush: false,
          noseOpacity: 0.2,
        }
      case 'curious':
        return {
          left: { type: 'round' as const, scaleX: 0.95, offsetX: -2.2, offsetY: -0.5 },
          right: { type: 'round' as const, scaleX: 0.95, offsetX: -2.2, offsetY: 0 },
          blush: false,
          noseOpacity: 0.35,
        }
      case 'surprised':
        return {
          left: { type: 'wide' as const, scaleX: 1.25, scaleY: 1.25, offsetY: -0.5 },
          right: { type: 'wide' as const, scaleX: 1.25, scaleY: 1.25, offsetY: -0.5 },
          blush: true,
          noseOpacity: 0.5,
        }
      case 'content':
        return {
          left: { type: 'winkSlit' as const, scaleX: 1.1, scaleY: 0.9, offsetY: 0.3 },
          right: { type: 'winkSlit' as const, scaleX: 1.1, scaleY: 0.9, offsetY: 0.3 },
          blush: true,
          noseOpacity: 0.35,
        }
      case 'thinking':
        return {
          left: { type: 'round' as const, offsetX: 1.6, offsetY: -1.4 },
          right: { type: 'round' as const, offsetX: 2.0, offsetY: -1.6 },
          blush: false,
          noseOpacity: 0.35,
        }
      case 'neutral':
      default:
        return {
          left: { type: 'round' as const, offsetX: gazeOffset },
          right: { type: 'round' as const, offsetX: gazeOffset },
          blush: false,
          noseOpacity: 0.3,
        }
    }
  }

  const eyeConfig = getEyeConfig()

  // Olivia Rodrigo aesthetic colors: signature lilac/purple (#c084fc) or vibrant rose (#f43f5e)
  const blushColor = isOlivia ? '#c084fc' : '#f43f5e'
  const blushGlow = isOlivia
    ? '0 0 7px rgba(192, 132, 252, 0.85)'
    : '0 0 6px rgba(244, 63, 94, 0.7)'

  return (
    <div className="relative flex items-center justify-center select-none py-1">
      {/* Olivia Rodrigo Floating Music / Heart Charm */}
      {isOlivia && (
        <motion.div
          initial={{ opacity: 0, scale: 0, y: 4 }}
          animate={{
            opacity: [0.75, 1, 0.75],
            scale: [0.95, 1.1, 0.95],
            y: [-6, -9, -6],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-3.5 flex items-center gap-0.5 text-[9px] pointer-events-none"
        >
          <span className="text-purple-400 font-bold drop-shadow-[0_0_6px_rgba(192,132,252,0.8)]">💜</span>
          <span className="text-pink-300 font-mono text-[8px] animate-pulse">♪</span>
        </motion.div>
      )}

      {/* Main Face Container with Subtle Joyful Bobbing when Olivia / Music is playing */}
      <motion.div
        key={currentEmotion}
        animate={
          isOlivia
            ? { y: [0, -1.8, 0], rotate: [0, -1, 1, 0] }
            : isMusic
            ? { y: [0, -1.0, 0] }
            : { y: 0 }
        }
        transition={
          isOlivia
            ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
            : isMusic
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
        className="flex items-center justify-center gap-2 relative px-2"
        title={isOlivia ? '💜 Olivia Rodrigo Mode: Kuma senang banget!' : undefined}
      >
        {/* Left Blush */}
        {eyeConfig.blush && (
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.75, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.28 }}
            className="absolute -left-1 bottom-0.5 rounded-full pointer-events-none"
            style={{
              width: 5.5,
              height: 3,
              backgroundColor: blushColor,
              boxShadow: blushGlow,
            }}
          />
        )}

        {/* Left Eye */}
        <VectorEye
          type={eyeConfig.left.type}
          offsetX={eyeConfig.left.offsetX}
          offsetY={eyeConfig.left.offsetY}
          scaleX={eyeConfig.left.scaleX}
          scaleY={eyeConfig.left.scaleY}
          isBlinking={isBlinking}
        />

        {/* Nose */}
        <motion.div
          animate={{ opacity: eyeConfig.noseOpacity }}
          transition={{ duration: 0.25 }}
          className="w-1.5 h-0.5 rounded-full bg-white/90 shrink-0"
        />

        {/* Right Eye */}
        <VectorEye
          type={eyeConfig.right.type}
          offsetX={eyeConfig.right.offsetX}
          offsetY={eyeConfig.right.offsetY}
          scaleX={eyeConfig.right.scaleX}
          scaleY={eyeConfig.right.scaleY}
          isBlinking={isBlinking}
        />

        {/* Right Blush */}
        {eyeConfig.blush && (
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.75, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.28 }}
            className="absolute -right-1 bottom-0.5 rounded-full pointer-events-none"
            style={{
              width: 5.5,
              height: 3,
              backgroundColor: blushColor,
              boxShadow: blushGlow,
            }}
          />
        )}
      </motion.div>
    </div>
  )
}
