import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  ChevronRight,
  Music2,
  Folder,
} from 'lucide-react'
import {
  globalMediaEngine,
  formatMediaDuration,
  type MediaData,
} from '../../core/media'
import { AudioWaveform } from './AudioWaveform'
import { getT } from '../../core/i18n'

interface ExpandedMusicProps {
  onClose?: () => void
  onBackToHome?: () => void
  onOpenShelf?: () => void
  onOpenTimer?: () => void
  isTimerActive?: boolean
}

export function ExpandedMusic({
  onClose,
  onBackToHome,
  onOpenShelf,
  onOpenTimer,
  isTimerActive = false,
}: ExpandedMusicProps) {
  const t = getT()
  const [media, setMedia] = useState<MediaData | null>(() => globalMediaEngine.getData())
  const [currentPosMs, setCurrentPosMs] = useState<number>(() =>
    globalMediaEngine.getInterpolatedPositionMs(),
  )
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPosMs, setSeekPosMs] = useState<number>(0)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Subscribe to media engine updates
  useEffect(() => {
    return globalMediaEngine.subscribe((data) => {
      setMedia(data)
    })
  }, [])

  // Smooth interpolated position update loop (every 250ms when playing)
  useEffect(() => {
    if (media?.playbackStatus !== 'playing') {
      setCurrentPosMs(media?.positionMs ?? 0)
      return
    }

    const interval = setInterval(() => {
      if (!isSeeking) {
        setCurrentPosMs(globalMediaEngine.getInterpolatedPositionMs())
      }
    }, 250)

    return () => clearInterval(interval)
  }, [media?.playbackStatus, media?.lastUpdated, media?.positionMs, isSeeking])

  const isPlaying = media?.playbackStatus === 'playing'
  const durationMs = media?.durationMs ?? 0
  const effectivePosMs = isSeeking ? seekPosMs : currentPosMs
  const progressRatio = durationMs > 0 ? Math.min(1, Math.max(0, effectivePosMs / durationMs)) : 0

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || durationMs <= 0) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, clickX / rect.width))
    const targetMs = Math.round(ratio * durationMs)
    setCurrentPosMs(targetMs)
    globalMediaEngine.seek(targetMs)
  }

  const handleSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!progressBarRef.current || durationMs <= 0) return
    setIsSeeking(true)

    const updateSeek = (clientX: number) => {
      if (!progressBarRef.current) return
      const rect = progressBarRef.current.getBoundingClientRect()
      const clickX = clientX - rect.left
      const ratio = Math.max(0, Math.min(1, clickX / rect.width))
      setSeekPosMs(Math.round(ratio * durationMs))
    }

    updateSeek(e.clientX)

    const handlePointerMove = (ev: PointerEvent) => {
      updateSeek(ev.clientX)
    }

    const handlePointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      setIsSeeking(false)
      if (progressBarRef.current) {
        const rect = progressBarRef.current.getBoundingClientRect()
        const clickX = ev.clientX - rect.left
        const ratio = Math.max(0, Math.min(1, clickX / rect.width))
        const targetMs = Math.round(ratio * durationMs)
        setCurrentPosMs(targetMs)
        globalMediaEngine.seek(targetMs)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const sourceName = media?.appId
    ? media.appId.toLowerCase().includes('spotify')
      ? 'Spotify'
      : media.appId.toLowerCase().includes('chrome')
      ? 'Chrome'
      : media.appId.toLowerCase().includes('edge')
      ? 'Edge'
      : media.appId.split('.').pop() || 'Media Player'
    : 'Media Player'

  return (
    <div className="flex flex-col justify-between w-full h-full text-white cursor-default overflow-hidden select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between shrink-0 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
            <Music2 className="w-3 h-3 text-[#1ed760]" />
          </div>
          <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
            {sourceName}
          </span>
          {isTimerActive && onOpenTimer && (
            <button
              onClick={onOpenTimer}
              className="ml-1 text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
            >
              {t.openTimer}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-medium transition-all active:scale-95 mr-0.5"
              title="Ke Halaman Jam"
            >
              <span>Jam</span>
              <ChevronRight className="w-3 h-3 text-white/50" />
            </button>
          )}

          {onOpenShelf && (
            <button
              onClick={onOpenShelf}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-medium transition-all active:scale-95"
              title={t.fileShelf}
            >
              <Folder className="w-3 h-3 text-amber-400" />
              <span>Shelf</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
              title="Tutup (Kecilkan)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!media || !media.isActive ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2 text-center select-none">
          <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Music2 className="w-5 h-5 text-white/30" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white/80">Tidak Ada Musik</p>
            <p className="text-[10px] text-white/40 mt-0.5 max-w-[200px] leading-tight">
              Buka Spotify, browser, atau media player untuk memutar musik
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Main Track Info & Art */}
          <div className="flex items-center gap-3 px-1 py-1 shrink-0">
            {/* Album Artwork */}
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg shrink-0 flex items-center justify-center">
              {media?.thumbnailBase64 ? (
                <img
                  src={media.thumbnailBase64}
                  alt={media.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <Music2 className="w-5 h-5 text-white/30" />
              )}
            </div>

            {/* Title, Artist, & Live Equalizer Waveform */}
            <div className="flex-1 min-w-0 pr-1 flex items-center justify-between">
              <div className="min-w-0 mr-2">
                <h3 className="text-xs font-bold text-white tracking-tight truncate leading-tight">
                  {media?.title || 'No Track'}
                </h3>
                <p className="text-[11px] text-white/60 truncate font-medium mt-0.5 leading-tight">
                  {media?.artist || 'Unknown Artist'}
                </p>
                {media?.album && (
                  <p className="text-[9px] text-white/35 truncate mt-0.5 leading-tight">
                    {media.album}
                  </p>
                )}
              </div>

              <div className="shrink-0 pl-1">
                <AudioWaveform isPlaying={isPlaying} barCount={4} size="sm" />
              </div>
            </div>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="flex flex-col gap-0.5 px-1 shrink-0">
            <div
              ref={progressBarRef}
              onClick={handleProgressBarClick}
              onPointerDown={handleSeekPointerDown}
              className="relative w-full h-2 bg-white/10 hover:bg-white/15 rounded-full cursor-pointer flex items-center group transition-colors"
            >
              {/* Active Fill Track */}
              <div
                className="h-1 bg-white group-hover:bg-[#1ed760] rounded-full transition-all duration-150 relative"
                style={{ width: `${progressRatio * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] text-white/40 font-mono tracking-tight px-0.5">
              <span>{formatMediaDuration(effectivePosMs)}</span>
              <span>{durationMs > 0 ? formatMediaDuration(durationMs) : '--:--'}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-5 pb-1 shrink-0">
            <button
              onClick={() => globalMediaEngine.previous()}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-transform active:scale-90"
              title="Previous (Ganti Lagu)"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={() => globalMediaEngine.togglePlayPause()}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
              title={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => globalMediaEngine.next()}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-transform active:scale-90"
              title="Next (Ganti Lagu)"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
