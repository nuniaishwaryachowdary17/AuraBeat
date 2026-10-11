import { useSettings } from "../../hooks/useSettings";
import { useEffect, useRef } from "react";
import { getShow, onLiveEvent, serverNow } from "../../live/liveBridge";

/**
 * A rendered concert: moving-head beams cutting through drifting haze, a silhouetted crowd lit from
 * behind, phone lights and lightsticks as soft bokeh, film grain and a vignette. It breathes on an idle
 * 75 BPM pulse and flares on every real cue from the backend (a drop washes the room).
 *
 * The show drives it: as a drop approaches (the backend's forecast), the beams pull in toward the centre,
 * sweep faster and the strobe quickens (never past 3 flashes a second). On the drop the rig blasts open:
 * pyro sparks fountain up from the stage, CO2 cannons fire, and lasers fan across the room through the
 * chorus. With `demo`, the scene runs its own build-and-drop loop when no show is playing.
 *
 * Decorative only. Renders at reduced resolution (haze is soft anyway), caps at ~40 fps, pauses when
 * off-screen or hidden, and draws a single still frame under reduced motion.
 */

type RGB = [number, number, number];
const VIOLET: RGB = [139, 123, 255];
const MAGENTA: RGB = [255, 79, 163];
const AMBER: RGB = [255, 181, 71];
const ICE: RGB = [200, 214, 255];

