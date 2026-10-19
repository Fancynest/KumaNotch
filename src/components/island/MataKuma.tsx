import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Emotion System ────────────────────────────────────────────────
export type KumaEmotion =
  | 'neutral'   // Default soft look
  | 'happy'     // Curved eyes like ^_^ (music playing, timer done)
  | 'sleepy'    // Half-closed, slow blinks (long idle)
  | 'curious'   // Eyes looking left/right (new file detected)
  | 'surprised' // Wide open eyes (device connected)
  | 'content'   // Relaxed soft squint (background music)
  | 'thinking'  // Eyes look up-right (timer running)
  | 'wink'      // One eye closed playfully

interface MataKumaProps {
  emotion?: KumaEmotion
  isVisible: boolean
  /** External context signals for auto-emotion */
  context?: {
    isMusicPlaying?: boolean
    isTimerRunning?: boolean
    isTimerCompleted?: boolean
    freshFileDetected?: boolean
    deviceConnected?: boolean
    idleDurationMs?: number
  }
}

// ─── Eye Shape Presets ─────────────────────────────────────────────
// Each eye is defined by SVG properties
interface EyeShape {
  /** Scale on Y axis: 1 = round, 0.1 = squished flat, 2 = tall */
  scaleY: number
  /** Scale on X axis */
  scaleX: number
  /** Vertical offset from center (positive = down) */
  offsetY: number
  /** Horizontal offset from center (positive = right, for gaze) */
  offsetX: number
  /** Opacity */
  opacity: number
  /** Width in pixels */
  width: number
  /** Height in pixels */
  height: number
  /** Border radius as fraction: 1 = circle, 0 = square, >1 = horizontal oval */
  roundness: number
  /** Whether this eye is a curved arc (for happy ^_^) */
  isArc?: boolean
}

interface EmotionPreset {
  leftEye: EyeShape
  rightEye: EyeShape
  noseOpacity: number
  /** Optional blush circles */
  blush?: boolean
  /** How long this emotion transition takes */
  transitionDuration: number
}

const BASE_EYE: EyeShape = {
  scaleY: 1,
  scaleX: 1,
  offsetY: 0,
  offsetX: 0,
  opacity: 0.95,
  width: 6,
  height: 6,
  roundness: 1,
}

const EMOTION_PRESETS: Record<KumaEmotion, EmotionPreset> = {
  neutral: {
    leftEye: { ...BASE_EYE },
    rightEye: { ...BASE_EYE },
    noseOpacity: 0.3,
    transitionDuration: 0.3,
  },
  happy: {
    leftEye: { ...BASE_EYE, isArc: true, scaleY: 0.4, offsetY: -0.5 },
    rightEye: { ...BASE_EYE, isArc: true, scaleY: 0.4, offsetY: -0.5 },
    noseOpacity: 0.4,
    blush: true,
    transitionDuration: 0.25,
  },
  sleepy: {
    leftEye: { ...BASE_EYE, scaleY: 0.35, offsetY: 1 },
    rightEye: { ...BASE_EYE, scaleY: 0.35, offsetY: 1 },
    noseOpacity: 0.2,
    transitionDuration: 0.6,
  },
  curious: {
    leftEye: { ...BASE_EYE, scaleX: 0.9, offsetX: -1.5 },
    rightEye: { ...BASE_EYE, scaleX: 0.9, offsetX: -1.5 },
    noseOpacity: 0.3,
    transitionDuration: 0.35,
  },
  surprised: {
    leftEye: { ...BASE_EYE, scaleY: 1.3, scaleX: 1.2, width: 7, height: 7 },
    rightEye: { ...BASE_EYE, scaleY: 1.3, scaleX: 1.2, width: 7, height: 7 },
    noseOpacity: 0.45,
    transitionDuration: 0.15,
  },
  content: {
    leftEye: { ...BASE_EYE, scaleY: 0.7, offsetY: 0.3 },
    rightEye: { ...BASE_EYE, scaleY: 0.7, offsetY: 0.3 },
    noseOpacity: 0.3,
    blush: true,
    transitionDuration: 0.4,
  },
  thinking: {
    leftEye: { ...BASE_EYE, offsetX: 1, offsetY: -1 },
    rightEye: { ...BASE_EYE, offsetX: 1.5, offsetY: -1.2 },
    noseOpacity: 0.3,
    transitionDuration: 0.35,
  },
  wink: {
    leftEye: { ...BASE_EYE },
    rightEye: { ...BASE_EYE, scaleY: 0.08, isArc: true },
    noseOpacity: 0.35,
    blush: true,
    transitionDuration: 0.2,
  },
}

