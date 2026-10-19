import React from 'react'
import { motion } from 'framer-motion'
import { Bluetooth, Headphones, Keyboard, Mouse, Smartphone, Speaker, Volume2 } from 'lucide-react'
import type { AudioDeviceNotification, DeviceCategory } from '../../core/audioDevice'
import { getT, type SupportedLang } from '../../core/i18n'
import { MataKuma } from './MataKuma'

interface DeviceNotificationCardProps {
  notification: AudioDeviceNotification
  language: 'auto' | SupportedLang
  onDismiss?: () => void
}

/**
 * Custom ultra-crisp vector icon for True Wireless Stereo (TWS) Earbuds.
 * Visualizes dual in-ear earbuds with stem and tip.
 */
const EarbudsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Left Earbud */}
    <rect x="5.5" y="11" width="2" height="7.5" rx="1" />
    <path d="M6.5 4C4.8 4 3.5 5.3 3.5 7C3.5 8.7 4.8 10 6.5 10H8V7C8 5.3 7.3 4 6.5 4Z" />
    <circle cx="5" cy="7" r="1.1" fill="currentColor" fillOpacity="0.35" />
    {/* Right Earbud */}
    <rect x="16.5" y="11" width="2" height="7.5" rx="1" />
    <path d="M17.5 4C19.2 4 20.5 5.3 20.5 7C20.5 8.7 19.2 10 17.5 10H16V7C16 5.3 16.7 4 17.5 4Z" />
    <circle cx="19" cy="7" r="1.1" fill="currentColor" fillOpacity="0.35" />
  </svg>
)

export const DeviceNotificationCard: React.FC<DeviceNotificationCardProps> = ({
  notification,
  language,
  onDismiss,
}) => {
  const t = getT(language)
  const isConnected = notification.event_type === 'connected'
  const isBluetooth = Boolean(notification.is_bluetooth || notification.device_type === 'bluetooth')
  const devType: DeviceCategory = notification.device_type

  const renderIcon = () => {
    const iconClass = `w-4 h-4 ${
      isConnected
        ? isBluetooth
          ? 'text-sky-400'
          : 'text-emerald-400'
        : 'text-zinc-400'
    }`

    switch (devType) {
      case 'tws':
        return <EarbudsIcon className={iconClass} />
      case 'headphones':
        return <Headphones className={iconClass} />
      case 'speaker':
      case 'speakers':
        return <Speaker className={iconClass} />
      case 'keyboard':
        return <Keyboard className={iconClass} />
      case 'mouse':
        return <Mouse className={iconClass} />
      case 'phone':
        return <Smartphone className={iconClass} />
      case 'bluetooth':
        return <Bluetooth className={iconClass} />
      case 'audio':
      default:
        return <Volume2 className={iconClass} />
    }
  }

  const getCategoryLabel = () => {
    switch (devType) {
      case 'tws':
        return t.tws
      case 'headphones':
        return t.headphones
      case 'speaker':
      case 'speakers':
        return t.speakers
      case 'keyboard':
        return t.keyboard
      case 'mouse':
        return t.mouse
      case 'phone':
        return t.phone
      case 'bluetooth':
        return t.bluetoothDevice
      case 'audio':
      default:
        return isBluetooth ? t.bluetoothDevice : t.audioDevice
    }
  }

  const statusAction = isConnected ? t.deviceConnected : t.deviceDisconnected
  const categoryLabel = getCategoryLabel()
  const subtitle = `${categoryLabel} • ${statusAction}`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -2 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.7 }}
      onClick={onDismiss}
      className="absolute inset-0 px-3.5 flex items-center justify-between text-white cursor-pointer select-none overflow-hidden"
      title={`${notification.device_name} • ${subtitle}`}
    >
      {/* Left Icon with subtle glow and type badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative">
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
          {/* Subtle Bluetooth badge for recognized BT devices */}
          {isBluetooth && devType !== 'bluetooth' && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-black/90 border border-sky-400/80 flex items-center justify-center">
              <Bluetooth className="w-2 h-2 text-sky-400" />
            </div>
          )}
        </div>

        {/* Text Details */}
        <div className="flex flex-col min-w-0 pr-1">
          <span className="text-[11px] font-semibold text-white/95 truncate leading-tight tracking-tight">
            {notification.device_name}
          </span>
          <span
            className={`text-[9px] font-medium leading-none tracking-tight mt-0.5 ${
              isConnected
                ? isBluetooth
                  ? 'text-sky-400'
                  : 'text-emerald-400'
                : 'text-zinc-400'
            }`}
          >
            {subtitle}
          </span>
        </div>
      </div>

      {/* Right: Mata Kuma surprised reaction & connection pulse */}
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <MataKuma
          emotion={isConnected ? 'surprised' : 'content'}
          isVisible
        />
        {isConnected && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isBluetooth ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8] animate-pulse' : 'bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse'
            }`}
          />
        )}
      </div>
    </motion.div>
  )
}
