import React from 'react'
import {
  Coffee,
  Brain,
  Timer as TimerIcon,
  Music2,
  Folder,
  ChevronDown,
  RotateCcw,
  Pause,
  Play,
} from 'lucide-react'
import { globalTimerEngine, formatTimeDisplay, type TimerData } from '../../core/timer'
import type { MediaData } from '../../core/media'
import { getT } from '../../core/i18n'
import { globalSettingsEngine } from '../../core/settings'

interface TimerCardProps {
  timerData: TimerData
  remainingSeconds: number
  mediaData: MediaData | null
  onClose: () => void
  onOpenMusic: () => void
  onOpenFileShelf: () => void
}

export const TimerCard: React.FC<TimerCardProps> = ({
  timerData,
  remainingSeconds,
  mediaData,
  onClose,
  onOpenMusic,
  onOpenFileShelf,
}) => {
  const settings = globalSettingsEngine.getSettings()
  const t = getT(settings.language)

  const isTimerRunning = timerData.status === 'running'
  const isPomodoroBreak = timerData.isPomodoro && timerData.pomodoroPhase !== 'focus'
  const isMediaActive = mediaData !== null && mediaData.isActive

  const timerProgress =
    timerData.totalDurationSeconds > 0
      ? Math.min(1, Math.max(0, remainingSeconds / timerData.totalDurationSeconds))
      : 0

  return (
    <div
      className="absolute inset-0 p-5 flex flex-col gap-3 text-white cursor-default overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isPomodoroBreak ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {isPomodoroBreak ? (
              <Coffee className="w-3.5 h-3.5" />
            ) : timerData.isPomodoro ? (
              <Brain className="w-3.5 h-3.5" />
            ) : (
              <TimerIcon className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <span className="text-xs font-semibold text-white/80 block leading-tight">
              {timerData.label}
            </span>
            {timerData.isPomodoro && (
              <span className="text-[10px] text-white/40 block leading-tight">
                {t.round(timerData.pomodoroCycle || 1, 4)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMediaActive && (
            <button
              onClick={onOpenMusic}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1ed760]/20 hover:bg-[#1ed760]/30 text-[#1ed760] text-[10px] font-medium transition-all active:scale-95 border border-[#1ed760]/30"
              title={t.openMusic}
            >
              <Music2 className="w-3 h-3" />
              <span>{t.music}</span>
            </button>
          )}

          <button
            onClick={onOpenFileShelf}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-medium transition-all active:scale-95"
            title={t.fileShelf}
          >
            <Folder className="w-3 h-3 text-amber-400" />
            <span>{t.fileShelf}</span>
          </button>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1"
            title={t.collapse}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Massive time countdown */}
      <div className="flex flex-col items-center justify-center py-0.5">
        <div className="text-4xl font-semibold tracking-tight font-mono text-white">
          {formatTimeDisplay(remainingSeconds)}
        </div>
        {/* Horizontal progress track */}
        <div className="w-48 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPomodoroBreak ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            style={{ width: `${timerProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => {
            globalTimerEngine.reset()
            onClose()
          }}
          className="px-3 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center gap-1.5 transition-transform active:scale-90 text-xs font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.reset}</span>
        </button>
        <button
          onClick={() => {
            if (isTimerRunning) {
              globalTimerEngine.pause()
            } else {
              globalTimerEngine.resume()
            }
          }}
          className={`px-5 h-9 rounded-full font-semibold text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-md ${
            isPomodoroBreak
              ? 'bg-emerald-400 text-black shadow-emerald-400/20'
              : 'bg-[#ff9500] text-black shadow-[#ff9500]/20'
          }`}
        >
          {isTimerRunning ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isTimerRunning ? t.pause : t.resume}</span>
        </button>
        <button
          onClick={() => globalTimerEngine.addOneMinute()}
          className="px-3 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center transition-transform active:scale-90 font-mono text-xs font-medium"
        >
          +1m
        </button>
      </div>
    </div>
  )
}
