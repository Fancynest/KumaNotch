import { invoke } from '@tauri-apps/api/core'

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
  idle: { width: 170, height: 58 },
  droplet: { width: 48, height: 48 },
  singleTimer: { width: 180, height: 58 },
  singleMusic: { width: 280, height: 58 },
  split: { width: 220, height: 58 },
  dropTarget: { width: 260, height: 72 },
  home: { width: 390, height: 260 },
  expandedMusic: { width: 400, height: 230 },
  expandedTimer: { width: 370, height: 220 },
  alert: { width: 370, height: 210 },
}

// Single persistent shell geometry configurations
export const SHELL_CONFIGS: Record<string, ShellConfig> = {
  droplet: {
    width: 16,
    height: 16,
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
    y: 8, // vertical center anchored at y = 24px (8 + 8 + 8)
  },
  dropTarget: {
    width: 220,
    height: 44,
    borderRadius: 22,
    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.5)',
    y: 0,
  },
  idle: {
    width: 96,
    height: 32,
    borderRadius: 16,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
    y: 0, // vertical center anchored at y = 24px (8 + 0 + 16)
  },
  split: {
    width: 96,
    height: 32,
    borderRadius: 16,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
    y: 0,
  },
  singleTimer: {
    width: 118,
    height: 32,
    borderRadius: 16,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
    y: 0,
  },
  home: {
    width: 350,
    height: 220,
    borderRadius: 36,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
    y: 0,
  },
  expandedTimer: {
    width: 330,
    height: 175,
    borderRadius: 36,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
    y: 0,
  },
  alert: {
    width: 330,
    height: 165,
    borderRadius: 36,
    boxShadow: '0 4px 25px rgba(255, 149, 0, 0.45)',
    y: 0,
  },
}

export async function resizeWindow(width: number, height: number): Promise<void> {
  try {
    await invoke('resize_island', { width, height })
  } catch (err) {
    console.debug('resize_island dev fallback:', err)
  }
}
