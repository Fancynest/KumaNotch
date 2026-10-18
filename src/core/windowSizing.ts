import { invoke } from '@tauri-apps/api/core'

export interface WindowSize {
  width: number
  height: number
}

// Window sizes include tight padding for lighter shadow without clipping
export const WINDOW_SIZES: Record<string, WindowSize> = {
  idle: { width: 170, height: 58 },
  singleTimer: { width: 180, height: 58 },
  singleMusic: { width: 280, height: 58 },
  split: { width: 320, height: 58 },
  home: { width: 390, height: 230 },
  expandedMusic: { width: 400, height: 230 },
  expandedTimer: { width: 370, height: 220 },
}

export async function resizeWindow(width: number, height: number) {
  try {
    await invoke('resize_island', { width, height })
  } catch (err) {
    console.debug('resize_island dev fallback:', err)
  }
}
