import Foundation
import SQLite3

enum OfflineConfig {
    static let appGroup = "group.com.bryan.donascontrol.offline"
}

enum Payment: String, CaseIterable, Identifiable {
    case cash = "Efectivo"
    case yappy = "Yappy"
    var id: String { rawValue }
}

struct Sale: Identifiable {
    let id: String
    let quantity: Int
    let payment: Payment
    let totalCents: Int64
    let date: Date
}

struct Dashboard {
    let stock: Int
    let priceCents: Int64
    let widgetQuantity: Int
    let widgetNotice: String
    let todayQuantity: Int
    let cashCents: Int64
    let yappyCents: Int64
    let sales: [Sale]
}

enum StoreError: LocalizedError {
    case unavailable
    case invalid(String)
    case database(String)

    var errorDescription: String? {
        switch self {
        case .unavailable: return "Activa App Groups para la app y el widget en Xcode."
        case .invalid(let message), .database(let message): return message
        }
    }
}

private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

private final class Database {
    private var connection: OpaquePointer?

    init() throws {
        guard let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: OfflineConfig.appGroup) else {
            throw StoreError.unavailable
        }
        let path = folder.appendingPathComponent("donas-offline.sqlite").path
        guard sqlite3_open_v2(path, &connection, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            let reason = connection.map { String(cString: sqlite3_errmsg($0)) } ?? "No se pudo abrir la base local."
            sqlite3_close(connection)
            connection = nil
            throw StoreError.database(reason)
        }
        sqlite3_busy_timeout(connection, 5000)
        try exec("PRAGMA journal_mode=WAL")
        try exec("CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY CHECK(id=1), stock INTEGER NOT NULL CHECK(stock>=0), price_cents INTEGER NOT NULL CHECK(price_cents>0))")
        try exec("INSERT OR IGNORE INTO config VALUES (1, 0, 100)")
        try exec("CREATE TABLE IF NOT EXISTS selection (id INTEGER PRIMARY KEY CHECK(id=1), quantity INTEGER NOT NULL, notice TEXT NOT NULL)")
        try exec("INSERT OR IGNORE INTO selection VALUES (1, 1, '')")
        try exec("CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity>0), payment TEXT NOT NULL CHECK(payment IN ('Efectivo','Yappy')), total_cents INTEGER NOT NULL, created_at REAL NOT NULL, reversed INTEGER NOT NULL DEFAULT 0)")
        try exec("CREATE INDEX IF NOT EXISTS sales_created_at ON sales(created_at)")
    }

    deinit { sqlite3_close(connection) }

    func exec(_ sql: String) throws {
        guard sqlite3_exec(connection, sql, nil, nil, nil) == SQLITE_OK else { throw error() }
    }

    func statement<T>(_ sql: String, _ body: (OpaquePointer) throws -> T) throws -> T {
        var prepared: OpaquePointer?
        guard sqlite3_prepare_v2(connection, sql, -1, &prepared, nil) == SQLITE_OK, let prepared else { throw error() }
        defer { sqlite3_finalize(prepared) }
        return try body(prepared)
    }

    func done(_ statement: OpaquePointer) throws {
        guard sqlite3_step(statement) == SQLITE_DONE else { throw error() }
    }

    func error() -> StoreError { .database(String(cString: sqlite3_errmsg(connection))) }

    func transaction<T>(_ body: () throws -> T) throws -> T {
        try exec("BEGIN IMMEDIATE")
        do {
            let result = try body()
            try exec("COMMIT")
            return result
        } catch {
            try? exec("ROLLBACK")
            throw error
        }
    }

    func stockAndPrice() throws -> (Int, Int64) {
        try statement("SELECT stock, price_cents FROM config WHERE id=1") { query in
            guard sqlite3_step(query) == SQLITE_ROW else { throw error() }
            return (Int(sqlite3_column_int(query, 0)), sqlite3_column_int64(query, 1))
        }
    }

    func selectedQuantity() throws -> Int {
        try statement("SELECT quantity FROM selection WHERE id=1") { query in
            guard sqlite3_step(query) == SQLITE_ROW else { throw error() }
            return Int(sqlite3_column_int(query, 0))
        }
    }
}

enum Store {
    static func snapshot() throws -> Dashboard {
        let db = try Database()
        let (stock, price) = try db.stockAndPrice()
        let quantity = try db.selectedQuantity()
        let notice = try db.statement("SELECT notice FROM selection WHERE id=1") { query -> String in
            guard sqlite3_step(query) == SQLITE_ROW, let raw = sqlite3_column_text(query, 0) else { throw db.error() }
            return String(cString: raw)
        }
        let start = Calendar.current.startOfDay(for: Date()).timeIntervalSince1970
        let totals = try db.statement("SELECT COALESCE(SUM(quantity),0), COALESCE(SUM(CASE WHEN payment='Efectivo' THEN total_cents ELSE 0 END),0), COALESCE(SUM(CASE WHEN payment='Yappy' THEN total_cents ELSE 0 END),0) FROM sales WHERE created_at>=? AND reversed=0") { query -> (Int, Int64, Int64) in
            sqlite3_bind_double(query, 1, start)
            guard sqlite3_step(query) == SQLITE_ROW else { throw db.error() }
            return (Int(sqlite3_column_int(query, 0)), sqlite3_column_int64(query, 1), sqlite3_column_int64(query, 2))
        }
        let sales = try db.statement("SELECT id, quantity, payment, total_cents, created_at FROM sales WHERE reversed=0 ORDER BY created_at DESC, rowid DESC LIMIT 30") { query -> [Sale] in
            var items: [Sale] = []
            var result = sqlite3_step(query)
            while result == SQLITE_ROW {
                guard let rawID = sqlite3_column_text(query, 0), let rawPayment = sqlite3_column_text(query, 2),
                      let payment = Payment(rawValue: String(cString: rawPayment)) else { throw db.error() }
                items.append(Sale(id: String(cString: rawID), quantity: Int(sqlite3_column_int(query, 1)), payment: payment,
                                  totalCents: sqlite3_column_int64(query, 3), date: Date(timeIntervalSince1970: sqlite3_column_double(query, 4))))
                result = sqlite3_step(query)
            }
            guard result == SQLITE_DONE else { throw db.error() }
            return items
        }
        return Dashboard(stock: stock, priceCents: price, widgetQuantity: quantity, widgetNotice: notice,
                         todayQuantity: totals.0, cashCents: totals.1, yappyCents: totals.2, sales: sales)
    }

