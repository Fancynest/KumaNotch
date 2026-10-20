import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Pause } from 'lucide-react'
import type { TimerData } from '../../core/timer'
import type { FreshFileInfo } from '../../core/freshFile'
import { formatTimeDisplay } from '../../core/timer'

function formatCompactRemaining(secs: number): string {
  if (secs <= 0) return '0s'
  if (secs < 60) return `${secs}s`
  const m = Math.ceil(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(secs / 3600)
  return `${h}h`
}

interface RightBubbleProps {
  isExpanded: boolean
  isDragOver: boolean
  isTimerActive: boolean
  isFreshActive: boolean
  timerData: TimerData | null
  remainingSeconds: number
  freshFile: FreshFileInfo | null
  hoveredTarget: string | null
  timerTitle: string
  freshFileTitle: string
  clickToOpenTitle: string
  onBubblePointerEnter: (type: 'timer' | 'music' | 'freshFile') => void
  onBubblePointerLeave: () => void
  onOpenTimer: () => void
  onOpenFreshFile: () => void
}

const RightBubbleComponent: React.FC<RightBubbleProps> = ({
  isExpanded,
  isDragOver,
  isTimerActive,
  isFreshActive,
  timerData,
  remainingSeconds,
  freshFile,
  hoveredTarget,
  timerTitle,
  freshFileTitle,
  clickToOpenTitle,
  onBubblePointerEnter,
  onBubblePointerLeave,
  onOpenTimer,
  onOpenFreshFile,
}) => {
  const timerProgress =
    timerData && timerData.totalDurationSeconds > 0
      ? Math.min(1, Math.max(0, remainingSeconds / timerData.totalDurationSeconds))
      : 0
  const isPomodoroBreak = timerData?.isPomodoro && timerData.pomodoroPhase !== 'focus'

  return (
    <AnimatePresence>
      {!isExpanded && !isDragOver && isTimerActive ? (
        <motion.div
          key="bubble-timer"
          initial={{
            x: -38,
            scaleX: 1.55,
            scaleY: 0.6,
            scale: 0.35,
            opacity: 0,
          }}
          animate={{
            x: 0,
            scaleX: 1,
            scaleY: 1,
            scale: 1,
            opacity: 1,
          }}
          exit={{
            x: -38,
            scaleX: 1.4,
            scaleY: 0.6,
            scale: 0.2,
            opacity: 0,
            transition: { duration: 0.22, ease: 'easeIn' },
          }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 20,
            mass: 0.75,
          }}
          whileHover={{ scale: 1.14 }}
          whileTap={{ scale: 0.94 }}
          onPointerEnter={() => onBubblePointerEnter('timer')}
          onPointerLeave={onBubblePointerLeave}
          onClick={(e) => {
            e.stopPropagation()
            onBubblePointerLeave()
            onOpenTimer()
          }}
          style={{
            width: 32,
            height: 32,
            transformOrigin: 'left center',
          }}
          className="relative rounded-full bg-black border border-amber-500/40 shadow-[0_2px_12px_rgba(245,158,11,0.25)] flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
          title={`${timerData?.label || timerTitle}: ${formatTimeDisplay(remainingSeconds)} • ${clickToOpenTitle}`}
        >
          <svg className="w-6 h-6 -rotate-90 absolute" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="8.5"
              fill="none"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="2"
            />
            <circle
              cx="12"
              cy="12"
              r="8.5"
              fill="none"
              stroke={isPomodoroBreak ? '#10b981' : '#ff9500'}
              strokeWidth="2"
              strokeDasharray={53.4}
              strokeDashoffset={53.4 * (1 - timerProgress)}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>

          {timerData?.status === 'paused' ? (
            <Pause className="w-2.5 h-2.5 text-amber-400 fill-amber-400 relative z-10" />
          ) : (
            <span className="text-[9px] font-mono font-bold text-amber-300 tracking-tighter relative z-10 leading-none">
              {formatCompactRemaining(remainingSeconds)}
            </span>
          )}

          {hoveredTarget === 'timer' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none"
            />
          )}
        </motion.div>
      ) : !isExpanded && !isDragOver && isFreshActive ? (
        <motion.div
          key="bubble-fresh-right"
          initial={{
            x: -38,
            scaleX: 1.55,
            scaleY: 0.6,
            scale: 0.35,
            opacity: 0,
          }}
          animate={{
            x: 0,
            scaleX: 1,
            scaleY: 1,
            scale: 1,
            opacity: 1,
          }}
          exit={{
            x: -38,
            scaleX: 1.4,
            scaleY: 0.6,
            scale: 0.2,
            opacity: 0,
            transition: { duration: 0.22, ease: 'easeIn' },
          }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 20,
            mass: 0.75,
          }}
          whileHover={{ scale: 1.14 }}
          whileTap={{ scale: 0.94 }}
          onPointerEnter={() => onBubblePointerEnter('freshFile')}
          onPointerLeave={onBubblePointerLeave}
          onClick={(e) => {
            e.stopPropagation()
            onBubblePointerLeave()
            onOpenFreshFile()
          }}
          style={{
            width: 32,
            height: 32,
            transformOrigin: 'left center',
          }}
          className="relative rounded-full bg-black border border-sky-400/60 shadow-[0_2px_12px_rgba(56,189,248,0.35)] flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
          title={`${freshFile?.name || freshFileTitle} • ${clickToOpenTitle}`}
        >
          {freshFile?.thumbnail ? (
            <img
              src={freshFile.thumbnail}
              alt={freshFile.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
          )}

          {hoveredTarget === 'freshFile' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-sky-400 pointer-events-none"
            />
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export const RightBubble = React.memo(RightBubbleComponent)