interface ConcertSceneProps {
  /** hero: full brightness. ambient: dim background behind content. */
  variant?: "hero" | "ambient";
  /** Flare on live cues from the backend. */
  live?: boolean;
  /** One frame only (also forced by reduced motion). */
  still?: boolean;
  /** Fraction of the height the crowd occupies. 0 = no crowd (another layer draws it). */
  crowd?: number;
  /** Run a build-up and drop on a loop when no real show is playing (home screen). */
  demo?: boolean;
  className?: string;
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

/** Seeded random so the crowd doesn't reshuffle on resize. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Light {
  x: number;
  y: number;
  r: number;
  color: RGB;
  phase: number;
  depth: number; // 0 far … 1 near
  kind: "phone" | "stick";
}

function makeHaze(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.fillRect(0, 0, size, size);
  const rand = rng(7);
  // Soft overlapping puffs make smoke-like density; drawn wrapped so the texture tiles.
  for (let i = 0; i < 70; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.08 + rand() * 0.22);
    const a = 0.06 + rand() * 0.16;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
  return c;
}

function makeGrain(size: number, seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const rand = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Silhouettes: heads, shoulders, raised arms, some holding phones. Returns the layer and its lights. */
function makeCrowd(w: number, h: number, crowdFrac: number): { layer: HTMLCanvasElement; lights: Light[] } {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const lights: Light[] = [];
  const rand = rng(42);
  const top = h * (1 - crowdFrac);
  const rows = [
    { y: top + h * crowdFrac * 0.18, head: h * 0.016, shade: "#161a33", spacing: 1.9, depth: 0.15, blur: 1.6, rim: 0.42 },
    { y: top + h * crowdFrac * 0.42, head: h * 0.024, shade: "#0c0f22", spacing: 1.8, depth: 0.45, blur: 0.4, rim: 0.32 },
    { y: top + h * crowdFrac * 0.72, head: h * 0.036, shade: "#04050b", spacing: 1.75, depth: 0.8, blur: 2.2, rim: 0.2 },
  ];
  // Each row is drawn on its own layer: backlit from the stage (a rim of light on heads and shoulders),
  // then blurred by its distance from the focus plane, like a real lens.
  for (const row of rows) {
    const rc = document.createElement("canvas");
    rc.width = c.width;
    rc.height = c.height;
    const g = rc.getContext("2d")!;
    const step = row.head * 2 * row.spacing;
    for (let x = -step * rand(); x < w + step; x += step * (0.75 + rand() * 0.5)) {
      const hr = row.head * (0.85 + rand() * 0.3);
      const hx = x;
      const hy = row.y + (rand() - 0.5) * hr * 0.8;
      const lean = (rand() - 0.5) * hr * 0.5;
      g.fillStyle = row.shade;
      g.strokeStyle = row.shade;
      // body + shoulders
      g.beginPath();
      g.moveTo(hx - hr * 2.6, h);
      g.quadraticCurveTo(hx - hr * 2.8, hy + hr * 1.7, hx - hr * 1.15, hy + hr * 1.3);
      g.lineTo(hx + hr * 1.15, hy + hr * 1.3);
      g.quadraticCurveTo(hx + hr * 2.8, hy + hr * 1.7, hx + hr * 2.6, h);
      g.closePath();
      g.fill();
      // neck + head, a few with a cap or hair up
      g.fillRect(hx - hr * 0.42 + lean * 0.3, hy + hr * 0.6, hr * 0.84, hr * 0.9);
      g.beginPath();
      g.ellipse(hx + lean * 0.4, hy, hr * (0.9 + rand() * 0.18), hr * (1.02 + rand() * 0.14), lean * 0.02, 0, Math.PI * 2);
      g.fill();
      const extra = rand();
      if (extra < 0.12) {
        g.beginPath();
        g.ellipse(hx + lean * 0.4 + hr * 0.5, hy - hr * 0.2, hr * 0.9, hr * 0.32, 0.15, 0, Math.PI * 2);
        g.fill();
      } else if (extra < 0.22) {
        g.beginPath();
        g.arc(hx + lean * 0.4, hy - hr * 1.0, hr * 0.42, 0, Math.PI * 2);
        g.fill();
      }
      // raised arms
      const roll = rand();
      if (roll < 0.45) {
        const side = rand() < 0.5 ? -1 : 1;
        const sx = hx + side * hr * 1.5;
        const sy = hy + hr * 1.4;
        const ex = sx + side * hr * (0.3 + rand() * 1.0);
        const ey = hy - hr * (2.2 + rand() * 1.8);
        g.lineCap = "round";
        g.lineWidth = hr * 0.6;
        g.beginPath();
        g.moveTo(sx, sy);
        g.quadraticCurveTo(sx + side * hr * 0.6, (sy + ey) / 2 + hr * 0.4, ex, ey);
        g.stroke();
        g.beginPath();
        g.ellipse(ex, ey - hr * 0.15, hr * 0.36, hr * 0.46, 0, 0, Math.PI * 2);
        g.fill();
        if (roll < 0.3) {
          const phone = roll < 0.15;
          lights.push({
            x: ex,
            y: ey - hr * (phone ? 0.7 : 1.0),
            r: hr * (phone ? 0.5 : 0.7),
            color: phone ? ICE : [VIOLET, MAGENTA, AMBER][Math.floor(rand() * 3)],
            phase: rand() * Math.PI * 2,
            depth: row.depth,
            kind: phone ? "phone" : "stick",
          });
          if (phone) {
            g.fillRect(ex - hr * 0.28, ey - hr * 1.05, hr * 0.56, hr * 0.85);
          } else {
            g.lineWidth = hr * 0.2;
            g.beginPath();
            g.moveTo(ex, ey - hr * 0.2);
            g.lineTo(ex, ey - hr * 0.95);
            g.stroke();
          }
        }
      }
    }
    // backlight rim: light from the stage catching the top edges
    g.globalCompositeOperation = "source-atop";
    const rim = g.createLinearGradient(0, row.y - row.head * 5, 0, row.y + row.head * 1.5);
    rim.addColorStop(0, `rgba(190,170,255,${row.rim})`);
    rim.addColorStop(0.55, `rgba(255,120,190,${row.rim * 0.45})`);
    rim.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rim;
    g.fillRect(0, 0, rc.width, rc.height);
    const ctx = c.getContext("2d")!;
    ctx.filter = row.blur > 0 ? `blur(${row.blur}px)` : "none";
    ctx.drawImage(rc, 0, 0);
    ctx.filter = "none";
  }
  return { layer: c, lights };
}

interface Spark {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: RGB;
}

export default function ConcertScene({ variant = "hero", live = true, still = false, crowd = 0.34, demo = false, className = "" }: ConcertSceneProps) {
  const reducedMotion = useSettings().settings.reducedMotion;
  const ref = useRef<HTMLCanvasElement>(null);
  const flare = useRef({ v: 0, drop: 0, blastAt: -1 });

  useEffect(() => {
    if (!live) return;
    return onLiveEvent((e) => {
      if (e.type !== "cue") return;
      const f = flare.current;
      f.v = Math.min(1, f.v + (e.cue === "beat" ? 0.35 : e.cue === "bass" ? 0.6 : 0.8));
      if (e.cue === "drop") {
        f.drop = 1;
        f.blastAt = performance.now();
      }
    });
  }, [live]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = still || reducedMotion;
    const dim = variant === "ambient" ? 0.55 : 1;

    const haze = makeHaze(256);
    const grains = [makeGrain(128, 1), makeGrain(128, 2), makeGrain(128, 3)];
    const beamLayer = document.createElement("canvas");
    const bctx = beamLayer.getContext("2d")!;

    let w = 0;
    let h = 0;
    let crowdLayer: HTMLCanvasElement | null = null;
    let lights: Light[] = [];
    let hazePattern: CanvasPattern | null = null;

    const fixtures = [
      { x: 0.08, base: 0.35, amp: 0.28, speed: 0.21, color: VIOLET },
      { x: 0.27, base: 0.12, amp: 0.34, speed: 0.17, color: MAGENTA },
      { x: 0.5, base: 0, amp: 0.22, speed: 0.13, color: ICE },
      { x: 0.73, base: -0.12, amp: 0.34, speed: 0.19, color: MAGENTA },
      { x: 0.92, base: -0.35, amp: 0.28, speed: 0.23, color: VIOLET },
      { x: 0.38, base: 0.05, amp: 0.4, speed: 0.11, color: AMBER },
      { x: 0.62, base: -0.05, amp: 0.4, speed: 0.12, color: AMBER },
    ];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2) * (variant === "ambient" ? 0.4 : 0.6);
      w = Math.max(1, Math.round(rect.width * scale));
      h = Math.max(1, Math.round(rect.height * scale));
      canvas.width = w;
      canvas.height = h;
      beamLayer.width = w;
      beamLayer.height = h;
      if (crowd > 0) {
        const made = makeCrowd(w, h, crowd);
        crowdLayer = made.layer;
        lights = made.lights;
      } else {
        crowdLayer = null;
        lights = [];
      }
      hazePattern = ctx.createPattern(haze, "repeat");
    };

