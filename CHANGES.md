# What changed in this version (merged build)

This build combines AuraBeat-final with the team's latest repo (`aurabeat_2`), in the team repo's layout:
one folder (`aurabeat/frontend`) with the app at the top and `backend/`, `watchOS/`, `tools/`, `captions/`
inside it. Server deploy files moved to `deploy/`. The old root README.md was the same 93 lines repeated
~600 times (3.9 MB), so the team's README.md is used instead.

## From the team repo: Apple Watch on a real wrist

- The watch talks to the web app's relay over HTTP long-polling (`/__aurabeat/relay/poll` and `/send`),
  because watchOS blocks WebSockets on a physical watch. The simulator can still use WebSockets.
- Live Demo sends the watch its own haptic vocabulary (BASS, BUILD, CHORUS, DROP) instead of the
  At-home GET READY / WAVE prompts. Lighting-only cues (`pattern: "none"`) never vibrate.
- The backend's musical-onset `haptic` messages (from `/sessions/{session}/haptic`) now vibrate phones
  and reach the watch. Before, phones ignored them.
- Stop cancels the haptic the watch is playing, right away.
- Watch fixes: epoch-ms timestamps no longer overflow on arm64_32 (that crashed real watches), the
  wave detector's bounce gate is 1.0 g (measured on a real wrist), and a haptic test page on the watch.
- The DEV panel won't let the mock watch replace a real connected watch.

## From the team repo: Nova, the voice host

- **✦ Talk to Nova** in Watch at Home (ElevenLabs voice agent over WebRTC, loaded only when needed).
  It floats in the bottom-right corner so it's always visible (the team repo had it below the player).
- Four client tools, presentation only: `setConcertEnergy`, `triggerAuraMoment`,
  `setSensoryPreference`, `getConcertStatus`. The edge lighting follows Nova's energy too.

## New: Nova connects herself

- Before, the agent had to be built by hand in the ElevenLabs dashboard and its ID was hard-coded,
  so Nova only worked with one teammate's account. Now, with an ElevenLabs key, AuraBeat finds or
  creates the agent in that key's workspace (prompt, first message, the four tools, authentication),
  saves its ID in `.nova-agent.json`, and keeps it in sync with `nova/agent.mjs`.
- If the agent is deleted in the dashboard, the next "Talk to Nova" creates a new one automatically.
- `NOVA_AGENT_ID` still pins a specific agent (never modified). `NOVA_VOICE_ID` picks the voice.
- `npm run nova:setup` does the setup ahead of time and checks a conversation token end to end.
- `GET /__aurabeat/nova/status` reports whether Nova is configured and connected.

## Merge fixes

