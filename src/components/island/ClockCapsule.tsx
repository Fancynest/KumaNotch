import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { SystemMode } from '../../core/islandStore'

interface ClockCapsuleProps {
  timeStr: string
  personalityEnabled: boolean
  idleBeforeEyesSeconds: number
  systemMode: SystemMode
  isIdleView: boolean
}

export const ClockCapsule: React.FC<ClockCapsuleProps> = ({
  timeStr,
  personalityEnabled,
  idleBeforeEyesSeconds,
  systemMode,
  isIdleView,
}) => {
  const [isPersonalityIdle, setIsPersonalityIdle] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)

  const isEligible = isIdleView && personalityEnabled && systemMode !== 'hidden'

  // Trigger Mata Kuma eyes after inactivity delay when in idle mode
  useEffect(() => {
    if (!isEligible) return

    const idleDelayMs = (idleBeforeEyesSeconds || 6) * 1000
    let timerId = setTimeout(() => {
      setIsPersonalityIdle(true)
    }, idleDelayMs)

    const handleActivity = () => {
      setIsPersonalityIdle(false)
      clearTimeout(timerId)
      timerId = setTimeout(() => {
        setIsPersonalityIdle(true)
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

  // Randomized blink scheduler (3s - 6s) when idle eyes are shown
  useEffect(() => {
    if (!isEligible || !isPersonalityIdle) return

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null
    let resetTimeout: ReturnType<typeof setTimeout> | null = null
    let active = true

    const scheduleNextBlink = () => {
      const delay = Math.floor(Math.random() * 3000) + 3000
      blinkTimeout = setTimeout(() => {
        if (!active) return
        setIsBlinking(true)
        resetTimeout = setTimeout(() => {
          if (!active) return
          setIsBlinking(false)
          scheduleNextBlink()
        }, 140)
      }, delay)
    }

    scheduleNextBlink()

    return () => {
      active = false
      if (blinkTimeout) clearTimeout(blinkTimeout)
      if (resetTimeout) clearTimeout(resetTimeout)
    }
  }, [isEligible, isPersonalityIdle])

  const showEyes = isEligible && isPersonalityIdle
  const blinkingNow = showEyes && isBlinking

  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onMouseEnter={() => setIsPersonalityIdle(false)}
      className="absolute inset-0 px-3 flex items-center justify-center text-white overflow-hidden whitespace-nowrap"
    >
      {showEyes ? (
        <div className="flex items-center justify-center gap-2.5">
          {/* Left eye */}
          <motion.div
            animate={{ scaleY: blinkingNow ? 0.1 : 1 }}
            transition={{ duration: 0.1 }}
            className="w-1.5 h-1.5 rounded-full bg-white/95"
          />
          {/* Cute subtle bear nose */}
          <div className="w-1 h-0.5 rounded-full bg-white/30" />
          {/* Right eye */}
          <motion.div
            animate={{ scaleY: blinkingNow ? 0.1 : 1 }}
            transition={{ duration: 0.1 }}
            className="w-1.5 h-1.5 rounded-full bg-white/95"
          />
        </div>
      ) : (
        <span className="text-xs font-semibold text-white/95 font-mono tracking-tight">
          {timeStr}
        </span>
      )}
    </motion.div>
  )
}
