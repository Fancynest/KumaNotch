import { useEffect } from 'react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { globalShelfEngine } from '../core/shelf'
import { globalTimerEngine } from '../core/timer'
import { globalSettingsEngine, type AppSettings } from '../core/settings'
import { useIslandStore, type IslandView, type ExpandedActivity, type SystemMode } from '../core/islandStore'

interface UseIslandEventsOptions {
  currentView: IslandView
  expandedActivity: ExpandedActivity
  timerStatus?: string
  settings: AppSettings
  systemMode: SystemMode
  setSystemMode: (mode: SystemMode) => void
  setIsFullscreen?: (isFullscreen: boolean) => void
  setExpandedActivity: (activity: ExpandedActivity) => void
  setHomePage: (page: number) => void
  setIsDragOver: (isDragOver: boolean) => void
  collapseAll: () => void
}

export function useIslandEvents({
  currentView,
  expandedActivity,
  timerStatus,
  settings,
  systemMode,
  setSystemMode,
  setIsFullscreen,
  setExpandedActivity,
  setHomePage,
  setIsDragOver,
  collapseAll,
}: UseIslandEventsOptions) {
  // 1. Drag and drop listener for File Shelf
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('drop', handleDrop)

    let unlisten: (() => void) | undefined
    try {
      getCurrentWebviewWindow()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDragOver(true)
            setHomePage(2)
          } else if (event.payload.type === 'leave') {
            setIsDragOver(false)
          } else if (event.payload.type === 'drop') {
            setIsDragOver(false)
            setHomePage(2)
            if (event.payload.paths && event.payload.paths.length > 0) {
              globalShelfEngine.addPaths(event.payload.paths)
              setExpandedActivity('home')
            }
          }
        })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
    } catch {}

    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('drop', handleDrop)
      if (unlisten) unlisten()
    }
  }, [setIsDragOver, setHomePage, setExpandedActivity])

  // 2. OS Foreground mode events
  useEffect(() => {
    let unlisten: (() => void) | undefined

    interface AppModeResponse {
      mode: SystemMode
      is_fullscreen?: boolean
    }

    invoke<AppModeResponse | string>('get_app_mode')
      .then((res) => {
        const mode = typeof res === 'string' ? (res as SystemMode) : res.mode
        const isFs = typeof res === 'object' ? Boolean(res.is_fullscreen) : mode === 'fullscreen'
        if (mode === 'app' || mode === 'desktop' || mode === 'fullscreen' || mode === 'hidden') {
          setSystemMode(mode)
        }
        if (setIsFullscreen) {
          setIsFullscreen(isFs)
        } else {
          useIslandStore.getState().setIsFullscreen(isFs)
        }
      })
      .catch(() => {})

    listen<AppModeResponse>('app_mode_changed', (event) => {
      const mode = event.payload.mode
      const isFs = mode === 'fullscreen' || Boolean(event.payload.is_fullscreen)
      setSystemMode(mode)
      if (setIsFullscreen) {
        setIsFullscreen(isFs)
      } else {
        useIslandStore.getState().setIsFullscreen(isFs)
      }
      if (
        mode === 'hidden' ||
        (mode === 'app' && settings.hideOnFullscreen) ||
        (isFs && settings.hideOnFullscreen)
      ) {
        getCurrentWebviewWindow().hide().catch(() => {})
      } else {
        getCurrentWebviewWindow().show().catch(() => {})
      }
    })
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => {})

    return () => {
      if (unlisten) unlisten()
    }
  }, [setSystemMode, setIsFullscreen, settings.hideOnFullscreen])

  // React to hideOnFullscreen setting change in app or fullscreen mode
  useEffect(() => {
    if (systemMode === 'app' || systemMode === 'fullscreen') {
      if (settings.hideOnFullscreen) {
        getCurrentWebviewWindow().hide().catch(() => {})
      } else {
        getCurrentWebviewWindow().show().catch(() => {})
      }
    }
  }, [settings.hideOnFullscreen, systemMode])

  // 3. Tray events
  useEffect(() => {
    const unlisteners: Array<() => void> = []

    listen('open_settings', () => {
      setExpandedActivity('settings')
    })
      .then((fn) => unlisteners.push(fn))
      .catch(() => {})

    listen('toggle_personality', () => {
      const curr = globalSettingsEngine.getSettings().personalityEnabled
      globalSettingsEngine.update({ personalityEnabled: !curr })
    })
      .then((fn) => unlisteners.push(fn))
      .catch(() => {})

    listen<boolean>('autostart_changed', (e) => {
      globalSettingsEngine.update({ autostart: e.payload })
    })
      .then((fn) => unlisteners.push(fn))
      .catch(() => {})

    return () => {
      unlisteners.forEach((fn) => fn())
    }
  }, [setExpandedActivity])

  // 4. Alert Auto-Dismiss after 30s
  useEffect(() => {
    if (currentView !== 'alert' && timerStatus !== 'completed') return
    const timer = setTimeout(() => {
      globalTimerEngine.dismissAlert()
    }, 30000)
    return () => clearTimeout(timer)
  }, [currentView, timerStatus])

  // 5. Collapse on Escape & Window blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentView === 'alert' || timerStatus === 'completed') {
          globalTimerEngine.dismissAlert()
        } else {
          collapseAll()
        }
      }
    }
    const handleBlur = () => {
      if (currentView !== 'alert') collapseAll()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleBlur)

    let unlisten: (() => void) | undefined
    try {
      getCurrentWebviewWindow()
        .onFocusChanged(({ payload: focused }) => {
          if (!focused && currentView !== 'alert') collapseAll()
        })
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
    } catch {}

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleBlur)
      if (unlisten) unlisten()
    }
  }, [currentView, timerStatus, collapseAll])

  // 6. Auto-collapse when capsule is open and idle/unclicked for settings.autoCollapseSeconds
  useEffect(() => {
    if (
      !settings.autoCollapseExpanded ||
      expandedActivity === null ||
      currentView === 'alert'
    )
      return

    const timeoutMs = (settings.autoCollapseSeconds || 10) * 1000

    let timer = setTimeout(() => {
      collapseAll()
    }, timeoutMs)

    const resetInactivity = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        collapseAll()
      }, timeoutMs)
    }

    window.addEventListener('mousemove', resetInactivity)
    window.addEventListener('mousedown', resetInactivity)
    window.addEventListener('keydown', resetInactivity)
    window.addEventListener('wheel', resetInactivity)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', resetInactivity)
      window.removeEventListener('mousedown', resetInactivity)
      window.removeEventListener('keydown', resetInactivity)
      window.removeEventListener('wheel', resetInactivity)
    }
  }, [
    expandedActivity,
    currentView,
    settings.autoCollapseExpanded,
    settings.autoCollapseSeconds,
    collapseAll,
  ])
}
