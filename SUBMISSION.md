# AuraBeat: Devpost draft

## Tagline

Feel the rhythm. Follow the moment.

## Inspiration

At a concert, the bass hits your chest and the crowd roars before the drop. If you're Deaf or hard of hearing, most of that is gone, and so are the announcements over the PA. We wanted the moment itself to reach people, on the wrist and in the hand, without anyone needing to explain it after.

## What it does

**Live Concert**
- Your watch taps out the music: a short tap for percussion, a deep pulse for bass, a rising ramp for a build, a long burst for the drop.
- Your phone becomes a lightstick that shows the music as vibration. Each beat sends a shockwave through glowing dust, the drop explodes into sparks, and a trace at the bottom draws exactly what your wrist is feeling.
- Every phone in the crowd flashes together.

**Real time, together**
- Every phone counts down to the next drop at the same moment ("Drop in 3, 2, 1"), so Deaf fans get the anticipation a build-up gives everyone else.
- Live song progress and section, a moving energy wave, how many phones are lit, and each phone's sync in milliseconds.
- Tap love, fire or applause and it floats up on every phone in the crowd.

**Live captions**
- What the singer or host says shows up as words on every fan's phone, even over the full-screen lightstick (ElevenLabs Scribe, live).

**Announcements**
- Staff type what's said over the PA. It appears as big text on every phone and buzzes every watch, so Deaf fans hear "encore in 5 minutes" too.

**At-home Concert**
- A recorded performance plays with synced lyrics, haptics and a virtual stage.
- Turn on Play Along and wave your wrist on the glowing beats. A ring fills up to each target, and you see On beat, Close or Missed with real points.
- It's fair: shaking harder earns nothing, one wave can't score twice, and the watch's own buzzing can never earn points.

## How we built it

- **Phone:** React + TypeScript + Tailwind. The lightstick animation is a canvas particle field. Each wave front pushes the dust outward as it passes, and the wrist trace renders each haptic pattern's envelope.
- **Watch:** native Swift on Apple Watch (wave detection tuned on recorded real wrist motion, plus a phone-as-watch simulator for testing) and a Kotlin contract for Wear OS. It plays the haptic patterns and detects wrist waves.
- **Design:** one "stage light" theme across every screen. The home screen is a real-time rendered concert (volumetric beams through haze, a backlit crowd, phone-light bokeh, film grain) that reacts to the live cues.
- **Backend:** Python FastAPI with one WebSocket hub.
  - Cues carry a sequence number and a shared "show at" time. Phones schedule them using a clock offset measured from ping/pong, so phones with different network delays still flash together.
- **Music:**
  - librosa analyzed the real song into 118 beats, 78 bass hits, 156 percussion hits, 3 builds and 2 drops. The backend schedules and plays that timeline.
  - For live venues, a mic listener measures room noise, then detects hits and drops in real time. It tells phones "Audio source unavailable" instead of making things up.
- **Scoring:**
  - The phone's video is the clock.
  - Watch waves are mapped onto it with the watch's own timestamp: ±200 ms is On beat (100), ±350 ms is Close (50).
  - Haptics are held back within ±350 ms of each target, so a still wrist on a buzzing watch scores nothing.
- **Tiger Data:**
  - Every cue, latency sample, wave, score and announcement goes into TimescaleDB hypertables, with a continuous aggregate of haptic activity.
  - Our show dashboard charts it with `time_bucket`: cues per 10 s, song intensity, which moments made people wave, and latency per device.
- **Google Gemini:** listens to the song and describes each section in a few plain words ("huge bass, full band") that appear under the cue on the phone. librosa decides *when*, Gemini describes *what*.
- **Vultr:** one Docker image (app + backend) behind Caddy for automatic HTTPS, so phones join from any network.

## Challenges we ran into

- Campus Wi-Fi blocks devices from talking to each other, so the first live demo ran on a phone hotspot. Deploying with HTTPS removed that dependency.
- Two phones never get a message at the same moment. Scheduling every cue for a shared future time, corrected per phone, made them flash together.
- The watch's own vibration can look like a wave to the motion sensor. A quiet zone around target beats fixed that at the source.
- Live detection is hard. Our mic listener finds drops about 2 s late, so we're upfront about it, and the demo uses the prepared timeline.
- iPhone browsers can't vibrate at all, so on iPhone the watch carries the haptics and the screen carries the light.

## Accomplishments that we're proud of

- The lightstick animation shows vibration you can see, matched to what the wrist feels.
- Scoring that holds up: on-beat vs close timing, one result per target, no reward for shaking or for the watch's own buzz, and fresh attempts after a seek.
- Announcements: a small feature that fixes a real gap at every concert.
- 32 automated tests, plus browser end-to-end runs of Live, At-home and announcements.

## What we learned

<!-- fill in from the team -->

## What's next for AuraBeat

- A user study with Deaf and hard-of-hearing concertgoers to tune the patterns.
- Venue integration: lighting desks sending cues straight to the lightstick.
- Per-person pairing and authentication for real venues.
- More songs: Gemini plus librosa can prepare a timeline from any licensed track.

## Built with

react, typescript, tailwindcss, vite, python, fastapi, websockets, librosa, numpy, swift, watchos, kotlin, wear-os, elevenlabs, tiger-data, timescaledb, postgresql, google-gemini, vultr, docker, caddy

## Credits

"Grateful" by NEFFEX, CC BY 3.0, via Wikimedia Commons.

## Honest scope (keep this in the submission)

AuraBeat is an exploratory accessibility prototype, not a replacement for hearing or for venue accommodations. Prepared song cues were measured offline from the audio, not live AI analysis. User-testing numbers come from a small informal session.
