import Foundation
import Security

enum Keychain {
    static func read(_ key: String) -> Data? {
        let query: [String: Any] = [kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:"com.bryan.donas.control",kSecAttrAccount as String:key,
            kSecReturnData as String:true,kSecMatchLimit as String:kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary,&result)==errSecSuccess else { return nil }
        return result as? Data
    }
    static func save(_ data: Data?, key: String) throws {
        let query: [String: Any] = [kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:"com.bryan.donas.control",kSecAttrAccount as String:key]
        guard let data else { SecItemDelete(query as CFDictionary); return }
        let attributes: [String: Any] = [kSecValueData as String:data,
            kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let update=SecItemUpdate(query as CFDictionary,attributes as CFDictionary)
        if update==errSecSuccess { return }
        if update==errSecItemNotFound {
            var item=query; attributes.forEach { item[$0.key]=$0.value }
            if SecItemAdd(item as CFDictionary,nil)==errSecSuccess { return }
        }
        throw BusinessError.invalid("No se pudo guardar la sesión en el llavero.")
    }
}
struct AdminSession: Codable, Sendable {
    let accessToken: String; let refreshToken: String; let expiresAt: String; let userId: String;let role: String
    var expiry: Date {
        let formatter=ISO8601DateFormatter(); formatter.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
        return formatter.date(from:expiresAt) ?? ISO8601DateFormatter().date(from:expiresAt) ?? .distantPast
    }
}
struct APIEnvelope<T: Decodable>: Decodable { let ok: Bool; let data: T?; let error: APIErrorBody? }
struct APIErrorBody: Decodable { let code: String; let message: String }
struct APIProblem: LocalizedError, Sendable {
    let status: Int; let code: String; let message: String
    var errorDescription: String? { message }
}
struct OrderSyncPage: Decodable, Sendable {
    let orders: [RemoteOrder]; let nextCursor: String?; let hasMore: Bool
}
struct SyncAck: Decodable, Sendable {
    let clientOperationId: UUID; let status: String; let serverSequence: Int64; let errorCode: String?
}
struct SyncResponse: Decodable, Sendable { let acknowledgements: [SyncAck] }
struct SavedInventory: Decodable, Sendable { let saved: Bool; let revision: Int64 }

actor SessionClient {
    private var session: AdminSession?
    private var renewal: Task<AdminSession, Error>?
    private var generation=0
    private let base=URL(string:"https://donas-racha.vercel.app")!
    init() { if let saved=Keychain.read("session") { session=try? JSONDecoder().decode(AdminSession.self,from:saved) } }
    var signedIn: Bool { session != nil }
    var ownerID: String? { session?.userId }
    var role: String? { session?.role }
    static var savedSession: AdminSession? { Keychain.read("session").flatMap { try? JSONDecoder().decode(AdminSession.self,from:$0) } }

    private func raw<T: Decodable & Sendable>(_ path: String, method: String="GET", body: Data?=nil,
                                             token: String?=nil) async throws -> T {
        var request=URLRequest(url:URL(string:base.absoluteString+path)!)
        request.httpMethod=method;request.httpBody=body;request.timeoutInterval=20
        request.setValue("application/json",forHTTPHeaderField:"Accept")
        if body != nil { request.setValue("application/json",forHTTPHeaderField:"Content-Type") }
        if let token { request.setValue("Bearer \(token)",forHTTPHeaderField:"Authorization") }
        let (data,response)=try await URLSession.shared.data(for:request)
        guard let http=response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        let envelope=try? JSONDecoder().decode(APIEnvelope<T>.self,from:data)
        guard (200...299).contains(http.statusCode),envelope?.ok==true,let result=envelope?.data else {
            throw APIProblem(status:http.statusCode,code:envelope?.error?.code ?? "SERVER_ERROR",
                message:envelope?.error?.message ?? "El servidor no respondió correctamente. Tus registros siguen guardados.")
        }
        return result
    }
    private func store(_ value: AdminSession) throws {
        try Keychain.save(JSONEncoder().encode(value),key:"session");session=value
    }
    func login(email: String, password: String, expectedOwner: String?) async throws -> String {
        let body=try JSONEncoder().encode(["grantType":"password","email":email.trimmingCharacters(in:.whitespacesAndNewlines),"password":password])
        let value: AdminSession=try await raw("/api/auth/session",method:"POST",body:body)
        if let expectedOwner,expectedOwner != value.userId {
            throw BusinessError.invalid("Este libro pertenece a otra cuenta. Exporta sus datos y usa un dispositivo separado para el otro negocio.")
        }
        try store(value); return value.userId
    }
    private func token(rejected: String?=nil) async throws -> String {
        guard let saved=session else { throw APIProblem(status:401,code:"LOGIN_REQUIRED",message:"Conecta tu cuenta desde Ajustes.") }
        if saved.accessToken != rejected && saved.expiry>Date().addingTimeInterval(60) { return saved.accessToken }
        if let renewal { return try await renewal.value.accessToken }
        let stamp=generation
        let task=Task<AdminSession,Error> {
            try await self.raw("/api/auth/session",method:"POST",body:JSONEncoder().encode([
                "grantType":"refresh_token","refreshToken":saved.refreshToken]))
        }
        renewal=task
        defer { renewal=nil }
        do {
            let refreshed=try await task.value
            guard generation==stamp else { throw CancellationError() }
            try store(refreshed);return refreshed.accessToken
        } catch let problem as APIProblem {
            if generation==stamp && (problem.code=="INVALID_CREDENTIALS" || problem.code=="STAFF_REQUIRED") {
                try Keychain.save(nil,key:"session");session=nil
            }
            throw problem
        }
    }
    func request<T: Decodable & Sendable>(_ path: String, method: String="GET", body: [String:JSONValue]?=nil) async throws -> T {
        let encoded=try body.map { try JSONEncoder().encode($0) }
        let access=try await token()
        do { return try await raw(path,method:method,body:encoded,token:access) }
        catch let problem as APIProblem where problem.status==401 {
            let refreshed=try await token(rejected:access)
            return try await raw(path,method:method,body:encoded,token:refreshed)
        }
    }
    func push(_ operations: [SyncOperation], device: UUID) async throws -> SyncResponse {
        struct Upload: Encodable { let deviceId: UUID; let deviceName: String; let appVersion: String; let operations: [SyncOperation] }
        let body=try JSONEncoder().encode(Upload(deviceId:device,deviceName:"Donas Control iOS",appVersion:"1.3.0",operations:operations))
        let access=try await token()
        do { return try await raw("/api/sync",method:"POST",body:body,token:access) }
        catch let problem as APIProblem where problem.status==401 {
            let refreshed=try await token(rejected:access)
            return try await raw("/api/sync",method:"POST",body:body,token:refreshed)
        }
    }
    func logout(device: UUID) async throws {
        let _: JSONValue=try await request("/api/admin/customers/devices",method:"DELETE",body:["deviceId":.string(device.uuidString)])
        generation+=1;renewal?.cancel();renewal=nil
        try Keychain.save(nil,key:"session");session=nil
    }
}
