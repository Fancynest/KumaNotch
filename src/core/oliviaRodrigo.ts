import type { MediaData } from './media'

/**
 * Returns true if the currently active media track is by the user's configured favorite artist.
 * Matches ARTIST name only. Track titles and album names are strictly ignored.
 * If favoriteArtist is empty or unset, returns false.
 */
export function isFavoriteArtistMedia(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  if (!media || !media.isActive || media.playbackStatus !== 'playing') {
    return false
  }

  const rawTarget = (favoriteArtist || '').trim().toLowerCase()
  if (!rawTarget) {
    return false
  }

  // Support comma/semicolon-separated artists (e.g. "Olivia Rodrigo, Taylor Swift")
  const targets = rawTarget
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (targets.length === 0) return false

  const artist = (media.artist || '').trim().toLowerCase()
  const title = (media.title || '').trim().toLowerCase()
  const album = (media.album || '').trim().toLowerCase()

  return targets.some((t) => artist.includes(t) || title.includes(t) || album.includes(t))
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
