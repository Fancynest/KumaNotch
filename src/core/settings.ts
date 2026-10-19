import { invoke } from '@tauri-apps/api/core'

export interface AppSettings {
  timeFormat: 'auto' | '12h' | '24h'
  language: 'auto' | 'en' | 'id'
  autostart: boolean
  autoDroplet: boolean
  inactivitySeconds: number
  dwellSeconds: number
  autoCollapseExpanded: boolean
  autoCollapseSeconds: number
  personalityEnabled: boolean
  idleBeforeEyesSeconds: number
  timerChimeEnabled: boolean
  timerChimeVolume: number
  freshFileEnabled: boolean
  freshFileScreenshots: boolean
  freshFileDownloads: boolean
  freshFileDurationSeconds: number
  freshFileDismissOnDrag: boolean
  freshFileSound: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  timeFormat: 'auto',
  language: 'auto',
  autostart: false,
  autoDroplet: true,
  inactivitySeconds: 10,
  dwellSeconds: 2,
  autoCollapseExpanded: true,
  autoCollapseSeconds: 10,
  personalityEnabled: true,
  idleBeforeEyesSeconds: 6,
  timerChimeEnabled: true,
  timerChimeVolume: 80,
  freshFileEnabled: true,
  freshFileScreenshots: true,
  freshFileDownloads: true,
  freshFileDurationSeconds: 8,
  freshFileDismissOnDrag: true,
  freshFileSound: false,
}

const STORAGE_KEY = 'kumanotch_settings'

class SettingsEngine {
  private settings: AppSettings
  private listeners: Array<(settings: AppSettings) => void> = []

  constructor() {
    this.settings = this.load()
    this.syncAutostartFromSystem()
    this.syncTrayPersonality()
  }

  private syncTrayPersonality() {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      invoke('tray_set_personality', { checked: this.settings.personalityEnabled }).catch(() => {})
    }
  }

  private async syncAutostartFromSystem() {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const enabled = await invoke<boolean>('autostart_is_enabled')
        if (typeof enabled === 'boolean' && enabled !== this.settings.autostart) {
          this.settings.autostart = enabled
          this.save()
          this.notify()
        }
      } catch {}
    }
  }

  private load(): AppSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to load kumanotch_settings from localStorage:', e)
    }
    return { ...DEFAULT_SETTINGS }
  }

  private save(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch (e) {
      console.warn('Failed to save kumanotch_settings to localStorage:', e)
    }
  }

  public getSettings(): AppSettings {
    return { ...this.settings }
  }

  public update(patch: Partial<AppSettings>): void {
    if (patch.autostart !== undefined && patch.autostart !== this.settings.autostart) {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        invoke('autostart_set', { enable: patch.autostart }).catch(() => {})
      }
    }
    if (patch.personalityEnabled !== undefined && patch.personalityEnabled !== this.settings.personalityEnabled) {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        invoke('tray_set_personality', { checked: patch.personalityEnabled }).catch(() => {})
      }
    }
    this.settings = { ...this.settings, ...patch }
    this.save()
    this.notify()
  }

  public subscribe(fn: (settings: AppSettings) => void): () => void {
    this.listeners.push(fn)
    fn(this.getSettings())
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn)
    }
  }

  private notify(): void {
    const copy = this.getSettings()
    for (const fn of this.listeners) {
      try {
        fn(copy)
      } catch (e) {
        console.error('Settings listener error:', e)
      }
    }
  }
}

export const globalSettingsEngine = new SettingsEngine()
