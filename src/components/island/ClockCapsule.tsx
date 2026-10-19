import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SystemMode } from '../../core/islandStore'
import { MataKuma } from './MataKuma'
import { isOliviaRodrigoMedia } from '../../core/oliviaRodrigo'
import type { MediaData } from '../../core/media'

interface ClockCapsuleProps {
  timeStr: string
  personalityEnabled: boolean
  idleBeforeEyesSeconds: number
  systemMode: SystemMode
  isIdleView: boolean
  /** Context signals for emotion inference */
  isMusicPlaying?: boolean
  isTimerRunning?: boolean
  isTimerCompleted?: boolean
  freshFileDetected?: boolean
  deviceConnected?: boolean
  mediaData?: MediaData | null
}

export const ClockCapsule: React.FC<ClockCapsuleProps> = ({
  timeStr,
  personalityEnabled,
  idleBeforeEyesSeconds,
  systemMode,
  isIdleView,
  isMusicPlaying,
  isTimerRunning,
  isTimerCompleted,
  freshFileDetected,
  deviceConnected,
  mediaData,
}) => {
  const [isPersonalityIdle, setIsPersonalityIdle] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const idleSinceRef = useRef<number>(Date.now())

  const isEligible = isIdleView && personalityEnabled && systemMode !== 'hidden'
  const isOlivia = isOliviaRodrigoMedia(mediaData)

  // Trigger Mata Kuma eyes after inactivity delay when in idle mode
  useEffect(() => {
    if (!isEligible) return

    const idleDelayMs = (idleBeforeEyesSeconds || 6) * 1000
    let timerId = setTimeout(() => {
      setIsPersonalityIdle(true)
      idleSinceRef.current = Date.now()
    }, idleDelayMs)

    const handleActivity = () => {
      // Don't hide eyes on minor mouse movements if already active
      // Only reset the timer if eyes aren't active yet
      idleSinceRef.current = Date.now()
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
  }, [isEligible, idleBeforeEyesSeconds])

  // Track how long we've been idle for sleepy detection
  const [idleDurationMs, setIdleDurationMs] = useState(0)
  useEffect(() => {
    if (!isPersonalityIdle) {
      setIdleDurationMs(0)
      return
    }

    const interval = setInterval(() => {
      setIdleDurationMs(Date.now() - idleSinceRef.current)
    }, 4000)

    return () => clearInterval(interval)
  }, [isPersonalityIdle])

  // Show eyes if:
  // 1. Idle threshold reached
  // 2. OR Olivia Rodrigo is playing (immediate VIP reaction!)
  // 3. OR user is hovering over the droplet/capsule
  const showEyes =
    (isEligible && isPersonalityIdle) ||
    (isEligible && isOlivia) ||
    (isEligible && isHovered)

  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="absolute inset-0 px-3 flex items-center justify-center text-white overflow-hidden whitespace-nowrap"
    >
      <AnimatePresence mode="wait">
        {showEyes ? (
          <motion.div
            key="eyes"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <MataKuma
              isVisible
              context={{
                isMusicPlaying,
                isTimerRunning,
                isTimerCompleted,
                freshFileDetected,
                deviceConnected,
                idleDurationMs,
                isOliviaRodrigo: isOlivia,
                isHovered,
              }}
            />
          </motion.div>
        ) : (
          <motion.span
            key="clock"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="text-xs font-semibold text-white/95 font-mono tracking-tight"
          >
            {timeStr}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