    let raf = 0;
    let last = 0;
    let visible = true;
    const t0 = performance.now();

    // Show dynamics
    const phases = fixtures.map((fx) => fx.x * 9);
    let strobePhase = 0;
    let strobeFlash = 0;
    let blastSeen = -1;
    let blast = 0; // 1 at the drop, decays
    let lasers = 0; // 0..1
    let lasersUntil = -1;
    let demoLast = 0;
    const sparks: Spark[] = [];
    const jets: { x: number; age: number }[] = [];

    const ignite = (stageY: number) => {
      // Pyro gerbs: four fountains along the stage edge
      for (const gx of [0.14, 0.36, 0.64, 0.86]) {
        for (let i = 0; i < 46; i++) {
          const speed = h * (1.05 + Math.random() * 0.75);
          const ang = (Math.random() - 0.5) * 0.5;
          sparks.push({
            x: gx * w + (Math.random() - 0.5) * w * 0.01,
            y: stageY,
            px: gx * w,
            py: stageY,
            vx: Math.sin(ang) * speed,
            vy: -Math.cos(ang) * speed,
            life: 0,
            max: 1.1 + Math.random() * 0.9,
            color: Math.random() < 0.7 ? [255, 214, 160] : Math.random() < 0.5 ? MAGENTA : [255, 255, 255],
          });
        }
      }
      // CO2 cannons between them
      for (const jx of [0.25, 0.5, 0.75]) jets.push({ x: jx * w, age: 0 });
      if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
    };

