import Foundation

/// Where the watch finds the AuraBeat relay.
///
/// During development the relay runs inside the web app's dev server on the Mac
/// (`npm run dev:watch`, plain http on port 5173). Put the Mac's address here:
/// IPv4 as `http://192.168.1.20:5173/…`, IPv6 in brackets, e.g. `http://[2600:…]:5173/…`.
/// Find it with `ipconfig getifaddr en0` (IPv4) or `ifconfig en0 | grep "inet6 2"` (IPv6).
/// http:// uses the relay's long-polling, which works on a physical watch; ws:// (…/relay?role=watch)
/// only works in the simulator, since watchOS blocks WebSockets for apps that aren't streaming audio.
///
/// Simulator only: or connect straight to the AuraBeat FastAPI backend (cues from the song timeline / live mic, waves scored
/// in Play Along):  ws://<Mac-IPv4>:8001/ws?role=watch&session=demo
/// The backend understands this app's wave message, and this app understands the backend's cues.
enum RelayConfig {
    static let url = URL(string: "http://192.168.1.184:5173/__aurabeat/relay")!
}
