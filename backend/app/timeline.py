"""Plays a prepared song timeline (timelines/<name>.json) to every device in a session.

The timeline comes from scripts/analyze_song.py: real beats, bass hits, builds and drops measured
from the actual audio. The server schedules each cue itself, so timing doesn't depend on a script
sending one HTTP request per beat.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .hub import hub
from .messages import CueMsg, CuePayload, ForecastMsg, ForecastPayload, StatusMsg, StatusPayload, now_ms
from .storage import store

log = logging.getLogger("timeline")

TIMELINE_DIR = Path(__file__).resolve().parent.parent / "timelines"
_SKIP_SUFFIXES = (".sections.json", ".ai.json")


def list_timelines() -> list[dict]:
    out = []
    for p in sorted(TIMELINE_DIR.glob("*.json")):
        if p.name.endswith(_SKIP_SUFFIXES):
            continue
        try:
            tl = json.loads(p.read_text())
            out.append({"name": p.stem, "title": tl.get("title"), "duration": tl.get("duration"),
                        "bpm": tl.get("bpm"), "counts": tl.get("counts"),
                        "ai": (TIMELINE_DIR / f"{p.stem}.ai.json").exists()})
        except (OSError, ValueError):
            continue
    return out


def load_timeline(name: str) -> dict:
    if not name.replace("-", "").replace("_", "").isalnum():
        raise FileNotFoundError(name)
    path = TIMELINE_DIR / f"{name}.json"
    return json.loads(path.read_text())


# Moments worth counting down to, and what to call the part of the song that follows each one.
BIG = {"build": "Build-up", "drop": "Drop", "chorus": "Chorus"}
STATUS_EVERY_S = 4.0


@dataclass
class Run:
    name: str
    title: str
    duration: float
    offset: float
    started: float  # time.monotonic() when song position == offset
    task: asyncio.Task
    big: list  # [(t, kind, text)] of build/drop/chorus cues, in order
    sent: int = 0
    section: str = "Intro"

    def position_ms(self) -> int:
        return int((self.offset + time.monotonic() - self.started) * 1000)

    def forecast(self) -> ForecastPayload:
        """The next build, drop or chorus, with the server time it lands, for a shared countdown."""
        pos = self.position_ms() / 1000
        last = max((t for t, _, _ in self.big if t <= pos + 0.05), default=-99.0)
        for t, kind, text in self.big:
            # Skip a moment within 4 s of the one that just landed (in Grateful the hook enters 3 s after the drop):
            # the drop gets the screen to itself instead of a second countdown on top of it.
            if t > pos + 0.05 and t - last >= 4.0:
                return ForecastPayload(kind=kind, text=text, at_ms=int(t * 1000),
                                       due_at=now_ms() + int((t - pos) * 1000))
        return ForecastPayload()

    def status(self) -> StatusPayload:
        return StatusPayload(audio="listening", source=self.name, title=self.title, position_ms=self.position_ms(),
                             duration_ms=int(self.duration * 1000) or None, section=self.section)


class TimelinePlayer:
    def __init__(self) -> None:
        self.runs: dict[str, Run] = {}

    def position_ms(self, session: str) -> Optional[int]:
        run = self.runs.get(session)
        return run.position_ms() if run else None

    def state(self, session: str) -> dict:
        run = self.runs.get(session)
        if not run:
            return {"playing": False}
        return {"playing": True, "name": run.name, "title": run.title, "duration": run.duration,
                "position_ms": run.position_ms(), "cues_sent": run.sent, "section": run.section}

    def run(self, session: str) -> Optional[Run]:
        return self.runs.get(session)

    async def start(self, session: str, name: str, offset: float = 0.0, lead_ms: int = 0) -> dict:
        tl = load_timeline(name)
        await self.stop(session, announce=False)
        title = tl.get("title") or name
        cues = [c for c in tl["cues"] if c["t"] >= offset]
        started = time.monotonic() + lead_ms / 1000.0
        big = [(c["t"], c["kind"], c.get("text")) for c in tl["cues"] if c["kind"] in BIG]
        loop_task = asyncio.create_task(self._play(session, name, title, cues, offset, started))
        run = Run(name, title, float(tl.get("duration", 0)), offset, started, loop_task, big)
        # Starting mid-song: name the section we're already in.
        passed = [k for t, k, _ in big if t <= offset]
        if passed:
            run.section = BIG[passed[-1]]
        self.runs[session] = run
        await hub.broadcast(StatusMsg(session=session, payload=run.status()), session)
        await hub.broadcast(ForecastMsg(session=session, payload=run.forecast()), session)
        log.info("timeline %s started in %s at %.1fs (%d cues)", name, session, offset, len(cues))
        return self.state(session)

    async def stop(self, session: str, announce: bool = True) -> None:
        run = self.runs.pop(session, None)
        if run:
            run.task.cancel()
            try:
                await run.task
            except (asyncio.CancelledError, Exception):
                pass
        if announce:
            await hub.broadcast(StatusMsg(session=session, payload=StatusPayload(audio="idle")), session)

    async def _play(self, session, name, title, cues, offset, started) -> None:
        last_status = time.monotonic()
        try:
            for c in cues:
                due = started + (c["t"] - offset)
                delay = due - time.monotonic()
                if delay > 0:
                    await asyncio.sleep(delay)
                elif delay < -0.25:
                    continue  # we fell far behind (laptop slept?): skip rather than burst
                payload = CuePayload(kind=c["kind"], at_ms=int(c["t"] * 1000), intensity=c.get("intensity", 0.8),
                                     duration_ms=c.get("duration_ms", 120), pattern=c.get("pattern", "tap"),
                                     color=c.get("color"), text=c.get("text"))
                msg = CueMsg(session=session, payload=payload)
                hub.stamp(msg)
                hub.remember_cue(payload.cue_id, msg.sent_at)
                delivered = await hub.broadcast(msg, session, roles=["phone", "watch"])
                store.record_cue(session, payload.cue_id, payload.kind, payload.intensity, payload.pattern,
                                 payload.at_ms, f"timeline:{name}", delivered)
                run = self.runs.get(session)
                if run:
                    run.sent += 1
                    if c["kind"] in BIG:
                        # A big moment just landed: new section, and point everyone at the next one.
                        run.section = BIG[c["kind"]]
                        await hub.broadcast(StatusMsg(session=session, payload=run.status()), session)
                        await hub.broadcast(ForecastMsg(session=session, payload=run.forecast()), session)
                        last_status = time.monotonic()
                    elif time.monotonic() - last_status > STATUS_EVERY_S:
                        # Heartbeat: keeps every phone's progress bar honest, and catches up late joiners.
                        await hub.broadcast(StatusMsg(session=session, payload=run.status()), session)
                        last_status = time.monotonic()
            # Finished naturally.
            if self.runs.get(session) and self.runs[session].task is asyncio.current_task():
                self.runs.pop(session, None)
                await hub.broadcast(StatusMsg(session=session, payload=StatusPayload(
                    audio="idle", source=name, title=title)), session)
        except asyncio.CancelledError:
            pass


player = TimelinePlayer()
