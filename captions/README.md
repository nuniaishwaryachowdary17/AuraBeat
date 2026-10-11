# Standalone captions page (optional)

You don't need this anymore: live speech captions are built into the **Live Demo** screen and the main
backend on port 8001 (see START_HERE.md). This folder keeps the original standalone tool
(`captions_server.py` + `captions.html`, names matched) for testing on its own:

```bash
cd captions
python3 captions_server.py     # paste the ElevenLabs key, open http://localhost:8765
```
It forwards finished lines to the AuraBeat backend at http://127.0.0.1:8001 (set AURABEAT_BACKEND to change).
