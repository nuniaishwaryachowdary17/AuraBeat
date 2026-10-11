import SwiftUI

@main
struct AuraBeatWatchApp: App {
    @StateObject private var session = WatchSession()

    var body: some Scene {
        WindowGroup {
            // Page 1 is the AuraBeat screen; swipe down for the diagnostic page (local haptic test,
            // network probes, wave recorder). Drop HapticTestView once the physical watch is confirmed.
            TabView {
                ContentView(client: session.client)
                    .environmentObject(session)
                HapticTestView()
            }
            .tabViewStyle(.verticalPage)
        }
    }
}
