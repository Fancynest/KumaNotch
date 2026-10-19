import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Sliders,
  Volume2,
  Play,
} from 'lucide-react'
import { globalSettingsEngine, type AppSettings } from '../../core/settings'
import { getT } from '../../core/i18n'
import { playTimerChime } from '../../core/audio'

interface SettingsViewProps {
  onClose: () => void
}

type SettingsTab = 'general' | 'notch' | 'personality' | 'freshFile'

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(() => globalSettingsEngine.getSettings())
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const scrollRef = useRef<HTMLDivElement>(null)
  const t = getT(settings.language)

  useEffect(() => {
    return globalSettingsEngine.subscribe((newSettings) => {
      setSettings({ ...newSettings })
    })
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [activeTab])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    globalSettingsEngine.update({ [key]: value })
  }

  const handleTestSound = () => {
    playTimerChime((settings.timerChimeVolume || 80) / 100)
  }

  return (
    <div
      role="dialog"
      aria-label={t.settings}
      className="absolute inset-0 p-4 flex flex-col justify-between text-white cursor-default select-none overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header: Title & Close Button */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-amber-400">
            <Sliders className="w-3 h-3" />
          </div>
          <span className="text-xs font-bold tracking-tight text-white">{t.settings}</span>
        </div>

        <button
          onClick={onClose}
          aria-label={t.closeSettings}
          className="text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Full-Width Segmented Tab Bar */}
      <div className="grid grid-cols-4 p-1 my-2 bg-white/[0.06] rounded-xl border border-white/10 text-[11px] font-medium gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('general')}
          className={`py-1 rounded-lg transition-all text-center whitespace-nowrap truncate px-1 ${
            activeTab === 'general'
              ? 'bg-white/20 text-white font-semibold shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          {t.tabGeneral}
        </button>
        <button
          onClick={() => setActiveTab('notch')}
          className={`py-1 rounded-lg transition-all text-center whitespace-nowrap truncate px-1 ${
            activeTab === 'notch'
              ? 'bg-white/20 text-white font-semibold shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          {t.tabNotch}
        </button>
        <button
          onClick={() => setActiveTab('personality')}
          className={`py-1 rounded-lg transition-all text-center whitespace-nowrap truncate px-1 ${
            activeTab === 'personality'
              ? 'bg-white/20 text-white font-semibold shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          {t.tabPersonality}
        </button>
        <button
          onClick={() => setActiveTab('freshFile')}
          className={`py-1 rounded-lg transition-all text-center whitespace-nowrap truncate px-1 ${
            activeTab === 'freshFile'
              ? 'bg-white/20 text-white font-semibold shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          {t.tabFreshFile}
        </button>
      </div>

      {/* Main Tab Content */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 py-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar"
      >
        {/* TAB 1: GENERAL */}
        {activeTab === 'general' && (
          <div className="space-y-3">
            {/* Language Selection */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white block">{t.language}</span>
                <span className="text-[10px] text-white/40 block">EN / ID</span>
              </div>
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-md border border-white/10 text-[10px]">
                <button
                  onClick={() => updateSetting('language', 'auto')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    settings.language === 'auto'
                      ? 'bg-white/25 text-white font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {t.auto}
                </button>
                <button
                  onClick={() => updateSetting('language', 'en')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    settings.language === 'en'
                      ? 'bg-white/25 text-white font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => updateSetting('language', 'id')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    settings.language === 'id'
                      ? 'bg-white/25 text-white font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  ID
                </button>
              </div>
            </div>

            {/* Time Format */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white block">{t.timeFormat}</span>
                <span className="text-[10px] text-white/40 block">12h / 24h</span>
              </div>
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-md border border-white/10 text-[10px]">
                <button
                  onClick={() => updateSetting('timeFormat', 'auto')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    settings.timeFormat === 'auto'
                      ? 'bg-white/25 text-white font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {t.auto}
                </button>
                <button
                  onClick={() => updateSetting('timeFormat', '12h')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    settings.timeFormat === '12h'
                      ? 'bg-white/25 text-white font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  12h
                </button>
                <button
                  onClick={() => updateSetting('timeFormat', '24h')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    settings.timeFormat === '24h'
                      ? 'bg-white/25 text-white font-semibold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  24h
                </button>
              </div>
            </div>

            {/* Start with Windows */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-medium text-white block">{t.autostart}</span>
                <span className="text-[10px] text-white/40 block">
                  {settings.autostart ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autostart}
                onClick={() => updateSetting('autostart', !settings.autostart)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autostart ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autostart ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DROPLET & NOTCH */}
        {activeTab === 'notch' && (
          <div className="space-y-3">
            {/* Auto-Collapse When Open Toggle */}
            <div className="flex items-center justify-between">
              <div className="max-w-[210px]">
                <span className="text-xs font-medium text-white block">{t.autoCollapseExpanded}</span>
                <span className="text-[10px] text-white/40 block leading-tight">{t.autoCollapseExpandedDesc}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoCollapseExpanded}
                onClick={() => updateSetting('autoCollapseExpanded', !settings.autoCollapseExpanded)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autoCollapseExpanded ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoCollapseExpanded ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Auto-Collapse Timeout Slider */}
            {settings.autoCollapseExpanded && (
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/80">{t.autoCollapseTimeout}</span>
                  <span className="font-mono text-amber-400 font-semibold">
                    {settings.autoCollapseSeconds} {t.secondsUnit}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={settings.autoCollapseSeconds}
                  onChange={(e) => updateSetting('autoCollapseSeconds', parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            )}

            <div className="border-t border-white/10 pt-1" />

            {/* Auto-Droplet Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="max-w-[210px]">
                <span className="text-xs font-medium text-white block">{t.autoDroplet}</span>
                <span className="text-[10px] text-white/40 block leading-tight">{t.autoDropletDesc}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoDroplet}
                onClick={() => updateSetting('autoDroplet', !settings.autoDroplet)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autoDroplet ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoDroplet ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Inactivity Timeout Slider */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/80">{t.inactivityTimeout}</span>
                <span className="font-mono text-amber-400 font-semibold">{settings.inactivitySeconds} {t.secondsUnit}</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={settings.inactivitySeconds}
                onChange={(e) => updateSetting('inactivitySeconds', parseInt(e.target.value, 10))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Dwell Timeout Slider */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/80">{t.dwellTimeout}</span>
                <span className="font-mono text-amber-400 font-semibold">{settings.dwellSeconds} {t.secondsUnit}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={settings.dwellSeconds}
                onChange={(e) => updateSetting('dwellSeconds', parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          </div>
        )}

        {/* TAB 3: PERSONALITY & SOUND */}
        {activeTab === 'personality' && (
          <div className="space-y-3">
            {/* Personality Mata Kuma */}
            <div className="flex items-center justify-between">
              <div className="max-w-[210px]">
                <span className="text-xs font-medium text-white block">
                  {t.personality}
                </span>
                <span className="text-[10px] text-white/40 block leading-tight">{t.personalityDesc}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.personalityEnabled}
                onClick={() => updateSetting('personalityEnabled', !settings.personalityEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.personalityEnabled ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.personalityEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Delay before eyes appear */}
            {settings.personalityEnabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/70">{t.delayBeforeEyes}</span>
                  <span className="font-mono text-amber-400 font-semibold">{settings.idleBeforeEyesSeconds} {t.secondsUnit}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={settings.idleBeforeEyesSeconds}
                  onChange={(e) => updateSetting('idleBeforeEyesSeconds', parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            )}

            {/* Timer Chime Toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-white/70" />
                <span className="text-xs font-medium text-white block">{t.timerChime}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.timerChimeEnabled}
                onClick={() => updateSetting('timerChimeEnabled', !settings.timerChimeEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.timerChimeEnabled ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.timerChimeEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Alarm Volume Slider & Test Button */}
            {settings.timerChimeEnabled && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/70">{t.timerVolume}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-semibold">{settings.timerChimeVolume}%</span>
                    <button
                      type="button"
                      onClick={handleTestSound}
                      className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                      title={t.testSound}
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{t.testSound}</span>
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.timerChimeVolume}
                  onChange={(e) => updateSetting('timerChimeVolume', parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FRESH FILE TRAY (FASE 6A) */}
        {activeTab === 'freshFile' && (
          <div className="space-y-3">
            {/* Master Toggle */}
            <div className="flex items-center justify-between">
              <div className="max-w-[210px]">
                <span className="text-xs font-medium text-white block">{t.freshFile}</span>
                <span className="text-[10px] text-white/40 block leading-tight">{t.freshFileDesc}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.freshFileEnabled}
                onClick={() => updateSetting('freshFileEnabled', !settings.freshFileEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.freshFileEnabled ? 'bg-sky-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.freshFileEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {settings.freshFileEnabled && (
              <>
                {/* Watch Screenshots Toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <div>
                    <span className="text-xs font-medium text-white block">{t.watchScreenshots}</span>
                    <span className="text-[10px] text-white/40 block">Pictures\Screenshots</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.freshFileScreenshots}
                    onClick={() => updateSetting('freshFileScreenshots', !settings.freshFileScreenshots)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.freshFileScreenshots ? 'bg-sky-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.freshFileScreenshots ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Watch Downloads Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">{t.watchDownloads}</span>
                    <span className="text-[10px] text-white/40 block">User\Downloads</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.freshFileDownloads}
                    onClick={() => updateSetting('freshFileDownloads', !settings.freshFileDownloads)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.freshFileDownloads ? 'bg-sky-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.freshFileDownloads ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Display Duration Slider */}
                <div className="space-y-1 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/80">{t.displayDuration}</span>
                    <span className="font-mono text-sky-400 font-semibold">{settings.freshFileDurationSeconds} {t.secondsUnit}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="15"
                    step="1"
                    value={settings.freshFileDurationSeconds}
                    onChange={(e) => updateSetting('freshFileDurationSeconds', parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Dismiss on drag */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-medium text-white block">{t.dismissOnDrag}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.freshFileDismissOnDrag}
                    onClick={() => updateSetting('freshFileDismissOnDrag', !settings.freshFileDismissOnDrag)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.freshFileDismissOnDrag ? 'bg-sky-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.freshFileDismissOnDrag ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/40 shrink-0">
        <span>KumaNotch v0.1.0 • Dynamic Island for Windows</span>
        <button
          onClick={onClose}
          className="text-amber-400/80 hover:text-amber-300 font-medium transition-colors"
        >
          {t.closeSettings}
        </button>
      </div>
    </div>
  )
}
