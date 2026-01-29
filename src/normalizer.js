/**
 * Creates a normalizer for artist names with deduplication support
 * @param {Object} options - Normalizer options
 * @param {boolean} [options.noTrim=false] - Disable whitespace trimming
 * @param {boolean} [options.sort=false] - Sort artists alphabetically
 * @returns {Object} Normalizer instance with add() and getUniqueArtists() methods
 */
export function createNormalizer(options = {}) {
  const { noTrim = false, sort = false } = options;
  
  // Map: lowercase key -> first-seen display value
  const seen = new Map();
  
  return {
    /**
     * Add an artist to the normalizer
     * @param {string} artist - Raw artist name
     * @returns {boolean} True if this was a new unique artist
     */
    add(artist) {
      // Apply trimming unless disabled
      if (!noTrim) {
        artist = artist.trim();
      }
      
      // Skip empty values
      if (!artist) {
        return false;
      }
      
      // Case-insensitive deduplication key
      const key = artist.toLocaleLowerCase();
      
      // Keep first-seen display value
      if (!seen.has(key)) {
        seen.set(key, artist);
        return true;
      }
      
      return false;
    },
    
    /**
     * Get the count of unique artists added so far
     * @returns {number} Number of unique artists
     */
    get count() {
      return seen.size;
    },
    
    /**
     * Get all unique artists
     * @returns {string[]} Array of unique artist names
     */
    getUniqueArtists() {
      let artists = [...seen.values()];
      
      if (sort) {
        // Locale-aware alphabetical sort
        artists.sort((a, b) => a.localeCompare(b));
      }
      
      return artists;
    }
  };
}

/**
 * Process an array of artist names through the normalizer
 * @param {string[]} rawArtists - Array of raw artist names
 * @param {Object} options - Normalizer options
 * @returns {string[]} Array of unique, normalized artist names
 */
export function normalizeArtists(rawArtists, options = {}) {
  const normalizer = createNormalizer(options);
  
  for (const artist of rawArtists) {
    normalizer.add(artist);
  }
  
  return normalizer.getUniqueArtists();
}
