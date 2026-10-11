#!/bin/bash
# Stop every AuraBeat server on this laptop (backend 8001, app 5173-5175), from any version.
for port in 8001 5173 5174 5175; do
  pids=$(lsof -ti tcp:$port 2>/dev/null)
  if [ -n "$pids" ]; then kill $pids 2>/dev/null && echo "Stopped port $port"; else echo "Nothing on port $port"; fi
done
