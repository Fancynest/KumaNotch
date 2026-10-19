import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface ProcessEvent {
  id: string
  command: string
  status: 'running' | 'success' | 'error'
  exit_code?: number | null
  duration_ms: number
  message?: string | null
  post_action?: string | null
}

export interface PostActionState {
  action: string
  countdown: number
  isCancelled: boolean
  command: string
}

type ProcessListener = (state: {
  activeProcess: ProcessEvent | null
  latestAlert: ProcessEvent | null
  postAction: PostActionState | null
}) => void

class ProcessWatcherEngine {
  private activeProcess: ProcessEvent | null = null
  private latestAlert: ProcessEvent | null = null
  private postActionState: PostActionState | null = null
  private listeners: ProcessListener[] = []
  private alertTimer: ReturnType<typeof setTimeout> | null = null
  private countdownTimer: ReturnType<typeof setInterval> | null = null
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

      // If post_action specified and completed successfully (exit code 0), initiate 30s countdown
      const isSuccess =
        event.status === 'success' &&
        (event.exit_code === 0 || event.exit_code == null)

      if (event.post_action && isSuccess) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer)
          this.countdownTimer = null
        }

        this.postActionState = {
          action: event.post_action,
          countdown: 30,
          isCancelled: false,
          command: event.command,
        }

        this.countdownTimer = setInterval(() => {
          if (!this.postActionState || this.postActionState.isCancelled) {
            if (this.countdownTimer) {
              clearInterval(this.countdownTimer)
              this.countdownTimer = null
            }
            return
          }

          if (this.postActionState.countdown <= 1) {
            if (this.countdownTimer) {
              clearInterval(this.countdownTimer)
              this.countdownTimer = null
            }
            const actionToRun = this.postActionState.action
            this.postActionState.countdown = 0
            this.notify()
            this.executePowerAction(actionToRun)
          } else {
            this.postActionState.countdown -= 1
            this.notify()
          }
        }, 1000)
      }

      this.notify()

      // Auto-dismiss finished alert card after 4.5s (or 33s if post-action countdown is active)
      const dismissDelay = event.post_action && isSuccess ? 33000 : 4500
      this.alertTimer = setTimeout(() => {
        this.latestAlert = null
        this.notify()
      }, dismissDelay)
    }
  }

  public getActiveProcess(): ProcessEvent | null {
    return this.activeProcess
  }

  public getLatestAlert(): ProcessEvent | null {
    return this.latestAlert
  }

  public getPostAction(): PostActionState | null {
    return this.postActionState
  }

  public cancelPostAction() {
    if (this.postActionState) {
      this.postActionState.isCancelled = true
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    this.notify()
  }

  public dismissAlert() {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer)
      this.alertTimer = null
    }
    this.latestAlert = null
    this.notify()
  }

  private async executePowerAction(action: string) {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      console.log('ProcessWatcherEngine: Mock power action executed:', action)
      return
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('power_action', { action })
    } catch (err) {
      console.error('ProcessWatcherEngine: power_action failed', action, err)
    }
  }

  public async runCommand(command: string): Promise<void> {
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

  public subscribe(listener: ProcessListener): () => void {
    this.listeners.push(listener)
    listener({
      activeProcess: this.activeProcess,
      latestAlert: this.latestAlert,
      postAction: this.postActionState,
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
          postAction: this.postActionState,
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
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
  }
}

export const globalProcessWatcherEngine = new ProcessWatcherEngine()
