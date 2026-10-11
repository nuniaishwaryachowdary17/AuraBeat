# Testing status

Every acceptance test from the project spec (section 17), with what's been verified and how. "Automated" means it runs in `pytest` (`cd backend && pytest -q`, 32 tests). "Browser" means it ran end to end in a real Chromium against the real backend with a simulated watch. Real phones and the real watch still need a run. Those boxes are for you to tick.

| Test (spec) | Status | How it was checked / how to check |
|---|---|---|
| **Lightstick-only:** Live mode without a watch | Browser ✓ · phone ☐ | Live mode ran the real song with no watch connected. On a phone, open Live, Start, then Play song. |
| **Independent controls:** haptics off ≠ lightstick off | By design · phone ☐ | Separate toggles in Live settings. Turn Haptics off and check the light still moves. |
| **Haptics Off:** current vibration stops, queue can't restart it | Watch ☐ | Watch app's job (`WATCH.md`). The backend `control` `haptics_off` reaches every device. |
| **Local Stop works offline** | Phone ✓ (local) · watch ☐ | The phone's Stop is local. Watch Stop must not need the network. |
| **Shared lightstick:** two phones coordinated | Automated ✓ · 2 phones ☐ | Cues carry `seq` and `display_at`, and phones schedule on their measured clock offset (test `cues_carry_sequence_and_display_time`). Put two phones side by side and run `play_song.py --from 60`: the drop should burst together. |
| **Live audio:** changes trigger patterns, silence doesn't buzz | Automated ✓ · venue ☐ | 20 s of simulated room noise produced 0 cues. On the real song it found 1.5 hits/s and both drops about 2 s late, with 1 false drop. A dead mic shows "Audio source unavailable" (test `silent_mic_is_reported_unavailable`). |
| **Recorded timing:** lyrics/haptics follow playback | Browser ✓ | The video clock drives lyrics and haptics. The phone reports position every second and the backend scores against it. |
| **Pause/buffer:** no misses, no haptics while stopped | Automated ✓ | `pause_stops_missed_and_seek_resets_attempt`. Buffering is reported as its own state and counts as not playing. |
| **Seek/restart:** old cues and results invalidated | Automated ✓ · browser ✓ | A version bump or a jump over 1.5 s starts a fresh attempt with a new id. |
| **Movement interference:** still wrist + vibration earns nothing | Automated ✓ · browser ✓ · watch ☐ | Quiet zone: haptics are held back ±350 ms around targets (7–12 held per run in the browser test). The watch should also ignore motion for 250 ms after its own vibration. |
| **Score dedup:** one wave can't score twice | Automated ✓ | 700 ms cooldown, and each target is judged once (`full_attempt_scoring_dedupe_missed_and_results`). |
| **No-game experience:** useful with Play Along off | Automated ✓ | Play Along off means waves are never scored. The video, lyrics and haptics carry on. |
| **Disconnection:** clear state, no catch-up buzzing | Code ✓ · phone ☐ | Pending cues are cleared on disconnect, and the lightstick shows "Not connected. This light isn't in sync". Turn Wi-Fi off mid-song to check. |
| **Authorization:** one user can't control another's attempt | Partly | Scores and attempts are private to the phone that owns them (test `scores_are_private_to_the_attempt_owner`). There's no login: anyone who can reach the server can send cues or announcements. That's acceptable for a demo, but don't run it on a public network as-is. |
| **TV mirroring** | Not done | Stretch goal in the spec. |
| **Repeated demo:** 3 full runs with no code edits | ☐ | Do this Sunday 7 AM. |

## End-to-end runs already done (browser + simulated watch)

- **Live:** the real "Grateful" timeline from 0:58. The phone showed BUILD, DROP and CHORUS on time. The watch received 86 cues. The picture was about 0.1 s behind the cue in screen capture.
- **At-home:** real video, jump to 1:13. The simulated watch waved on 3 targets and skipped the 4th.
  - The backend scored 300 (3 × On beat) and marked the 4th Missed.
  - The ring and score updated on the phone.
  - The quiet zone held back watch haptics near targets.
- **Announcements:** normal and urgent, shown over the full-screen lightstick. Late joiners get the latest one.
- **Single-address deploy:** the backend served the built app, and the app connected same-origin.

## User testing (spec: 5–10 willing adults)

Teach the patterns first. Let people stop any time. Keep game scores separate from pattern-recognition results.

| # | Hearing (self-described, optional) | Recognized bass / build / drop (of 3) | Comfort 1–5 | Play Along score | Notes |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

Describe the results as a small informal study, not broad accessibility validation.
