import Foundation

public extension BusinessState {
    /// Reject damaged or edited backups before they reach accounting calculations.
    func validateBackup() throws {
        func check(_ condition: Bool) throws {
            if !condition { throw BusinessError.invalid("La copia contiene datos incoherentes. El libro actual se conserva.") }
        }
        let flavors=Set(Flavor.allCases.map(\.rawValue))
        let accounts=Set(["CASH","YAPPY","EQUITY","INVENTORY","SALES","COGS","EXPENSE","PERSONAL","LOAN","PARTNER"])
        try check(schema==1 && events.count<=100_000 && lots.count<=100_000 && orders.count<=100_000)
        try check((1...1_000_000).contains(config.boxCostCents) && (1...1_000_000).contains(config.unitPriceCents))
        try check((1...8).contains(partners.count) && Set(partners.map(\.id)).count==partners.count)
        try check(partners.allSatisfy { (0...100).contains($0.percentage) && !$0.name.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty })
        try check(partners.reduce(0) { $0+$1.percentage }==100)
        let ids=Set(events.map(\.id))
        try check(ids.count==events.count && acknowledged.isSubset(of:ids) && Set(rejected.keys).isSubset(of:ids))
        var previous: Int64=0
        for event in events {
            try check(event.localID>previous && event.localID<=1_000_000_000 && event.operation.id==event.id && event.operation.type==event.type)
            previous=event.localID
            try check((-1_000_000_000...1_000_000_000).contains(event.amountCents) && event.lines.count<=32)
            try check(event.lines.allSatisfy { accounts.contains($0.account) && (-1_000_000_000...1_000_000_000).contains($0.cents) })
            try check(event.lines.reduce(Int64(0)) { $0+$1.cents }==0)
            try check(event.items.allSatisfy { flavors.contains($0.key) && (0...100_000).contains($0.value) })
        }
        try check(Set(lots.map(\.id)).count==lots.count && Set(orders.map(\.id)).count==orders.count)
        let lotIDs=Set(lots.map(\.id))
        for lot in lots {
            try check(lot.remaining.count==4 && lot.remaining.allSatisfy { flavors.contains($0.key) && (0...100_000).contains($0.value) })
            try check((0...1_000_000_000).contains(lot.costCents) && (lot.quantity>0 || lot.costCents==0))
        }
        for event in events {
            try check(event.allocations.count<=100_000)
            for allocation in event.allocations {
                try check(lotIDs.contains(allocation.lotID) && (0...1_000_000_000).contains(allocation.cost))
                try check(allocation.items.allSatisfy { flavors.contains($0.key) && (1...99).contains($0.value) })
            }
        }
        try check(lots.reduce(Int64(0)) { $0+$1.costCents }==balance("INVENTORY"))
    }
}
