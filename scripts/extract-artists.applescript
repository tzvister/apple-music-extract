-- Extract artist names from Music.app library
-- Outputs one artist name per line to stdout
-- Uses library playlist 1 to avoid localized playlist name issues

tell application "Music"
    try
        set trackList to every track of library playlist 1
        set artistList to {}
        repeat with t in trackList
            set end of artistList to (artist of t)
        end repeat
        -- Join with newlines and return (outputs to stdout)
        set AppleScript's text item delimiters to linefeed
        return artistList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
