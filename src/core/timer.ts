import { globalActivityRegistry, ACTIVITY_PRIORITIES } from './activities'
import { startAlarmLoop, stopAlarmLoop } from './audio'
import { getT } from './i18n'
import { globalSettingsEngine } from './settings'
import { globalMediaEngine } from './media'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'
export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak'

export interface TimerData {
  id: string
  label: string
  totalDurationSeconds: number
  startedAt: number
  endsAt: number
  status: TimerStatus
  pausedRemainingSeconds?: number
  isPomodoro: boolean
  pomodoroPhase?: PomodoroPhase
  pomodoroCycle?: number // 1..4
}

export const MAX_CONCURRENT_TIMERS = 3
const STORAGE_KEY_MULTI = 'kumanotch_timers_state'
const STORAGE_KEY_LEGACY = 'kumanotch_timer_state'

export function calculateRemainingSeconds(data: TimerData | null): number {
  if (!data || data.status === 'idle') return 0
  if (data.status === 'paused' && data.pausedRemainingSeconds !== undefined) {
    return data.pausedRemainingSeconds
  }
  if (data.status === 'completed') return 0

  const diffMs = data.endsAt - Date.now()
  return Math.max(0, Math.ceil(diffMs / 1000))
}

export function loadPersistedTimers(): TimerData[] {
  try {
    const rawMulti = localStorage.getItem(STORAGE_KEY_MULTI)
    let list: TimerData[] = []
    if (rawMulti) {
      const parsed = JSON.parse(rawMulti)
      if (Array.isArray(parsed)) {
        list = parsed
      }
    } else {
      const rawLegacy = localStorage.getItem(STORAGE_KEY_LEGACY)
      if (rawLegacy) {
        const item = JSON.parse(rawLegacy)
        if (item && item.id) {
          list = [item]
        }
      }
    }

    const now = Date.now()
    return list
      .filter((t) => t && t.id)
      .slice(0, MAX_CONCURRENT_TIMERS)
      .map((t) => {
        if (t.status === 'running' && t.endsAt <= now) {
          return { ...t, status: 'completed' as TimerStatus }
        }
        return t
      })
  } catch {
    return []
  }
}

export function savePersistedTimers(timers: TimerData[]): void {
  try {
    const valid = timers.filter((t) => t.status !== 'idle').slice(0, MAX_CONCURRENT_TIMERS)
    if (valid.length === 0) {
      localStorage.removeItem(STORAGE_KEY_MULTI)
      localStorage.removeItem(STORAGE_KEY_LEGACY)
    } else {
      localStorage.setItem(STORAGE_KEY_MULTI, JSON.stringify(valid))
      // Legacy backward compatibility
      localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(valid[0]))
    }
  } catch (err) {
    console.debug('Failed to persist timers:', err)
  }
}

// Backward compat
export function loadPersistedTimer(): TimerData | null {
  const all = loadPersistedTimers()
  return all.length > 0 ? all[0] : null
}
export function savePersistedTimer(data: TimerData | null): void {
  if (!data) {
    savePersistedTimers([])
  } else {
    savePersistedTimers([data])
  }
}

