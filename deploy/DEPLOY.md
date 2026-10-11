# Deploy to Vultr (about 15 minutes)

You end up with one HTTPS address, for example `https://203-0-113-5.sslip.io`. Phones open it from any network (no hotspot), the watch connects to `wss://203-0-113-5.sslip.io/ws?role=watch&session=demo`, and the dashboard is at `/dashboard`.

HTTPS isn't optional for a good demo. Phones only allow screen wake lock and a secure live connection on HTTPS. Caddy gets the certificate automatically.

## 1. Create the server

On Vultr, go to Deploy, then Cloud Compute, then Shared CPU. Pick Ubuntu 24.04 with 1 vCPU and 1 GB of RAM or more. Note the IP address.

In the server's firewall group (if you use one), allow inbound TCP 22, 80 and 443.

## 2. Install Docker

```bash
ssh root@<IP>
curl -fsSL https://get.docker.com | sh
```

## 3. Upload AuraBeat

From your laptop, in the folder that contains this file:

```bash
scp -r . root@<IP>:/opt/aurabeat
```

Or upload the zip and unzip it into `/opt/aurabeat`.

## 4. Configure

```bash
ssh root@<IP>
cd /opt/aurabeat/deploy
cp .env.example .env
nano .env
```

Set `DOMAIN` to your IP with dashes plus `.sslip.io`. 203.0.113.5 becomes `203-0-113-5.sslip.io`, and sslip.io points that name at your IP with no DNS setup. Add `TIGER_DATABASE_URL` and `GEMINI_API_KEY` if you have them.

## 5. Start

```bash
docker compose up -d --build
docker compose logs -f app     # Ctrl+C to stop watching
```

The first build takes a few minutes. Open `https://<DOMAIN>/health` and you should see `{"ok":true,...}`.

## 6. Use it

| Who | Address |
|---|---|
| Phones | `https://<DOMAIN>` |
| Watch | `wss://<DOMAIN>/ws?role=watch&session=demo` |
| Staff / judges | `https://<DOMAIN>/dashboard` |
| Ambient lightstick | `https://<DOMAIN>/lightstick` |

To play the song from your laptop to the deployed server, run `python scripts/play_song.py --url https://<DOMAIN>`. The music plays on the laptop and the beats go out from the server.

For live mic mode, run `python scripts/live_audio.py --url https://<DOMAIN>`. The laptop listens and sends what it hears to the cloud.

## Updating

```bash
cd /opt/aurabeat/deploy && docker compose up -d --build
```

## If something's wrong

- **The certificate doesn't appear:** ports 80 and 443 must be open, and `DOMAIN` must match the server's IP. Check with `docker compose logs caddy`.
- **Phones say Disconnected:** open `https://<DOMAIN>/health` on the phone. If that loads, check the browser console for the WebSocket URL.
- **Latency:** a server far from the venue adds round-trip time. Pick the Vultr region closest to you. The shared "show at" time (150 ms ahead) absorbs normal jitter. On a bad network, raise it with `LIGHT_BUFFER_MS=250` in `.env`.
