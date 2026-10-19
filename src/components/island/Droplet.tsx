import React from 'react'
import { motion } from 'framer-motion'
import type { TimerData } from '../../core/timer'
import type { MediaData } from '../../core/media'

interface DropletProps {
  timerData: TimerData | null
  mediaData: MediaData | null
}

export const Droplet: React.FC<DropletProps> = ({ timerData, mediaData }) => {
  const isTimerActive = timerData !== null && (timerData.status === 'running' || timerData.status === 'paused')
  const isTimerRunning = timerData?.status === 'running'
  const isPomodoroBreak = timerData?.isPomodoro && timerData.pomodoroPhase !== 'focus'
  const isMediaActive = mediaData !== null && mediaData.isActive

  return (
    <motion.div
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/40 blur-[0.2px]" />
      {isTimerActive ? (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isPomodoroBreak
              ? 'bg-emerald-400 shadow-[0_0_4px_#10b981]'
              : 'bg-[#ff9500] shadow-[0_0_4px_#ff9500]'
          } ${isTimerRunning ? 'animate-pulse' : 'opacity-80'}`}
        />
      ) : isMediaActive ? (
        <span
          className={`w-1.5 h-1.5 rounded-full bg-[#1ed760] shadow-[0_0_4px_#1ed760] ${
            mediaData?.playbackStatus === 'playing' ? 'animate-pulse' : 'opacity-80'
          }`}
        />
      ) : null}
    </motion.div>
  )
}
