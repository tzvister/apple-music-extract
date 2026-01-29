# amlib-export-artists

A minimal macOS command-line tool that exports unique artist names from your Apple Music Library to a CSV file.

## Quick Start

### Option 1: Run with npx (easiest)

If you have Node.js installed, just run:

```bash
npx github:tzvister/apple-music-extract
```

This downloads and runs the tool in one command. Add `--sort` to sort alphabetically:

```bash
npx github:tzvister/apple-music-extract -- --sort --out ~/Desktop/artists.csv
```

### Option 2: Download and run single file

1. Download `amlib-export-artists.js` from this repo
2. Run it with Node.js:

```bash
node amlib-export-artists.js
```

That's it! The file is completely self-contained with no dependencies.

## Requirements

- macOS (uses Music.app)
- Node.js 18 or later

## Usage

```
node amlib-export-artists.js [OPTIONS]

OPTIONS:
  --out, -o <path>    Output CSV file path (default: artists.csv)
  --sort, -s          Sort artists alphabetically
  --help, -h          Show help message
```

### Examples

```bash
# Export to artists.csv in current directory
node amlib-export-artists.js

# Export sorted to Desktop
node amlib-export-artists.js --out ~/Desktop/my-artists.csv --sort
```

## Output Format

The output is a CSV file with UTF-8 encoding:

```csv
artist
Taylor Swift
The Beatles
Beyoncé
```

- One artist per row
- Deduplicated (case-insensitive)
- Special characters properly escaped

## Permissions

On first run, macOS will prompt:

> "Terminal would like to control Music"

Click **OK** to allow access.

### If you denied the permission

1. Open **System Settings** → **Privacy & Security** → **Automation**
2. Find your terminal app (Terminal, iTerm, Warp, etc.)
3. Enable the toggle for **Music**
4. Run the command again

## How It Works

The tool uses AppleScript to ask Music.app for the artist name of every track in your library, then deduplicates and exports to CSV. No Apple ID or network access required.

## License

MIT
