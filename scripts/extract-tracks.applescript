-- Extract full track data from Music.app library
-- Outputs one track per line with fields separated by |||
-- Format: title|||artist|||album_artist|||album

tell application "Music"
    try
        set trackList to every track of library playlist 1
        set outputList to {}
        repeat with t in trackList
            set trackTitle to name of t
            set trackArtist to artist of t
            set trackAlbumArtist to album artist of t
            set trackAlbum to album of t
            set trackData to trackTitle & "|||" & trackArtist & "|||" & trackAlbumArtist & "|||" & trackAlbum
            set end of outputList to trackData
        end repeat
        set AppleScript's text item delimiters to linefeed
        return outputList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
