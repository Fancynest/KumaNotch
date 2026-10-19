import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type DeviceCategory =
  | 'tws'
  | 'headphones'
  | 'speaker'
  | 'speakers'
  | 'keyboard'
  | 'mouse'
  | 'phone'
  | 'bluetooth'
  | 'audio'

export interface AudioDeviceEvent {
  event_type: 'connected' | 'disconnected'
  device_name: string
  device_type: DeviceCategory
  is_bluetooth?: boolean
  is_default: boolean
}

export interface AudioDeviceNotification extends AudioDeviceEvent {
  id: string
  timestamp: number
}

type DeviceListener = (notification: AudioDeviceNotification | null) => void

class AudioDeviceEngine {
  private activeNotification: AudioDeviceNotification | null = null
  private listeners: DeviceListener[] = []
  private dismissTimer: ReturnType<typeof setTimeout> | null = null
  private unlisten: UnlistenFn | null = null

  constructor() {
    this.initTauriListener()
  }

  private async initTauriListener() {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return
    }

    try {
      this.unlisten = await listen<AudioDeviceEvent>('audio_device_changed', (event) => {
        this.handleEvent(event.payload)
      })
    } catch (err) {
      console.debug('AudioDeviceEngine: failed to register event listener', err)
    }
  }

  private handleEvent(event: AudioDeviceEvent) {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = null
    }

    const notification: AudioDeviceNotification = {
      ...event,
      id: `${event.device_name}-${Date.now()}`,
      timestamp: Date.now(),
    }

    this.activeNotification = notification
    this.notify()

    // Auto-dismiss HUD after 3.8 seconds
    this.dismissTimer = setTimeout(() => {
      this.activeNotification = null
      this.notify()
    }, 3800)
  }

  public getActiveNotification(): AudioDeviceNotification | null {
    return this.activeNotification
  }

  public simulate(event: AudioDeviceEvent) {
    this.handleEvent(event)
  }

  public dismiss() {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = null
    }
    this.activeNotification = null
    this.notify()
  }

  public subscribe(listener: DeviceListener): () => void {
    this.listeners.push(listener)
    listener(this.activeNotification)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.activeNotification)
      } catch (e) {
        console.error('AudioDeviceEngine listener error:', e)
      }
    }
  }

  public destroy() {
    if (this.unlisten) {
      this.unlisten()
      this.unlisten = null
    }
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = null
    }
  }
}

export const globalAudioDeviceEngine = new AudioDeviceEngine()
