import Foundation

public enum Ledger {
    private static func check(_ valid: Bool, _ message: String) throws { if !valid { throw BusinessError.invalid(message) } }
    @discardableResult private static func add(_ state: inout BusinessState, type: String, title: String,
        amount: Int64, account: String? = nil, items: [String: Int] = [:], lines: [JournalLine] = [],
        allocations: [Allocation] = [], details: [String: JSONValue] = [:], reversedID: Int64? = nil,
        remoteID: String? = nil, id: UUID = UUID()) throws -> UUID {
        if state.events.contains(where: { $0.id == id }) { return id }
        try check(lines.reduce(Int64(0)) { $0 + $1.cents } == 0,"El asiento no está balanceado.")
        let local = (state.events.last?.localID ?? 0)+1; let date = Date()
        var payload: [String: JSONValue] = ["localEventId":.number(local),"requestKey":.string(id.uuidString),
            "amountCents":.number(amount),"accountCode":account.map(JSONValue.string) ?? .null,
            "details":.object(details)]
        if let reversedID { payload["reversedEventId"] = .number(reversedID) }
        let operation = SyncOperation(clientOperationId:id,type:type,occurredAt:iso(date),payload:payload)
        state.events.append(LocalEvent(id:id,localID:local,date:date,title:title,type:type,amountCents:amount,
            account:account,items:items,lines:lines,allocations:allocations,operation:operation,remoteOrderID:remoteID,reversed:false))
        return id
    }
    private static func line(_ account: String, _ cents: Int64) -> JournalLine { JournalLine(account:account,cents:cents) }
    public static func openDay(_ state: inout BusinessState, cash: Int64, yappy: Int64) throws {
        try check(!state.dayOpen,"Ya hay una jornada abierta.")
        try check(cash>=0 && yappy>=0 && cash+yappy<=1_000_000_000,"Saldos iniciales inválidos.")
        try add(&state,type:"SESSION_START",title:"Inicio de jornada",amount:cash+yappy,
            lines:[line("CASH",cash),line("YAPPY",yappy),line("EQUITY",-cash-yappy)])
        state.dayOpen = true
    }
    public static func closeDay(_ state: inout BusinessState) throws {
        try check(state.dayOpen,"No hay jornada abierta.")
        try add(&state,type:"SESSION_CLOSE",title:"Cierre de jornada",amount:0)
        state.dayOpen = false
    }
    public static func seedInventory(_ state: inout BusinessState, items: [String:Int], costCents: Int64) throws {
        try check(state.lots.isEmpty,"El inventario inicial solo se registra antes de comprar o vender en este libro.")
        try check(items.count==4 && items.allSatisfy { Flavor(rawValue:$0.key) != nil && (0...100000).contains($0.value) },"Completa las existencias iniciales de los cuatro sabores.")
        let quantity=items.values.reduce(0,+)
        try check(quantity>0 && costCents>=0 && costCents<=1_000_000_000,"Cantidad o costo inicial inválidos.")
        // Existing stock is an opening balance, never a new purchase in shared inventory.
        try add(&state,type:"OPENING_BALANCE",title:"Existencias iniciales del libro",amount:0,items:items,
            lines:[line("INVENTORY",costCents),line("EQUITY",-costCents)],details:["existingStock":.bool(true)])
        state.lots.append(Lot(id:UUID(),remaining:items,costCents:costCents,createdAt:Date()))
    }
    public static func purchase(_ state: inout BusinessState, boxes: Int, account: String, id: UUID = UUID()) throws {
        if state.events.contains(where: { $0.id == id }) { return }
        try check((1...10000).contains(boxes),"Compra entre 1 y 10000 cajas.")
        try check(["CASH","YAPPY","LOAN"].contains(account),"Elige una cuenta válida.")
        let cost = state.config.boxCostCents*Int64(boxes)
        try check(cost>0 && cost<=1_000_000_000,"Costo de cajas inválido.")
        try check(account=="LOAN" || state.balance(account)>=cost,"Saldo insuficiente.")
        let items = Dictionary(uniqueKeysWithValues:Flavor.allCases.map { ($0.rawValue,$0.perBox*boxes) })
        try add(&state,type:"PURCHASE",title:"Compra de \(boxes) caja(s)",amount:-cost,account:account,items:items,
            lines:[line("INVENTORY",cost),line(account,-cost)],details:["boxes":.number(Int64(boxes)),"donutsPerBox":.number(12)],id:id)
        state.lots.append(Lot(id:UUID(),remaining:items,costCents:cost,createdAt:Date()))
    }
    public static func sale(_ state: inout BusinessState, items: [String: Int], account: String,
        remoteID: String? = nil, revenueOverride: Int64? = nil, id: UUID = UUID()) throws {
        if state.events.contains(where: { $0.id == id }) || (remoteID != nil && state.events.contains(where: { $0.remoteOrderID==remoteID })) { return }
        try check(state.dayOpen,"Abre una jornada antes de vender.")
        try check(["CASH","YAPPY"].contains(account),"Elige Efectivo o Yappy.")
        try check(!items.isEmpty && items.allSatisfy { Flavor(rawValue:$0.key) != nil && (1...99).contains($0.value) },"Selecciona los sabores y cantidades.")
        let quantity = items.values.reduce(0,+)
        try check(quantity<=99,"Máximo 99 donas por venta.")
        for (sku,count) in items { try check(state.stock(Flavor(rawValue:sku)!)>=count,"No hay suficientes donas de ese sabor en este dispositivo.") }
        var candidate = state
        var allocations: [Allocation] = []; var cost: Int64 = 0
        var remaining = items
        for index in candidate.lots.indices {
            var used: [String: Int] = [:]
            for flavor in Flavor.allCases {
                let sku = flavor.rawValue
                let take = min(remaining[sku] ?? 0,candidate.lots[index].remaining[sku] ?? 0)
                if take>0 { used[sku]=take; remaining[sku,default:0]-=take }
            }
            let take = used.values.reduce(0,+)
            if take==0 { continue }
            let lotCost = candidate.lots[index].costCents*Int64(take)/Int64(candidate.lots[index].quantity)
            for (sku,count) in used { candidate.lots[index].remaining[sku,default:0]-=count }
            candidate.lots[index].costCents-=lotCost; cost+=lotCost
            allocations.append(Allocation(lotID:candidate.lots[index].id,items:used,cost:lotCost))
        }
        let revenue = revenueOverride ?? state.config.unitPriceCents*Int64(quantity)
        try check(revenue>0 && revenue<=1_000_000_000,"Importe de venta inválido.")
        var details: [String: JSONValue] = ["quantity":.number(Int64(quantity)),"unitPriceCents":.number(state.config.unitPriceCents),"costCents":.number(cost)]
        if let remoteID { details["remoteOrderId"] = .string(remoteID) }
        else { details["items"] = .array(items.sorted { $0.key<$1.key }.map { .object(["sku":.string($0.key),"quantity":.number(Int64($0.value))]) }) }
        try add(&candidate,type:"SALE",title:remoteID == nil ? "Venta presencial" : "Pedido entregado",amount:revenue,account:account,
            items:items,lines:[line(account,revenue),line("SALES",-revenue),line("COGS",cost),line("INVENTORY",-cost)],
            allocations:allocations,details:details,remoteID:remoteID,id:id)
        state = candidate
    }
    public static func reverseLastSale(_ state: inout BusinessState) throws {
        guard let index = state.events.lastIndex(where: { $0.type=="SALE" && !$0.reversed }) else { throw BusinessError.invalid("No hay una venta activa para deshacer.") }
        let sale = state.events[index]
        try check(sale.remoteOrderID==nil,"La devolución de un pedido entregado requiere conciliación con el servidor.")
        for allocation in sale.allocations {
            guard let lot = state.lots.firstIndex(where: { $0.id==allocation.lotID }) else { throw BusinessError.invalid("Falta un lote de inventario.") }
            for (sku,count) in allocation.items { state.lots[lot].remaining[sku,default:0]+=count }
            state.lots[lot].costCents+=allocation.cost
        }
        try add(&state,type:"REVERSAL",title:"Reversión de venta",amount:-sale.amountCents,account:sale.account,
            lines:sale.lines.map { line($0.account,-$0.cents) },reversedID:sale.localID)
        state.events[index].reversed = true
    }
    public static func expense(_ state: inout BusinessState, cents: Int64, account: String, title: String, personal: Bool = false) throws {
        try check(["CASH","YAPPY"].contains(account) && cents>0 && cents<=1_000_000_000 && state.balance(account)>=cents,"Revisa el importe y el saldo disponible.")
        try add(&state,type:"EXPENSE",title:title,amount:-cents,account:account,
            lines:[line(account,-cents),line(personal ? "PERSONAL" : "EXPENSE",cents)])
    }
    public static func transfer(_ state: inout BusinessState, cents: Int64, fee: Int64, from: String) throws {
        try check(["CASH","YAPPY"].contains(from) && cents>0 && fee>=0 && cents+fee<=1_000_000_000 && state.balance(from)>=cents+fee,"Saldo insuficiente o importe inválido.")
        try add(&state,type:"TRANSFER",title:"Transferencia entre cuentas",amount:-fee,account:from,
            lines:[line(from,-cents-fee),line(from=="CASH" ? "YAPPY" : "CASH",cents),line("EXPENSE",fee)])
    }
    public static func loan(_ state: inout BusinessState, cents: Int64, account: String, repay: Bool) throws {
        try check(["CASH","YAPPY"].contains(account) && cents>0 && cents<=1_000_000_000,"Importe inválido.")
        if repay { try check(state.balance(account)>=cents && -state.balance("LOAN")>=cents,"Revisa el saldo y la deuda pendiente.") }
        let signed = repay ? -cents : cents
        try add(&state,type:repay ? "LOAN_PAYMENT" : "LOAN",title:repay ? "Pago de préstamo" : "Préstamo recibido",
            amount:signed,account:account,lines:[line(account,signed),line("LOAN",-signed)])
    }
    public static func partnerPayment(_ state: inout BusinessState, cents: Int64, account: String, name: String) throws {
        try check(["CASH","YAPPY"].contains(account) && cents>0 && state.balance(account)>=cents,"Saldo insuficiente.")
        try add(&state,type:"PARTNER_PAYMENT",title:"Pago a \(name)",amount:-cents,account:account,
            lines:[line(account,-cents),line("PARTNER",cents)])
    }
    public static func shares(_ state: BusinessState) -> [(String,Int64)] {
        guard state.partners.reduce(0, { $0+$1.percentage })==100 else { return [] }
        let total = max(0,state.profit)
        var assigned = state.partners.map { total*Int64($0.percentage)/100 }
        let remainder = total-assigned.reduce(0,+)
        let ranked = state.partners.indices.sorted {
            let a = total*Int64(state.partners[$0].percentage)%100,b = total*Int64(state.partners[$1].percentage)%100
            return a==b ? $0<$1 : a>b
        }
        for index in 0..<Int(remainder) { assigned[ranked[index]]+=1 }
        return zip(state.partners,assigned).map { ($0.name,$1) }
    }
}
