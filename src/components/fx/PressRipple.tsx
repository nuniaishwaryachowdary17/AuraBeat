import { useEffect, useRef } from "react";

/**
 * Every tap on a button sends out a ring of light from your finger, like a pulse on a lit stage floor.
 * Off with Reduce Motion; skipped inside the full-screen lightstick so it never competes with the light.
 */
export default function PressRipple({ reducedMotion }: { reducedMotion: boolean }) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const control = target?.closest?.("button, a, [role=switch]");
      const host = layer.current;
      if (!control || !host || target?.closest?.('[aria-label="Lightstick"]')) return;
      for (const [delay, size, alpha] of [
        [0, 150, 0.55],
        [90, 230, 0.3],
      ] as const) {
        const ring = document.createElement("span");
        ring.className = "absolute rounded-full animate-[press-ring_700ms_cubic-bezier(0.1,0.7,0.2,1)_forwards]";
        Object.assign(ring.style, {
          left: `${e.clientX - size / 2}px`,
          top: `${e.clientY - size / 2}px`,
          width: `${size}px`,
          height: `${size}px`,
          border: `2px solid rgba(255,255,255,${alpha})`,
          boxShadow: `0 0 24px rgba(139,123,255,${alpha}), inset 0 0 18px rgba(255,79,163,${alpha * 0.6})`,
          animationDelay: `${delay}ms`,
        });
        ring.addEventListener("animationend", () => ring.remove());
        host.appendChild(ring);
      }
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, [reducedMotion]);

  return <div ref={layer} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[96] overflow-hidden" />;
}
