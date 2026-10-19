import React from 'react'
import { motion, type Transition } from 'framer-motion'
import type { ShellConfig } from '../../core/windowSizing'
import type { IslandView } from '../../core/islandStore'

const springTransition: Transition = {
  type: 'spring',
  stiffness: 340,
  damping: 30,
  mass: 0.85,
  restDelta: 0.4,
  restSpeed: 0.4,
}

interface ShellProps {
  shellConfig: ShellConfig
  currentView: IslandView
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: React.ReactNode
}

export const Shell: React.FC<ShellProps> = ({
  shellConfig,
  currentView,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}) => {
  return (
    <motion.div
      animate={{
        width: shellConfig.width,
        height: shellConfig.height,
        borderRadius: shellConfig.borderRadius,
        boxShadow: shellConfig.boxShadow,
        y: shellConfig.y,
      }}
      transition={springTransition}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0
        e.currentTarget.scrollTop = 0
      }}
      className={`bg-black border overflow-hidden cursor-pointer relative shrink-0 ${
        currentView === 'alert'
          ? 'border-amber-500/50'
          : currentView === 'dropTarget'
          ? 'border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
          : 'border-white/20'
      }`}
    >
      {children}
    </motion.div>
  )
}
