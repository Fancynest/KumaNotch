import React from 'react'
import { motion } from 'framer-motion'
import { Music, Clock, Sparkles } from 'lucide-react'
import type { TimerData } from '../../core/timer'
import type { MediaData } from '../../core/media'
import type { FreshFileInfo } from '../../core/freshFile'
import { isFavoriteArtistMedia } from '../../core/oliviaRodrigo'

interface DropletProps {
  timerData: TimerData | null
  mediaData: MediaData | null
  freshFile?: FreshFileInfo | null
}

export const Droplet: React.FC<DropletProps> = ({ timerData, mediaData, freshFile }) => {
  const isTimerActive = timerData !== null && (timerData.status === 'running' || timerData.status === 'paused')
  const isTimerRunning = timerData?.status === 'running'
  const isPomodoroBreak = timerData?.isPomodoro && timerData.pomodoroPhase !== 'focus'
  const isMediaActive = mediaData !== null && mediaData.isActive
  const isFreshActive = freshFile !== null && freshFile !== undefined
  const isOlivia = isFavoriteArtistMedia(mediaData)

  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="absolute inset-0 flex items-center justify-center px-2 text-white select-none overflow-hidden cursor-pointer"
      title="Klik untuk membuka KumaNotch"
    >
      {/* Glossy top glass highlight */}
      <div className="absolute top-0 inset-x-2 h-[1px] bg-white/20 rounded-full" />

      {isMediaActive ? (
        isOlivia ? (
          <div className="flex items-center gap-1.5 text-purple-400" title="💜 Olivia Rodrigo">
            <span className="text-[9px] leading-none animate-pulse">💜</span>
            {/* Animated 3-bar equalizer in signature lilac */}
            <div className="flex items-end gap-[1.5px] h-2">
              <span className="w-[2px] bg-purple-400 rounded-full animate-[bounce_0.8s_infinite_ease-in-out] h-full" />
              <span className="w-[2px] bg-purple-400 rounded-full animate-[bounce_0.6s_infinite_ease-in-out_0.2s] h-3/4" />
              <span className="w-[2px] bg-purple-400 rounded-full animate-[bounce_0.9s_infinite_ease-in-out_0.4s] h-1/2" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#1ed760]">
            <Music className="w-2.5 h-2.5 animate-pulse" />
            {/* Animated 3-bar equalizer */}
            <div className="flex items-end gap-[1.5px] h-2">
              <span className="w-[2px] bg-[#1ed760] rounded-full animate-[bounce_0.8s_infinite_ease-in-out] h-full" />
              <span className="w-[2px] bg-[#1ed760] rounded-full animate-[bounce_0.6s_infinite_ease-in-out_0.2s] h-3/4" />
              <span className="w-[2px] bg-[#1ed760] rounded-full animate-[bounce_0.9s_infinite_ease-in-out_0.4s] h-1/2" />
            </div>
          </div>
        )
      ) : isTimerActive ? (
        <div className="flex items-center gap-1">
          <Clock
            className={`w-2.5 h-2.5 ${
              isPomodoroBreak ? 'text-emerald-400' : 'text-amber-400'
            } ${isTimerRunning ? 'animate-pulse' : 'opacity-80'}`}
          />
          <span
            className={`w-1 h-1 rounded-full ${
              isPomodoroBreak ? 'bg-emerald-400' : 'bg-amber-400'
            } ${isTimerRunning ? 'animate-ping' : ''}`}
          />
        </div>
      ) : isFreshActive ? (
        <div className="flex items-center gap-1 text-sky-400">
          <Sparkles className="w-2.5 h-2.5 animate-pulse" />
          <span className="w-1 h-1 rounded-full bg-sky-400 shadow-[0_0_4px_#38bdf8]" />
        </div>
      ) : (
        /* Cute sleepy Kuma eyes when idle in droplet */
        <div className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
          {/* Left sleepy curved eye */}
          <svg width="7" height="4" viewBox="0 0 7 4" fill="none" className="text-white/80">
            <path d="M0.5 1C1.5 2.8 5.5 2.8 6.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {/* Tiny nose */}
          <div className="w-1 h-0.5 rounded-full bg-white/40" />
          {/* Right sleepy curved eye */}
          <svg width="7" height="4" viewBox="0 0 7 4" fill="none" className="text-white/80">
            <path d="M0.5 1C1.5 2.8 5.5 2.8 6.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </motion.div>
  )
}
