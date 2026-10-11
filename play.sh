#!/bin/bash
# Play "Grateful" on this laptop's speakers and send its beats to every phone and watch, in sync.
#   bash play.sh              song + beats
#   bash play.sh --silent     beats only (music plays from somewhere else)
#   bash play.sh --nudge 80   beats 80 ms later, if the light feels early (e.g. Bluetooth speakers)
# Start the phones first: Live Demo -> Start live mode. The first drop is at 1:16.
cd "$(dirname "$0")/backend" || exit 1
VENV="$HOME/aurabeat-venv"
[ -x "$VENV/bin/python" ] || { echo "Python isn't set up yet. Run  bash start.sh  once (or see START_HERE.md, first-time setup)."; exit 1; }
curl -s localhost:8001/health >/dev/null 2>&1 || { echo "The backend isn't running. Start it first (bash start.sh, or Terminal 1 in START_HERE.md)."; exit 1; }
exec "$VENV/bin/python" scripts/play_song.py "$@"
