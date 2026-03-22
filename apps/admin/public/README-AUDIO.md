# Audio asset

Replace `alarm.mp3` with a **clear, repetitive bell sound** for new order alerts. The file is used when the merchant has pending orders (foreground loop) and in the service worker (background push notification). Keep the filename `alarm.mp3`.

**Path:** Place the file in this directory as `alarm.mp3` (i.e. `public/alarm.mp3`). It is served at `/alarm.mp3`. If the file is missing, the app falls back to a short beep; for continuous ringing, the file must exist.
