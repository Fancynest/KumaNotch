import React from 'react'
import { motion } from 'framer-motion'
import { Bluetooth, Headphones, Speaker, Volume2 } from 'lucide-react'
import type { AudioDeviceNotification } from '../../core/audioDevice'
import { getT, type SupportedLang } from '../../core/i18n'

interface DeviceNotificationCardProps {
  notification: AudioDeviceNotification
  language: 'auto' | SupportedLang
  onDismiss?: () => void
}

export const DeviceNotificationCard: React.FC<DeviceNotificationCardProps> = ({
  notification,
  language,
  onDismiss,
}) => {
  const t = getT(language)
  const isConnected = notification.event_type === 'connected'
  const isBluetooth = notification.device_type === 'bluetooth'

  const renderIcon = () => {
    const iconClass = `w-4 h-4 ${
      isConnected
        ? isBluetooth
          ? 'text-sky-400'
          : 'text-emerald-400'
        : 'text-zinc-400'
    }`

    if (isBluetooth) {
      return <Bluetooth className={iconClass} />
    }
    if (notification.device_type === 'headphones') {
      return <Headphones className={iconClass} />
    }
    if (notification.device_type === 'speakers') {
      return <Speaker className={iconClass} />
    }
    return <Volume2 className={iconClass} />
  }

  const statusText = isConnected ? t.deviceConnected : t.deviceDisconnected

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -2 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.7 }}
      onClick={onDismiss}
      className="absolute inset-0 px-3.5 flex items-center justify-between text-white cursor-pointer select-none overflow-hidden"
      title={`${notification.device_name} • ${statusText}`}
    >
      {/* Left Icon with subtle glow */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
            isConnected
              ? isBluetooth
                ? 'bg-sky-950/60 border-sky-400/50 shadow-[0_0_10px_rgba(56,189,248,0.35)]'
                : 'bg-emerald-950/60 border-emerald-400/50 shadow-[0_0_10px_rgba(52,211,153,0.35)]'
              : 'bg-zinc-900 border-zinc-700/60'
          }`}
        >
          {renderIcon()}
        </div>

        {/* Text Details */}
        <div className="flex flex-col min-w-0 pr-1">
          <span className="text-[11px] font-semibold text-white/95 truncate leading-tight tracking-tight">
            {notification.device_name}
          </span>
          <span
            className={`text-[9px] font-medium leading-none tracking-tight ${
              isConnected
                ? isBluetooth
                  ? 'text-sky-400'
                  : 'text-emerald-400'
                : 'text-zinc-400'
            }`}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* Right connected indicator pulse */}
      {isConnected && (
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isBluetooth ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
            }`}
          />
        </div>
      )}
    </motion.div>
  )
}
