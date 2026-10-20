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
  isDragging?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
  onPointerCancel?: (e: React.PointerEvent) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: React.ReactNode
}

export const Shell: React.FC<ShellProps> = ({
  shellConfig,
  currentView,
  growing = false,
  nudge = false,
  isDragging = false,
  onClick,
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
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
        y: nudge ? [shellConfig.y + 4, shellConfig.y] : shellConfig.y,
      }}
      transition={activeSpring}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        boxShadow: shellConfig.boxShadow,
      }}
      className={`bg-transparent select-none relative shrink-0 z-40 ${
        isDragging
          ? 'cursor-grabbing'
          : currentView === 'idle'
          ? 'cursor-pointer'
          : 'cursor-default'
      }`}
    >
      {/* Left Concave Shoulder Fillet (Outer arc connecting notch to top screen bezel) */}
      <div
        className="absolute top-0 pointer-events-none z-30"
        style={{
          left: -12,
          width: 12,
          height: 12,
          background:
            'radial-gradient(circle at 0 100%, transparent 11px, rgba(255, 255, 255, 0.12) 11.5px, #000 12.5px)',
        }}
      />
      {/* Right Concave Shoulder Fillet (Outer arc connecting notch to top screen bezel) */}
      <div
        className="absolute top-0 pointer-events-none z-30"
        style={{
          right: -12,
          width: 12,
          height: 12,
          background:
            'radial-gradient(circle at 100% 100%, transparent 11px, rgba(255, 255, 255, 0.12) 11.5px, #000 12.5px)',
        }}
      />

      {/* Main Body with bottom corner squircle and borderless top edge */}
      <div
        className={`w-full h-full bg-black border-x border-b border-t-0 overflow-hidden relative flex flex-col items-center justify-start ${
          currentView === 'alert'
            ? 'border-amber-500/50'
            : currentView === 'dropTarget'
            ? 'border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
            : 'border-white/10'
        }`}
        style={{
          borderBottomLeftRadius: shellConfig.borderRadius,
          borderBottomRightRadius: shellConfig.borderRadius,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
        onScroll={(e) => {
          e.currentTarget.scrollLeft = 0
          e.currentTarget.scrollTop = 0
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}