// ─── Auto-Emotion Logic ────────────────────────────────────────────
function deriveEmotion(context: MataKumaProps['context']): KumaEmotion {
  if (!context) return 'neutral'

  const { isMusicPlaying, isTimerRunning, isTimerCompleted, freshFileDetected, deviceConnected, idleDurationMs } = context

  // Priority order of emotions
  if (deviceConnected) return 'surprised'
  if (isTimerCompleted) return 'happy'
  if (freshFileDetected) return 'curious'
  if (isTimerRunning) return 'thinking'
  if (isMusicPlaying) return 'content'
  if (idleDurationMs && idleDurationMs > 30000) return 'sleepy'

  return 'neutral'
}

// ─── Single Eye Component ──────────────────────────────────────────
const KumaEye: React.FC<{
  shape: EyeShape
  isBlinking: boolean
}> = React.memo(({ shape, isBlinking }) => {
  const blinkScaleY = isBlinking ? 0.08 : shape.scaleY

  if (shape.isArc && !isBlinking) {
    // Happy arc eye: curved line like ^
    return (
      <motion.div
        animate={{
          scaleX: shape.scaleX,
          scaleY: 1,
          x: shape.offsetX,
          y: shape.offsetY,
          opacity: shape.opacity,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 0.5 }}
        style={{
          width: shape.width,
          height: shape.height * 0.45,
          borderRadius: '50% 50% 0 0',
          borderTop: '2px solid rgba(255, 255, 255, 0.95)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.4)',
          borderRight: '1px solid rgba(255, 255, 255, 0.4)',
          borderBottom: 'none',
          background: 'transparent',
        }}
      />
    )
  }

  return (
    <motion.div
      animate={{
        scaleX: shape.scaleX,
        scaleY: blinkScaleY,
        x: shape.offsetX,
        y: shape.offsetY + (isBlinking ? 0.5 : 0),
        opacity: shape.opacity,
      }}
      transition={{
        scaleY: { duration: isBlinking ? 0.07 : 0.2, ease: 'easeInOut' },
        scaleX: { type: 'spring', stiffness: 300, damping: 20, mass: 0.5 },
        x: { type: 'spring', stiffness: 200, damping: 18, mass: 0.6 },
        y: { type: 'spring', stiffness: 200, damping: 18, mass: 0.6 },
      }}
      style={{
        width: shape.width,
        height: shape.height,
        borderRadius: shape.roundness >= 1 ? '50%' : `${shape.roundness * 50}%`,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        transformOrigin: 'center center',
      }}
    />
  )
})

KumaEye.displayName = 'KumaEye'

