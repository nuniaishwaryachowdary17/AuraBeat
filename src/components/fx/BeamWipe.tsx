/**
 * Screen change, cut like a concert edit: a bright beam of stage light whips across the screen while the
 * new screen punches in behind it. Keyed by the screen, so it plays once per change.
 */
export default function BeamWipe({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[94] overflow-hidden">
      <div className="absolute -inset-y-1/4 -left-1/2 w-[70%] animate-[beam-wipe_750ms_cubic-bezier(0.7,0,0.2,1)_forwards] -skew-x-[18deg] bg-[linear-gradient(90deg,transparent,rgba(139,123,255,0.35)_30%,rgba(255,255,255,0.9)_50%,rgba(255,79,163,0.35)_70%,transparent)] blur-md mix-blend-screen" />
      <div className="absolute inset-0 animate-[wipe-dim_750ms_ease-out_forwards] bg-black" />
    </div>
  );
}
