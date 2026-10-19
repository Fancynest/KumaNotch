import React from 'react'
import { Bell, ChevronDown } from 'lucide-react'
import { globalTimerEngine, type TimerData } from '../../core/timer'
import { getT } from '../../core/i18n'
import { globalSettingsEngine } from '../../core/settings'
import { MataKuma } from './MataKuma'

interface AlertCardProps {
  timerData: TimerData | null
  onDismiss: () => void
}

export const AlertCard: React.FC<AlertCardProps> = ({ timerData, onDismiss }) => {
  const settings = globalSettingsEngine.getSettings()
  const t = getT(settings.language)

  const isPomodoroBreak = timerData?.isPomodoro && timerData.pomodoroPhase !== 'focus'

  return (
    <div
      className="absolute inset-0 p-4 flex flex-col justify-between text-white cursor-default overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center animate-bounce shrink-0">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400 block leading-tight">
                {timerData?.isPomodoro ? `${timerData.label} ${t.completedSuffix}` : t.timeUp}
              </span>
              <div className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30">
                <MataKuma emotion="happy" isVisible />
              </div>
            </div>
            <span className="text-[10px] text-white/50 block leading-tight mt-0.5">
              {timerData?.isPomodoro
                ? isPomodoroBreak
                  ? t.timeToRefocus
                  : t.timeForBreak
                : t.timerCompleted}
            </span>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-white/40 hover:text-white transition-colors p-1"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center font-mono font-bold text-2xl text-white tracking-tight py-1">
        00:00
      </div>

      {/* Alert Next Step Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onDismiss}
          className="px-3.5 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-sm bg-red-400" />
          <span>{t.stop}</span>
        </button>

        {timerData?.isPomodoro ? (
          isPomodoroBreak ? (
            <button
              onClick={() => {
                const nextCycle = ((timerData?.pomodoroCycle || 1) % 4) + 1
                globalTimerEngine.startPomodoro('focus', nextCycle)
              }}
              className="px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-transform active:scale-95"
            >
              {t.startFocusSession}
            </button>
          ) : (
            <button
              onClick={() => {
                const cycle = timerData?.pomodoroCycle || 1
                const nextPhase = cycle === 4 ? 'longBreak' : 'shortBreak'
                globalTimerEngine.startPomodoro(nextPhase, cycle)
              }}
              className="px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-transform active:scale-95"
            >
              {t.startBreak(timerData?.pomodoroCycle === 4 ? '15m' : '5m')}
            </button>
          )
        ) : (
          <button
            onClick={() => {
              const secs = timerData?.totalDurationSeconds || 60
              globalTimerEngine.startTimerSeconds(secs)
            }}
            className="px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-transform active:scale-95"
          >
            {t.repeatTimer}
          </button>
        )}
      </div>
    </div>
  )
}