// ─── Main Mata Kuma Component ──────────────────────────────────────
export const MataKuma: React.FC<MataKumaProps> = ({ emotion: externalEmotion, isVisible, context }) => {
  const [isBlinking, setIsBlinking] = useState(false)
  const [microExpression, setMicroExpression] = useState<'lookLeft' | 'lookRight' | null>(null)
  const activeRef = useRef(true)

  // Derive emotion from context or use external override
  const autoEmotion = useMemo(() => deriveEmotion(context), [context])
  const emotion = externalEmotion ?? autoEmotion

  const preset = EMOTION_PRESETS[emotion]

  // Apply micro-expression overlays to eye shapes
  const effectiveLeftEye = useMemo(() => {
    const eye = { ...preset.leftEye }
    if (microExpression === 'lookLeft') {
      eye.offsetX = (eye.offsetX || 0) - 2
    } else if (microExpression === 'lookRight') {
      eye.offsetX = (eye.offsetX || 0) + 2
    }
    return eye
  }, [preset.leftEye, microExpression])

  const effectiveRightEye = useMemo(() => {
    const eye = { ...preset.rightEye }
    if (microExpression === 'lookLeft') {
      eye.offsetX = (eye.offsetX || 0) - 2
    } else if (microExpression === 'lookRight') {
      eye.offsetX = (eye.offsetX || 0) + 2
    }
    return eye
  }, [preset.rightEye, microExpression])

  // ─── Blink Scheduler ─────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return
    activeRef.current = true

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null
    let resetTimeout: ReturnType<typeof setTimeout> | null = null

    const scheduleNextBlink = () => {
      // Sleepy emotion blinks more frequently and slower
      const isSleepy = emotion === 'sleepy'
      const minDelay = isSleepy ? 1500 : 2800
      const maxDelay = isSleepy ? 3500 : 6000
      const blinkDuration = isSleepy ? 220 : 120

      // Sometimes do a double-blink
      const isDoubleBlink = Math.random() < 0.2

      const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay
      blinkTimeout = setTimeout(() => {
        if (!activeRef.current) return
        setIsBlinking(true)
        resetTimeout = setTimeout(() => {
          if (!activeRef.current) return
          setIsBlinking(false)

          if (isDoubleBlink) {
            // Quick second blink
            setTimeout(() => {
              if (!activeRef.current) return
              setIsBlinking(true)
              setTimeout(() => {
                if (!activeRef.current) return
                setIsBlinking(false)
                scheduleNextBlink()
              }, blinkDuration * 0.8)
            }, 100)
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
  }, [isVisible, emotion])

  // ─── Micro-Expression Scheduler (occasional look-arounds) ────
  useEffect(() => {
    if (!isVisible || emotion === 'sleepy' || emotion === 'happy') return
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const scheduleLook = () => {
      const delay = Math.floor(Math.random() * 8000) + 5000
      timer = setTimeout(() => {
        if (!active) return
        const direction = Math.random() < 0.5 ? 'lookLeft' : 'lookRight'
        setMicroExpression(direction as 'lookLeft' | 'lookRight')

        // Hold gaze for 0.8-1.5s then return
        setTimeout(() => {
          if (!active) return
          setMicroExpression(null)
          scheduleLook()
        }, 800 + Math.random() * 700)
      }, delay)
    }

    scheduleLook()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [isVisible, emotion])

  // ─── Curious Alternating Gaze ─────────────────────────────────
  useEffect(() => {
    if (!isVisible || emotion !== 'curious') return
    let active = true
    let step = 0

    const gazePattern = () => {
      if (!active) return
      const directions: Array<'lookLeft' | 'lookRight' | null> = ['lookLeft', 'lookRight', null]
      setMicroExpression(directions[step % 3])
      step++
      setTimeout(gazePattern, 1200 + Math.random() * 600)
    }

    const startTimer = setTimeout(gazePattern, 300)

    return () => {
      active = false
      clearTimeout(startTimer)
    }
  }, [isVisible, emotion])

  if (!isVisible) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={emotion}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{
          opacity: { duration: preset.transitionDuration },
          scale: { type: 'spring', stiffness: 350, damping: 25, mass: 0.4 },
        }}
        className="flex items-center justify-center gap-2.5 relative"
      >
        {/* Left eye */}
        <KumaEye shape={effectiveLeftEye} isBlinking={isBlinking} />

        {/* Nose */}
        <motion.div
          animate={{ opacity: preset.noseOpacity }}
          transition={{ duration: 0.3 }}
          className="w-1 h-0.5 rounded-full bg-white"
        />

        {/* Right eye */}
        <KumaEye shape={effectiveRightEye} isBlinking={isBlinking} />

        {/* Blush indicators (happy/content/wink) */}
        {preset.blush && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.2, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="absolute rounded-full bg-pink-400"
              style={{
                width: 5,
                height: 3,
                left: -2,
                bottom: -2,
                filter: 'blur(1.5px)',
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.2, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="absolute rounded-full bg-pink-400"
              style={{
                width: 5,
                height: 3,
                right: -2,
                bottom: -2,
                filter: 'blur(1.5px)',
              }}
            />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
