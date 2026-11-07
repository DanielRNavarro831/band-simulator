# Music

Put the looping background track here as **`bgm-main.mp3`**. The game finds it automatically: there's nothing to configure, and the mute button appears once the file exists.

## Export settings

- MP3, 128–192 kbps, 44.1 kHz. Stereo is fine; mono is half the size.
- 1–3 minutes long (about 1–3 MB).
- Cut it so the end flows straight back into the start, with no fade-out or trailing silence. The game trims the few milliseconds of padding that MP3 encoders add, so the loop is seamless.

## Notes

- Music starts when the player taps **New Band** or **Continue**. Phones block audio until a tap.
- The ♪ button next to the speed controls mutes or unmutes, and the game remembers the choice.
- Music pauses when the app is in the background.
- The repo is public, so only use music you own, licensed, or that's free to use (e.g. CC0).
- To add more tracks later (e.g. `bgm-tour.mp3`), add them to `MUSIC_TRACKS` in `js/audio.js` and call `Music.play('tour')`.