- Animations could freeze for good: Reduce Motion was saved the first time the app opened (from the
  Mac's setting) and never let go, and some animations also obeyed only the Mac setting. Now motion
  follows the device until you choose in the app, and the new **Motion on/off** button on Home (or
  Your senses → Reduce motion) turns every animation back on. Settings are shared live across screens.
- Waves from a physical watch were thrown away whenever the backend was running. Watch at Home
  assumed the backend would score them, but a physical watch goes through the relay, so the backend
  never saw them. Relay waves are now judged by the app, and the watch gets its celebration buzz back.
- With several phones open, each one forwarded the same Live cue, so the watch buzzed once per phone.
  The relay now merges the same buzz arriving from different pages within 150 ms.
- The web app only joined the watch relay in `npm run dev`. It now joins under `vite preview` too
  (start.sh's demo mode).
- Live Demo's "Watches" counter now includes a physical watch on the relay (it showed 0).
- The watch app opens on the AuraBeat screen; the diagnostic page (haptic test, network probes, wave
  recorder) is one swipe down instead of being first.
- The watch relay and Nova now also run under `vite preview`, so `bash start.sh` (demo mode) supports
  a physical watch and Nova. Before, both only existed in `npm run dev`.
- `.env.example` points at `/media/grateful.webm` (the team repo still used the old filename).
- `start.sh` says the key is for captions and Nova.

---

# What changed in this version

## Song and timing

- Only one recording is used: NEFFEX "Grateful" (`public/media/grateful.webm`). Live Demo
  plays `backend/media/grateful.mp3`, re-extracted from that same video. The measured offset between
  them is 0.0 ms.
- The synthesized fallback beat is gone from Watch at Home. If the video is missing, the screen says so
  and plays nothing.
- The cue timeline was rechecked against the recording:
  - 79 beats were moved onto the actual kick onsets (median shift 30 ms, maximum 66 ms).
  - Bass and percussion cues all land within 50 ms of an onset in the audio.
  - Two build-ups that sat in quiet passages (40.0 s and 127.0 s) were removed.
  - A build-up was added at 140.79 s, where the second pre-hook really starts (+19% loudness).
  - Drops sit on the measured loudness jumps: 76.83 s (×1.43) and 153.63 s (×1.47).
- The section map was rebuilt from bar-by-bar loudness: Intro 0, Verse 11.2, Breakdown 51.2,
  Pre-Hook 64.0, Hook 76.8, Verse 2 102.4, Breakdown 2 128.0, Pre-Hook 2 140.8, Final Hook 153.6.
- The chorus 3.2 s after each drop no longer gets its own countdown on top of the drop.

## Navigation

- The home page has exactly two choices: **Live Demo** and **Watch at Home**. The duplicate entries
  are gone. The logo icon is removed. The same names are used on every screen and in the docs.

## Look and motion (violet, mint, pink)

- Home: a floating ribbon sculpture of light. Each card has its own animated preview: a venue running a
  build and drop for Live Demo, a lit screen with lyrics and progress for Watch at Home.
- Live Demo: a living aura that follows the show's cues. Beats make mint ripples and bass makes violet
  rings. A build-up gathers particles toward the centre, and a drop blooms and then settles. Wrist
  movement leaves light trails, and reactions drift in as motes that merge into the aura. When there are
  no cues it breathes slowly.
- Watch at Home: edge lighting around the video, driven by the video's own clock. It rests when the
  video is paused.
- The drop takeover is a colour bloom with shockwaves, with no white flash. It only plays during live
  mode.
- Animations are paused off-screen and shown as still frames with Reduce Motion. They draw at lower
  resolution on phones.

## Behaviour fixes

- **Stop** now clears the drop takeover, the screen shake, pending effects and haptics immediately. A
  drop that arrives while live mode is off no longer takes over the screen.
- Phones find the backend at the same host on port 8001 from Vite ports 5173 to 5175. Nothing is
  hard-coded.
- The phone's Back gesture returns to Home instead of leaving the app. Each screen has its own address
  (`#live`, `#watch`), so a reload stays on that screen.
- A 4 px horizontal scroll on phones in Watch at Home is fixed.
- The cue-activity graph is labelled as cue activity, not microphone audio.

## Live speech captions (from Vy's captions tool)

- Built into the main backend (port 8001) and the Live Demo screen, so no extra server is needed.
- The ElevenLabs key stays in the backend's memory. The browser gets a single-use token from
  `POST /captions/token`, which only answers the laptop itself, is rate-limited to one request every
  5 seconds and never returns the key.
- The laptop transcribes once and the backend sends the words to every phone through the existing
  caption messages.
- The panel has a consent checkbox, Start and Stop (Stop releases the microphone), and clear states for
  no key, no microphone permission, connection lost and service errors. Captions also stop after
  30 minutes or when the tab is hidden.
- Phones explain that captions are started on the laptop, because browsers only allow the microphone
  on secure pages.
- The standalone tool is kept in `captions/` with its filenames matched (`captions.html`).

## Packaging

- `start.sh` (setup, backend and app), `play.sh` (song sender) and `stop.sh`.
- START_HERE.md has the three-terminal commands, first-time setup, phone access and port troubleshooting.

---

# Checked before shipping

Done in a test environment (Linux, headless Chromium at phone 390×844 and desktop 1280×900 sizes):

- Production build passes with no TypeScript errors or warnings. Backend: **43 tests pass**, including
  the new captions token tests: no key returns 503, a phone gets 403, the key is never returned, a LAN
  origin is refused, the rate limit returns 429 and a bad key returns 502.
- Both navigation paths work on both sizes, including browser Back, Forward and reload. Keyboard focus reaches the cards with a visible mint
  outline. There is no horizontal overflow on any screen, and there are no console errors or failed
  requests on desktop.
- Watch at Home loads the real video (182.441 s). Seeking to 80 s shows HOOK and seeking to 145 s
  shows PRE-HOOK 2. The edge light pulses while the video plays and rests when it's paused.
- Live Demo, using the song sender from 136 s:
  - The phone receives the build at 140.79, the countdown 5…1 and the drop at 153.63.
  - The drop takeover appears and is gone 120 ms after Stop, with no shake left running.
  - A drop sent with live mode off shows nothing.
- Captions:
  - Without a key, Start is disabled and the panel explains how to add one.
  - Start stays disabled until the consent box is ticked.
  - With an invalid key the panel shows "Could not get a transcription token…" and no error is thrown.

# Not verified here (needs your devices)

- Real iPhone and Android behaviour: vibration, screen wake lock, Safari quirks. The phone-sized tests
  ran in Chromium and reached the backend through a test proxy.
- Real captions with a valid ElevenLabs key and credits. The test environment can't reach ElevenLabs,
  so only the error paths were exercised.
- Speaker latency. The cues match the audio file; a Bluetooth speaker adds delay, which
  `bash play.sh --nudge 100` corrects.
- The Apple Watch app (needs Xcode and a watch).
- Timing was measured with onset and loudness analysis. The sections are musical judgments ("build",
  "chorus") made from those numbers; they weren't checked against an official stem or score.
