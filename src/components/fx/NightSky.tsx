/**
 * The room every screen sits in: stage navy, two slow beams of light from above, a warm glow where
 * the stage would be, and fine film grain. Pure CSS, so it costs nothing on a phone that is also
 * running the lightstick. Beams hold still under reduced motion.
 */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export default function NightSky({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const sweep = reducedMotion ? "" : "animate-beam-sweep";
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-stage">
      {/* stage glow at the far end of the room */}
      <div className="absolute inset-x-[-20%] top-[-30%] h-[70%] bg-[radial-gradient(ellipse_at_50%_100%,rgb(139_123_255/0.22),transparent_60%)]" />
      <div className="absolute inset-x-[-20%] bottom-[-35%] h-[60%] bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_79_163/0.10),transparent_65%)]" />
      {/* two beams from the truss */}
      <div
        className={`absolute top-[-10%] left-[12%] h-[130%] w-[38vw] origin-top ${sweep} bg-gradient-to-b from-lilac/16 via-aura/5 to-transparent blur-2xl [clip-path:polygon(46%_0,54%_0,100%_100%,0_100%)]`}
        style={{ animationDuration: "19s" }}
      />
      <div
        className={`absolute top-[-10%] right-[8%] h-[130%] w-[34vw] origin-top ${sweep} bg-gradient-to-b from-bubblegum/12 via-bubblegum/4 to-transparent blur-2xl [clip-path:polygon(46%_0,54%_0,100%_100%,0_100%)]`}
        style={{ animationDuration: "23s", animationDelay: "-9s" }}
      />
      {/* film grain and a vignette, like a photo taken in a dark venue */}
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_45%,rgb(2_3_8/0.7)_100%)]" />
    </div>
  );
}
