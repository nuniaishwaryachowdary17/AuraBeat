import { useEffect, useRef } from "react";

/**
 * The home sculpture: ribbons of violet, mint and pink light floating through space, each one slowly
 * twisting (it thins as it turns edge-on) with motes drifting past at different depths.
 *
 * Purely ambient: it never claims to show the music. Canvas at reduced resolution with a soft bloom pass;
 * fewer ribbons and particles on small screens; pauses off-screen; a single still frame with reduced motion.
 */

type RGB = [number, number, number];
const VIOLET: RGB = [139, 123, 255];
const MINT: RGB = [111, 245, 210];
const PINK: RGB = [255, 79, 163];

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

interface Ribbon {
  y: number; // centre line, fraction of height
  amp: number; // wave height, fraction of height
  freq: number; // waves across the width
  speed: number;
  width: number; // band thickness, fraction of height
  twist: number; // twist speed
  phase: number;
  depth: number; // 0 far .. 1 near
  colors: [RGB, RGB, RGB];
}

export default function AuraRibbon({ reducedMotion = false, className = "" }: { reducedMotion?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = reducedMotion; // the app setting, which follows the device until the person chooses
    const small = window.innerWidth < 640;

    const all: Ribbon[] = [
      { y: 0.46, amp: 0.13, freq: 1.1, speed: 0.16, width: 0.11, twist: 0.21, phase: 0, depth: 1, colors: [VIOLET, MINT, PINK] },
      { y: 0.52, amp: 0.1, freq: 1.5, speed: -0.12, width: 0.07, twist: 0.17, phase: 2.1, depth: 0.7, colors: [MINT, VIOLET, PINK] },
      { y: 0.4, amp: 0.16, freq: 0.8, speed: 0.09, width: 0.05, twist: 0.26, phase: 4.2, depth: 0.45, colors: [PINK, VIOLET, MINT] },
      { y: 0.58, amp: 0.08, freq: 1.9, speed: 0.2, width: 0.035, twist: 0.31, phase: 1.3, depth: 0.3, colors: [VIOLET, PINK, MINT] },
    ];
    const ribbons = all.slice(0, small ? 3 : 4);

    type Mote = { x: number; y: number; r: number; vy: number; vx: number; tw: number; c: RGB; depth: number };
    let motes: Mote[] = [];
    let w = 0;
    let h = 0;
    const glow = document.createElement("canvas");
    const gctx = glow.getContext("2d")!;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.75;
      w = Math.max(1, Math.round(rect.width * scale));
      h = Math.max(1, Math.round(rect.height * scale));
      canvas.width = w;
      canvas.height = h;
      glow.width = Math.max(1, Math.round(w / 3));
      glow.height = Math.max(1, Math.round(h / 3));
      const n = small ? 26 : 48;
      motes = Array.from({ length: n }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: (0.6 + depth * 2.2) * (w / 600 + 0.6),
          vy: -(4 + depth * 14) * (h / 600),
          vx: (Math.random() - 0.5) * 6,
          tw: Math.random() * Math.PI * 2,
          c: [VIOLET, MINT, PINK][Math.floor(Math.random() * 3)],
          depth,
        };
      });
    };

    const drawRibbon = (g: CanvasRenderingContext2D, r: Ribbon, t: number, W: number, H: number, alpha: number) => {
      const steps = 70;
      const top: [number, number][] = [];
      const bot: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = -W * 0.1 + u * W * 1.2;
        const a = u * Math.PI * 2 * r.freq + t * r.speed * Math.PI * 2 + r.phase;
        const yc = H * (r.y + r.amp * Math.sin(a) + r.amp * 0.35 * Math.sin(a * 0.5 + t * 0.2));
        // the twist: the band's visible thickness follows a slow cosine, so it turns edge-on and back
        const thick = H * r.width * (0.18 + 0.82 * Math.abs(Math.cos(u * Math.PI * 1.3 + t * r.twist * Math.PI * 2 + r.phase)));
        top.push([x, yc - thick / 2]);
        bot.push([x, yc + thick / 2]);
      }
      const grad = g.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, rgba(r.colors[0], 0));
      grad.addColorStop(0.18, rgba(r.colors[0], 0.55 * alpha));
      grad.addColorStop(0.5, rgba(r.colors[1], 0.7 * alpha));
      grad.addColorStop(0.82, rgba(r.colors[2], 0.55 * alpha));
      grad.addColorStop(1, rgba(r.colors[2], 0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(top[0][0], top[0][1]);
      top.forEach(([x, y]) => g.lineTo(x, y));
      for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
      g.closePath();
      g.fill();
      // a bright edge where the light catches the ribbon
      g.strokeStyle = rgba([255, 255, 255], 0.35 * alpha);
      g.lineWidth = Math.max(0.6, H * 0.0025);
      g.beginPath();
      top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    };

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const t0 = performance.now();

    const frame = (now: number) => {
      raf = still ? 0 : requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000 + 8;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // bloom: ribbons drawn small and blurred, then scaled up behind the sharp pass
      gctx.clearRect(0, 0, glow.width, glow.height);
      gctx.globalCompositeOperation = "lighter";
      for (const r of ribbons) drawRibbon(gctx, { ...r, width: r.width * 2.2 }, t, glow.width, glow.height, 0.5 + 0.5 * r.depth);
      ctx.save();
      ctx.filter = "blur(18px)";
      ctx.globalAlpha = 0.9;
      ctx.drawImage(glow, 0, 0, w, h);
      ctx.restore();

      for (const r of ribbons) drawRibbon(ctx, r, t, w, h, 0.35 + 0.65 * r.depth);

      for (const m of motes) {
        if (!still) {
          m.y += m.vy * dt;
          m.x += (m.vx + Math.sin(t * 0.4 + m.tw) * 4) * dt;
          if (m.y < -10) {
            m.y = h + 10;
            m.x = Math.random() * w;
          }
        }
        const a = (0.25 + 0.55 * m.depth) * (0.6 + 0.4 * Math.sin(t * 1.4 + m.tw));
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
        g.addColorStop(0, rgba([255, 255, 255], a));
        g.addColorStop(0.3, rgba(m.c, a * 0.8));
        g.addColorStop(1, rgba(m.c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(m.x - m.r * 3, m.y - m.r * 3, m.r * 6, m.r * 6);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (still) frame(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !still && !document.hidden) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (visible && !still && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    if (still) frame(performance.now());
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reducedMotion]);

  return <canvas ref={ref} aria-hidden="true" className={`block size-full ${className}`} />;
}
