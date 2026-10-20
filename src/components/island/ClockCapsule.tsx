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
  isMagnetSnapped?: boolean
  mediaData?: MediaData | null
  isTransitioning?: boolean
}

const ClockCapsuleComponent: React.FC<ClockCapsuleProps> = ({
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
  isMagnetSnapped,
  mediaData,
  isTransitioning,
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
      clearTimeout(timerId)
      setIsPersonalityIdle(false)
      timerId = setTimeout(() => {
        setIsPersonalityIdle(true)
        idleSinceRef.current = Date.now()
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

  // Show eyes strictly according to KUMANOTCH_SPEC.md Fase 8a:
  // "Isi poni: jam kecil redup secara default. Mata Kuma tampil di dalam poni setelah idle lama, musik, atau timer."
  const showEyes =
    (isEligible && isPersonalityIdle) ||
    (isEligible && isFavArtist) ||
    (isEligible && isMusicPlaying) ||
    (isEligible && isTimerRunning) ||
    (isEligible && isMagnetSnapped) ||
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
                isMagnetSnapped,
                idleDurationMs,
                isOliviaRodrigo: isFavArtist,
                isHovered,
                isTransitioning,
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

export const ClockCapsule = React.memo(ClockCapsuleComponent)
