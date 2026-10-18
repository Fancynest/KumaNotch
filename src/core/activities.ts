export type ActivityKind = 'alert' | 'hud' | 'timer' | 'indicator' | 'media' | 'calendar'

export interface Activity {
  id: string
  kind: ActivityKind
  priority: number // alert: 100, hud: 90, timer: 70, indicator: 60, media: 50, calendar: 40
  title: string
  updatedAt: number
  expiresAt?: number // for transient hud/alerts
  metadata?: Record<string, unknown>
}

export const ACTIVITY_PRIORITIES: Record<ActivityKind, number> = {
  alert: 100,
  hud: 90,
  timer: 70,
  indicator: 60,
  media: 50,
  calendar: 40,
}

export class ActivityRegistry {
  private activities: Map<string, Activity> = new Map()
  private listeners: Set<(activities: Activity[]) => void> = new Set()

  public register(activity: Activity): void {
    this.activities.set(activity.id, {
      ...activity,
      updatedAt: Date.now(),
    })
    this.notify()
  }

  public update(id: string, updates: Partial<Activity>): void {
    const existing = this.activities.get(id)
    if (!existing) return
    this.activities.set(id, {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    })
    this.notify()
  }

  public remove(id: string): void {
    if (this.activities.delete(id)) {
      this.notify()
    }
  }

  public get(id: string): Activity | undefined {
    return this.activities.get(id)
  }

  public getSortedActivities(): Activity[] {
    const now = Date.now()
    // Filter out expired transient activities
    const active = Array.from(this.activities.values()).filter((act) => {
      if (act.expiresAt && act.expiresAt <= now) {
        this.activities.delete(act.id)
        return false
      }
      return true
    })

    // Sort by priority descending, then updatedAt descending
    return active.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      return b.updatedAt - a.updatedAt
    })
  }

  public getTopActivity(): Activity | undefined {
    const sorted = this.getSortedActivities()
    return sorted[0]
  }

  public subscribe(listener: (activities: Activity[]) => void): () => void {
    this.listeners.add(listener)
    listener(this.getSortedActivities())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const sorted = this.getSortedActivities()
    this.listeners.forEach((listener) => listener(sorted))
  }
}

export const globalActivityRegistry = new ActivityRegistry()
