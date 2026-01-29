# Apple Music Library Export

> Free macOS CLI to export your Music.app library — artists, albums, playlists & tracks. No login required.

![Apple Music Library Export](Apple%20Music%20Export.png)

[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

## Why Use This?

- **Free & open source** — No subscription, no limits
- **Works offline** — Queries your local Music.app directly via AppleScript
- **Private** — No Apple ID login, no account creation, no data sent anywhere
- **Flexible output** — Terminal, pipe to file, or write directly to CSV
- **Interactive or scripted** — TUI for beginners, CLI flags for automation

## Use Cases

- **Backup** — Keep a local copy of your artist/playlist data
- **Analysis** — Import into a spreadsheet to explore your library
- **Migration** — Export data before switching services
- **Sharing** — Send your playlist contents to a friend

## Quick Start

Run with no arguments to launch the **interactive TUI**:

```bash
npx -y github:tzvister/apple-music-extract
```

The TUI guides you through selecting extraction type, options, and output destination.

```
  🎵 Apple Music Library Export
  ─────────────────────────────────

? What would you like to export?
❯ Artists - Unique artist names from your library
  Albums - Unique album names
  Tracks - All track titles
  Playlists - Playlist names only
  Playlist Tracks - Playlists with their track listings
  Detailed - Full track metadata (title, artist, album artist, album)
```

When exporting **Playlist Tracks**, you can select specific playlists:

```
✔ Found 12 playlists

? Select playlists to export:
◉ All playlists
◯ Chill Vibes
◉ Workout Mix
◯ Road Trip
◉ Focus Time
```

### Command Line Mode

Pass any argument to use CLI mode directly:

```bash
# Extract artists to stdout
npx -y github:tzvister/apple-music-extract --type artists

# Pipe to file
npx -y github:tzvister/apple-music-extract --type artists > artists.txt

# Write directly to CSV file
npx -y github:tzvister/apple-music-extract --out artists.csv
```

## Requirements

- macOS (uses Music.app)
- Node.js 18 or later

## Local Installation

Clone and run:

```bash
git clone https://github.com/tzvister/apple-music-extract.git
cd apple-music-extract
npm install

# Run TUI
./amlib

# CLI mode
./amlib --type artists
```

## Global Installation (optional)

To install globally and use from anywhere:

```bash
npm install -g .
```

Then run:

```bash
amlib-export              # Launch interactive TUI
amlib-export --type artists          # CLI mode
```

## Usage

```
amlib-export [--type TYPE] [OPTIONS]
amlib-export help [TYPE]
```

By default, output goes to **stdout**. Use `--out` to write to a file.

### Extraction Types

| Type | Description | Output Format |
|------|-------------|---------------|
| `artists` | Unique artist names (default) | Artist |
| `albums` | Unique albums with artist | Artist - Album |
| `tracks` | Unique tracks with artist | Artist - Track |
| `playlists` | Playlist names only | Playlist |
| `playlist-tracks` | Playlists with their tracks | Playlist, Artist, Album, Track |
| `detailed` | Full library listing | Artist, Album, Track |

### Options

```
--type, -t <type>    Extraction type (default: artists)
--out, -o <path>     Write to file instead of stdout
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
amlib-export

# Output albums to stdout
amlib-export --type albums

# Pipe to file
amlib-export --type artists > artists.txt

# Write directly to CSV file
amlib-export --type detailed --out library.csv

# Get help for a specific type
amlib-export help playlist-tracks
```

## Output Formats

**Note:** When outputting to stdout, only data is shown (no headers). Files include capitalized headers.

### Artists

```
Taylor Swift
The Beatles
Beyoncé
```

### Albums (Artist - Album)

```
Queen - A Night at the Opera
The Beatles - Abbey Road
Taylor Swift - 1989
```

### Tracks (Artist - Track)

```
Queen - Bohemian Rhapsody
The Beatles - Hey Jude
Taylor Swift - Shake It Off
```

### Playlist Tracks (Playlist, Artist, Album, Track)

```
Chill Vibes,Marconi Union,Weightless,Weightless
Chill Vibes,Petit Biscuit,Presence,Sunset Lover
```

CSV file:
```csv
Playlist,Artist,Album,Track
Chill Vibes,Marconi Union,Weightless,Weightless
Chill Vibes,Petit Biscuit,Presence,Sunset Lover
```

### Detailed (Artist, Album, Track)

```
Queen,A Night at the Opera,Bohemian Rhapsody
The Beatles,Abbey Road,Come Together
```

CSV file:
```csv
Artist,Album,Track
Queen,A Night at the Opera,Bohemian Rhapsody
The Beatles,Abbey Road,Come Together
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
