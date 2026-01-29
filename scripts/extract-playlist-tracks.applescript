-- Extract playlists with their tracks from Music.app
-- Outputs one track per line with fields separated by |||
-- Format: playlist_name|||track_title|||artist|||album

tell application "Music"
    try
        set playlistList to every user playlist
        set outputList to {}
        repeat with p in playlistList
            set playlistName to name of p
            set trackList to every track of p
            repeat with t in trackList
                set trackTitle to name of t
                set trackArtist to artist of t
                set trackAlbum to album of t
                set trackData to playlistName & "|||" & trackTitle & "|||" & trackArtist & "|||" & trackAlbum
                set end of outputList to trackData
            end repeat
        end repeat
        set AppleScript's text item delimiters to linefeed
        return outputList as text
    on error errMsg number errNum
        error errMsg number errNum
    end try
end tell
