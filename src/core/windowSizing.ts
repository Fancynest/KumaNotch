import { invoke } from '@tauri-apps/api/core'
import type { IslandView, ExpandedActivity } from './islandStore'
import type { TimerData } from './timer'
import type { AudioDeviceNotification } from './audioDevice'
import type { ProcessEvent } from './processWatcher'

export interface WindowSize {
  width: number
  height: number
}

export interface ShellConfig {
  width: number
  height: number
  borderRadius: number
  boxShadow: string
  y: number
}

// Window sizes include tight padding for lighter shadow without clipping
export const WINDOW_SIZES: Record<string, WindowSize> = {
  idle: { width: 140, height: 48 },
  singleTimer: { width: 180, height: 48 },
  singleMusic: { width: 280, height: 48 },
  split: { width: 220, height: 48 },
  dropTarget: { width: 300, height: 60 },
  home: { width: 400, height: 280 },
  expandedMusic: { width: 400, height: 240 },
  expandedTimer: { width: 380, height: 230 },
  alert: { width: 380, height: 220 },
  expandedFreshFile: { width: 400, height: 250 },
  deviceNotification: { width: 300, height: 56 },
  processAlert: { width: 310, height: 56 },
  settings: { width: 420, height: 390 },
}

// Single persistent shell geometry configurations (Fase 8a: Attached Poni at y = 0)
export const SHELL_CONFIGS: Record<string, ShellConfig> = {
  dropTarget: {
    width: 240,
    height: 38,
    borderRadius: 19,
    boxShadow: 'none',
    y: 0,
  },
  idle: {
    width: 136,
    height: 28,
    borderRadius: 16,
    boxShadow: 'none',
    y: 0,
  },
  split: {
    width: 136,
    height: 28,
    borderRadius: 16,
    boxShadow: 'none',
    y: 0,
  },
  singleTimer: {
    width: 136,
    height: 28,
    borderRadius: 16,
    boxShadow: 'none',
    y: 0,
  },
  singleMusic: {
    width: 220,
    height: 28,
    borderRadius: 16,
    boxShadow: 'none',
    y: 0,
  },
  home: {
    width: 360,
    height: 240,
    borderRadius: 32,
    boxShadow: 'none',
    y: 0,
  },
  expandedTimer: {
    width: 340,
    height: 180,
    borderRadius: 32,
    boxShadow: 'none',
    y: 0,
  },
  expandedMusic: {
    width: 360,
    height: 220,
    borderRadius: 32,
    boxShadow: 'none',
    y: 0,
  },
  alert: {
    width: 340,
    height: 170,
    borderRadius: 32,
    boxShadow: 'none',
    y: 0,
  },
  expandedFreshFile: {
    width: 360,
    height: 200,
    borderRadius: 32,
    boxShadow: 'none',
    y: 0,
  },
  deviceNotification: {
    width: 260,
    height: 34,
    borderRadius: 17,
    boxShadow: 'none',
    y: 0,
  },
  processAlert: {
    width: 270,
    height: 34,
    borderRadius: 17,
    boxShadow: 'none',
    y: 0,
  },
  settings: {
    width: 380,
    height: 360,
    borderRadius: 32,
    boxShadow: 'none',
    y: 0,
  },
}

export async function setHitRegion(
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  try {
    await invoke('set_hit_region', {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
  } catch (err) {
    console.debug('set_hit_region dev fallback:', err)
  }
}

export async function resizeWindow(width: number, height: number): Promise<void> {
  try {
    await invoke('resize_island', { width, height })
  } catch (err) {
    console.debug('resize_island dev fallback:', err)
  }
}

export async function setIslandOffset(offsetX: number): Promise<void> {
  try {
    await invoke('set_island_offset', { offsetX })
  } catch (err) {
    console.debug('set_island_offset dev fallback:', err)
  }
}

export async function getIslandOffset(): Promise<number> {
  try {
    return await invoke<number>('get_island_offset')
  } catch (err) {
    console.debug('get_island_offset dev fallback:', err)
    return 0
  }
}

export function getIslandView(
  expandedActivity: ExpandedActivity,
  timerData: TimerData | null,
  isDragOver: boolean,
  deviceNotification: AudioDeviceNotification | null,
  processAlert: ProcessEvent | null,
): IslandView {
  if (timerData?.status === 'completed') return 'alert'
  if (processAlert !== null) return 'processAlert'
  if (expandedActivity === 'settings') return 'settings'
  if (expandedActivity === 'music') return 'expandedMusic'
  if (expandedActivity === 'home') return 'home'
  if (expandedActivity === 'timer') return 'expandedTimer'
  if (expandedActivity === 'freshFile') return 'expandedFreshFile'
  if (isDragOver) return 'dropTarget'
  if (deviceNotification !== null) return 'deviceNotification'
  return 'idle'
}

export function getDynamicDimensions(
  view: IslandView,
  isCustom: boolean,
  musicActive: boolean,
  timerActive: boolean,
  freshFileActive: boolean = false,
  hasPostAction: boolean = false,
) {
  const baseShell = { ...SHELL_CONFIGS[view] }
  const baseWin = { ...WINDOW_SIZES[view] }

  if (view === 'idle') {
    const auxCount = (musicActive ? 1 : 0) + (timerActive ? 1 : 0) + (freshFileActive ? 1 : 0)
    if (auxCount >= 2) {
      baseWin.width = 200
    } else if (auxCount === 1) {
      baseWin.width = 180
    } else {
      baseWin.width = 130
    }
  }

  if (view === 'deviceNotification' || view === 'processAlert') {
    const auxCount = (musicActive ? 1 : 0) + (timerActive ? 1 : 0) + (freshFileActive ? 1 : 0)
    if (view === 'processAlert' && hasPostAction) {
      baseShell.width = 340
      baseWin.width = 370
    } else if (auxCount >= 2) {
      baseWin.width = 380
    } else if (auxCount === 1) {
      baseWin.width = 340
    } else {
      baseWin.width = 300
    }
  }

  if (view === 'home') {
    const height = isCustom ? 268 : 230
    const winHeight = isCustom ? 310 : 270
    baseShell.height = height
    baseWin.height = winHeight
  }

  return { shell: baseShell, win: baseWin }
}
