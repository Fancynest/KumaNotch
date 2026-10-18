export type SupportedLang = 'id' | 'en'

export function detectDeviceLanguage(): SupportedLang {
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('id')) {
      return 'id'
    }
  }
  return 'en'
}

export const translations = {
  id: {
    quickTimer: 'Mulai Timer Cepat',
    focus: 'Fokus',
    custom: 'Custom',
    start: 'Mulai',
    hourUnit: 'j',
    minUnit: 'm',
    secUnit: 'd',
    focusSession: 'Sesi Fokus',
    shortBreak: 'Istirahat Pendek',
    longBreak: 'Istirahat Panjang',
    round: (cycle: number, total = 4) => `Putaran ${cycle} dari ${total}`,
    reset: 'Reset',
    pause: 'Jeda',
    resume: 'Lanjut',
    timeUp: 'Waktu Habis!',
    completedSuffix: 'Selesai!',
    timeForBreak: 'Saatnya istirahat sejenak',
    timeToRefocus: 'Waktunya kembali fokus',
    timerCompleted: 'Timer telah selesai',
    stop: 'Stop',
    startFocusSession: 'Mulai Sesi Fokus',
    startBreak: (mins: string) => `Mulai Istirahat (${mins})`,
    repeatTimer: 'Ulangi Timer',
    fileShelf: 'File Shelf',
    dropFilesHere: 'Lepaskan file di sini',
    emptyShelfDesc: 'Tarik & letakkan file atau folder ke sini',
    showInFolder: 'Tampilkan di Explorer',
    copyPath: 'Salin Path',
    copied: 'Tersalin!',
    openFile: 'Buka',
    missing: 'Hilang',
    clearAll: 'Bersihkan',
    dragOutHint: 'Geser keluar untuk share',
    backToHome: 'Kembali',
  },
  en: {
    quickTimer: 'Quick Timer',
    focus: 'Focus',
    custom: 'Custom',
    start: 'Start',
    hourUnit: 'h',
    minUnit: 'm',
    secUnit: 's',
    focusSession: 'Focus Session',
    shortBreak: 'Short Break',
    longBreak: 'Long Break',
    round: (cycle: number, total = 4) => `Round ${cycle} of ${total}`,
    reset: 'Reset',
    pause: 'Pause',
    resume: 'Resume',
    timeUp: "Time's Up!",
    completedSuffix: 'Completed!',
    timeForBreak: 'Time for a short break',
    timeToRefocus: 'Time to refocus',
    timerCompleted: 'Timer completed',
    stop: 'Stop',
    startFocusSession: 'Start Focus Session',
    startBreak: (mins: string) => `Start Break (${mins})`,
    repeatTimer: 'Repeat Timer',
    fileShelf: 'File Shelf',
    dropFilesHere: 'Drop files here',
    emptyShelfDesc: 'Drag & drop files or folders here',
    showInFolder: 'Show in Explorer',
    copyPath: 'Copy Path',
    copied: 'Copied!',
    openFile: 'Open',
    missing: 'Missing',
    clearAll: 'Clear All',
    dragOutHint: 'Drag out to share',
    backToHome: 'Back',
  },
}

export function getT(lang: SupportedLang = detectDeviceLanguage()) {
  return translations[lang] || translations.en
}
