# amlib-export

A minimal macOS command-line tool that exports data from your Apple Music Library.

**How it works:** The tool uses AppleScript to query Music.app for track metadata, then deduplicates and outputs CSV. No Apple ID or network access required.

## Quick Start

If you have Node.js installed, just run:

```bash
npx github:tzvister/apple-music-extract
```

This outputs your unique artists to stdout. Pipe to a file or use `--out`:

```bash
# Pipe to file
npx github:tzvister/apple-music-extract > artists.csv

# Or write directly to file
npx github:tzvister/apple-music-extract -- --out artists.csv
```

## Requirements

- macOS (uses Music.app)
- Node.js 18 or later

## Installation (optional)

To install globally:

```bash
git clone https://github.com/tzvister/apple-music-extract.git
cd apple-music-extract
npm install -g .
```

Then run from anywhere:

```bash
amlib-export-artists --type artists --sort
```

## Usage

```
amlib-export-artists [--type TYPE] [OPTIONS]
amlib-export-artists help [TYPE]
```

By default, output goes to **stdout**. Use `--out` to write to a file.

### Extraction Types

| Type | Description | Output |
|------|-------------|--------|
| `artists` | Unique artist names (default) | Single-column CSV |
| `albums` | Unique album names | Single-column CSV |
| `tracks` | Unique track titles | Single-column CSV |
| `playlists` | Playlist names only | Single-column CSV |
| `playlist-tracks` | Playlists with their tracks | Multi-column CSV |
| `detailed` | Full track metadata | Multi-column CSV |

### Options

```
--type, -t <type>    Extraction type (default: artists)
--out, -o <path>     Write to file instead of stdout
--sort, -s           Sort output alphabetically
--strict             Disable album artist fallback (see below)
--help, -h           Show help message
```

**Advanced options:**

```
--limit, -l <N>      Stop after N items (for debugging large libraries)
--no-trim            Keep leading/trailing whitespace in values
```

### Artist Extraction Behavior

When extracting artists (`--type artists`), the tool automatically uses the **album artist** as a fallback when a track's artist field is empty. This is useful for compilation albums where individual tracks may not have an artist set.

Use `--strict` if you only want the exact track artist field (no fallback).

### Examples

```bash
# Output artists to stdout
amlib-export-artists

# Output sorted albums to stdout
amlib-export-artists --type albums --sort

# Pipe to file
amlib-export-artists --type artists > artists.csv

# Write directly to file
amlib-export-artists --type detailed --out library.csv

# Get help for a specific type
amlib-export-artists help playlist-tracks
```

## Output Formats

### Single-column (artists, albums, tracks, playlists)

```csv
artist
Taylor Swift
The Beatles
Beyoncé
```

### Playlist tracks

```csv
playlist,track,artist
Chill Vibes,Weightless,Marconi Union
Chill Vibes,Sunset Lover,Petit Biscuit
```

### Detailed

```csv
title,artist,album_artist,album
Bohemian Rhapsody,Queen,Queen,A Night at the Opera
```

## Permissions

On first run, macOS will prompt:

> "Terminal would like to control Music"

Click **OK** to allow access.

### If you denied the permission

1. Open **System Settings** → **Privacy & Security** → **Automation**
2. Find your terminal app (Terminal, iTerm, Warp, etc.)
3. Enable the toggle for **Music**
4. Run the command again

## License

MIT