    const frame = (now: number) => {
      raf = reduced ? 0 : requestAnimationFrame(frame);
      if (!reduced && now - last < 24) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = Math.max(0, now - t0) / 1000;
      const f = flare.current;
      f.v *= Math.pow(0.04, dt);
      f.drop *= Math.pow(0.15, dt);
      // idle pulse at 75 BPM: a soft kick in the light
      const idle = Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 1.25), 10) * 0.25;

      // Tension: how close the next drop is (real forecast), or the demo loop's own build-up.
      const show = getShow();
      let tension = 0;
      if (live && show.playing && show.forecast?.kind === "drop") {
        const left = show.forecast.dueAt - serverNow();
        tension = left > 0 ? Math.max(0, Math.min(1, 1 - left / 10000)) : 0;
      } else if (demo && !show.playing && !reduced) {
        const cycle = 15;
        const p = t % cycle;
        tension = p > 3 && p < 11 ? (p - 3) / 8 : 0;
        if (demoLast < 11 && p >= 11) {
          f.drop = 1;
          f.blastAt = now;
        }
        demoLast = p;
      }
      // The drop: blast the rig open, fire the pyro and the CO2, start the lasers.
      if (f.blastAt !== blastSeen && f.blastAt > 0) {
        blastSeen = f.blastAt;
        blast = 1;
        lasersUntil = t + 9;
        ignite(h * (1 - Math.max(crowd, 0.3)) + h * Math.max(crowd, 0.3) * 0.08);
      }
      blast *= Math.pow(0.12, dt);
      const lasersWanted = t < lasersUntil || (live && show.playing && show.section === "Chorus") ? 1 : 0;
      lasers += (lasersWanted - lasers) * Math.min(1, dt * 2.5);

      // Strobe while the tension rises: 1 to 3 flashes per second, never faster.
      if (tension > 0.4) {
        strobePhase += dt * (1 + 2 * ((tension - 0.4) / 0.6));
        if (strobePhase >= 1) {
          strobePhase -= 1;
          strobeFlash = 1;
        }
      } else strobePhase = 0;
      strobeFlash *= Math.pow(0.0005, dt);

      const energy = (0.55 + idle + f.v * 0.7 + tension * 0.35 + blast * 0.6) * dim;

      // 1. Room: stage navy, a warm glow behind the crowd
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#05060d");
      bg.addColorStop(0.55, "#0a0c1c");
      bg.addColorStop(1, "#070912");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const horizon = h * (1 - Math.max(crowd, 0.3));
      const back = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, w * 0.8);
      back.addColorStop(0, rgba(MAGENTA, 0.28 * energy + f.drop * 0.3));
      back.addColorStop(0.35, rgba(VIOLET, 0.16 * energy));
      back.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = back;
      ctx.fillRect(0, 0, w, h);

      // 2. Beams, drawn on their own layer and then cut by drifting haze so they look volumetric
      bctx.globalCompositeOperation = "source-over";
      bctx.clearRect(0, 0, w, h);
      bctx.globalCompositeOperation = "lighter";
      const trussY = h * 0.04;
      for (const fx of fixtures) {
        const i = fixtures.indexOf(fx);
        // sweep faster as the tension rises
        phases[i] += dt * fx.speed * Math.PI * 2 * (1 + tension * 3 + blast * 2);
        const sx = fx.x * w;
        let ang = fx.base + fx.amp * Math.sin(phases[i]);
        // build-up: every beam pulls in toward one point centre-stage
        const toCentre = Math.atan2(w * 0.5 - sx, h * 0.62);
        ang += (toCentre - ang) * tension * 0.85;
        // drop: the rig blasts open, beams thrown outward
        ang += Math.sign(fx.x - 0.5 || 1) * blast * 0.55;
        const len = h * 1.25;
        const spread = (0.1 + 0.025 * Math.sin(t * 0.7 + fx.x * 5)) * (1 - tension * 0.45) * (1 + blast * 0.6);
        const ex = sx + Math.sin(ang) * len;
        const ey = trussY + Math.cos(ang) * len;
        const px = Math.cos(ang) * len * spread;
        const py = -Math.sin(ang) * len * spread;
        const grad = bctx.createLinearGradient(sx, trussY, ex, ey);
        const a = 0.62 * energy + f.drop * 0.3;
        grad.addColorStop(0, rgba(fx.color, a));
        grad.addColorStop(0.45, rgba(fx.color, a * 0.45));
        grad.addColorStop(1, rgba(fx.color, 0));
        bctx.fillStyle = grad;
        bctx.beginPath();
        bctx.moveTo(sx - 1, trussY);
        bctx.lineTo(ex + px, ey + py);
        bctx.lineTo(ex - px, ey - py);
        bctx.lineTo(sx + 1, trussY);
        bctx.closePath();
        bctx.fill();
        // bright core of the beam
        const core = bctx.createLinearGradient(sx, trussY, ex, ey);
        core.addColorStop(0, rgba([255, 255, 255], a * 0.6));
        core.addColorStop(0.3, rgba(fx.color, a * 0.25));
        core.addColorStop(1, rgba(fx.color, 0));
        bctx.fillStyle = core;
        bctx.beginPath();
        bctx.moveTo(sx, trussY);
        bctx.lineTo(ex + px * 0.25, ey + py * 0.25);
        bctx.lineTo(ex - px * 0.25, ey - py * 0.25);
        bctx.closePath();
        bctx.fill();
      }
      if (hazePattern) {
        const m = new DOMMatrix().translateSelf((t * 9) % 256, (t * -4) % 256).scaleSelf(w / 220, w / 220);
        hazePattern.setTransform(m);
        bctx.globalCompositeOperation = "destination-in";
        bctx.fillStyle = hazePattern;
        bctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(beamLayer, 0, 0);
      // a second, softer pass of the same light gives the bloom of real haze
      ctx.globalAlpha = 0.7;
      ctx.filter = "blur(10px)";
      ctx.drawImage(beamLayer, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;

      // 3. Fixture heads on the truss: hot points with bloom
      for (const fx of fixtures) {
        const sx = fx.x * w;
        const r = Math.max(6, w * 0.022);
        const glow = ctx.createRadialGradient(sx, trussY, 0, sx, trussY, r * 3);
        glow.addColorStop(0, rgba([255, 255, 255], 0.9 * energy));
        glow.addColorStop(0.15, rgba(fx.color, 0.7 * energy));
        glow.addColorStop(1, rgba(fx.color, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(sx - r * 3, trussY - r * 3, r * 6, r * 6);
      }

      // 4. Haze lit by the stage, drifting across the room
      if (hazePattern) {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.1 * dim + f.drop * 0.06;
        const m = new DOMMatrix().translateSelf((t * -6) % 256, (t * 2) % 256).scaleSelf(w / 160, w / 160);
        hazePattern.setTransform(m);
        ctx.fillStyle = hazePattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // 4a. Lasers: a fan of thin beams sweeping the room through the drop and the chorus
      if (lasers > 0.02) {
        const ox = w / 2;
        const oy = h * 0.07;
        const n = 11;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (let i = 0; i < n; i++) {
          const spreadA = 1.15;
          const a = -spreadA / 2 + (i / (n - 1)) * spreadA + Math.sin(t * 1.3 + i * 0.4) * 0.12;
          const col = i % 2 ? MAGENTA : VIOLET;
          const ex = ox + Math.sin(a) * h * 1.6;
          const ey = oy + Math.cos(a) * h * 1.6;
          ctx.strokeStyle = rgba(col, 0.22 * lasers);
          ctx.lineWidth = Math.max(3, w * 0.008);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.strokeStyle = rgba([255, 255, 255], 0.55 * lasers);
          ctx.lineWidth = Math.max(0.8, w * 0.0018);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        const src = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.05);
        src.addColorStop(0, rgba([255, 255, 255], 0.9 * lasers));
        src.addColorStop(1, rgba(MAGENTA, 0));
        ctx.fillStyle = src;
        ctx.fillRect(ox - w * 0.05, oy - w * 0.05, w * 0.1, w * 0.1);
      }

      // 4c. CO2 cannons: white columns that blast up and spread out
      for (let i = jets.length - 1; i >= 0; i--) {
        const j = jets[i];
        j.age += dt;
        const life = j.age / 1.6;
        if (life >= 1) {
          jets.splice(i, 1);
          continue;
        }
        const baseY = h * (1 - Math.max(crowd, 0.3)) + h * Math.max(crowd, 0.3) * 0.08;
        const top = baseY - h * 0.62 * Math.min(1, life * 3.2);
        const width = w * (0.03 + life * 0.14);
        const a = (1 - life) * 0.55;
        const g = ctx.createLinearGradient(0, baseY, 0, top);
        g.addColorStop(0, rgba([235, 238, 255], a));
        g.addColorStop(0.7, rgba([220, 225, 255], a * 0.5));
        g.addColorStop(1, rgba([220, 225, 255], 0));
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = g;
        ctx.filter = "blur(6px)";
        ctx.beginPath();
        ctx.moveTo(j.x - width * 0.2, baseY);
        ctx.lineTo(j.x - width, top);
        ctx.lineTo(j.x + width, top);
        ctx.lineTo(j.x + width * 0.2, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.filter = "none";
      }

      // 4d. Pyro sparks: streaks with gravity, cooling as they fall
      if (sparks.length) {
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        const g = h * 1.5;
        for (let i = sparks.length - 1; i >= 0; i--) {
          const p = sparks[i];
          p.life += dt;
          if (p.life > p.max) {
            sparks.splice(i, 1);
            continue;
          }
          p.px = p.x;
          p.py = p.y;
          p.vy += g * dt;
          p.vx *= 0.995;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const k = 1 - p.life / p.max;
          ctx.strokeStyle = rgba(p.color, 0.95 * k);
          ctx.lineWidth = Math.max(1, w * 0.003) * (0.6 + k);
          ctx.beginPath();
          ctx.moveTo(p.px - (p.x - p.px) * 1.5, p.py - (p.y - p.py) * 1.5);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }

      // 4b. The stage edge: an LED strip and its uplight, just above the crowd, pulsing with the music
      if (crowd > 0) {
        const sy = h * (1 - crowd) + h * crowd * 0.08;
        const strip = ctx.createLinearGradient(0, 0, w, 0);
        const shift = (t * 0.08) % 1;
        strip.addColorStop(0, rgba(VIOLET, 0));
        strip.addColorStop(Math.max(0, shift - 0.3), rgba(VIOLET, 0.55 * energy));
        strip.addColorStop(shift, rgba(MAGENTA, 0.8 * energy));
        strip.addColorStop(Math.min(1, shift + 0.3), rgba(AMBER, 0.5 * energy));
        strip.addColorStop(1, rgba(VIOLET, 0));
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = strip;
        ctx.fillRect(0, sy - 1, w, Math.max(2, h * 0.006));
        const up = ctx.createLinearGradient(0, sy, 0, sy - h * 0.22);
        up.addColorStop(0, rgba(MAGENTA, 0.22 * energy + f.drop * 0.2));
        up.addColorStop(1, rgba(MAGENTA, 0));
        ctx.fillStyle = up;
        ctx.fillRect(0, sy - h * 0.22, w, h * 0.22);
      }

      // 5. Crowd silhouettes, then their phone screens and lightsticks
      ctx.globalCompositeOperation = "source-over";
      if (crowdLayer) ctx.drawImage(crowdLayer, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      for (const l of lights) {
        const tw = l.kind === "phone" ? 0.75 + 0.25 * Math.sin(t * 0.8 + l.phase) : 0.6 + 0.4 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.5 + l.phase), 2);
        const sway = l.kind === "stick" ? Math.sin(t * 1.6 + l.phase) * l.r * 0.8 : 0;
        const rr = l.r * (2.2 + l.depth * 1.6) * (1 + f.v * 0.4);
        const g = ctx.createRadialGradient(l.x + sway, l.y, 0, l.x + sway, l.y, rr);
        g.addColorStop(0, rgba([255, 255, 255], 0.85 * tw * dim));
        g.addColorStop(0.18, rgba(l.color, 0.75 * tw * dim));
        g.addColorStop(1, rgba(l.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(l.x + sway - rr, l.y - rr, rr * 2, rr * 2);
      }

      // 6. Out-of-focus foreground lights (depth of field)
      for (let i = 0; i < 5; i++) {
        const bx = ((i * 0.23 + t * 0.006 * (i % 2 ? 1 : -1)) % 1) * w;
        const by = h * (0.62 + 0.08 * Math.sin(i * 1.7 + t * 0.2));
        const br = w * (0.05 + (i % 3) * 0.025);
        const col = [VIOLET, MAGENTA, AMBER][i % 3];
        const g = ctx.createRadialGradient(bx, by, br * 0.6, bx, by, br);
        g.addColorStop(0, rgba(col, 0.08 * dim));
        g.addColorStop(0.9, rgba(col, 0.12 * dim));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Drop: the whole room flashes once
      if (f.drop > 0.02) {
        ctx.fillStyle = rgba([255, 230, 245], f.drop * 0.18);
        ctx.fillRect(0, 0, w, h);
      }

      // 7b. Strobe (build-up only, ≤3 per second, soft)
      if (strobeFlash > 0.02) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rgba([235, 240, 255], strobeFlash * 0.16 * dim);
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }

      // 8. Vignette + film grain
      ctx.globalCompositeOperation = "source-over";
      const vig = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(3,4,10,0.75)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.09;
      const grain = ctx.createPattern(grains[Math.floor(t * 24) % 3], "repeat");
      if (grain) {
        ctx.fillStyle = grain;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) frame(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !document.hidden && !reduced) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden && !reduced) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);
    if (reduced) frame(performance.now() + 1000);
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [variant, still, crowd, demo, live, reducedMotion]);

  return <canvas ref={ref} aria-hidden="true" className={`block size-full ${className}`} />;
}
