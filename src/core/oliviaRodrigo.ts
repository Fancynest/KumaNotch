import type { MediaData } from './media'

/**
 * Known signature tracks by Olivia Rodrigo from SOUR, GUTS, and soundtracks.
 */
const OLIVIA_TRACKS = [
  'vampire',
  'drivers license',
  'driver license',
  'deja vu',
  'good 4 u',
  'bad idea right',
  'get him back',
  'traitor',
  'all-american bitch',
  'all american bitch',
  'ballad of a homeschool girl',
  'making the bed',
  'logical',
  'love is embarrassing',
  'the grudge',
  'pretty isnt pretty',
  "pretty isn't pretty",
  'teenage dream',
  'obsessed',
  'so american',
  'stranger',
  'scared of my guitar',
  'girl ive always been',
  "girl i've always been",
  'brutal',
  '1 step forward',
  'happier',
  'jealousy, jealousy',
  'jealousy jealousy',
  'favorite crime',
  'hope ur ok',
  'cant catch me now',
  "can't catch me now",
]

/**
 * Known albums by Olivia Rodrigo.
 */
const OLIVIA_ALBUMS = [
  'sour',
  'guts',
  'guts (spilled)',
  'the hunger games: the ballad of songbirds & snakes',
]

/**
 * Returns true if the currently active media track or video is by or features Olivia Rodrigo.
 * Inspects artist, title, and album metadata from Windows SMTC (Spotify, YouTube, browser, etc.).
 */
export function isOliviaRodrigoMedia(media: MediaData | null | undefined): boolean {
  if (!media || !media.isActive || media.playbackStatus !== 'playing') {
    return false
  }

  const artist = (media.artist || '').toLowerCase().trim()
  const title = (media.title || '').toLowerCase().trim()
  const album = (media.album || '').toLowerCase().trim()
  const combined = `${artist} ${title} ${album}`

  // 1. Direct name match in artist, title, or album (covers YouTube video titles like "Olivia Rodrigo - vampire")
  if (
    combined.includes('olivia rodrigo') ||
    combined.includes('olivia-rodrigo') ||
    combined.includes('oliviarodrigo')
  ) {
    return true
  }

  // 2. Artist contains Olivia
  if (artist.includes('olivia') && (artist.includes('rodrigo') || OLIVIA_TRACKS.some((t) => title.includes(t)))) {
    return true
  }

  // 3. Iconic track match with Olivia reference or unique pop hit title
  for (const track of OLIVIA_TRACKS) {
    if (title.includes(track)) {
      if (artist.includes('olivia') || combined.includes('rodrigo')) {
        return true
      }
      // Top signature songs that are uniquely associated with Olivia Rodrigo
      if (
        [
          'vampire',
          'drivers license',
          'good 4 u',
          'bad idea right',
          'get him back',
          'all-american bitch',
          'deja vu',
        ].includes(track)
      ) {
        return true
      }
    }
  }

  // 4. Album match
  for (const alb of OLIVIA_ALBUMS) {
    if (album === alb || album.startsWith(alb)) {
      if (artist.includes('olivia') || title.length > 0) {
        return true
      }
    }
  }

  return false
}