export function formatTimeDisplay(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60

  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export type TimerListener = (
  primary: TimerData | null,
  remaining: number,
  allTimers: TimerData[]
) => void

export class TimerEngine {
  private timers: TimerData[] = []
  private intervalId: ReturnType<typeof setInterval> | null = null
  private listeners: Set<TimerListener> = new Set()

  constructor() {
    this.timers = loadPersistedTimers()
    if (this.timers.some((t) => t.status === 'running')) {
      this.startTick()
    }
    const completed = this.timers.find((t) => t.status === 'completed')
    if (completed) {
      this.triggerCompletionAlert(completed)
    }
  }

  public subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener)
    const primary = this.getPrimaryTimer()
    listener(primary, calculateRemainingSeconds(primary), [...this.timers])
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getTimers(): TimerData[] {
    return [...this.timers]
  }

  public getPrimaryTimer(): TimerData | null {
    if (this.timers.length === 0) return null

    // 1. Any timer currently completed (alert ringing)
    const completed = this.timers.find((t) => t.status === 'completed')
    if (completed) return completed

    // 2. Running timer with lowest remaining time
    const running = this.timers.filter((t) => t.status === 'running')
    if (running.length > 0) {
      return running.reduce((min, cur) =>
        calculateRemainingSeconds(cur) < calculateRemainingSeconds(min) ? cur : min
      )
    }

    // 3. Paused timer with lowest remaining time
    const paused = this.timers.filter((t) => t.status === 'paused')
    if (paused.length > 0) {
      return paused.reduce((min, cur) =>
        calculateRemainingSeconds(cur) < calculateRemainingSeconds(min) ? cur : min
      )
    }

    return this.timers[0]
  }

  public getData(): TimerData | null {
    return this.getPrimaryTimer()
  }

  public getRemainingSeconds(id?: string): number {
    if (id) {
      const found = this.timers.find((t) => t.id === id)
      return calculateRemainingSeconds(found || null)
    }
    return calculateRemainingSeconds(this.getPrimaryTimer())
  }

  public startTimerSeconds(durationSeconds: number, label = 'Timer'): string {
    stopAlarmLoop()
    const validSeconds = Math.max(1, Math.round(durationSeconds))
    const now = Date.now()
    const endsAt = now + validSeconds * 1000

    const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newTimer: TimerData = {
      id,
      label,
      totalDurationSeconds: validSeconds,
      startedAt: now,
      endsAt,
      status: 'running',
      isPomodoro: false,
    }

    // If max reached (3), replace any completed timer, or oldest timer
    if (this.timers.length >= MAX_CONCURRENT_TIMERS) {
      const completedIdx = this.timers.findIndex((t) => t.status === 'completed')
      if (completedIdx >= 0) {
        this.timers[completedIdx] = newTimer
      } else {
        // Replace oldest timer
        this.timers[0] = newTimer
      }
    } else {
      this.timers.push(newTimer)
    }

    savePersistedTimers(this.timers)
    this.syncActivityRegistry()
    this.startTick()
    this.notify()
    return id
  }

  public startTimer(durationMinutes: number, label = 'Timer'): string {
    return this.startTimerSeconds(durationMinutes * 60, label)
  }

  public startPomodoro(phase: PomodoroPhase = 'focus', cycle = 1): string {
    stopAlarmLoop()
    const minutes = phase === 'focus' ? 25 : phase === 'shortBreak' ? 5 : 15
    const durationSeconds = minutes * 60
    const now = Date.now()
    const endsAt = now + durationSeconds * 1000

    const t = getT()
    const label =
      phase === 'focus'
        ? `${t.focusSession} (#${cycle})`
        : phase === 'shortBreak'
          ? t.shortBreak
          : t.longBreak

    const pomodoroTimer: TimerData = {
      id: 'timer-pomodoro',
      label,
      totalDurationSeconds: durationSeconds,
      startedAt: now,
      endsAt,
      status: 'running',
      isPomodoro: true,
      pomodoroPhase: phase,
      pomodoroCycle: cycle,
    }

    const existingIdx = this.timers.findIndex((t) => t.isPomodoro || t.id === 'timer-pomodoro')
    if (existingIdx >= 0) {
      this.timers[existingIdx] = pomodoroTimer
    } else if (this.timers.length >= MAX_CONCURRENT_TIMERS) {
      const completedIdx = this.timers.findIndex((t) => t.status === 'completed')
      if (completedIdx >= 0) {
        this.timers[completedIdx] = pomodoroTimer
      } else {
        this.timers[0] = pomodoroTimer
      }
    } else {
      this.timers.push(pomodoroTimer)
    }

    savePersistedTimers(this.timers)
    this.syncActivityRegistry()
    this.startTick()
    this.notify()
    return 'timer-pomodoro'
  }

  public pause(id?: string): void {
    const target = id ? this.timers.find((t) => t.id === id) : this.getPrimaryTimer()
    if (!target || target.status !== 'running') return

    const remaining = calculateRemainingSeconds(target)
    target.status = 'paused'
    target.pausedRemainingSeconds = remaining

    savePersistedTimers(this.timers)
    this.syncActivityRegistry()
    this.notify()
  }

  public resume(id?: string): void {
    const target = id ? this.timers.find((t) => t.id === id) : this.getPrimaryTimer()
    if (!target || target.status !== 'paused') return

    const remaining = target.pausedRemainingSeconds || 0
    target.status = 'running'
    target.endsAt = Date.now() + remaining * 1000
    target.pausedRemainingSeconds = undefined

    savePersistedTimers(this.timers)
    this.syncActivityRegistry()
    this.startTick()
    this.notify()
  }

  public addOneMinute(id?: string): void {
    const target = id ? this.timers.find((t) => t.id === id) : this.getPrimaryTimer()
    if (!target || target.status === 'idle') {
      this.startTimer(1)
      return
    }

    if (target.status === 'paused' && target.pausedRemainingSeconds !== undefined) {
      target.totalDurationSeconds += 60
      target.pausedRemainingSeconds += 60
    } else if (target.status === 'running') {
      target.totalDurationSeconds += 60
      target.endsAt += 60 * 1000
    }

    savePersistedTimers(this.timers)
    this.syncActivityRegistry()
    this.notify()
  }

  public reset(id?: string): void {
    if (id) {
      this.timers = this.timers.filter((t) => t.id !== id)
    } else {
      this.timers = []
    }

    if (this.timers.length === 0 || !this.timers.some((t) => t.status === 'completed')) {
      stopAlarmLoop()
      globalActivityRegistry.remove('timer-alert')
    }

    if (!this.timers.some((t) => t.status === 'running')) {
      this.stopTick()
    }

    savePersistedTimers(this.timers)
    this.syncActivityRegistry()
    this.notify()
  }

  public dismissAlert(id?: string): void {
    if (id) {
      this.timers = this.timers.filter((t) => t.id !== id)
    } else {
      // Dismiss the completed timer
      const completedIdx = this.timers.findIndex((t) => t.status === 'completed')
      if (completedIdx >= 0) {
        this.timers.splice(completedIdx, 1)
      }
    }

    const anyCompletedRemaining = this.timers.some((t) => t.status === 'completed')
    if (!anyCompletedRemaining) {
      stopAlarmLoop()
      globalActivityRegistry.remove('timer-alert')
    }

    savePersistedTimers(this.timers)
    this.syncActivityRegistry()
    this.notify()

    // Refresh media state repeatedly in case audio was paused/ducked during alarm chime
    ;[150, 400, 800, 1500].forEach((delay) => {
      setTimeout(() => {
        globalMediaEngine.poll()
      }, delay)
    })
  }

  private startTick(): void {
    this.stopTick()
    this.intervalId = setInterval(() => {
      let anyRunning = false
      let changed = false

      this.timers.forEach((timer) => {
        if (timer.status === 'running') {
          anyRunning = true
          const remaining = calculateRemainingSeconds(timer)
          if (remaining <= 0) {
            timer.status = 'completed'
            changed = true
            this.triggerCompletionAlert(timer)
          }
        }
      })

      if (!anyRunning && !this.timers.some((t) => t.status === 'completed')) {
        this.stopTick()
      }

      if (changed) {
        savePersistedTimers(this.timers)
      }

      this.notify()
    }, 1000)
  }

  private stopTick(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private triggerCompletionAlert(completedTimer: TimerData): void {
    const settings = globalSettingsEngine.getSettings()
    if (settings.timerChimeEnabled) {
      startAlarmLoop(2400, (settings.timerChimeVolume || 80) / 100)
    }

    const t = getT(settings.language)
    globalActivityRegistry.register({
      id: 'timer-alert',
      kind: 'alert',
      priority: ACTIVITY_PRIORITIES.alert,
      title: completedTimer.isPomodoro
        ? `${completedTimer.label} ${t.completedSuffix}`
        : `${completedTimer.label}: ${t.timeUp}`,
      updatedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    })

    this.notify()
  }

  private syncActivityRegistry(): void {
    const runningOrPaused = this.timers.filter((t) => t.status === 'running' || t.status === 'paused')
    if (runningOrPaused.length === 0) {
      globalActivityRegistry.remove('timer')
      return
    }

    const primary = this.getPrimaryTimer()
    if (!primary) {
      globalActivityRegistry.remove('timer')
      return
    }

    globalActivityRegistry.register({
      id: 'timer',
      kind: 'timer',
      priority: ACTIVITY_PRIORITIES.timer,
      title: primary.label,
      updatedAt: Date.now(),
      metadata: {
        status: primary.status,
        remainingSeconds: calculateRemainingSeconds(primary),
        totalDurationSeconds: primary.totalDurationSeconds,
        isPomodoro: primary.isPomodoro,
        pomodoroPhase: primary.pomodoroPhase,
        activeTimerCount: runningOrPaused.length,
      },
    })
  }

  private notify(): void {
    const primary = this.getPrimaryTimer()
    const remaining = calculateRemainingSeconds(primary)
    const timersCopy = [...this.timers]
    this.listeners.forEach((l) => l(primary, remaining, timersCopy))
  }
}

export const globalTimerEngine = new TimerEngine()
