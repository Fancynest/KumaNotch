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

// 6-segment cubic Bezier path for a perfect 32x32 circle (R=15.5, center=(16, 16))
const D_CIRCLE =
  'M 16.00 0.50 C 21.54 0.50, 26.65 3.45, 29.42 8.25 C 32.19 13.05, 32.19 18.95, 29.42 23.75 C 26.65 28.55, 21.54 31.50, 16.00 31.50 C 10.46 31.50, 5.35 28.55, 2.58 23.75 C -0.19 18.95, -0.19 13.05, 2.58 8.25 C 5.35 3.45, 10.46 0.50, 16.00 0.50 Z'

// 6-segment morph path: circle with an organic liquid neck stretching leftward into the Shell
const D_RIGHT_MERGED =
  'M 16.00 0.50 C 21.54 0.50, 26.65 3.45, 29.42 8.25 C 32.19 13.05, 32.19 18.95, 29.42 23.75 C 26.65 28.55, 21.54 31.50, 16.00 31.50 C 6.00 22.50, -6.00 22.50, -14.00 29.00 C -16.00 22.00, -16.00 10.00, -14.00 3.00 C -6.00 9.50, 6.00 9.50, 16.00 0.50 Z'

const liquidEase = [0.22, 1, 0.36, 1] as const

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
            scale: 0.88,
            opacity: 0,
          }}
          animate={{
            scale: 1,
            opacity: 1,
          }}
          exit={{
            scale: 0.88,
            opacity: 0,
            transition: { duration: 0.18, ease: 'easeOut' },
          }}
          transition={{
            duration: 0.38,
            ease: liquidEase,
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
          className="relative flex items-center justify-center cursor-pointer shrink-0"
          title={`${timerData?.label || timerTitle}: ${formatTimeDisplay(remainingSeconds)} • ${clickToOpenTitle}`}
        >
          {/* 1. True SVG Path Liquid Morphing Background (separates from & merges into Shell) */}
          <svg
            viewBox="-22 0 54 32"
            className="absolute top-0 -left-[22px] w-[54px] h-[32px] overflow-visible pointer-events-none z-0"
          >
            <motion.path
              initial={{ d: D_RIGHT_MERGED }}
              animate={{ d: D_CIRCLE }}
              exit={{ d: D_RIGHT_MERGED }}
              transition={{ duration: 0.38, ease: liquidEase }}
              fill="#000000"
            />
          </svg>

          {/* 2. Delicate circular outline border (reveals fluidly as the circle finishes forming) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, delay: 0.12 }}
            className="absolute inset-0 rounded-full border border-amber-500/50 pointer-events-none z-10"
          />

          {/* 3. Inner countdown ring and timer display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ duration: 0.32, delay: 0.08, ease: 'easeOut' }}
            className="w-full h-full flex items-center justify-center overflow-hidden rounded-full relative z-20"
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

          {/* 4. Active timer count badge */}
          {activeCount > 1 && (
            <span
              className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-amber-400 text-black font-extrabold text-[7.5px] flex items-center justify-center pointer-events-none z-30 shadow-sm leading-none"
              title={`${activeCount} timer berjalan`}
            >
              {activeCount}
            </span>
          )}

          {/* 5. Hover glowing aura */}
          {hoveredTarget === 'timer' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none z-40"
            />
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export const RightBubble = React.memo(RightBubbleComponent)
