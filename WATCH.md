# Watch app: what to connect

For the watch teammates. Wear OS message types are in `backend/shared/Messages.kt`.

**Apple Watch (Vy's app in `watchOS/`)**: a physical watch can't open WebSockets (watchOS blocks them for
apps that aren't streaming audio), so it uses the web app's relay over HTTP long-polling. Point
`RelayConfig.swift` at `http://<laptop-ip>:5173/__aurabeat/relay`. The relay runs in `npm run dev`,
`npm run dev:watch` and `bash start.sh` (vite preview). Live Concert then sends the watch its own
vocabulary (BASS, BUILD, CHORUS, DROP), Stop cancels the watch's haptic at once, and the watch screen
has a haptic test page. In the simulator you can still point it straight at this backend with
`ws://<laptop-ip>:8001/ws?role=watch&session=demo`. The app reads the backend's `cue`, `control` (stop) and
`announcement` messages, and the backend accepts the app's own `movement_detected` wave message. Its waves
count in Play Along. It doesn't send `ping` yet, so the backend can't map its timestamp and scores by arrival
time instead; adding a 2-second ping (see below) makes scoring fairer on slow Wi-Fi.

## Connect

- Hotspot: `ws://<laptop-ip>:8001/ws?role=watch&session=demo`
- Deployed: `wss://<DOMAIN>/ws?role=watch&session=demo`
- Optional: add `&pair=<phone-id>` to tie the watch to one phone's At-home game. The phone ids are listed at `GET /clients`. Without it, waves go to the most recently active At-home phone, which is fine for a one-watch demo.

On hotspot (`ws://`), the manifest needs the `INTERNET` permission and `android:usesCleartextTraffic="true"`. Deployed (`wss://`) needs neither change.

## Send

| When | Message | Why it matters |
|---|---|---|
| Every 2 s | `ping` with `client_time`, `last_rtt_ms`, `clock_offset_ms` | Scoring maps your wave time onto the video clock with this offset. |
| After acting on a cue | `ack` with `cue_id`, `received_at` | Latency numbers on the dashboard (Tiger Data). |
| A wrist wave | `movement` with `confidence` and **`client_time`**, the watch time when the wave happened | Waves are scored on this timestamp, not on arrival. Without it, Wi-Fi delay costs points. |

Read `System.currentTimeMillis()` the moment the wave is detected, then send.

## Handle

| Message | Do |
|---|---|
| `cue` | Vibrate with `pattern` (`tap`, `double_tap`, `pulse`, `long`, `ramp`) at `intensity` (0–1, maps to amplitude 1–255). Kinds include `build`, `chorus` and `drop`. |
| `control` `stop` / `haptics_off` | Cancel the current vibration and clear the queue right away. |
| `announcement` | Buzz a distinct pattern (stronger if `urgent`) and show the `text`. This is for PA announcements. |
| `welcome`, `status`, `presence`, `pong` | Use `pong` for the clock offset. Ignore the rest. |

## Fairness (spec: "a still wrist receiving vibrations must not earn points")

- The backend doesn't send haptic cues within ±350 ms of a target beat, so the motor is quiet at scoring moments.
- On the watch, also ignore motion for about 250 ms after any vibration you play.
- Send one `movement` per wave. The backend enforces a 700 ms cooldown anyway.
- `confidence` below 0.5 never scores. Send your detector's real confidence.

## Test it without the phone

```bash
python backend/scripts/fake_music.py --pattern bass     # cues to your watch
curl -X POST localhost:8001/sessions/demo/announce -H 'content-type: application/json' \
  -d '{"text":"Encore in 5 minutes","urgent":false}'
```

Check `http://localhost:8001/clients`: your watch should be listed with its round-trip time.
