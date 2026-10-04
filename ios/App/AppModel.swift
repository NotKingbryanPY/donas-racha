import Foundation
import SwiftUI
import UserNotifications

@MainActor final class AppModel: ObservableObject {
    static let shared=AppModel()
    @Published private(set) var state=BusinessState()
    @Published var message="Tus registros se guardan en este dispositivo."
    @Published private(set) var signedIn=SessionClient.savedSession != nil
    @Published private(set) var busy=false
    @Published var tab=0
    @Published private(set) var storageProblem=false
    @Published private(set) var pushRegistered=false
    @Published private(set) var role=SessionClient.savedSession?.role ?? "ADMIN"
    let network=NetworkStatus()
    private let client=SessionClient()
    private var store: LocalStore?
    init() {
        do { let storage=try LocalStore(); state=try storage.load();store=storage }
        catch { storageProblem=true;message="No se pudo abrir el archivo local. No registres ventas: \(error.localizedDescription)" }
    }
    @discardableResult func commit(_ change: (inout BusinessState) throws -> Void) -> Bool {
        guard let store,!storageProblem else { message="El almacenamiento necesita reparación. Conserva el archivo local.";return false }
        do {
            var next=state;try change(&next);try store.save(next);state=next
            return true
        } catch { message=error.localizedDescription;return false }
    }
    func record(_ change: (inout BusinessState) throws -> Void) {
        guard role=="ADMIN" else { message="Esta cuenta atiende pedidos. El administrador registra movimientos del negocio.";return }
        if commit(change) { message="Registro guardado. \(state.pending.count) pendientes de sincronizar.";Task { await synchronize() } }
    }
    func login(email: String, password: String) async {
        guard !busy else { return };busy=true
        do {
            let owner=try await client.login(email:email,password:password,expectedOwner:state.ownerID)
            guard commit({ $0.ownerID=owner }) else { busy=false;return }
            signedIn=true;message="Sesión guardada en el llavero."
            role=await client.role ?? "ADMIN"
            await requestNotifications()
        } catch { message=error.localizedDescription }
        busy=false
        await synchronize()
    }
    func logout() async {
        guard !busy else { return }
        if !state.pending.isEmpty { message="Sincroniza los registros pendientes antes de cerrar sesión.";return }
        busy=true;defer { busy=false }
        do {
            try await client.logout(device:state.deviceID)
            signedIn=false;pushRegistered=false
            commit { $0.orders=[];$0.orderCursor=nil;$0.inventory=nil }
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            message="Sesión cerrada. El libro local se conserva."
        } catch { message="Conecta a Internet para desvincular los avisos: \(error.localizedDescription)" }
    }
    func requestNotifications() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.sound,.badge])
        UIApplication.shared.registerForRemoteNotifications()
        await registerPush()
    }
    func registerPush() async {
        guard signedIn,let token=UserDefaults.standard.string(forKey:"apnsToken") else { return }
        #if DEBUG
        let environment="sandbox"
        #else
        let environment="production"
        #endif
        do {
            let _: JSONValue=try await client.request("/api/admin/customers/devices",method:"POST",body:[
                "deviceId":.string(state.deviceID.uuidString),"platform":.string("IOS"),"token":.string(token),
                "environment":.string(environment),"appVersion":.string("1.3.0")])
            struct Status: Decodable, Sendable { struct Configured: Decodable,Sendable { let ios: Bool };let configured: Configured }
            let status: Status=try await client.request("/api/admin/customers/devices")
            pushRegistered=status.configured.ios
        } catch { pushRegistered=false }
    }
    func synchronize() async {
        guard !busy,signedIn,network.online,!storageProblem else { return }
        busy=true;defer { busy=false }
        do {
            // Only upload after ten uninterrupted seconds of Wi-Fi. Reads can use cellular.
            while role=="ADMIN" && network.stableWifi && !state.pending.isEmpty {
                let batch=Array(state.pending.prefix(50))
                let response=try await client.push(batch,device:state.deviceID)
                let sent=Set(batch.map(\.clientOperationId))
                guard response.acknowledgements.count==batch.count,
                      Set(response.acknowledgements.map(\.clientOperationId))==sent else {
                    throw BusinessError.invalid("El servidor devolvió acuses incompletos. Se reintentará sin duplicar registros.")
                }
                var waiting=false
                guard commit({ next in
                    for ack in response.acknowledgements {
                        if ack.status=="APPLIED" || (ack.status=="RECEIVED" && !["SALE","REVERSAL"].contains(batch.first { $0.id==ack.clientOperationId }?.type ?? "")) {
                            next.acknowledged.insert(ack.clientOperationId)
                        } else if ack.status=="REJECTED" { next.rejected[ack.clientOperationId]=ack.errorCode ?? "Requiere conciliación" }
                        else { waiting=true }
                    }
                }) else { return }
                if waiting { break }
            }
            for _ in 0..<20 {
                let cursor=state.orderCursor.map { "&cursor=\($0.addingPercentEncoding(withAllowedCharacters:.urlQueryAllowed) ?? $0)" } ?? ""
                let page: OrderSyncPage=try await client.request("/api/sync?limit=100\(cursor)")
                let known=Set(state.orders.map(\.id))
                guard commit({ next in
                    var merged=Dictionary(uniqueKeysWithValues:next.orders.map { ($0.id,$0) })
                    page.orders.forEach { merged[$0.id]=$0 }
                    next.orders=merged.values.sorted { $0.createdAt>$1.createdAt }
                    next.orderCursor=page.nextCursor
                }) else { return }
                if !pushRegistered {
                    for order in page.orders where order.status=="PENDING" && !known.contains(order.id) { await notify(order) }
                }
                if !page.hasMore { break }
            }
            // A seller may deliver from Android while this administrator keeps the local book.
            // Ignore deliveries predating this book's opening balance.
            var unbooked=0
            if role=="ADMIN",let start=state.events.first?.date {
                let fractional=ISO8601DateFormatter();fractional.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
                let plain=ISO8601DateFormatter()
                for order in state.orders where order.status=="COMPLETED" && order.paymentStatus=="CONFIRMED" && !state.events.contains(where:{ $0.remoteOrderID==order.id }) {
                    guard let delivered=fractional.date(from:order.updatedAt) ?? plain.date(from:order.updatedAt),delivered>=start else { continue }
                    let items=Dictionary(order.items.compactMap { item -> (String,Int)? in
                        guard let sku=item.sku,Flavor(rawValue:sku) != nil else { return nil };return (sku,item.quantity)
                    },uniquingKeysWith:+)
                    guard state.dayOpen,!items.isEmpty,items.values.reduce(0,+)==order.items.reduce(0,{ $0+$1.quantity }) else { unbooked+=1;continue }
                    if !commit({ try Ledger.sale(&$0,items:items,account:order.paymentMethod,remoteID:order.id,revenueOverride:order.totalCents) }) { unbooked+=1 }
                }
            }
            let inventory: InventorySnapshot=try await client.request("/api/admin/customers/inventory")
            commit { $0.inventory=inventory;$0.lastSync=Date() }
            signedIn=await client.signedIn
            role=await client.role ?? role
            message=state.pending.isEmpty ? "Todo sincronizado." : "\(state.pending.count) registros esperando Wi‑Fi estable."
            if !state.rejected.isEmpty { message="\(state.rejected.count) registros requieren conciliación. No repitas la venta." }
            if unbooked>0 { message="\(unbooked) entregas confirmadas esperan asiento local. Abre jornada y revisa las existencias; no repitas el cobro." }
        } catch {
            signedIn=await client.signedIn
            message="\(error.localizedDescription) Los registros locales se conservan."
        }
    }
    private func notify(_ order: RemoteOrder) async {
        let content=UNMutableNotificationContent();content.title="Nuevo pedido \(order.publicCode)"
        content.body="Abre Donas Control para revisar el pedido.";content.sound = .default
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier:order.id,content:content,trigger:nil))
    }
    func transition(_ order: RemoteOrder, to status: String, payment: String?=nil) async {
        guard !busy,network.online else { message="Conecta a Internet para confirmar el estado de un pedido.";return }
        busy=true
        var outcome: String?
        var body: [String:JSONValue]=["status":.string(status)]
        if let payment { body["paymentReceived"] = .bool(true);body["paymentMethod"] = .string(payment) }
        do {
            let _: JSONValue=try await client.request("/api/admin/orders/\(order.id)/status",method:"POST",body:body)
            if status=="COMPLETED" && role=="ADMIN" {
                let items=Dictionary(order.items.compactMap { item -> (String,Int)? in
                    guard let sku=item.sku,Flavor(rawValue:sku) != nil else { return nil };return (sku,item.quantity)
                },uniquingKeysWith:+)
                if items.count>0 && items.values.reduce(0,+)==order.items.reduce(0,{ $0+$1.quantity }) {
                    let booked=commit { next in
                        if !next.dayOpen {
                            let cash=next.balance("CASH"),yappy=next.balance("YAPPY")
                            try Ledger.openDay(&next,cash:cash,yappy:yappy)
                        }
                        try Ledger.sale(&next,items:items,account:payment ?? order.paymentMethod,remoteID:order.id,revenueOverride:order.totalCents)
                    }
                    if !booked { outcome="Entrega confirmada en el servidor. El asiento local requiere conciliación; no repitas el cobro." }
                } else { outcome="Entrega confirmada. Faltan los sabores del pedido para conciliar el libro local; no repitas el cobro." }
            }
        } catch { outcome="\(error.localizedDescription) Actualiza para comprobar el resultado antes de reintentar." }
        busy=false;await synchronize()
        if let outcome { message=outcome }
    }
    func savePhysicalInventory(counts: [String:Int], revision: Int64) async {
        guard !busy,state.pending.isEmpty,network.stableWifi else { message="Sincroniza las ventas con Wi‑Fi estable antes de contar.";return }
        busy=true
        do {
            let _: SavedInventory=try await client.request("/api/admin/customers/inventory",method:"POST",body:[
                "counts":.object(counts.mapValues { .number(Int64($0)) }),"expectedRevision":.number(revision)])
            message="Conteo compartido guardado."
        } catch { message=error.localizedDescription }
        busy=false;await synchronize()
    }
    func export() throws -> URL {
        let file=FileManager.default.temporaryDirectory.appendingPathComponent("Donas-Control-\(Int(Date().timeIntervalSince1970)).json")
        try JSONEncoder().encode(state).write(to:file,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication]);return file
    }
    func restore(_ url: URL) throws {
        guard !busy,state.events.isEmpty else { throw BusinessError.invalid("Restaura únicamente en una instalación sin movimientos para conservar el libro actual.") }
        let access=url.startAccessingSecurityScopedResource();defer { if access { url.stopAccessingSecurityScopedResource() } }
        var restored=try JSONDecoder().decode(BusinessState.self,from:Data(contentsOf:url))
        guard restored.schema==1 else { throw BusinessError.invalid("Versión de copia no compatible.") }
        try restored.validateBackup()
        if let owner=SessionClient.savedSession?.userId,let old=restored.ownerID,owner != old { throw BusinessError.invalid("Esta copia pertenece a otra cuenta.") }
        // Preserve operation IDs and device ID: the server recognizes restored retries.
        restored.orders=[];restored.orderCursor=nil
        guard commit({ $0=restored }) else { throw BusinessError.invalid(message) }
    }
}
