import { useEffect, useState } from "react";
import { isLiveSessionActive, onEffectsStop, onLiveEvent } from "../../live/liveBridge";

/**
 * When a real drop hits during live mode, the whole phone reacts like the room does: a bloom of stage
 * colour, two shockwaves, light streaks from the centre, a gentle kick, and DROP lands with a brief RGB
 * split. About 1.4 seconds. No white strobe; nothing at all with Reduce Motion; Stop clears it at once.
 */
export default function DropTakeover({ reducedMotion }: { reducedMotion: boolean }) {
  const [hit, setHit] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let clear: number | undefined;
    const off = onLiveEvent((e) => {
      if (e.type !== "cue" || e.cue !== "drop" || !isLiveSessionActive()) return;
      setHit((n) => n + 1);
      window.clearTimeout(clear);
      clear = window.setTimeout(() => setHit(0), 1500);
      // the screen kicks: a short, decaying shake of the whole app
      document.getElementById("root")?.animate(
        [
          { transform: "translate(0,0)" },
          { transform: "translate(-5px,3px) rotate(-0.2deg)" },
          { transform: "translate(4px,-3px) rotate(0.15deg)" },
          { transform: "translate(-3px,2px)" },
          { transform: "translate(2px,-1px)" },
          { transform: "translate(-1px,0)" },
          { transform: "translate(0,0)" },
        ],
        { duration: 520, easing: "cubic-bezier(0.2,0.7,0.3,1)" },
      );
    });
    // Stop: clear the takeover and the shake on the spot.
    const offStop = onEffectsStop(() => {
      window.clearTimeout(clear);
      setHit(0);
      document.getElementById("root")?.getAnimations().forEach((a) => a.cancel());
    });
    return () => {
      offStop();
      off();
      window.clearTimeout(clear);
    };
  }, [reducedMotion]);

  if (!hit || reducedMotion) return null;

  return (
    <div key={hit} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
      {/* a bloom of stage colour (no white flash) */}
      <div className="absolute inset-0 animate-[drop-flash_900ms_ease-out_forwards] bg-[radial-gradient(circle_at_50%_50%,rgb(255_255_255/0.55),rgb(255_79_163/0.35)_30%,rgb(111_245_210/0.18)_55%,transparent_75%)]" />
      {/* light streaks from the centre */}
      <div className="absolute top-1/2 left-1/2">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 left-0 h-[3px] w-[60vmax] origin-left animate-[drop-streak_900ms_cubic-bezier(0.1,0.8,0.2,1)_forwards] rounded-full"
            style={{
              rotate: `${(i / 28) * 360 + (i % 3) * 4}deg`,
              background: `linear-gradient(90deg, transparent, ${["#ffffff", "#ff4fa3", "#8b7bff", "#ffb547"][i % 4]}, transparent)`,
              animationDelay: `${(i % 5) * 18}ms`,
            }}
          />
        ))}
      </div>
      {/* shockwaves */}
      {[0, 160].map((d) => (
        <span
          key={d}
          className="absolute top-1/2 left-1/2 size-[30vmin] -translate-x-1/2 -translate-y-1/2 animate-[drop-ring_1100ms_cubic-bezier(0.1,0.7,0.2,1)_forwards] rounded-full border-[6px] border-white/80 shadow-[0_0_40px_8px_rgba(255,79,163,0.8),inset_0_0_40px_6px_rgba(139,123,255,0.7)]"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
      {/* DROP, with an RGB split that snaps together */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative animate-[drop-word_1400ms_cubic-bezier(0.16,1,0.3,1)_forwards] font-display text-[clamp(5rem,28vw,14rem)] leading-none font-bold tracking-tight">
          <span className="absolute inset-0 animate-[split-left_1400ms_ease-out_forwards] text-[#ff4fa3] mix-blend-screen">DROP</span>
          <span className="absolute inset-0 animate-[split-right_1400ms_ease-out_forwards] text-[#5fd4ff] mix-blend-screen">DROP</span>
          <span className="relative text-white [text-shadow:0_0_50px_rgba(255,255,255,0.8)]">DROP</span>
        </div>
      </div>
    </div>
  );
}
