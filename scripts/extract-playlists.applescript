-- Extract playlist names from Music.app
-- Outputs one playlist name per line

tell application "Music"
    try
        set playlistList to every user playlist
        set outputList to {}
        repeat with p in playlistList
            set end of outputList to (name of p)
        end repeat
        set AppleScript's text item delimiters to linefeed
        return outputList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
