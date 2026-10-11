import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { onAnnouncement, type Announcement } from "../live/liveBridge";
import { phoneCanVibrate } from "../lib/watchBridge";

/**
 * What venue staff say over the PA, as words on every screen. Deaf and hard-of-hearing fans otherwise
 * miss "the encore starts in 5 minutes" or "use exit B". Stays until dismissed — nothing auto-hides,
 * because missing it is the problem it solves. Sits above the full-screen lightstick.
 */
export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  // In true fullscreen (the lightstick), the browser draws only the fullscreen element, so the
  // banner has to live inside it to be seen.
  const [host, setHost] = useState<Element>(() => document.fullscreenElement ?? document.body);
  useEffect(() => {
    const sync = () => setHost(document.fullscreenElement ?? document.body);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(
    () =>
      onAnnouncement((a) => {
        setItems((prev) => (prev.some((p) => p.id === a.id) ? prev : [a, ...prev].slice(0, 3)));
        if (phoneCanVibrate) navigator.vibrate(a.urgent ? [300, 120, 300, 120, 300] : [200, 100, 200]);
      }),
    [],
  );

  if (items.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {items.map((a) => (
        <section
          key={a.id}
          role={a.urgent ? "alert" : "status"}
          aria-label={a.urgent ? "Urgent announcement" : "Announcement"}
          className={`pointer-events-auto w-full max-w-xl rounded-2xl border bg-stage/95 p-4 shadow-2xl backdrop-blur ${
            a.urgent ? "border-alert" : "border-aura/50"
          }`}
        >
          <div className="flex items-start gap-3">
            <svg aria-hidden="true" viewBox="0 0 24 24" className={`mt-0.5 size-6 shrink-0 ${a.urgent ? "text-alert" : "text-aura"}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10v4h3l5 4V6L6 10H3Z" strokeLinejoin="round" />
              <path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" strokeLinecap="round" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${a.urgent ? "text-alert" : "text-aura"}`}>
                {a.urgent ? "Urgent announcement" : "Announcement"} ·{" "}
                {new Date(a.receivedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-1 text-lg leading-snug font-semibold text-ink">{a.text}</p>
            </div>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((p) => p.id !== a.id))}
              className="min-h-12 min-w-12 shrink-0 rounded-xl border border-white/20 px-3 text-sm font-semibold text-ink hover:bg-white/5"
            >
              Got it
            </button>
          </div>
        </section>
      ))}
    </div>,
    host,
  );
}
