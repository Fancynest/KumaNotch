import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause } from 'lucide-react'
import type { TimerData } from '../../core/timer'
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
  timerData: TimerData | null
  allTimers?: TimerData[]
  remainingSeconds: number
  hoveredTarget: string | null
  timerTitle: string
  clickToOpenTitle: string
  onBubblePointerEnter: (type: 'timer' | 'music') => void
  onBubblePointerLeave: () => void
  onOpenTimer: () => void
}

const RightBubbleComponent: React.FC<RightBubbleProps> = ({
  isExpanded,
  isDragOver,
  isTimerActive,
  timerData,
  allTimers,
  remainingSeconds,
  hoveredTarget,
  timerTitle,
  clickToOpenTitle,
  onBubblePointerEnter,
  onBubblePointerLeave,
  onOpenTimer,
}) => {
  const activeCount = (allTimers || []).filter(
    (t) => t.status === 'running' || t.status === 'paused'
  ).length

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
            scale: 0.35,
            opacity: 0,
            clipPath: 'circle(0% at 50% 50%)',
          }}
          animate={{
            scale: 1,
            opacity: 1,
            clipPath: 'circle(100% at 50% 50%)',
          }}
          exit={{
            scale: 0.3,
            opacity: 0,
            clipPath: 'circle(0% at 50% 50%)',
            transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
          }}
          transition={{
            duration: 0.52,
            ease: [0.16, 1, 0.3, 1],
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
            transformOrigin: 'center center',
          }}
          className="relative rounded-full bg-black border border-amber-500/50 flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
          title={`${timerData?.label || timerTitle}: ${formatTimeDisplay(remainingSeconds)} • ${clickToOpenTitle}`}
        >
          {/* Gentle water-parting liquid ripple expanding outward from center on reveal */}
          <motion.div
            initial={{ scale: 0.15, opacity: 0.85 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 rounded-full border border-amber-400/60 pointer-events-none"
          />

          {/* Inner content revealed fluidly from center */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, delay: 0.05, ease: 'easeOut' }}
            className="w-full h-full flex items-center justify-center overflow-hidden rounded-full relative"
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
          </motion.div>

          {activeCount > 1 && (
            <span
              className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-amber-400 text-black font-extrabold text-[7.5px] flex items-center justify-center pointer-events-none z-20 shadow-sm leading-none"
              title={`${activeCount} timer berjalan`}
            >
              {activeCount}
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
      ) : null}
    </AnimatePresence>
  )
}

export const RightBubble = React.memo(RightBubbleComponent)
