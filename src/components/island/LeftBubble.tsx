import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MediaData } from '../../core/media'
import { AudioWaveform } from '../../features/media/AudioWaveform'
import { useIslandStore } from '../../core/islandStore'

interface LeftBubbleProps {
  isExpanded: boolean
  isDragOver: boolean
  isMediaActive: boolean
  mediaData: MediaData | null
  hoveredTarget: string | null
  musicTitle: string
  clickToOpenTitle: string
  onBubblePointerEnter: (type: 'timer' | 'music') => void
  onBubblePointerLeave: () => void
  onOpenMedia: () => void
}

// 6-segment cubic Bezier path for a perfect 32x32 circle (R=15.5, center=(16, 16))
const D_CIRCLE =
  'M 16.00 0.50 C 21.54 0.50, 26.65 3.45, 29.42 8.25 C 32.19 13.05, 32.19 18.95, 29.42 23.75 C 26.65 28.55, 21.54 31.50, 16.00 31.50 C 10.46 31.50, 5.35 28.55, 2.58 23.75 C -0.19 18.95, -0.19 13.05, 2.58 8.25 C 5.35 3.45, 10.46 0.50, 16.00 0.50 Z'

// 6-segment morph path: circle with an organic liquid neck stretching rightward into the Shell
const D_LEFT_MERGED =
  'M 16.00 0.50 C 26.00 9.50, 38.00 9.50, 46.00 3.00 C 48.00 10.00, 48.00 22.00, 46.00 29.00 C 38.00 22.50, 26.00 22.50, 16.00 31.50 C 10.46 31.50, 5.35 28.55, 2.58 23.75 C -0.19 18.95, -0.19 13.05, 2.58 8.25 C 5.35 3.45, 10.46 0.50, 16.00 0.50 Z'

const liquidSpring = {
  type: 'spring' as const,
  stiffness: 250,
  damping: 23,
  mass: 0.85,
}

const LeftBubbleComponent: React.FC<LeftBubbleProps> = ({
  isExpanded,
  isDragOver,
  isMediaActive,
  mediaData,
  hoveredTarget,
  musicTitle,
  clickToOpenTitle,
  onBubblePointerEnter,
  onBubblePointerLeave,
  onOpenMedia,
}) => {
  const isTransitioning = useIslandStore((state) => state.isTransitioning)

  return (
    <AnimatePresence>
      {!isExpanded && !isDragOver && isMediaActive ? (
        <motion.div
          key="bubble-music"
          initial={{
            x: 24,
            scaleX: 1.08,
            scaleY: 0.94,
            opacity: 0,
          }}
          animate={{
            x: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
          }}
          exit={{
            x: 24,
            scaleX: 1.06,
            scaleY: 0.95,
            opacity: 0,
            transition: { duration: 0.28, ease: [0.32, 0, 0.67, 0] },
          }}
          transition={liquidSpring}
          whileHover={{ scale: 1.14 }}
          whileTap={{ scale: 0.94 }}
          onPointerEnter={() => onBubblePointerEnter('music')}
          onPointerLeave={onBubblePointerLeave}
          onClick={(e) => {
            e.stopPropagation()
            onBubblePointerLeave()
            onOpenMedia()
          }}
          style={{
            width: 32,
            height: 32,
            transformOrigin: 'center center',
          }}
          className="relative flex items-center justify-center cursor-pointer shrink-0"
          title={`${mediaData?.title || musicTitle} • ${clickToOpenTitle}`}
        >
          {/* 1. True SVG Path Liquid Morphing Background (separates from & merges into Shell) */}
          <svg
            viewBox="0 0 54 32"
            className="absolute top-0 left-0 w-[54px] h-[32px] overflow-visible pointer-events-none z-0"
          >
            <motion.path
              initial={{ d: D_LEFT_MERGED }}
              animate={{ d: D_CIRCLE }}
              exit={{ d: D_LEFT_MERGED }}
              transition={liquidSpring}
              fill="#000000"
            />
          </svg>

          {/* 2. Delicate circular outline border (reveals fluidly as the circle finishes forming) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, delay: 0.12 }}
            className="absolute inset-0 rounded-full border border-[#1ed760]/50 pointer-events-none z-10"
          />

          {/* 3. Inner media artwork / waveform content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ duration: 0.32, delay: 0.08, ease: 'easeOut' }}
            className="w-full h-full flex items-center justify-center overflow-hidden rounded-full relative z-20"
          >
            {mediaData?.thumbnailBase64 ? (
              <img
                src={mediaData.thumbnailBase64}
                alt={mediaData.title}
                className="w-full h-full object-cover rounded-full pointer-events-none"
              />
            ) : (
              <AudioWaveform
                isPlaying={mediaData?.playbackStatus === 'playing'}
                barCount={3}
                size="sm"
                isTransitioning={isTransitioning}
              />
            )}
          </motion.div>

          {/* 4. Hover glowing aura */}
          {hoveredTarget === 'music' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-[#1ed760] pointer-events-none z-30"
            />
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export const LeftBubble = React.memo(LeftBubbleComponent)
