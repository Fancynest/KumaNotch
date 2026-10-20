import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { globalActivityRegistry, ACTIVITY_PRIORITIES } from './activities'

export interface MediaData {
  isActive: boolean
  title: string
  artist: string
  album: string
  playbackStatus: 'playing' | 'paused' | 'stopped'
  positionMs: number
  durationMs: number
  appId: string
  thumbnailBase64?: string | null
  lastUpdated: number
}

interface RawMediaState {
  isActive: boolean
  title: string
  artist: string
  album: string
  playbackStatus: string
  positionMs: number
  durationMs: number
  appId: string
  thumbnailBase64?: string | null
  lastUpdatedTime?: number
}

export class MediaEngine {
  private data: MediaData | null = null
  private listeners: Set<(data: MediaData | null) => void> = new Set()
  private initialized: boolean = false
  private cachedThumbnail: string | null = null
  private currentTrackKey: string = ''

  constructor() {
    this.init()
  }

  private async init() {
    if (this.initialized) return
    this.initialized = true

    try {
      const raw = await invoke<RawMediaState>('media_get_state')
      this.handleStateUpdate(raw)
    } catch (e) {
      console.debug('Failed to fetch initial media state:', e)
    }

    try {
      await listen<RawMediaState>('media_state_changed', (event) => {
        this.handleStateUpdate(event.payload)
      })
    } catch (e) {
      console.debug('Failed to listen to media_state_changed:', e)
    }

    // Steady background sync to catch external player state changes (Spotify, Chrome YouTube, etc.)
    setInterval(() => {
      this.poll()
    }, 200)
  }

  private handleStateUpdate(raw: RawMediaState) {
    const status = (raw.playbackStatus.toLowerCase() as 'playing' | 'paused' | 'stopped') || 'stopped'
    const isActive = raw.isActive && Boolean(raw.title && (status === 'playing' || status === 'paused'))

    if (isActive) {
      const trackKey = `${raw.appId}::${raw.title}_${raw.artist}`
      if (trackKey !== this.currentTrackKey) {
        this.currentTrackKey = trackKey
        this.cachedThumbnail = raw.thumbnailBase64 ?? null
      } else if (raw.thumbnailBase64) {
        this.cachedThumbnail = raw.thumbnailBase64
      }

      const effectiveThumbnail = this.cachedThumbnail
      const lastUpdated = raw.lastUpdatedTime && raw.lastUpdatedTime > 0 ? raw.lastUpdatedTime : Date.now()

      const hasChanged =
        !this.data ||
        this.data.isActive !== true ||
        this.data.title !== raw.title ||
        this.data.artist !== raw.artist ||
        this.data.album !== raw.album ||
        this.data.playbackStatus !== status ||
        this.data.appId !== raw.appId ||
        this.data.thumbnailBase64 !== effectiveThumbnail

      this.data = {
        isActive: true,
        title: raw.title,
        artist: raw.artist,
        album: raw.album,
        playbackStatus: status,
        positionMs: raw.positionMs,
        durationMs: raw.durationMs,
        appId: raw.appId,
        thumbnailBase64: effectiveThumbnail,
        lastUpdated,
      }

      if (hasChanged) {
        globalActivityRegistry.register({
          id: 'media',
          kind: 'media',
          priority: ACTIVITY_PRIORITIES.media,
          title: raw.title,
          updatedAt: Date.now(),
          metadata: {
            artist: raw.artist,
            playbackStatus: status,
            thumbnailBase64: effectiveThumbnail,
          },
        })
        this.notify()
      }
    } else {
      const wasActive = this.data !== null
      this.data = null
      this.cachedThumbnail = null
      this.currentTrackKey = ''
      if (wasActive) {
        globalActivityRegistry.remove('media')
        this.notify()
      }
    }
  }

  public getData(): MediaData | null {
    return this.data ? { ...this.data } : null
  }

  public getInterpolatedPositionMs(): number {
    if (!this.data) return 0
    if (this.data.playbackStatus !== 'playing') return this.data.positionMs

    const elapsed = Date.now() - this.data.lastUpdated
    const current = this.data.positionMs + elapsed
    return this.data.durationMs > 0 ? Math.min(this.data.durationMs, current) : current
  }

  public async poll(): Promise<void> {
    try {
      const raw = await invoke<RawMediaState>('media_get_state')
      this.handleStateUpdate(raw)
    } catch {}
  }

  private triggerMultiPoll(): void {
    const delays = [80, 250, 600, 1200]
    delays.forEach((delay) => {
      setTimeout(() => this.poll(), delay)
    })
  }

  public async play(): Promise<boolean> {
    try {
      const res = await invoke<boolean>('media_play')
      this.triggerMultiPoll()
      return res
    } catch {
      return false
    }
  }

  public async pause(): Promise<boolean> {
    try {
      const res = await invoke<boolean>('media_pause')
      this.triggerMultiPoll()
      return res
    } catch {
      return false
    }
  }

  public async togglePlayPause(): Promise<boolean> {
    try {
      const res = await invoke<boolean>('media_toggle_play_pause')
      this.triggerMultiPoll()
      return res
    } catch {
      return false
    }
  }

  public async next(): Promise<boolean> {
    try {
      const res = await invoke<boolean>('media_next')
      this.triggerMultiPoll()
      return res
    } catch {
      return false
    }
  }

  public async previous(): Promise<boolean> {
    try {
      const res = await invoke<boolean>('media_prev')
      this.triggerMultiPoll()
      return res
    } catch {
      return false
    }
  }

  public async seek(positionMs: number): Promise<boolean> {
    try {
      const ok = await invoke<boolean>('media_seek', { positionMs })
      if (ok && this.data) {
        this.data.positionMs = positionMs
        this.data.lastUpdated = Date.now()
        this.notify()
      }
      return ok
    } catch {
      return false
    }
  }

  public simulate(data: Partial<MediaData>) {
    this.data = {
      isActive: true,
      title: data.title || 'vampire',
      artist: data.artist || 'Olivia Rodrigo',
      album: data.album || 'GUTS',
      playbackStatus: data.playbackStatus || 'playing',
      positionMs: data.positionMs || 42000,
      durationMs: data.durationMs || 220000,
      appId: data.appId || 'Spotify',
      thumbnailBase64: data.thumbnailBase64 || null,
      lastUpdated: Date.now(),
    }
    this.notify()
  }

  public subscribe(listener: (data: MediaData | null) => void): () => void {
    this.listeners.add(listener)
    listener(this.getData())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const current = this.getData()
    this.listeners.forEach((listener) => listener(current))
  }
}

export function formatMediaDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const globalMediaEngine = new MediaEngine()
