/**
 * Creates a normalizer for string values with deduplication support
 * @param {Object} options - Normalizer options
 * @param {boolean} [options.noTrim=false] - Disable whitespace trimming
 * @param {boolean} [options.sort=false] - Sort values alphabetically
 * @returns {Object} Normalizer instance
 */
export function createNormalizer(options = {}) {
  const { noTrim = false, sort = false } = options;
  
  // Map: lowercase key -> first-seen display value
  const seen = new Map();
  
  return {
    /**
     * Add a value to the normalizer
     * @param {string} value - Raw value
     * @returns {boolean} True if this was a new unique value
     */
    add(value) {
      if (!noTrim) {
        value = value.trim();
      }
      
      if (!value) {
        return false;
      }
      
      const key = value.toLocaleLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, value);
        return true;
      }
      
      return false;
    },
    
    /**
     * Get the count of unique values added so far
     * @returns {number} Number of unique values
     */
    get count() {
      return seen.size;
    },
    
    /**
     * Get all unique values
     * @returns {string[]} Array of unique values
     */
    getUniqueValues() {
      let values = [...seen.values()];
      
      if (sort) {
        values.sort((a, b) => a.localeCompare(b));
      }
      
      return values;
    }
  };
}

/**
 * Normalize and deduplicate artists from raw artist strings
 * @param {string[]} rawArtists - Array of raw artist names
 * @param {Object} options - Normalizer options
 * @returns {string[]} Array of unique, normalized artist names
 */
export function normalizeArtists(rawArtists, options = {}) {
  const normalizer = createNormalizer(options);
  
  for (const artist of rawArtists) {
    normalizer.add(artist);
  }
  
  return normalizer.getUniqueValues();
}

/**
 * Normalize and deduplicate albums from track data
 * Format: "Artist - Album" or just "Album" if no artist
 * @param {Object[]} tracks - Array of track objects with album property
 * @param {Object} options - Normalizer options
 * @returns {string[]} Array of unique album entries
 */
export function normalizeAlbums(tracks, options = {}) {
  const normalizer = createNormalizer(options);
  
  for (const track of tracks) {
    if (track.album) {
      // Prefer album artist, fall back to track artist
      const artist = (track.albumArtist || track.artist || '').trim();
      const album = track.album.trim();
      
      if (artist) {
        normalizer.add(`${artist} - ${album}`);
      } else {
        normalizer.add(album);
      }
    }
  }
  
  return normalizer.getUniqueValues();
}

/**
 * Normalize and deduplicate tracks from track data
 * Format: "Artist - Track" or just "Track" if no artist
 * @param {Object[]} tracks - Array of track objects with title property
 * @param {Object} options - Normalizer options
 * @returns {string[]} Array of unique track entries
 */
export function normalizeTracks(tracks, options = {}) {
  const normalizer = createNormalizer(options);
  
  for (const track of tracks) {
    if (track.title) {
      const artist = (track.artist || track.albumArtist || '').trim();
      const title = track.title.trim();
      
      if (artist) {
        normalizer.add(`${artist} - ${title}`);
      } else {
        normalizer.add(title);
      }
    }
  }
  
  return normalizer.getUniqueValues();
}

/**
 * Normalize and deduplicate playlist names
 * @param {string[]} playlists - Array of playlist names
 * @param {Object} options - Normalizer options
 * @returns {string[]} Array of unique playlist names
 */
export function normalizePlaylists(playlists, options = {}) {
  const normalizer = createNormalizer(options);
  
  for (const playlist of playlists) {
    normalizer.add(playlist);
  }
  
  return normalizer.getUniqueValues();
}

/**
 * Extract artists from track data with optional album artist fallback
 * @param {Object[]} tracks - Array of track objects
 * @param {Object} options - Options
 * @param {boolean} [options.fallbackAlbumArtist=false] - Use album artist when artist is empty
 * @param {boolean} [options.noTrim=false] - Disable whitespace trimming
 * @param {boolean} [options.sort=false] - Sort artists alphabetically
 * @returns {string[]} Array of unique artist names
 */
export function normalizeArtistsFromTracks(tracks, options = {}) {
  const { fallbackAlbumArtist = false, noTrim = false, sort = false } = options;
  const normalizer = createNormalizer({ noTrim, sort });
  
  for (const track of tracks) {
    let artist = track.artist;
    
    // Fallback to album artist if enabled and artist is empty
    if (fallbackAlbumArtist && (!artist || !artist.trim())) {
      artist = track.albumArtist;
    }
    
    if (artist) {
      normalizer.add(artist);
    }
  }
  
  return normalizer.getUniqueValues();
}

/**
 * Prepare detailed track data for CSV export
 * Columns: Artist, Album, Track
 * @param {Object[]} tracks - Array of track objects
 * @param {Object} options - Options
 * @param {boolean} [options.sort=false] - Sort by artist, then album, then track
 * @returns {Object[]} Array of track objects ready for CSV
 */
export function prepareDetailedTracks(tracks, options = {}) {
  const { sort = false } = options;
  
  let result = tracks.map(track => ({
    artist: (track.artist || track.albumArtist || '').trim(),
    album: (track.album || '').trim(),
    track: (track.title || '').trim()
  }));
  
  if (sort) {
    result.sort((a, b) => {
      const artistCmp = a.artist.localeCompare(b.artist);
      if (artistCmp !== 0) return artistCmp;
      const albumCmp = a.album.localeCompare(b.album);
      if (albumCmp !== 0) return albumCmp;
      return a.track.localeCompare(b.track);
    });
  }
  
  return result;
}

/**
 * Prepare playlist tracks data for CSV export
 * Columns: Playlist, Artist, Album, Track
 * @param {Object[]} playlistTracks - Array of playlist track objects
 * @param {Object} options - Options
 * @param {boolean} [options.sort=false] - Sort by playlist name, then artist, then track
 * @returns {Object[]} Array of objects ready for CSV
 */
export function preparePlaylistTracks(playlistTracks, options = {}) {
  const { sort = false } = options;
  
  let result = playlistTracks.map(pt => ({
    playlist: (pt.playlist || '').trim(),
    artist: (pt.artist || '').trim(),
    album: (pt.album || '').trim(),
    track: (pt.track || '').trim()
  }));
  
  if (sort) {
    result.sort((a, b) => {
      const playlistCmp = a.playlist.localeCompare(b.playlist);
      if (playlistCmp !== 0) return playlistCmp;
      const artistCmp = a.artist.localeCompare(b.artist);
      if (artistCmp !== 0) return artistCmp;
      return a.track.localeCompare(b.track);
    });
  }
  
  return result;
}
