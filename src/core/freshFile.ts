import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { globalActivityRegistry } from './activities'
import { globalSettingsEngine } from './settings'
import { globalShelfEngine } from './shelf'
import { playTimerChime } from './audio'

export interface FreshFileInfo {
  id: string
  path: string
  name: string
  size: number
  extension: string
  thumbnail?: string
  is_batch: boolean
  batch_count: number
  created_at: number
}

type FreshFileListener = (active: FreshFileInfo | null, recent: FreshFileInfo[]) => void

class FreshFileEngine {
  private activeFile: FreshFileInfo | null = null
  private recentFiles: FreshFileInfo[] = []
  private listeners: Set<FreshFileListener> = new Set()
  private countdownTimer: ReturnType<typeof setInterval> | null = null
  private remainingMs: number = 0
  private isPaused: boolean = false

  constructor() {
    this.initTauriListener()
    this.loadInitialRecent()
  }

  private async loadInitialRecent() {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const files = await invoke<FreshFileInfo[]>('fresh_get_recent_files')
        if (Array.isArray(files)) {
          this.recentFiles = files
          this.notify()
        }
      } catch {}
    }
  }

  private initTauriListener() {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return
    }

    listen<FreshFileInfo>('fresh_file://discovered', (event) => {
      const file = event.payload
      if (!file) return

      const settings = globalSettingsEngine.getSettings()
      if (!settings.freshFileEnabled) return

      this.onNewFile(file, settings.freshFileDurationSeconds || 8, settings.freshFileSound)
    }).catch((err) => {
      console.warn('Failed to listen to fresh_file://discovered:', err)
    })
  }

  public onNewFile(file: FreshFileInfo, durationSeconds: number = 8, playSound: boolean = false) {
    this.activeFile = file

    // Update in-memory session recent list (up to 5 items)
    this.recentFiles = [file, ...this.recentFiles.filter((f) => f.path !== file.path)].slice(0, 5)

    // Register with Activity Registry
    globalActivityRegistry.register({
      id: file.id,
      kind: 'fresh-file',
      priority: 55,
      title: file.name,
      updatedAt: Date.now(),
      expiresAt: Date.now() + durationSeconds * 1000,
      metadata: { ...file },
    })

    if (playSound) {
      playTimerChime(0.5)
    }

    this.startCountdown(durationSeconds * 1000)
    this.notify()
  }

  private startCountdown(totalMs: number) {
    this.stopCountdown()
    this.remainingMs = totalMs
    this.isPaused = false

    this.countdownTimer = setInterval(() => {
      if (!this.isPaused) {
        this.remainingMs -= 100
        if (this.remainingMs <= 0) {
          this.dismiss()
        }
      }
    }, 100)
  }

  private stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
  }

  public pauseCountdown() {
    this.isPaused = true
  }

  public resumeCountdown() {
    this.isPaused = false
  }

  public getActiveFile(): FreshFileInfo | null {
    return this.activeFile
  }

  public getRecentFiles(): FreshFileInfo[] {
    return [...this.recentFiles]
  }

  public getRemainingRatio(): number {
    const settings = globalSettingsEngine.getSettings()
    const totalMs = (settings.freshFileDurationSeconds || 8) * 1000
    if (totalMs <= 0) return 0
    return Math.max(0, Math.min(1, this.remainingMs / totalMs))
  }

  public dismiss() {
    this.stopCountdown()
    if (this.activeFile) {
      globalActivityRegistry.remove(this.activeFile.id)
      invoke('fresh_dismiss', { id: this.activeFile.id }).catch(() => {})
    }
    this.activeFile = null
    this.notify()
  }

  public async openFile(path: string) {
    try {
      await invoke('shelf_open_path', { path })
    } catch (e) {
      console.warn('Failed to open fresh file:', e)
    }
  }

  public async showInFolder(path: string) {
    try {
      await invoke('shelf_show_in_folder', { path })
    } catch (e) {
      console.warn('Failed to show fresh file in folder:', e)
    }
  }

  public async addToShelf(path: string) {
    await globalShelfEngine.addPaths([path])
  }

  public async startDrag(path: string) {
    const settings = globalSettingsEngine.getSettings()
    await globalShelfEngine.startDrag([path])
    if (settings.freshFileDismissOnDrag) {
      this.dismiss()
    }
  }

  public subscribe(listener: FreshFileListener): () => void {
    this.listeners.add(listener)
    listener(this.activeFile, this.recentFiles)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l(this.activeFile, this.recentFiles))
  }
}

export const globalFreshFileEngine = new FreshFileEngine()
