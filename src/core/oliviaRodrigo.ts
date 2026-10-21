import type { MediaData } from './media'

/**
 * Returns true if the media track's artist, title, or album matches the configured
 * favorite artist or the built-in Olivia Rodrigo Easter egg.
 * Does NOT require playbackStatus to be 'playing', so artist identity is preserved
 * across play, pause, seek, and track transitions.
 */
export function isSupportedArtist(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  if (!media) {
    return false
  }

  const rawTarget = (favoriteArtist || '').trim().toLowerCase()
  const targets = rawTarget
    ? rawTarget
        .split(/[,;\n|]/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0)
    : []

  // Built-in Easter egg: Olivia Rodrigo is always recognized!
  if (!targets.some((t) => t.includes('olivia'))) {
    targets.push('olivia rodrigo', 'olivia')
  }

  const artist = (media.artist || '').trim().toLowerCase()
  const title = (media.title || '').trim().toLowerCase()
  const album = (media.album || '').trim().toLowerCase()

  if (!artist && !title && !album) {
    return false
  }

  return targets.some(
    (t) =>
      t.length > 0 &&
      (artist.includes(t) ||
        (artist.length > 0 && t.includes(artist)) ||
        title.includes(t) ||
        album.includes(t))
  )
}

/**
 * Returns true if the media is currently PLAYING AND matches a supported artist.
 */
export function isSupportedArtistPlaying(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  if (!media || !media.isActive) {
    return false
  }
  const status = (media.playbackStatus || '').toLowerCase()
  if (status !== 'playing') {
    return false
  }
  return isSupportedArtist(media, favoriteArtist)
}

/**
 * Backward-compatible helper for legacy references.
 */
export function isFavoriteArtistMedia(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  return isSupportedArtistPlaying(media, favoriteArtist)
}

/**
 * Backward-compatible helper for legacy references.
 */
export function isOliviaRodrigoMedia(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  return isFavoriteArtistMedia(media, favoriteArtist || 'olivia rodrigo')
}


