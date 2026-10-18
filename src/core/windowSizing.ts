import { invoke } from '@tauri-apps/api/core'

export interface WindowSize {
  width: number
  height: number
}

// Window sizes include >=40px padding to prevent box-shadow edge clipping
export const WINDOW_SIZES: Record<string, WindowSize> = {
  idle: { width: 220, height: 100 },
  singleTimer: { width: 230, height: 100 },
  singleMusic: { width: 330, height: 100 },
  split: { width: 360, height: 100 },
  home: { width: 440, height: 260 },
  expandedMusic: { width: 460, height: 260 },
  expandedTimer: { width: 420, height: 250 },
}

export async function resizeWindow(width: number, height: number) {
  try {
    await invoke('resize_island', { width, height })
  } catch (err) {
    console.debug('resize_island dev fallback:', err)
  }
}
