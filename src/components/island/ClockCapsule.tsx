import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SystemMode } from '../../core/islandStore'
import { MataKuma } from './MataKuma'
import { isFavoriteArtistMedia } from '../../core/oliviaRodrigo'
import type { MediaData } from '../../core/media'

interface ClockCapsuleProps {
  timeStr: string
  personalityEnabled: boolean
  idleBeforeEyesSeconds: number
  systemMode: SystemMode
  isIdleView: boolean
  favoriteArtist?: string
  /** Context signals for emotion inference */
  isMusicPlaying?: boolean
  isTimerRunning?: boolean
  isTimerCompleted?: boolean
  freshFileDetected?: boolean
  deviceConnected?: boolean
  isProcessRunning?: boolean
  mediaData?: MediaData | null
}

export const ClockCapsule: React.FC<ClockCapsuleProps> = ({
  timeStr,
  personalityEnabled,
  idleBeforeEyesSeconds,
  systemMode,
  isIdleView,
  favoriteArtist,
  isMusicPlaying,
  isTimerRunning,
  isTimerCompleted,
  freshFileDetected,
  deviceConnected,
  isProcessRunning,
  mediaData,
}) => {
  const [isPersonalityIdle, setIsPersonalityIdle] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const idleSinceRef = useRef<number | null>(null)

  const isEligible = isIdleView && personalityEnabled && systemMode !== 'hidden'
  const isFavArtist = isFavoriteArtistMedia(mediaData, favoriteArtist)

  // Trigger Mata Kuma eyes after inactivity delay when in idle mode
  useEffect(() => {
    if (!isEligible) return

    const idleDelayMs = (idleBeforeEyesSeconds || 6) * 1000
    let timerId = setTimeout(() => {
      setIsPersonalityIdle(true)
      idleSinceRef.current = Date.now()
    }, idleDelayMs)

    const handleActivity = () => {
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
  const [rawIdleDurationMs, setRawIdleDurationMs] = useState(0)
  const idleDurationMs = isPersonalityIdle ? rawIdleDurationMs : 0

  useEffect(() => {
    if (!isPersonalityIdle) return

    const interval = setInterval(() => {
      const start = idleSinceRef.current ?? Date.now()
      setRawIdleDurationMs(Date.now() - start)
    }, 4000)

    return () => clearInterval(interval)
  }, [isPersonalityIdle])

  // Show eyes if:
  // 1. Idle threshold reached
  // 2. OR Favorite Artist is playing (celebration mode!)
  // 3. OR Timer is active (Kuma thinking/concentrating!)
  // 4. OR Fresh file detected (Kuma curious side-glance!)
  // 5. OR Device connected (Kuma surprised eyes!)
  // 6. OR Process running (Kuma focus mode!)
  // 7. OR user is hovering over the droplet/capsule
  const showEyes =
    (isEligible && isPersonalityIdle) ||
    (isEligible && isFavArtist) ||
    (isEligible && isTimerRunning) ||
    (isEligible && freshFileDetected) ||
    (isEligible && deviceConnected) ||
    (isEligible && isProcessRunning) ||
    (isEligible && isHovered)

  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="absolute inset-0 px-3 flex items-center justify-center text-white overflow-hidden whitespace-nowrap"
    >
      <AnimatePresence initial={false}>
        {showEyes ? (
          <motion.div
            key="eyes"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3, position: 'absolute' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <MataKuma
              isVisible
              context={{
                isMusicPlaying,
                isTimerRunning,
                isTimerCompleted,
                freshFileDetected,
                deviceConnected,
                isProcessRunning,
                idleDurationMs,
                isOliviaRodrigo: isFavArtist,
                isHovered,
              }}
            />
          </motion.div>
        ) : (
          <motion.span
            key="clock"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3, position: 'absolute' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="text-xs font-semibold text-white/95 font-mono tracking-tight"
          >
            {timeStr}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
