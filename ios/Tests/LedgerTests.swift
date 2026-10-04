import XCTest
@testable import DonasControlCore

final class LedgerTests: XCTestCase {
    func testExistingInventoryDoesNotCreateAnotherPurchase() throws {
        var state=BusinessState()
        try Ledger.seedInventory(&state,items:Dictionary(uniqueKeysWithValues:Flavor.allCases.map { ($0.rawValue,$0.perBox) }),costCents:600)
        XCTAssertEqual(state.stock,12);XCTAssertEqual(state.pending.first?.type,"OPENING_BALANCE")
        XCTAssertEqual(state.balance("INVENTORY"),600);XCTAssertEqual(state.balance("EQUITY"),-600)
        XCTAssertThrowsError(try Ledger.seedInventory(&state,items:[:],costCents:0))
    }
    func prepared() throws -> BusinessState {
        var state=BusinessState();try Ledger.openDay(&state,cash:10_000,yappy:0)
        try Ledger.purchase(&state,boxes:1,account:"CASH");return state
    }
    func testBoxCompositionAndIdempotency() throws {
        var state=BusinessState();try Ledger.openDay(&state,cash:10_000,yappy:0)
        let id=UUID();try Ledger.purchase(&state,boxes:2,account:"CASH",id:id)
        try Ledger.purchase(&state,boxes:2,account:"CASH",id:id)
        XCTAssertEqual(state.stock,24)
        XCTAssertEqual(Flavor.allCases.map { state.stock($0) },[8,8,4,4])
        XCTAssertEqual(state.balance("CASH"),8800)
        XCTAssertEqual(state.pending.count,2)
    }
    func testSaleReversalRestoresCostAndFlavors() throws {
        var state=try prepared();let before=state.balance("CASH")
        try Ledger.sale(&state,items:[Flavor.chocolate.rawValue:3,Flavor.vanillaSprinkles.rawValue:1],account:"YAPPY")
        XCTAssertEqual(state.stock,8);XCTAssertEqual(state.profit,200)
        XCTAssertEqual(state.balance("YAPPY"),400)
        try Ledger.reverseLastSale(&state)
        XCTAssertEqual(state.stock,12);XCTAssertEqual(state.balance("INVENTORY"),600)
        XCTAssertEqual(state.balance("CASH"),before);XCTAssertEqual(state.balance("YAPPY"),0)
        XCTAssertEqual(state.profit,0)
        for event in state.events { XCTAssertEqual(event.lines.reduce(Int64(0)) { $0+$1.cents },0) }
    }
    func testFIFOConsumesRemainderExactly() throws {
        var state=try prepared();state.config.boxCostCents=601
        try Ledger.purchase(&state,boxes:1,account:"CASH")
        try Ledger.sale(&state,items:Dictionary(uniqueKeysWithValues:Flavor.allCases.map { ($0.rawValue,$0.perBox) }),account:"CASH")
        XCTAssertEqual(state.balance("COGS"),600)
        for flavor in Flavor.allCases {
            for _ in 0..<flavor.perBox { try Ledger.sale(&state,items:[flavor.rawValue:1],account:"CASH") }
        }
        XCTAssertEqual(state.stock,0);XCTAssertEqual(state.balance("COGS"),1201)
        XCTAssertEqual(state.balance("INVENTORY"),0)
    }
    func testInsufficientFlavorDoesNotMutateState() throws {
        var state=try prepared();let before=try JSONEncoder().encode(state)
        XCTAssertThrowsError(try Ledger.sale(&state,items:[Flavor.chocolateSprinkles.rawValue:3],account:"CASH"))
        let restored=try JSONDecoder().decode(BusinessState.self,from:before)
        XCTAssertEqual(state.stock,restored.stock);XCTAssertEqual(state.events.count,restored.events.count)
    }
    func testTransfersAndLoansDoNotBecomeRevenue() throws {
        var state=try prepared();try Ledger.transfer(&state,cents:500,fee:10,from:"CASH")
        XCTAssertEqual(state.profit,-10)
        try Ledger.loan(&state,cents:1000,account:"CASH",repay:false)
        XCTAssertEqual(state.balance("LOAN"),-1000);XCTAssertEqual(state.profit,-10)
        try Ledger.loan(&state,cents:300,account:"CASH",repay:true)
        XCTAssertEqual(state.balance("LOAN"),-700);XCTAssertEqual(state.profit,-10)
    }
    func testRemoteReceiptIsExcludedFromFlavorSales() throws {
        var state=try prepared()
        try Ledger.sale(&state,items:[Flavor.chocolate.rawValue:2],account:"CASH",remoteID:"order-1",revenueOverride:250)
        try Ledger.sale(&state,items:[Flavor.chocolate.rawValue:2],account:"CASH",remoteID:"order-1",revenueOverride:250)
        XCTAssertEqual(state.stock,10)
        let data=try JSONSerialization.jsonObject(with:JSONEncoder().encode(state.pending.last!)) as! [String:Any]
        let details=(data["payload"] as! [String:Any])["details"] as! [String:Any]
        XCTAssertEqual(details["remoteOrderId"] as? String,"order-1");XCTAssertNil(details["items"])
        XCTAssertThrowsError(try Ledger.reverseLastSale(&state))
    }
    func testBackupRetainsPendingOperationIDs() throws {
        let state=try prepared();let restored=try JSONDecoder().decode(BusinessState.self,from:JSONEncoder().encode(state))
        XCTAssertEqual(restored.pending.map(\.id),state.pending.map(\.id))
        XCTAssertEqual(restored.deviceID,state.deviceID);XCTAssertEqual(restored.stock,12)
    }
    func testIntegerMoneyInput() {
        XCTAssertEqual(parseCents("6.01"),601);XCTAssertEqual(parseCents("1,5"),150)
        XCTAssertEqual(parseCents("0"),0);XCTAssertNil(parseCents("1.123"));XCTAssertNil(parseCents("-1"))
        XCTAssertNil(parseCents("10000000000000000000000000000"))
    }
    func testSharesPreserveEveryCent() throws {
        var state=try prepared();state.config.unitPriceCents=101
        try Ledger.sale(&state,items:[Flavor.chocolate.rawValue:1],account:"CASH")
        XCTAssertEqual(state.profit,51)
        XCTAssertEqual(Ledger.shares(state).map(\.1),[26,25])
    }
}
