import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'

// ─── Emotion Types ────────────────────────────────────────────────
export type KumaEmotion =
  | 'neutral'   // Relaxed round eyes with reflection
  | 'happy'     // Bold curved smiling arcs ^_^ with rosy blush
  | 'sad'       // Downturned gentle arc with tear shimmer
  | 'focus'     // Determined, narrowed intense gaze
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
  isProcessRunning?: boolean
  isMagnetSnapped?: boolean
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
  type: 'round' | 'arc' | 'sleepy' | 'winkSlit' | 'wide' | 'sad' | 'focus'
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
          ) : type === 'sad' && !isBlinking ? (
            // Sad downturned arc with subtle tear shimmer
            <>
              <path
                d="M 1.5 5 C 3 9.5, 9 9.5, 10.5 5"
                fill="none"
                stroke="rgba(255, 255, 255, 0.88)"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <circle cx="9.2" cy="7.8" r="1.1" fill="#60a5fa" opacity="0.9" />
            </>
          ) : type === 'focus' && !isBlinking ? (
            // Sharp determined focused eyes
            <>
              <path
                d="M 1.2 4.2 L 10.8 4.2"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="6" cy="7" r="2.8" fill="#ffffff" />
              <circle cx="6" cy="7" r="1.2" fill="rgba(0, 0, 0, 0.5)" />
            </>
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

// ─── Bear Nose Vector Component ───────────────────────────────────
interface BearNoseProps {
  opacity: number
}

const BearNose: React.FC<BearNoseProps> = React.memo(({ opacity }) => {
  return (
    <motion.div
      animate={{ opacity }}
      transition={{ duration: 0.25 }}
      className="flex items-center justify-center shrink-0 origin-center"
      style={{ width: 8, height: 7 }}
    >
      <svg
        viewBox="0 0 10 9"
        className="w-2 h-1.5 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft inverted rounded triangle bear nose (▼) */}
        <path
          d="M 1.5 2 C 1.5 1.0, 8.5 1.0, 8.5 2 C 8.5 3.6, 6.2 5.8, 5 5.8 C 3.8 5.8, 1.5 3.6, 1.5 2 Z"
          fill="rgba(255, 255, 255, 0.95)"
        />
        {/* Cute shine highlight on the nose */}
        <ellipse cx="3.6" cy="2.2" rx="0.9" ry="0.5" fill="#ffffff" />
        {/* Vertical philtrum seam */}
        <line
          x1="5"
          y1="5.8"
          x2="5"
          y2="7.4"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="1.0"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  )
})

BearNose.displayName = 'BearNose'

// ─── Main MataKuma Component ──────────────────────────────────────
export const MataKuma: React.FC<MataKumaProps> = ({
  emotion: externalEmotion,
  isVisible,
  context,
}) => {
  const [isBlinking, setIsBlinking] = useState(false)
  const [rawSpontaneousEmotion, setRawSpontaneousEmotion] = useState<KumaEmotion | null>(null)
  const [microGaze, setMicroGaze] = useState<'left' | 'right' | null>(null)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const activeRef = useRef(true)

  // 1. External context flags
  const isOlivia = Boolean(context?.isOliviaRodrigo)
  const isMusic = Boolean(context?.isMusicPlaying)
  const isTimerDone = Boolean(context?.isTimerCompleted)
  const isTimerRunning = Boolean(context?.isTimerRunning)
  const isFresh = Boolean(context?.freshFileDetected)
  const isDeviceConnected = Boolean(context?.deviceConnected)
  const isProcessRunning = Boolean(context?.isProcessRunning)
  const isMagnetSnapped = Boolean(context?.isMagnetSnapped)
  const isHovered = Boolean(context?.isHovered)
  const isDeepSleepy = Boolean(context?.idleDurationMs && context.idleDurationMs > 35000)

  // Only run spontaneous mood cycles when idle (no active music/timer/device/process/magnet)
  const isBusy =
    isOlivia ||
    isMusic ||
    isTimerRunning ||
    isTimerDone ||
    isFresh ||
    isDeviceConnected ||
    isProcessRunning ||
    isMagnetSnapped
  const idleSpontaneousEmotion = isBusy ? null : rawSpontaneousEmotion

  // 2. Derive base context emotion
  // Precedence: Magnet Snap (Surprised) > Olivia > Process Running (Focus) > Device Connect > Timer Done > Fresh File > Timer Running (Thinking) > Hovered > Music > Sleepy > Spontaneous
  const contextualEmotion = useMemo<KumaEmotion>(() => {
    if (isMagnetSnapped) return 'surprised'
    if (isOlivia) return 'happy'
    if (isProcessRunning) return 'focus'
    if (isDeviceConnected) return 'surprised'
    if (isTimerDone) return 'happy'
    if (isFresh) return 'curious'
    if (isTimerRunning) return 'thinking'
    if (isHovered) return 'happy'
    if (isMusic) return 'happy'
    if (isDeepSleepy) return 'sleepy'
    return idleSpontaneousEmotion || 'neutral'
  }, [
    isMagnetSnapped,
    isOlivia,
    isProcessRunning,
    isDeviceConnected,
    isTimerDone,
    isFresh,
    isTimerRunning,
    isHovered,
    isMusic,
    isDeepSleepy,
    idleSpontaneousEmotion,
  ])

  const currentEmotion: KumaEmotion = externalEmotion ?? contextualEmotion

  // ─── Pupil Tracking Cursor (Only when cursor is within window) ───
  useEffect(() => {
    if (!isVisible) return

    const handleMouseMove = (e: MouseEvent) => {
      if (
        e.clientX < 0 ||
        e.clientX > window.innerWidth ||
        e.clientY < 0 ||
        e.clientY > window.innerHeight
      ) {
        setPupilOffset({ x: 0, y: 0 })
        return
      }

      const centerX = window.innerWidth / 2
      const centerY = 24
      const dx = e.clientX - centerX
      const dy = e.clientY - centerY

      const clampedX = Math.max(-2.2, Math.min(2.2, dx / 35))
      const clampedY = Math.max(-1.5, Math.min(1.5, dy / 20))
      setPupilOffset({ x: clampedX, y: clampedY })
    }

    const handleMouseLeave = () => {
      setPupilOffset({ x: 0, y: 0 })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [isVisible])

  // ─── Autonomous Organic Mood Cycle During Idle ────────────────────
  useEffect(() => {
    if (!isVisible || isBusy) return
    let active = true

    const scheduleNextMood = () => {
      if (!active) return

      // Calm delay between 18 and 32 seconds
      const delay = 18000 + Math.random() * 14000

      const timer = setTimeout(() => {
        if (!active) return

        const roll = Math.random()
        let nextMood: KumaEmotion = 'neutral'
        let duration = 2400

        // Subtle distribution: Mostly calm/content/wink, rarely happy
        if (roll < 0.08) {
          nextMood = 'happy'
          duration = 2600
        } else if (roll < 0.22) {
          nextMood = 'wink'
          duration = 2000
        } else if (roll < 0.40) {
          nextMood = 'content'
          duration = 2600
        } else if (roll < 0.52) {
          nextMood = 'curious'
          duration = 2200
        } else {
          nextMood = 'neutral'
          duration = 1000
        }

        setRawSpontaneousEmotion(nextMood)

        // Return to neutral after duration
        setTimeout(() => {
          if (!active) return
          setRawSpontaneousEmotion(null)
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
  }, [isVisible, isBusy])

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
      case 'sad':
        return {
          left: { type: 'sad' as const, scaleX: 1.05, scaleY: 1.0, offsetY: 0.6 },
          right: { type: 'sad' as const, scaleX: 1.05, scaleY: 1.0, offsetY: 0.6 },
          blush: false,
          noseOpacity: 0.25,
        }
      case 'focus':
        return {
          left: { type: 'focus' as const, scaleX: 1.1, scaleY: 0.95, offsetX: gazeOffset, offsetY: -0.2 },
          right: { type: 'focus' as const, scaleX: 1.1, scaleY: 0.95, offsetX: gazeOffset, offsetY: -0.2 },
          blush: false,
          noseOpacity: 0.4,
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

  const canFollowCursor = (type: string) =>
    type === 'round' || type === 'wide' || type === 'focus'

  const leftCursorX = canFollowCursor(eyeConfig.left.type) ? pupilOffset.x : 0
  const leftCursorY = canFollowCursor(eyeConfig.left.type) ? pupilOffset.y : 0
  const rightCursorX = canFollowCursor(eyeConfig.right.type) ? pupilOffset.x : 0
  const rightCursorY = canFollowCursor(eyeConfig.right.type) ? pupilOffset.y : 0

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

      {/* Thinking Floating Thought Charm */}
      {currentEmotion === 'thinking' && !isOlivia && (
        <motion.div
          initial={{ opacity: 0, scale: 0, y: 3 }}
          animate={{
            opacity: [0.7, 1, 0.7],
            scale: [0.95, 1.15, 0.95],
            y: [-6, -8.5, -6],
          }}
          transition={{
            duration: 1.9,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-3.5 right-0.5 flex items-center pointer-events-none"
        >
          <span className="text-amber-300 font-bold text-[9px] drop-shadow-[0_0_5px_rgba(252,211,77,0.8)]">💭</span>
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
          offsetX={(eyeConfig.left.offsetX ?? 0) + leftCursorX}
          offsetY={(eyeConfig.left.offsetY ?? 0) + leftCursorY}
          scaleX={eyeConfig.left.scaleX}
          scaleY={eyeConfig.left.scaleY}
          isBlinking={isBlinking}
        />

        {/* Bear Nose (Teddy Kuma Inverted Triangle Nose with Philtrum) */}
        <BearNose opacity={eyeConfig.noseOpacity} />

        {/* Right Eye */}
        <VectorEye
          type={eyeConfig.right.type}
          offsetX={(eyeConfig.right.offsetX ?? 0) + rightCursorX}
          offsetY={(eyeConfig.right.offsetY ?? 0) + rightCursorY}
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
