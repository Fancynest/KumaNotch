import { create } from 'zustand'

export type DisplayState = 'capsule'
export type ExpandedActivity = 'home' | 'timer' | 'music' | 'settings' | 'freshFile' | null
export type SystemMode = 'desktop' | 'app' | 'hidden'
export type IslandView =
  | 'idle'
  | 'home'
  | 'expandedTimer'
  | 'expandedMusic'
  | 'expandedFreshFile'
  | 'alert'
  | 'dropTarget'
  | 'settings'
  | 'deviceNotification'
  | 'processAlert'

interface IslandStoreState {
  displayState: DisplayState
  expandedActivity: ExpandedActivity
  homePage: number // 0 = Music, 1 = Clock/Timer, 2 = Shelf
  systemMode: SystemMode
  isDwelling: boolean
  hoveredTarget: 'timer' | 'music' | 'freshFile' | 'process' | null
  isDragOver: boolean
  showCustomInput: boolean
  isTransitioning: boolean

  setDisplayState: (state: DisplayState) => void
  setExpandedActivity: (activity: ExpandedActivity) => void
  setHomePage: (page: number) => void
  setSystemMode: (mode: SystemMode) => void
  setIsDwelling: (dwelling: boolean) => void
  setHoveredTarget: (target: 'timer' | 'music' | 'freshFile' | 'process' | null) => void
  setIsDragOver: (isDragOver: boolean) => void
  setShowCustomInput: (show: boolean) => void
  setIsTransitioning: (isTransitioning: boolean) => void
  collapseAll: () => void
}

export const useIslandStore = create<IslandStoreState>((set) => ({
  displayState: 'capsule',
  expandedActivity: null,
  homePage: 1,
  systemMode: 'desktop',
  isDwelling: false,
  hoveredTarget: null,
  isDragOver: false,
  showCustomInput: false,
  isTransitioning: false,

  setDisplayState: (displayState) => set({ displayState }),
  setExpandedActivity: (expandedActivity) =>
    set(() => ({
      expandedActivity,
      ...(expandedActivity === null ? { homePage: 1, showCustomInput: false } : {}),
    })),
  setHomePage: (homePage) => set({ homePage }),
  setSystemMode: (systemMode) =>
    set(() => ({
      systemMode,
      ...(systemMode === 'desktop' ? { displayState: 'capsule', isDwelling: false } : {}),
    })),
  setIsDwelling: (isDwelling) => set({ isDwelling }),
  setHoveredTarget: (hoveredTarget) => set({ hoveredTarget }),
  setIsDragOver: (isDragOver) => set({ isDragOver }),
  setShowCustomInput: (showCustomInput) => set({ showCustomInput }),
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
  collapseAll: () =>
    set({
      expandedActivity: null,
      homePage: 1,
      showCustomInput: false,
      hoveredTarget: null,
    }),
}))
