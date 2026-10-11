#!/bin/bash
# AuraBeat: start the whole demo with one command.
#   bash start.sh        clean demo build (what judges should see)
#   bash start.sh dev    developer mode: DEV panels, hot reload, watch simulator
#  - stops any older AuraBeat still running (ports 8001 and 5173)
#  - first run only: sets up Python in ~/aurabeat-venv and installs the app
#  - starts the backend (log in backend.log) and the phone app
#  - Ctrl+C stops both
cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"
MODE="${1:-demo}"
VENV="$HOME/aurabeat-venv"

echo "1/4  Stopping older AuraBeat servers (ports 8001, 5173)..."
for port in 8001 5173; do
  pids=$(lsof -ti tcp:$port 2>/dev/null)
  if [ -n "$pids" ]; then kill $pids 2>/dev/null; fi
done
sleep 1

echo "2/4  Checking Python..."
if [ ! -x "$VENV/bin/python" ]; then
  echo "     First run: setting up Python in $VENV (up to a minute, please wait)..."
  python3 -m venv "$VENV" || { echo "Could not create the Python environment."; exit 1; }
fi
if ! "$VENV/bin/python" -c "import fastapi, uvicorn, pydantic" 2>/dev/null; then
  echo "     Installing backend packages (about a minute)..."
  "$VENV/bin/python" -m pip install -q -r backend/requirements.txt || { echo "pip install failed (check the internet connection)."; exit 1; }
fi

echo "3/4  Checking the app..."
if [ ! -d node_modules ]; then
  echo "     First run: installing the app (about 30 seconds)..."
  npm install --no-audit --no-fund || { echo "npm install failed (is Node.js installed?)."; exit 1; }
fi
[ -f public/media/grateful.webm ] || echo "     WARNING: public/media/grateful.webm is missing (At-home video)."
[ -f backend/media/grateful.mp3 ] || echo "     WARNING: backend/media/grateful.mp3 is missing (song for play.sh)."

# The ElevenLabs key is optional: live speech captions and Nova, the voice host. The key stays in this terminal's memory and the backend's; it is
# never written to a file or sent to any browser.
if [ -z "$ELEVENLABS_API_KEY" ]; then
  echo
  echo "     Captions + Nova voice host (optional): paste your ElevenLabs API key and press Enter."
  echo "     Nova's agent is created and connected automatically the first time."
  echo "     Just press Enter to skip; everything else works without it."
  read -r -s -p "     ElevenLabs API key: " ELEVENLABS_API_KEY || true
  echo
fi
export ELEVENLABS_API_KEY
[ -n "$ELEVENLABS_API_KEY" ] && echo "     Captions + Nova: on (key kept in memory only)" || echo "     Captions + Nova: off"

echo "4/4  Starting the backend..."
(cd backend && exec "$VENV/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 8001 > "$ROOT/backend.log" 2>&1) &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null; echo; echo "AuraBeat stopped."' EXIT
for _ in $(seq 1 60); do curl -s localhost:8001/health >/dev/null 2>&1 && break; sleep 0.25; done
if ! curl -s localhost:8001/health >/dev/null 2>&1; then
  echo "The backend did not start. Last lines of backend.log:"; tail -20 "$ROOT/backend.log"; exit 1
fi

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "=============================================================="
echo "  AuraBeat is running. Keep this window open (Ctrl+C stops it)."
echo
echo "  Laptop:     http://localhost:5173"
echo "  Phone:      http://${IP:-<your-laptop-ip>}:5173   (same Wi-Fi)"
echo "  Dashboard:  http://localhost:8001/dashboard"
echo
echo "  Play the song + beats:  open a NEW terminal and run   bash play.sh"
echo "=============================================================="
echo
if [ "$MODE" = "dev" ]; then
  npx vite --host --port 5173 --strictPort --clearScreen false
else
  echo "Building the demo version (a few seconds)..."
  npx vite build --logLevel warn || { echo "Build failed. Try:  bash start.sh dev"; exit 1; }
  npx vite preview --host --port 5173 --strictPort
fi
