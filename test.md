# Manual Test Plan for Audio Mixing

This document outlines the steps to manually verify the audio mixing and soundboard functionality in the packaged TavernTones application.

**Objective:** To ensure that both sound effects and main music tracks play correctly without errors, both individually and simultaneously.

---

### Prerequisites

1.  A packaged (built) version of the TavernTones application.
2.  **`ffmpeg` and `ffprobe` must be installed on your system and accessible via the system's PATH environment variable.**
3.  At least one audio file (e.g., MP3, WAV) available on your computer to use as a main music track.
4.  Ensure your Discord bot is configured and running in a voice channel.

---

### Test Cases

#### Test Case 1: Sound Effect Playback

**Goal:** Verify that the test sound effect button plays a sound without `ENOENT` errors.

1.  Launch the packaged TavernTones application.
2.  Observe the "Log" panel in the bottom-left of the UI.
3.  Click the **sound icon (🔊)** button in the "Soundboard" panel.
4.  **Expected Result:**
    *   You should hear a **clear, undistorted** notification jingle through your Discord bot.
    *   The log panel should show messages like "Playing test sound effect...", "Adding sound effect...", and "Starting ffmpeg mixing process..."
    *   **Crucially, there should be NO `ENOENT` or "file not found" errors related to `ffmpeg.exe` in the log.**

#### Test Case 2: Main Music Playback

**Goal:** Verify that a music track can be loaded and played without "Only one input stream" errors.

1.  Launch the application.
2.  Click the **Select File** button in the "Music" panel.
3.  Choose an audio file from your computer.
4.  The file should appear as "Active" in the music panel.
5.  Click the **Play** button.
6.  **Expected Result:**
    *   The music should begin playing through your Discord bot, and it should sound **clear and undistorted**.
    *   The log panel should show messages related to caching the file and starting playback.
    *   **There should be NO "Only one input stream is supported" or "Invalid output" errors in the log.**

#### Test Case 3: Audio Premixing (Music + Sound Effect)

**Goal:** Verify that a sound effect can be played *while* music is playing, mixing the two streams together.

1.  Follow the steps in **Test Case 2** to start playing a music track.
2.  While the music is playing, click the **sound icon (🔊)** button in the "Soundboard" panel.
3.  **Expected Result:**
    *   The music should continue playing, and its quality should remain clear.
    *   You should hear the notification jingle play *over* the music, and it should also be clear and undistorted.
    *   The music should continue playing after the jingle finishes.
    *   The log panel should show messages about the ffmpeg process restarting to mix the new sound, without any errors.

#### Test Case 4: Playback State Recovery

**Goal:** Verify that the system can recover and play a new song after a previous playback session.

1.  Follow the steps in **Test Case 2** to play a music track.
2.  Click the **Pause** button to stop the music.
3.  Click the **Select File** button again and choose a *different* audio file.
4.  Click the **Play** button.
5.  **Expected Result:**
    *   The *new* music track should begin playing.
    *   There should be no errors in the log. The system should gracefully handle stopping the old track and starting the new one.
