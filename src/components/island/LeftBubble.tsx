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

// Mathematically exact 5-segment cubic Bezier topologies (standard 4-quadrant circle + Shell bridge)
// R = 16.0000, center = (16.0000, 16.0000), k = 16 * 4/3 * (sqrt(2) - 1) = 8.836556

// 1. D_CIRCLE: mathematically exact 32x32 circle (error < 0.05%)
const D_CIRCLE =
  'M 16.0000 0.0000 C 24.8366 0.0000, 32.0000 7.1634, 32.0000 16.0000 C 32.0000 16.0000, 32.0000 16.0000, 32.0000 16.0000 C 32.0000 24.8366, 24.8366 32.0000, 16.0000 32.0000 C 7.1634 32.0000, 0.0000 24.8366, 0.0000 16.0000 C 0.0000 7.1634, 7.1634 0.0000, 16.0000 0.0000 Z'

// 2. D_LEFT_PINCHED: narrow neck (waist height ~4px) just before detachment
const D_LEFT_PINCHED =
  'M 16.0000 0.0000 C 20.0000 2.0000, 26.0000 14.0000, 38.0000 14.0000 C 38.0000 15.0000, 38.0000 17.0000, 38.0000 18.0000 C 26.0000 18.0000, 20.0000 30.0000, 16.0000 32.0000 C 7.1634 32.0000, 0.0000 24.8366, 0.0000 16.0000 C 0.0000 7.1634, 7.1634 0.0000, 16.0000 0.0000 Z'

// 3. D_LEFT_STRETCHED: organic hourglass neck with pronounced concave inward curves (waist height ~12px)
const D_LEFT_STRETCHED =
  'M 16.0000 0.0000 C 22.0000 2.0000, 28.0000 10.0000, 42.0000 10.0000 C 42.0000 14.0000, 42.0000 18.0000, 42.0000 22.0000 C 28.0000 22.0000, 22.0000 30.0000, 16.0000 32.0000 C 7.1634 32.0000, 0.0000 24.8366, 0.0000 16.0000 C 0.0000 7.1634, 7.1634 0.0000, 16.0000 0.0000 Z'

// 4. D_LEFT_MERGED: wide, seamless liquid connection flowing directly into the Shell body (height ~26px)
const D_LEFT_MERGED =
  'M 16.0000 0.0000 C 26.0000 1.0000, 36.0000 2.0000, 46.0000 3.0000 C 46.0000 11.0000, 46.0000 21.0000, 46.0000 29.0000 C 36.0000 30.0000, 26.0000 31.0000, 16.0000 32.0000 C 7.1634 32.0000, 0.0000 24.8366, 0.0000 16.0000 C 0.0000 7.1634, 7.1634 0.0000, 16.0000 0.0000 Z'

const liquidEase = [0.16, 1, 0.3, 1] as const

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
            x: 10,
            opacity: 1,
          }}
          animate={{
            x: 0,
            opacity: 1,
          }}
          exit={
            isExpanded
              ? {
                  opacity: 0,
                  scale: 0.9,
                  transition: { duration: 0.16, ease: 'easeOut' },
                }
              : {
                  x: 10,
                  opacity: 0,
                  transition: { duration: 0.36, ease: [0.32, 0, 0.67, 0] },
                }
          }
          transition={{
            duration: 0.44,
            ease: liquidEase,
          }}
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
          {/* 1. True SVG Continuous Silhouette with organic concave hourglass neck */}
          <svg
            viewBox="-2 -2 58 36"
            className="absolute -top-[2px] -left-[2px] w-[58px] h-[36px] overflow-visible pointer-events-none z-0"
          >
            <motion.path
              initial={{ d: D_LEFT_MERGED }}
              animate={{
                d: [D_LEFT_MERGED, D_LEFT_STRETCHED, D_LEFT_PINCHED, D_CIRCLE],
              }}
              exit={
                isExpanded
                  ? { d: D_CIRCLE }
                  : {
                      d: [D_CIRCLE, D_LEFT_PINCHED, D_LEFT_STRETCHED, D_LEFT_MERGED],
                    }
              }
              transition={{
                duration: 0.44,
                times: [0, 0.35, 0.70, 1],
                ease: 'easeInOut',
              }}
              fill="#000000"
            />
          </svg>

          {/* 2. Delicate circular outline border (reveals fluidly as the circle finishes forming) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.24, delay: 0.32, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full border border-[#1ed760]/50 pointer-events-none z-10"
          />

          {/* 3. Inner media artwork / waveform content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.1 } }}
            transition={{ duration: 0.28, delay: 0.32, ease: 'easeOut' }}
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
