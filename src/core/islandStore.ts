import { create } from 'zustand'

export type DisplayState = 'capsule'
export type ExpandedActivity = 'home' | 'timer' | 'music' | 'settings' | null
export type SystemMode = 'desktop' | 'app' | 'fullscreen' | 'hidden'
export type IslandView =
  | 'idle'
  | 'home'
  | 'expandedTimer'
  | 'expandedMusic'
  | 'alert'
  | 'dropTarget'
  | 'settings'
  | 'deviceNotification'

interface IslandStoreState {
  displayState: DisplayState
  expandedActivity: ExpandedActivity
  homePage: number // 0 = Music, 1 = Clock/Timer, 2 = Shelf
  systemMode: SystemMode
  isFullscreen: boolean
  isDwelling: boolean
  hoveredTarget: 'timer' | 'music' | null
  isDragOver: boolean
  showCustomInput: boolean
  isTransitioning: boolean

  setDisplayState: (state: DisplayState) => void
  setExpandedActivity: (activity: ExpandedActivity) => void
  setHomePage: (page: number) => void
  setSystemMode: (mode: SystemMode) => void
  setIsFullscreen: (isFullscreen: boolean) => void
  setIsDwelling: (dwelling: boolean) => void
  setHoveredTarget: (target: 'timer' | 'music' | null) => void
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
  isFullscreen: false,
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
      isFullscreen: systemMode === 'fullscreen',
    })),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
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
