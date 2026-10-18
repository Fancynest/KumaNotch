import { globalActivityRegistry, ACTIVITY_PRIORITIES } from './activities'
import { playTimerChime } from './audio'

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

const STORAGE_KEY = 'kumanotch_timer_state'

export function loadPersistedTimer(): TimerData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data: TimerData = JSON.parse(raw)
    const now = Date.now()

    if (data.status === 'running') {
      if (data.endsAt <= now) {
        // Expired during system sleep or while app was closed
        return {
          ...data,
          status: 'completed',
        }
      }
    }
    return data
  } catch {
    return null
  }
}

export function savePersistedTimer(data: TimerData | null): void {
  try {
    if (!data || data.status === 'idle') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (err) {
    console.debug('Failed to persist timer state:', err)
  }
}

export function calculateRemainingSeconds(data: TimerData | null): number {
  if (!data || data.status === 'idle') return 0
  if (data.status === 'paused' && data.pausedRemainingSeconds !== undefined) {
    return data.pausedRemainingSeconds
  }
  if (data.status === 'completed') return 0

  const diffMs = data.endsAt - Date.now()
  return Math.max(0, Math.ceil(diffMs / 1000))
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

export class TimerEngine {
  private data: TimerData | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private listeners: Set<(data: TimerData | null, remaining: number) => void> = new Set()

  constructor() {
    const persisted = loadPersistedTimer()
    if (persisted) {
      this.data = persisted
      if (this.data.status === 'running') {
        this.startTick()
      } else if (this.data.status === 'completed') {
        this.triggerCompletionAlert()
      }
    }
  }

  public subscribe(listener: (data: TimerData | null, remaining: number) => void): () => void {
    this.listeners.add(listener)
    listener(this.data, calculateRemainingSeconds(this.data))
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getData(): TimerData | null {
    return this.data
  }

  public getRemainingSeconds(): number {
    return calculateRemainingSeconds(this.data)
  }

  public startTimerSeconds(durationSeconds: number, label = 'Timer'): void {
    const validSeconds = Math.max(1, Math.round(durationSeconds))
    const now = Date.now()
    const endsAt = now + validSeconds * 1000

    this.data = {
      id: 'timer-main',
      label,
      totalDurationSeconds: validSeconds,
      startedAt: now,
      endsAt,
      status: 'running',
      isPomodoro: false,
    }

    savePersistedTimer(this.data)
    this.syncActivityRegistry()
    this.startTick()
    this.notify()
  }

  public startTimer(durationMinutes: number, label = 'Timer'): void {
    this.startTimerSeconds(durationMinutes * 60, label)
  }

  public startPomodoro(phase: PomodoroPhase = 'focus', cycle = 1): void {
    const minutes = phase === 'focus' ? 25 : phase === 'shortBreak' ? 5 : 15
    const durationSeconds = minutes * 60
    const now = Date.now()
    const endsAt = now + durationSeconds * 1000

    const label =
      phase === 'focus'
        ? `Pomodoro Fokus (#${cycle})`
        : phase === 'shortBreak'
          ? 'Istirahat Pendek'
          : 'Istirahat Panjang'

    this.data = {
      id: 'timer-main',
      label,
      totalDurationSeconds: durationSeconds,
      startedAt: now,
      endsAt,
      status: 'running',
      isPomodoro: true,
      pomodoroPhase: phase,
      pomodoroCycle: cycle,
    }

    savePersistedTimer(this.data)
    this.syncActivityRegistry()
    this.startTick()
    this.notify()
  }

  public pause(): void {
    if (!this.data || this.data.status !== 'running') return
    const remaining = calculateRemainingSeconds(this.data)
    this.stopTick()

    this.data = {
      ...this.data,
      status: 'paused',
      pausedRemainingSeconds: remaining,
    }

    savePersistedTimer(this.data)
    this.syncActivityRegistry()
    this.notify()
  }

  public resume(): void {
    if (!this.data || this.data.status !== 'paused') return
    const remaining = this.data.pausedRemainingSeconds || 0
    const now = Date.now()

    this.data = {
      ...this.data,
      status: 'running',
      endsAt: now + remaining * 1000,
      pausedRemainingSeconds: undefined,
    }

    savePersistedTimer(this.data)
    this.syncActivityRegistry()
    this.startTick()
    this.notify()
  }

  public addOneMinute(): void {
    if (!this.data || this.data.status === 'idle') {
      this.startTimer(1)
      return
    }

    if (this.data.status === 'paused' && this.data.pausedRemainingSeconds !== undefined) {
      this.data = {
        ...this.data,
        totalDurationSeconds: this.data.totalDurationSeconds + 60,
        pausedRemainingSeconds: this.data.pausedRemainingSeconds + 60,
      }
    } else if (this.data.status === 'running') {
      this.data = {
        ...this.data,
        totalDurationSeconds: this.data.totalDurationSeconds + 60,
        endsAt: this.data.endsAt + 60 * 1000,
      }
    }

    savePersistedTimer(this.data)
    this.syncActivityRegistry()
    this.notify()
  }

  public reset(): void {
    this.stopTick()
    this.data = null
    savePersistedTimer(null)
    globalActivityRegistry.remove('timer')
    globalActivityRegistry.remove('timer-alert')
    this.notify()
  }

  public dismissAlert(): void {
    globalActivityRegistry.remove('timer-alert')
    if (this.data && this.data.status === 'completed') {
      this.reset()
    }
  }

  private startTick(): void {
    this.stopTick()
    this.intervalId = setInterval(() => {
      if (!this.data || this.data.status !== 'running') {
        this.stopTick()
        return
      }

      const remaining = calculateRemainingSeconds(this.data)
      if (remaining <= 0) {
        this.stopTick()
        this.data = {
          ...this.data,
          status: 'completed',
        }
        savePersistedTimer(this.data)
        this.triggerCompletionAlert()
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

  private triggerCompletionAlert(): void {
    playTimerChime(0.85)

    // Register high-priority Alert activity (100) with 30s auto-dismiss
    globalActivityRegistry.register({
      id: 'timer-alert',
      kind: 'alert',
      priority: ACTIVITY_PRIORITIES.alert,
      title: this.data?.isPomodoro ? `${this.data.label} Selesai!` : 'Waktu Habis!',
      updatedAt: Date.now(),
      expiresAt: Date.now() + 30000,
    })

    this.notify()
  }

  private syncActivityRegistry(): void {
    if (!this.data || this.data.status === 'idle') {
      globalActivityRegistry.remove('timer')
      return
    }

    globalActivityRegistry.register({
      id: 'timer',
      kind: 'timer',
      priority: ACTIVITY_PRIORITIES.timer,
      title: this.data.label,
      updatedAt: Date.now(),
      metadata: {
        status: this.data.status,
        remainingSeconds: calculateRemainingSeconds(this.data),
        totalDurationSeconds: this.data.totalDurationSeconds,
        isPomodoro: this.data.isPomodoro,
        pomodoroPhase: this.data.pomodoroPhase,
      },
    })
  }

  private notify(): void {
    const remaining = calculateRemainingSeconds(this.data)
    this.listeners.forEach((l) => l(this.data, remaining))
  }
}

export const globalTimerEngine = new TimerEngine()
