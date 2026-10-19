import React from 'react'
import { motion, type Transition } from 'framer-motion'
import type { ShellConfig } from '../../core/windowSizing'
import type { IslandView } from '../../core/islandStore'

// Spring physics specifications:
// Melebar (growing): stiffness 380, damping 26, mass 1
// Menciut (shrinking): stiffness 200, damping 28, mass 1
const expandSpring: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 26,
  mass: 1,
  restDelta: 0.4,
  restSpeed: 0.4,
}

const shrinkSpring: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 28,
  mass: 1,
  restDelta: 0.4,
  restSpeed: 0.4,
}

interface ShellProps {
  shellConfig: ShellConfig
  currentView: IslandView
  growing?: boolean
  nudge?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: React.ReactNode
}

export const Shell: React.FC<ShellProps> = ({
  shellConfig,
  currentView,
  growing = false,
  nudge = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}) => {
  const activeSpring = growing ? expandSpring : shrinkSpring

  return (
    <motion.div
      animate={{
        width: shellConfig.width,
        height: shellConfig.height,
        borderRadius: shellConfig.borderRadius,
        y: nudge ? [shellConfig.y - 6, shellConfig.y] : shellConfig.y,
      }}
      transition={activeSpring}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0
        e.currentTarget.scrollTop = 0
      }}
      style={{
        boxShadow: shellConfig.boxShadow,
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
