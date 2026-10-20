import React, { useState } from 'react'
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
  Plus,
} from 'lucide-react'
import {
  globalTimerEngine,
  formatTimeDisplay,
  calculateRemainingSeconds,
  MAX_CONCURRENT_TIMERS,
  type TimerData,
} from '../../core/timer'
import type { MediaData } from '../../core/media'
import { getT } from '../../core/i18n'
import { globalSettingsEngine } from '../../core/settings'

interface TimerCardProps {
  timerData: TimerData
  allTimers?: TimerData[]
  remainingSeconds: number
  mediaData: MediaData | null
  onClose: () => void
  onOpenMusic: () => void
  onOpenFileShelf: () => void
}

export const TimerCard: React.FC<TimerCardProps> = ({
  timerData,
  allTimers = [],
  remainingSeconds,
  mediaData,
  onClose,
  onOpenMusic,
  onOpenFileShelf,
}) => {
  const settings = globalSettingsEngine.getSettings()
  const t = getT(settings.language)

  const activeTimers = (allTimers.length > 0 ? allTimers : [timerData]).filter(
    (item) => item.status === 'running' || item.status === 'paused' || item.status === 'completed'
  )

  const [selectedId, setSelectedId] = useState<string>(timerData.id)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const activeTimer =
    activeTimers.find((item) => item.id === selectedId) || activeTimers[0] || timerData
  const activeRemaining =
    activeTimer.id === timerData.id ? remainingSeconds : calculateRemainingSeconds(activeTimer)

  const isTimerRunning = activeTimer.status === 'running'
  const isPomodoroBreak = activeTimer.isPomodoro && activeTimer.pomodoroPhase !== 'focus'
  const isMediaActive = mediaData !== null && mediaData.isActive

  const timerProgress =
    activeTimer.totalDurationSeconds > 0
      ? Math.min(1, Math.max(0, activeRemaining / activeTimer.totalDurationSeconds))
      : 0

  return (
    <div
      className="absolute inset-0 p-4 flex flex-col justify-between text-white cursor-default overflow-hidden select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              isPomodoroBreak
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {isPomodoroBreak ? (
              <Coffee className="w-3.5 h-3.5" />
            ) : activeTimer.isPomodoro ? (
              <Brain className="w-3.5 h-3.5" />
            ) : (
              <TimerIcon className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <span className="text-xs font-semibold text-white/90 block leading-tight truncate max-w-[120px]">
              {activeTimer.label}
            </span>
            {activeTimer.isPomodoro && (
              <span className="text-[10px] text-white/40 block leading-tight">
                {t.round(activeTimer.pomodoroCycle || 1, 4)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMediaActive && (
            <button
              onClick={onOpenMusic}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1ed760]/20 hover:bg-[#1ed760]/30 text-[#1ed760] text-[10px] font-medium transition-all active:scale-95 border border-[#1ed760]/30"
              title={t.openMusic}
            >
              <Music2 className="w-3 h-3" />
              <span>{t.music}</span>
            </button>
          )}

          <button
            onClick={onOpenFileShelf}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-medium transition-all active:scale-95"
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

      {/* Multi-Timer Tabs (when multiple timers or space available) */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar shrink-0">
        {activeTimers.map((item) => {
          const isSelected = item.id === activeTimer.id
          const rem = item.id === timerData.id ? remainingSeconds : calculateRemainingSeconds(item)
          const isBreak = item.isPomodoro && item.pomodoroPhase !== 'focus'
          return (
            <div
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-all shrink-0 ${
                isSelected
                  ? isBreak
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'bg-white/10 text-white/60 hover:text-white/90 hover:bg-white/15 border border-white/5'
              }`}
            >
              <span>{item.isPomodoro ? '🎯' : '⏱️'}</span>
              <span className="truncate max-w-[65px]">{item.label}</span>
              <span className="font-mono text-[9px] opacity-80">{formatTimeDisplay(rem)}</span>
              {activeTimers.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    globalTimerEngine.reset(item.id)
                    if (activeTimers.length <= 1) onClose()
                  }}
                  className="opacity-40 hover:opacity-100 hover:text-red-300 ml-0.5 text-[9px] leading-none"
                  title="Hapus timer ini"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {/* Add Timer Button if fewer than 3 timers */}
        {activeTimers.length < MAX_CONCURRENT_TIMERS && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-[10px] font-medium border border-dashed border-white/20 transition-all active:scale-95"
              title="Tambah timer baru (maks 3)"
            >
              <Plus className="w-3 h-3" />
              <span>+ Timer</span>
            </button>

            {showAddMenu && (
              <div className="absolute top-full left-0 mt-1 flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-white/15 z-50 shadow-lg">
                <button
                  onClick={() => {
                    const newId = globalTimerEngine.startTimer(5)
                    setSelectedId(newId)
                    setShowAddMenu(false)
                  }}
                  className="px-2 py-0.5 rounded text-[9px] bg-white/10 hover:bg-white/20 text-white"
                >
                  5m
                </button>
                <button
                  onClick={() => {
                    const newId = globalTimerEngine.startTimer(15)
                    setSelectedId(newId)
                    setShowAddMenu(false)
                  }}
                  className="px-2 py-0.5 rounded text-[9px] bg-white/10 hover:bg-white/20 text-white"
                >
                  15m
                </button>
                {!activeTimers.some((t) => t.isPomodoro) && (
                  <button
                    onClick={() => {
                      const newId = globalTimerEngine.startPomodoro('focus', 1)
                      setSelectedId(newId)
                      setShowAddMenu(false)
                    }}
                    className="px-2 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  >
                    Fokus
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Massive Time Countdown */}
      <div className="flex flex-col items-center justify-center py-1">
        <div className="text-4xl font-semibold tracking-tight font-mono text-white">
          {formatTimeDisplay(activeRemaining)}
        </div>
        {/* Horizontal Progress Track */}
        <div className="w-52 h-1 bg-white/10 rounded-full mt-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPomodoroBreak ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            style={{ width: `${timerProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Action Controls for Selected Active Timer */}
      <div className="flex items-center justify-center gap-3 shrink-0">
        <button
          onClick={() => {
            globalTimerEngine.reset(activeTimer.id)
            if (activeTimers.length <= 1) {
              onClose()
            }
          }}
          className="px-3.5 h-8 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center gap-1.5 transition-transform active:scale-90 text-xs font-medium"
          title="Reset timer aktif ini"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.reset}</span>
        </button>

        <button
          onClick={() => {
            if (isTimerRunning) {
              globalTimerEngine.pause(activeTimer.id)
            } else {
              globalTimerEngine.resume(activeTimer.id)
            }
          }}
          className={`px-5 h-8 rounded-full font-semibold text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-md ${
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
          onClick={() => globalTimerEngine.addOneMinute(activeTimer.id)}
          className="px-3.5 h-8 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center transition-transform active:scale-90 font-mono text-xs font-medium"
          title="Tambah 1 menit"
        >
          +1m
        </button>
      </div>
    </div>
  )
}
