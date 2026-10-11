import { useEffect, useRef, useState } from "react";
import type { Screen } from "./types/navigation";
import Home from "./pages/Home";
import LiveConcert from "./pages/LiveConcert";
import AtHomeConcert from "./pages/AtHomeConcert";
import { connectLiveBackend } from "./live/liveBridge";
import AnnouncementBanner from "./components/AnnouncementBanner";
import { startWatchRelay } from "./lib/watchRelay";
import { useSettings } from "./hooks/useSettings";
import NightSky from "./components/fx/NightSky";
import DropTakeover from "./components/fx/DropTakeover";
import PressRipple from "./components/fx/PressRipple";
import BeamWipe from "./components/fx/BeamWipe";

// Each screen has its own address (#live, #watch), so the phone's Back gesture returns to Home instead of
// leaving the app, and a reload stays on the same screen.
const HASH: Record<Screen, string> = { home: "", live: "#live", "at-home": "#watch" };
const screenFromHash = (): Screen => (location.hash === "#live" ? "live" : location.hash === "#watch" ? "at-home" : "home");

export default function App() {
  const [screen, setScreenState] = useState<Screen>(screenFromHash);
  // Counts screen changes, so the beam wipe plays on each change but not on first load.
  const [cuts, setCuts] = useState(0);
  const show = (next: Screen) => {
    setScreenState(next);
    setCuts((n) => n + 1);
  };
  const setScreen = (next: Screen) => {
    if (next !== screenFromHash()) {
      const url = HASH[next] || location.pathname + location.search;
      // Opening a screen from Home adds a history entry; going Home from a reloaded screen replaces it.
      if (next === "home") history.replaceState(null, "", url);
      else history.pushState({ fromHome: true }, "", url);
    }
    show(next);
  };

  // Browser Back and Forward (including the swipe on phones) move between screens.
  useEffect(() => {
    const onPop = () => show(screenFromHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const { settings } = useSettings();
  const reducedMotion = settings.reducedMotion;

  // Move focus to the new screen so keyboard and screen-reader users land at the top.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [screen]);

  // Link to the watch relay, so Vy's watch app (or a phone via watch-sim.html) can join. The relay runs in the
  // Vite server: `npm run dev` and `vite preview` (start.sh's demo mode, ports 4xxx/5xxx). A deployed build
  // served by the backend has no relay, so it doesn't try.
  useEffect(() => (import.meta.env.DEV || /^[45]\d{3}$/.test(window.location.port) ? startWatchRelay() : undefined), []);

  // One connection to the AuraBeat backend for the whole app: live cues, the watch, wrist waves.
  useEffect(() => connectLiveBackend(), []);

  // Exit steps back through history when the screen was opened from Home, so a later Back doesn't reopen it.
  const goHome = () => {
    if ((history.state as { fromHome?: boolean } | null)?.fromHome) history.back();
    else setScreen("home");
  };

  return (
    <main ref={mainRef} tabIndex={-1} className="relative isolate min-h-dvh outline-none">
      <NightSky reducedMotion={reducedMotion} />
      {/* Each screen comes into focus as it arrives. */}
      <div key={screen} className="animate-page-in">
        {screen === "home" && <Home onSelect={setScreen} />}
        {screen === "live" && <LiveConcert onExit={goHome} />}
        {screen === "at-home" && <AtHomeConcert onExit={goHome} />}
      </div>
      {cuts > 0 && <BeamWipe key={cuts} reducedMotion={reducedMotion} />}
      <AnnouncementBanner />
      <DropTakeover reducedMotion={reducedMotion} />
      <PressRipple reducedMotion={reducedMotion} />
    </main>
  );
}
