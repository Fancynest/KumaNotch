import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export interface ProcessEvent {
  id: string
  command: string
  status: 'running' | 'success' | 'error'
  exit_code?: number | null
  duration_ms: number
  message?: string | null
}

type ProcessListener = (state: {
  activeProcess: ProcessEvent | null
  latestAlert: ProcessEvent | null
}) => void

class ProcessWatcherEngine {
  private activeProcess: ProcessEvent | null = null
  private latestAlert: ProcessEvent | null = null
  private listeners: ProcessListener[] = []
  private alertTimer: ReturnType<typeof setTimeout> | null = null
  private unlisten: UnlistenFn | null = null

  constructor() {
    this.initTauriListener()
  }

  private async initTauriListener() {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return
    }

    try {
      this.unlisten = await listen<ProcessEvent>('process_event', (event) => {
        this.handleEvent(event.payload)
      })
    } catch (err) {
      console.debug('ProcessWatcherEngine: failed to register event listener', err)
    }
  }

  public handleEvent(event: ProcessEvent) {
    if (event.status === 'running') {
      this.activeProcess = event
      this.notify()
    } else {
      // Completed (success or error)
      this.activeProcess = null
      this.latestAlert = event

      if (this.alertTimer) {
        clearTimeout(this.alertTimer)
      }

      this.notify()

      // Auto-dismiss finished alert after 4.5s
      this.alertTimer = setTimeout(() => {
        this.latestAlert = null
        this.notify()
      }, 4500)
    }
  }

  public getActiveProcess(): ProcessEvent | null {
    return this.activeProcess
  }

  public getLatestAlert(): ProcessEvent | null {
    return this.latestAlert
  }

  public dismissAlert() {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer)
      this.alertTimer = null
    }
    this.latestAlert = null
    this.notify()
  }

  public async runCommand(command: string): Promise<void> {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      await invoke('kuma_run_command', { command })
    } else {
      // Mock simulation for browser dev
      const id = `mock-${Date.now()}`
      this.handleEvent({
        id,
        command,
        status: 'running',
        duration_ms: 0,
      })

      setTimeout(() => {
        this.handleEvent({
          id,
          command,
          status: 'success',
          exit_code: 0,
          duration_ms: 2450,
        })
      }, 2500)
    }
  }

  public subscribe(listener: ProcessListener): () => void {
    this.listeners.push(listener)
    listener({
      activeProcess: this.activeProcess,
      latestAlert: this.latestAlert,
    })
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener({
          activeProcess: this.activeProcess,
          latestAlert: this.latestAlert,
        })
      } catch (e) {
        console.error('ProcessWatcherEngine listener error:', e)
      }
    }
  }

  public destroy() {
    if (this.unlisten) {
      this.unlisten()
      this.unlisten = null
    }
    if (this.alertTimer) {
      clearTimeout(this.alertTimer)
      this.alertTimer = null
    }
  }
}

export const globalProcessWatcherEngine = new ProcessWatcherEngine()
