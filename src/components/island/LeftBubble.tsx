import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import type { MediaData } from '../../core/media'
import type { FreshFileInfo } from '../../core/freshFile'
import { AudioWaveform } from '../../features/media/AudioWaveform'
import { useIslandStore } from '../../core/islandStore'

interface LeftBubbleProps {
  isExpanded: boolean
  isDragOver: boolean
  isMediaActive: boolean
  isFreshActive: boolean
  isTimerActive: boolean
  mediaData: MediaData | null
  freshFile: FreshFileInfo | null
  hoveredTarget: string | null
  musicTitle: string
  freshFileTitle: string
  clickToOpenTitle: string
  onBubblePointerEnter: (type: 'timer' | 'music' | 'freshFile') => void
  onBubblePointerLeave: () => void
  onOpenMedia: () => void
  onOpenFreshFile: () => void
}

const LeftBubbleComponent: React.FC<LeftBubbleProps> = ({
  isExpanded,
  isDragOver,
  isMediaActive,
  isFreshActive,
  isTimerActive,
  mediaData,
  freshFile,
  hoveredTarget,
  musicTitle,
  freshFileTitle,
  clickToOpenTitle,
  onBubblePointerEnter,
  onBubblePointerLeave,
  onOpenMedia,
  onOpenFreshFile,
}) => {
  const isTransitioning = useIslandStore((state) => state.isTransitioning)

  return (
    <AnimatePresence>
      {!isExpanded && !isDragOver && isMediaActive ? (
        <motion.div
          key="bubble-music"
          initial={{
            x: 38,
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
            x: 38,
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
            transformOrigin: 'right center',
          }}
          className="relative rounded-full bg-black border border-[#1ed760]/40 shadow-[0_2px_12px_rgba(30,215,96,0.25)] flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
          title={`${mediaData?.title || musicTitle} • ${clickToOpenTitle}`}
        >
          {mediaData?.thumbnailBase64 ? (
            <img
              src={mediaData.thumbnailBase64}
              alt={mediaData.title}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <AudioWaveform
              isPlaying={mediaData?.playbackStatus === 'playing'}
              barCount={3}
              size="sm"
              isTransitioning={isTransitioning}
            />
          )}

          {hoveredTarget === 'music' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.25, opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-[#1ed760] pointer-events-none"
            />
          )}
        </motion.div>
      ) : !isExpanded && !isDragOver && isFreshActive && isTimerActive ? (
        <motion.div
          key="bubble-fresh-left"
          initial={{
            x: 38,
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
            x: 38,
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
            transformOrigin: 'right center',
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

export const LeftBubble = React.memo(LeftBubbleComponent)
