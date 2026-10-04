import Foundation
import Network

@MainActor final class NetworkStatus: ObservableObject {
    @Published private(set) var online=false
    @Published private(set) var wifi=false
    private var wifiSince: Date?
    private let monitor=NWPathMonitor()
    var stableWifi: Bool { wifi && (wifiSince.map { Date().timeIntervalSince($0)>=10 } ?? false) }
    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online=path.status == .satisfied
            let wifi=online && path.usesInterfaceType(.wifi) && !path.isConstrained
            Task { @MainActor in
                guard let self else { return }
                if !wifi { self.wifiSince=nil } else if !self.wifi { self.wifiSince=Date() }
                self.online=online;self.wifi=wifi
            }
        }
        monitor.start(queue:DispatchQueue(label:"donas.network"))
    }
    deinit { monitor.cancel() }
}
