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
          className="relative rounded-full bg-black border border-[#1ed760]/50 flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
          title={`${mediaData?.title || musicTitle} • ${clickToOpenTitle}`}
        >
          {/* Gentle water-parting liquid ripple expanding outward from center on reveal */}
          <motion.div
            initial={{ scale: 0.15, opacity: 0.85 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 rounded-full border border-[#1ed760]/60 pointer-events-none"
          />

          {/* Inner content revealed fluidly from center */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, delay: 0.05, ease: 'easeOut' }}
            className="w-full h-full flex items-center justify-center overflow-hidden rounded-full"
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

          {hoveredTarget === 'music' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-[#1ed760] pointer-events-none"
            />
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export const LeftBubble = React.memo(LeftBubbleComponent)
