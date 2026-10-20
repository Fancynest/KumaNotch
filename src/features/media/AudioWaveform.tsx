import { motion } from 'framer-motion'

interface AudioWaveformProps {
  isPlaying: boolean
  barCount?: number
  colorClass?: string
  size?: 'sm' | 'md' | 'lg'
  isTransitioning?: boolean
}

export function AudioWaveform({
  isPlaying,
  barCount = 4,
  colorClass = 'bg-[#1ed760]', // Spotify vibrant green by default
  size = 'sm',
  isTransitioning = false,
}: AudioWaveformProps) {
  const height = size === 'sm' ? 12 : size === 'md' ? 16 : 22
  const barWidth = size === 'sm' ? 'w-[2px]' : size === 'md' ? 'w-[3px]' : 'w-[3.5px]'
  const gap = size === 'sm' ? 'gap-[2px]' : 'gap-[2.5px]'

  const barConfigs = [
    { scale: [0.25, 0.95, 0.4, 0.8, 0.25], duration: 0.85, delay: 0 },
    { scale: [0.35, 0.6, 1.0, 0.45, 0.35], duration: 1.1, delay: 0.15 },
    { scale: [0.2, 0.85, 0.3, 0.95, 0.2], duration: 0.75, delay: 0.25 },
    { scale: [0.4, 1.0, 0.5, 0.7, 0.4], duration: 0.95, delay: 0.05 },
    { scale: [0.3, 0.7, 0.35, 0.9, 0.3], duration: 1.05, delay: 0.2 },
  ]

  // Pause waveform animation during island spring transitions to conserve frame budget
  const shouldAnimate = isPlaying && !isTransitioning

  return (
    <div className={`flex items-center justify-center ${gap}`} style={{ height }}>
      {Array.from({ length: barCount }).map((_, i) => {
        const cfg = barConfigs[i % barConfigs.length]

        return (
          <motion.span
            key={i}
            className={`${barWidth} h-full rounded-full ${colorClass} origin-center block`}
            animate={
              shouldAnimate
                ? { scaleY: cfg.scale }
                : { scaleY: 0.25 }
            }
            transition={
              shouldAnimate
                ? {
                    duration: cfg.duration,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: cfg.delay,
                  }
                : { duration: 0.15 }
            }
          />
        )
      })}
    </div>
  )
}
