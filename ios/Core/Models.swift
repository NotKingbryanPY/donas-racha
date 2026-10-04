import Foundation

public enum Flavor: String, CaseIterable, Codable, Sendable {
    case chocolate = "DR-CHOCOLATE"
    case vanilla = "DR-VAINILLA"
    case chocolateSprinkles = "DR-CHOCOLATE-CHISPAS"
    case vanillaSprinkles = "DR-VAINILLA-CHISPAS"
    public var name: String {
        switch self {
        case .chocolate: return "Chocolate"
        case .vanilla: return "Vainilla"
        case .chocolateSprinkles: return "Chocolate con chispas"
        case .vanillaSprinkles: return "Vainilla con chispas"
        }
    }
    public var perBox: Int { self == .chocolate || self == .vanilla ? 4 : 2 }
}

public enum JSONValue: Codable, Equatable, Sendable {
    case string(String), number(Int64), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
    public init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let v = try? value.decode(Bool.self) { self = .bool(v) }
        else if let v = try? value.decode(Int64.self) { self = .number(v) }
        else if let v = try? value.decode(String.self) { self = .string(v) }
        else if let v = try? value.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try value.decode([JSONValue].self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var value = encoder.singleValueContainer()
        switch self {
        case .null: try value.encodeNil()
        case .string(let v): try value.encode(v)
        case .number(let v): try value.encode(v)
        case .bool(let v): try value.encode(v)
        case .object(let v): try value.encode(v)
        case .array(let v): try value.encode(v)
        }
    }
}

public struct JournalLine: Codable, Sendable { public let account: String; public let cents: Int64 }
public struct Lot: Codable, Identifiable, Sendable {
    public let id: UUID
    public var remaining: [String: Int]
    public var costCents: Int64
    public let createdAt: Date
    public var quantity: Int { remaining.values.reduce(0,+) }
}
public struct Allocation: Codable, Sendable { public let lotID: UUID; public let items: [String: Int]; public let cost: Int64 }
public struct LocalEvent: Codable, Identifiable, Sendable {
    public let id: UUID
    public let localID: Int64
    public let date: Date
    public let title: String
    public let type: String
    public let amountCents: Int64
    public let account: String?
    public let items: [String: Int]
    public let lines: [JournalLine]
    public let allocations: [Allocation]
    public let operation: SyncOperation
    public let remoteOrderID: String?
    public var reversed: Bool
}
public struct SyncOperation: Codable, Identifiable, Sendable {
    public let clientOperationId: UUID
    public let type: String
    public let occurredAt: String
    public let payload: [String: JSONValue]
    public var id: UUID { clientOperationId }
}
public struct BusinessConfig: Codable, Sendable {
    public var boxCostCents: Int64 = 600
    public var unitPriceCents: Int64 = 100
    public init() {}
}
public struct Partner: Codable, Identifiable, Sendable {
    public var id = UUID()
    public var name: String
    public var percentage: Int
    public init(name: String, percentage: Int) { self.name = name; self.percentage = percentage }
}
public struct BusinessState: Codable, Sendable {
    public var schema = 1
    public var deviceID = UUID()
    public var ownerID: String?
    public var config = BusinessConfig()
    public var events: [LocalEvent] = []
    public var lots: [Lot] = []
    public var acknowledged: Set<UUID> = []
    public var rejected: [UUID: String] = [:]
    public var partners: [Partner] = [Partner(name: "Yo", percentage: 50),Partner(name: "Socio", percentage: 50)]
    public var dayOpen = false
    public var orderCursor: String?
    public var orders: [RemoteOrder] = []
    public var inventory: InventorySnapshot?
    public var lastSync: Date?
    public init() {}
    public var pending: [SyncOperation] { events.filter { !acknowledged.contains($0.id) && rejected[$0.id] == nil }.map(\.operation) }
    public func balance(_ account: String) -> Int64 { events.flatMap(\.lines).filter { $0.account == account }.reduce(0) { $0 + $1.cents } }
    public func stock(_ flavor: Flavor) -> Int { lots.reduce(0) { $0 + ($1.remaining[flavor.rawValue] ?? 0) } }
    public var stock: Int { lots.reduce(0) { $0 + $1.quantity } }
    public var profit: Int64 { -balance("SALES") - balance("COGS") - balance("EXPENSE") }
    public var activeOrders: [RemoteOrder] { orders.filter { !["COMPLETED","CANCELLED"].contains($0.status) } }
}

public struct RemoteOrder: Codable, Identifiable, Sendable {
    public let id: String
    public let publicCode: String
    public let status: String
    public let paymentMethod: String
    public let paymentStatus: String
    public let customerName: String?
    public let customerPhone: String?
    public let deliveryLocation: String?
    public let totalCents: Int64
    public let createdAt: String
    public let updatedAt: String
    public let items: [OrderItem]
    enum CodingKeys: String, CodingKey {
        case id,status,items
        case publicCode = "public_code", paymentMethod = "payment_method",paymentStatus = "payment_status"
        case customerName = "customer_name",customerPhone = "customer_phone",deliveryLocation = "delivery_location"
        case totalCents = "total_cents",createdAt = "created_at",updatedAt = "updated_at"
    }
    public var statusName: String {
        ["PENDING":"Pendiente","ACCEPTED":"Aceptado","OUT_FOR_DELIVERY":"En camino","COMPLETED":"Entregado","CANCELLED":"Cancelado"][status] ?? status
    }
}
public struct OrderItem: Codable, Sendable {
    public let quantity: Int
    public let variantName: String?
    public let sku: String?
}
public struct InventoryFlavor: Codable, Identifiable, Sendable {
    public let sku: String; public let name: String
    public let availableQuantity: Int; public let reservedQuantity: Int
    public let openingQuantity: Int; public let purchasedQuantity: Int; public let soldQuantity: Int
    public let counted: Bool
    public var id: String { sku }
    public var physical: Int { max(0,openingQuantity + purchasedQuantity - soldQuantity) }
    enum CodingKeys: String, CodingKey {
        case sku,name,counted
        case availableQuantity = "available_quantity",reservedQuantity = "reserved_quantity"
        case openingQuantity = "opening_quantity",purchasedQuantity = "purchased_quantity",soldQuantity = "sold_quantity"
    }
}
public struct InventorySnapshot: Codable, Sendable {
    public let flavors: [InventoryFlavor]; public let revision: Int64; public let serverTime: String
}
public enum BusinessError: LocalizedError {
    case invalid(String)
    public var errorDescription: String? { if case .invalid(let text) = self { return text }; return nil }
}
public func money(_ cents: Int64) -> String { String(format:"$%.2f",Double(cents)/100) }
public func iso(_ date: Date) -> String { ISO8601DateFormatter().string(from: date) }
public func parseCents(_ text: String) -> Int64? {
    let normalized=text.trimmingCharacters(in:.whitespacesAndNewlines).replacingOccurrences(of:",",with:".")
    let parts=normalized.split(separator:".",omittingEmptySubsequences:false)
    guard (1...2).contains(parts.count),!parts[0].isEmpty,parts[0].allSatisfy({ $0.isASCII && $0.isNumber }),
        let whole=Int64(parts[0]),whole<=10_000_000 else { return nil }
    let fraction=parts.count==2 ? String(parts[1]) : ""
    guard fraction.count<=2,fraction.allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
    let cents=Int64(fraction.isEmpty ? "0" : fraction.count==1 ? fraction+"0" : fraction) ?? 0
    return whole*100+cents
}
