import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud } from 'lucide-react'
import type { IslandView, SystemMode } from '../../core/islandStore'
import type { TimerData } from '../../core/timer'
import type { MediaData } from '../../core/media'
import type { AudioDeviceNotification } from '../../core/audioDevice'
import type { AppSettings } from '../../core/settings'
import { globalTimerEngine } from '../../core/timer'
import { globalAudioDeviceEngine } from '../../core/audioDevice'
import { ClockCapsule } from './ClockCapsule'
import { HomePager } from './HomePager'
import { TimerCard } from './TimerCard'
import { AlertCard } from './AlertCard'
import { ExpandedMusic } from '../../features/media/ExpandedMusic'
import { DeviceNotificationCard } from './DeviceNotificationCard'
import { SettingsView } from '../../features/settings/SettingsView'
import { useIslandStore } from '../../core/islandStore'

interface IslandContentProps {
  currentView: IslandView
  homePage: number
  setHomePage: (page: number) => void
  dateStr: string
  timeStr: string
  timerData: TimerData | null
  allTimers?: TimerData[]
  remainingSeconds: number
  mediaData: MediaData | null
  isDragOver: boolean
  showCustomInput: boolean
  setShowCustomInput: (show: boolean) => void
  deviceNotification: AudioDeviceNotification | null
  isMagnetSnapped: boolean
  settings: AppSettings
  dropFilesHereText: string
  isTimerActive: boolean
  systemMode: SystemMode
  onClose: () => void
  onOpenSettings: () => void
  onOpenTimer: () => void
  onOpenMusic: () => void
  onOpenFileShelf: () => void
}

const IslandContentComponent: React.FC<IslandContentProps> = ({
  currentView,
  homePage,
  setHomePage,
  dateStr,
  timeStr,
  timerData,
  allTimers,
  remainingSeconds,
  mediaData,
  isDragOver,
  showCustomInput,
  setShowCustomInput,
  deviceNotification,
  isMagnetSnapped,
  settings,
  dropFilesHereText,
  isTimerActive,
  systemMode,
  onClose,
  onOpenSettings,
  onOpenTimer,
  onOpenMusic,
  onOpenFileShelf,
}) => {
  const isTransitioning = useIslandStore((state) => state.isTransitioning)

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={currentView}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98, position: 'absolute' }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="w-full h-full flex flex-col items-center justify-start overflow-hidden relative"
      >
        {currentView === 'home' && (
          <HomePager
            homePage={homePage}
            setHomePage={setHomePage}
            dateStr={dateStr}
            timeStr={timeStr}
            timerData={timerData}
            allTimers={allTimers}
            remainingSeconds={remainingSeconds}
            mediaData={mediaData}
            isDragOver={isDragOver}
            showCustomInput={showCustomInput}
            setShowCustomInput={setShowCustomInput}
            onClose={onClose}
            onOpenSettings={onOpenSettings}
            onOpenTimer={onOpenTimer}
          />
        )}

        {currentView === 'expandedTimer' && timerData && (
          <TimerCard
            timerData={timerData}
            allTimers={allTimers}
            remainingSeconds={remainingSeconds}
            mediaData={mediaData}
            onClose={onClose}
            onOpenMusic={onOpenMusic}
            onOpenFileShelf={onOpenFileShelf}
          />
        )}

        {currentView === 'alert' && (
          <AlertCard
            timerData={timerData}
            onDismiss={() => globalTimerEngine.dismissAlert()}
          />
        )}

        {currentView === 'expandedMusic' && (
          <div
            className="absolute inset-0 px-5 pt-3.5 pb-2.5 flex flex-col justify-between text-white cursor-default overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ExpandedMusic
              onClose={onClose}
              onOpenTimer={onOpenTimer}
              isTimerActive={isTimerActive}
            />
          </div>
        )}

        {currentView === 'deviceNotification' && deviceNotification && (
          <DeviceNotificationCard
            notification={deviceNotification}
            language={settings.language}
            onDismiss={() => globalAudioDeviceEngine.dismiss()}
          />
        )}

        {currentView === 'idle' && (
          <ClockCapsule
            timeStr={timeStr}
            personalityEnabled={settings.personalityEnabled}
            idleBeforeEyesSeconds={settings.idleBeforeEyesSeconds}
            systemMode={systemMode}
            isIdleView={currentView === 'idle'}
            favoriteArtist={settings.favoriteArtist}
            isMusicPlaying={mediaData?.playbackStatus === 'playing'}
            isTimerRunning={isTimerActive}
            isTimerCompleted={timerData?.status === 'completed'}
            deviceConnected={deviceNotification?.event_type === 'connected'}
            isMagnetSnapped={isMagnetSnapped}
            mediaData={mediaData}
            isTransitioning={isTransitioning}
          />
        )}

        {currentView === 'dropTarget' && (
          <motion.div
            whileHover={{ scale: 1.04 }}
            className="absolute inset-0 px-3 flex items-center justify-center gap-2 text-amber-300 overflow-hidden whitespace-nowrap"
          >
            <UploadCloud className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
            <span className="text-xs font-semibold tracking-tight font-medium">
              {dropFilesHereText}
            </span>
          </motion.div>
        )}

        {currentView === 'settings' && (
          <SettingsView onClose={onClose} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export const IslandContent = React.memo(IslandContentComponent)
