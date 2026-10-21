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

// 6-segment cubic Bezier topologies matching 1:1 for continuous liquid morphing
// 1. D_CIRCLE: exact standalone 32x32 circle (R=15.5, center=(16, 16))
const D_CIRCLE =
  'M 16.00 0.50 C 21.54 0.50, 26.65 3.45, 29.42 8.25 C 32.19 13.05, 32.19 18.95, 29.42 23.75 C 26.65 28.55, 21.54 31.50, 16.00 31.50 C 10.46 31.50, 5.35 28.55, 2.58 23.75 C -0.19 18.95, -0.19 13.05, 2.58 8.25 C 5.35 3.45, 10.46 0.50, 16.00 0.50 Z'

// 2. D_LEFT_PINCHED: narrow neck (waist height ~4px) just before detachment
const D_LEFT_PINCHED =
  'M 16.00 0.50 C 20.00 4.00, 26.00 14.00, 38.00 10.00 C 40.00 14.00, 40.00 18.00, 38.00 22.00 C 26.00 18.00, 20.00 28.00, 16.00 31.50 C 10.46 31.50, 5.35 28.55, 2.58 23.75 C -0.19 18.95, -0.19 13.05, 2.58 8.25 C 5.35 3.45, 10.46 0.50, 16.00 0.50 Z'

// 3. D_LEFT_STRETCHED: organic hourglass neck with pronounced concave inward curves (waist height ~12px)
const D_LEFT_STRETCHED =
  'M 16.00 0.50 C 22.00 3.00, 28.00 10.00, 42.00 5.00 C 44.00 12.00, 44.00 20.00, 42.00 27.00 C 28.00 22.00, 22.00 29.00, 16.00 31.50 C 10.46 31.50, 5.35 28.55, 2.58 23.75 C -0.19 18.95, -0.19 13.05, 2.58 8.25 C 5.35 3.45, 10.46 0.50, 16.00 0.50 Z'

// 4. D_LEFT_MERGED: wide, seamless liquid connection flowing directly into the Shell body (height ~26px)
const D_LEFT_MERGED =
  'M 16.00 0.50 C 26.00 1.00, 36.00 2.00, 46.00 3.00 C 48.00 11.00, 48.00 21.00, 46.00 29.00 C 36.00 30.00, 26.00 31.00, 16.00 31.50 C 10.46 31.50, 5.35 28.55, 2.58 23.75 C -0.19 18.95, -0.19 13.05, 2.58 8.25 C 5.35 3.45, 10.46 0.50, 16.00 0.50 Z'

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
            viewBox="0 0 54 32"
            className="absolute top-0 left-0 w-[54px] h-[32px] overflow-visible pointer-events-none z-0"
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