    static func saveSettings(stock count: Int, priceCents cents: Int64) throws {
        guard (0...100_000).contains(count) else { throw StoreError.invalid("El stock debe estar entre 0 y 100 000.") }
        guard (1...100_000_000).contains(cents) else { throw StoreError.invalid("El precio debe estar entre B/. 0.01 y B/. 1 000 000.") }
        let db = try Database()
        try db.transaction {
            try db.statement("UPDATE config SET stock=?, price_cents=? WHERE id=1") { query in
                sqlite3_bind_int(query, 1, Int32(count))
                sqlite3_bind_int64(query, 2, cents)
                try db.done(query)
            }
        }
    }

    static func adjustWidgetQuantity(_ delta: Int) throws {
        guard delta == -1 || delta == 1 else { throw StoreError.invalid("Cambio de cantidad inválido.") }
        let db = try Database()
        try db.transaction {
            let current = try db.selectedQuantity()
            let stock = try db.stockAndPrice().0
            let next = max(1, min(min(99, max(1, stock)), current + delta))
            try db.statement("UPDATE selection SET quantity=?, notice='' WHERE id=1") { query in
                sqlite3_bind_int(query, 1, Int32(next))
                try db.done(query)
            }
        }
    }

    static func setWidgetNotice(_ message: String) throws {
        let db = try Database()
        try db.statement("UPDATE selection SET notice=? WHERE id=1") { query in
            sqlite3_bind_text(query, 1, message, -1, transient)
            try db.done(query)
        }
    }

    @discardableResult static func recordSale(quantity: Int, payment: Payment, fromWidget: Bool = false, requestID: String = UUID().uuidString) throws -> Int64 {
        let db = try Database()
        return try db.transaction {
            let existing = try db.statement("SELECT total_cents FROM sales WHERE id=?") { query -> Int64? in
                sqlite3_bind_text(query, 1, requestID, -1, transient)
                let result = sqlite3_step(query)
                if result == SQLITE_ROW { return sqlite3_column_int64(query, 0) }
                guard result == SQLITE_DONE else { throw db.error() }
                return nil
            }
            if let existing { return existing }
            let (stock, price) = try db.stockAndPrice()
            let units = fromWidget ? try db.selectedQuantity() : quantity
            guard units >= 1 && units <= 99 else { throw StoreError.invalid("Elige entre 1 y 99 donas.") }
            guard units <= stock else { throw StoreError.invalid("Stock insuficiente: quedan \(stock) donas.") }
            let total = try multiply(price, Int64(units))
            try db.statement("INSERT INTO sales(id,quantity,payment,total_cents,created_at) VALUES(?,?,?,?,?)") { query in
                sqlite3_bind_text(query, 1, requestID, -1, transient)
                sqlite3_bind_int(query, 2, Int32(units))
                sqlite3_bind_text(query, 3, payment.rawValue, -1, transient)
                sqlite3_bind_int64(query, 4, total)
                sqlite3_bind_double(query, 5, Date().timeIntervalSince1970)
                try db.done(query)
            }
            try db.statement("UPDATE config SET stock=stock-? WHERE id=1") { query in
                sqlite3_bind_int(query, 1, Int32(units))
                try db.done(query)
            }
            if fromWidget {
                try db.statement("UPDATE selection SET quantity=1, notice='Venta guardada' WHERE id=1") { query in try db.done(query) }
            }
            return total
        }
    }

    static func undoLastSale() throws {
        let db = try Database()
        try db.transaction {
            let last = try db.statement("SELECT id, quantity FROM sales WHERE reversed=0 ORDER BY created_at DESC, rowid DESC LIMIT 1") { query -> (String, Int) in
                guard sqlite3_step(query) == SQLITE_ROW, let rawID = sqlite3_column_text(query, 0) else {
                    throw StoreError.invalid("No hay ventas para deshacer.")
                }
                return (String(cString: rawID), Int(sqlite3_column_int(query, 1)))
            }
            try db.statement("UPDATE sales SET reversed=1 WHERE id=?") { query in
                sqlite3_bind_text(query, 1, last.0, -1, transient)
                try db.done(query)
            }
            try db.statement("UPDATE config SET stock=stock+? WHERE id=1") { query in
                sqlite3_bind_int(query, 1, Int32(last.1))
                try db.done(query)
            }
        }
    }

    private static func multiply(_ price: Int64, _ units: Int64) throws -> Int64 {
        let (result, overflow) = price.multipliedReportingOverflow(by: units)
        guard !overflow else { throw StoreError.invalid("El importe de la venta es demasiado grande.") }
        return result
    }
}

func money(_ cents: Int64) -> String {
    String(format: "B/. %.2f", Double(cents) / 100)
}
