import SwiftUI
import UserNotifications
import Security

private final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationPresenter()
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}

// Add this file to a new iPad App project in Xcode or Swift Playgrounds.
// A signed iPad app and APNs setup are required for alerts while the app is closed.
@main struct DonasControlApp: App {
    var body: some Scene { WindowGroup { OrdersView() } }
}

private enum Secrets {
    static func read(_ name: String) -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: name, kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func save(_ value: String?, as name: String) {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: name]
        SecItemDelete(query as CFDictionary)
        guard let value, let data = value.data(using: .utf8) else { return }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }
}

private struct Envelope<T: Decodable>: Decodable { let ok: Bool; let data: T }
private struct Session: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: String
}
private struct OrderPage: Decodable { let orders: [Order] }
private struct Order: Codable, Identifiable {
    let id: String
    let publicCode: String
    let status: String
    let customerName: String?
    let deliveryLocation: String?
    let totalCents: Int
    let createdAt: String
    private enum CodingKeys: String, CodingKey {
        case id, status
        case publicCode = "public_code"
        case customerName = "customer_name_snapshot"
        case deliveryLocation = "delivery_location"
        case totalCents = "total_cents"
        case createdAt = "created_at"
    }
}

@MainActor private final class OrdersModel: ObservableObject {
    @Published var orders: [Order] = []
    @Published var message = ""
    @Published var needsLogin = Secrets.read("refresh") == nil
    private var accessToken: String?
    private var expiresAt = Date.distantPast
    private var checkedOnce = false
    private var busy = false
    private let base = URL(string: "https://donas-racha.vercel.app")!
    private let decoder = JSONDecoder()

    init() {
        if let saved = Secrets.read("orderCache")?.data(using: .utf8),
           let cached = try? decoder.decode([Order].self, from: saved) { orders = cached }
        // Cached order IDs avoid repeat alerts after restarting the app.
        UNUserNotificationCenter.current().delegate = NotificationPresenter.shared
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    private func fetch<T: Decodable>(_ path: String, body: [String: String]? = nil,
                                     authorized: Bool = false) async throws -> T {
        var request = URLRequest(url: URL(string: base.absoluteString + "/" + path)!)
        request.timeoutInterval = 20
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        if authorized { request.setValue("Bearer \(try await token())", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "DonasControl", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "No se pudo conectar con pedidos."])
        }
        return try decoder.decode(Envelope<T>.self, from: data).data
    }

    private func store(_ session: Session) {
        Secrets.save(session.refreshToken, as: "refresh")
        accessToken = session.accessToken
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        expiresAt = format.date(from: session.expiresAt) ?? Date.distantPast
        needsLogin = false
    }

    private func token() async throws -> String {
        if let accessToken, expiresAt > Date().addingTimeInterval(60) { return accessToken }
        guard let refresh = Secrets.read("refresh") else { needsLogin = true; throw URLError(.userAuthenticationRequired) }
        do {
            let session: Session = try await fetch("api/auth/session",
                body: ["grantType": "refresh_token", "refreshToken": refresh])
            store(session)
            return session.accessToken
        } catch {
            Secrets.save(nil, as: "refresh")
            needsLogin = true
            throw error
        }
    }

    func login(email: String, password: String) async {
        do {
            let session: Session = try await fetch("api/auth/session",
                body: ["grantType": "password", "email": email, "password": password])
            store(session)
            await refresh()
        } catch { message = "No se pudo iniciar sesión: \(error.localizedDescription)" }
    }

    func refresh() async {
        guard !busy, !needsLogin else { return }
        busy = true
        defer { busy = false }
        do {
            let page: OrderPage = try await fetch("api/admin/orders?limit=100", authorized: true)
            let old = Set(orders.map(\.id))
            let saved = Set(UserDefaults.standard.stringArray(forKey: "seenOrderIds") ?? [])
            let known = old.union(saved)
            if checkedOnce || !saved.isEmpty {
                for order in page.orders where order.status == "PENDING" && !known.contains(order.id) {
                    let content = UNMutableNotificationContent()
                    content.title = "Nuevo pedido \(order.publicCode)"
                    content.body = "\(order.customerName ?? "Cliente") · \(order.deliveryLocation ?? "")"
                    content.sound = .default
                    try? await UNUserNotificationCenter.current().add(
                        UNNotificationRequest(identifier: order.id, content: content, trigger: nil))
                }
            }
            orders = page.orders
            if let encoded = try? JSONEncoder().encode(page.orders),
               let cached = String(data: encoded, encoding: .utf8) { Secrets.save(cached, as: "orderCache") }
            checkedOnce = true
            UserDefaults.standard.set(Array(Array(Set(page.orders.map(\.id)).union(saved)).suffix(500)), forKey: "seenOrderIds")
            message = "Pedidos actualizados"
        } catch { message = "Sin conexión. Revisa Wi‑Fi y vuelve a intentar." }
    }

    func logout() {
        Secrets.save(nil, as: "refresh")
        accessToken = nil
        needsLogin = true
        orders = []
        Secrets.save(nil, as: "orderCache")
    }
}

private struct OrdersView: View {
    @StateObject private var model = OrdersModel()
    @State private var email = ""
    @State private var password = ""
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            List {
                if model.needsLogin {
                    Section("Conectar una vez") {
                        TextField("Correo administrador", text: $email)
                            .textInputAutocapitalization(.never).keyboardType(.emailAddress)
                        SecureField("Contraseña", text: $password)
                        Button("Iniciar sesión") { Task { await model.login(email: email, password: password) } }
                    }
                }
                if !model.message.isEmpty { Text(model.message).font(.caption) }
                ForEach(model.orders) { order in
                    VStack(alignment: .leading, spacing: 5) {
                        Text("\(order.publicCode) · \(order.status)").font(.caption)
                        Text(order.customerName ?? "Cliente").font(.headline)
                        Text(order.deliveryLocation ?? "")
                        Text(String(format: "$%.2f", Double(order.totalCents) / 100))
                    }
                }
            }
            .navigationTitle("Pedidos Donas Control")
            .toolbar {
                Button("Actualizar") { Task { await model.refresh() } }
                if !model.needsLogin { Button("Salir") { model.logout() } }
            }
        }
        .task { await model.refresh() }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                if scenePhase == .active { await model.refresh() }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.refresh() } }
        }
    }
}
