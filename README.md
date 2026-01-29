# amlib-export

A minimal macOS command-line tool that exports data from your Apple Music Library.

**How it works:** The tool uses AppleScript to query Music.app for track metadata, then deduplicates and outputs CSV. No Apple ID or network access required.

## Quick Start

Run with no arguments to launch the **interactive TUI**:

```bash
npx github:tzvister/apple-music-extract
```

The TUI guides you through selecting extraction type, options, and output destination.

### Command Line Mode

Pass any argument to use CLI mode directly:

```bash
# Extract artists to stdout
npx github:tzvister/apple-music-extract -- --type artists

# Pipe to file
npx github:tzvister/apple-music-extract -- --type artists > artists.csv

# Write directly to file
npx github:tzvister/apple-music-extract -- --out artists.csv
```

## Requirements

- macOS (uses Music.app)
- Node.js 18 or later

## Local Development

Clone and run without installing globally:

```bash
git clone https://github.com/tzvister/apple-music-extract.git
cd apple-music-extract
npm install

# Run TUI
npm start

# Or directly
node src/amlib-export.js

# CLI mode
node src/amlib-export.js --type artists --sort
```

## Global Installation (optional)

To install globally and use from anywhere:

```bash
npm install -g .
```

Then run:

```bash
amlib-export              # Launch interactive TUI
amlib-export --type artists --sort   # CLI mode
```

## Usage

```
amlib-export [--type TYPE] [OPTIONS]
amlib-export help [TYPE]
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
amlib-export

# Output sorted albums to stdout
amlib-export --type albums --sort

# Pipe to file
amlib-export --type artists > artists.csv

# Write directly to file
amlib-export --type detailed --out library.csv

# Get help for a specific type
amlib-export help playlist-tracks
```

## Output Formats

**Note:** When outputting to stdout, only data is shown (no headers). CSV files include capitalized headers.

### Single-column (artists, albums, tracks, playlists)

Stdout:
```
Taylor Swift
The Beatles
Beyoncé
```

CSV file:
```csv
Artist
Taylor Swift
The Beatles
Beyoncé
```

### Playlist tracks

Stdout:
```
Chill Vibes,Weightless,Marconi Union
Chill Vibes,Sunset Lover,Petit Biscuit
```

CSV file:
```csv
Playlist,Track,Artist
Chill Vibes,Weightless,Marconi Union
Chill Vibes,Sunset Lover,Petit Biscuit
```

### Detailed

Stdout:
```
Bohemian Rhapsody,Queen,Queen,A Night at the Opera
```

CSV file:
```csv
Title,Artist,Album Artist,Album
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
