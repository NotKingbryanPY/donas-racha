package com.bryan.donas.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.data.db.AppDatabase
import kotlinx.coroutines.runBlocking
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class OperationsRepositoryTest {
    private lateinit var db: AppDatabase
    private lateinit var business: BusinessRepository
    private lateinit var operations: OperationsRepository
    @Before fun setup() = runBlocking {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java).build()
        business = BusinessRepository(db); operations = OperationsRepository(db); business.initialize()
    }
    @After fun close() { db.close() }

    @Test fun completeBusinessFlowBalancesAndAllocates() = runBlocking {
        operations.startSession(initialCash = 2000, requestKey = "start")
        operations.purchase(2, listOf(PaymentSource("CASH", 1200)), "purchase")
        assertEquals(24, operations.dashboard().stock)
        operations.quickSale("CASH", requestKey = "cash-sale")
        operations.quickSale("YAPPY", requestKey = "yappy-sale")
        operations.undoLastSale("undo")
        var data = operations.dashboard()
        assertEquals(23, data.stock)
        assertEquals(900, data.cash)
        assertEquals(0, data.yappy)
        assertEquals(1, data.today.quantity)
        operations.transfer("CASH", "YAPPY", 200, 10, "Retiro", "transfer")
        operations.expense("Transporte", "YAPPY", 50, true, "Bus", "expense")
        operations.receiveLoan("Juan", 500, "CASH", "Capital", "loan")
        val loan = operations.openLoans().single()
        operations.payLoan(loan.id, 200, "CASH", "loan-payment")
        data = operations.dashboard()
        assertEquals(990, data.cash)
        assertEquals(150, data.yappy)
        assertEquals(300, data.debt)
        assertEquals(60, data.businessExpenses)
        val closedSession = data.activeSession!!.id
        operations.closeSession(23, "close")
        assertNull(operations.dashboard().activeSession)
        val allocations = db.operationDao().allocationsForSession(closedSession)
        assertEquals(2, allocations.size)
        assertEquals(-10, allocations.sumOf { it.allocatedCents })
        assertEquals(0, db.operationDao().journalTotal())
    }

    @Test fun fifoAndUndoRestoreExactLotCents() = runBlocking {
        operations.startSession(initialCash = 2000)
        business.saveConfig(601, 12, 100)
        // The active session keeps its original config; close and start a new one for the changed cost.
        operations.closeSession(0)
        operations.startSession()
        operations.purchase(1, listOf(PaymentSource("CASH", 601)))
        repeat(12) { operations.quickSale("CASH") }
        assertEquals(0, operations.dashboard().stock)
        assertEquals(0, operations.dashboard().inventoryValue)
        operations.undoLastSale()
        assertEquals(1, operations.dashboard().stock)
        assertEquals(51, operations.dashboard().inventoryValue)
        assertEquals(0, db.operationDao().journalTotal())
    }

    @Test fun idempotentExternalSaleIsOnlyRecordedOnce() = runBlocking {
        operations.startSession(initialCash = 600)
        operations.purchase(1, listOf(PaymentSource("CASH", 600)))
        operations.quickSale("CASH", requestKey = "tap-1")
        operations.quickSale("CASH", requestKey = "tap-1")
        assertEquals(11, operations.dashboard().stock)
        assertEquals(1, operations.dashboard().today.quantity)
    }

    @Test fun fourDonutsByYappyAreOneSaleAndOnePayment() = runBlocking {
        operations.startSession(initialCash = 600)
        operations.purchase(1, listOf(PaymentSource("CASH", 600)))
        operations.quickSale("YAPPY", quantity = 4, requestKey = "widget-yappy-four")
        operations.quickSale("YAPPY", quantity = 4, requestKey = "widget-yappy-four")
        val dashboard = operations.dashboard()
        assertEquals(8, dashboard.stock)
        assertEquals(400, dashboard.yappy)
        assertEquals(4, dashboard.today.quantity)
        assertEquals(400, dashboard.today.revenue)
        assertEquals(0, db.operationDao().journalTotal())
        val queued = db.syncDao().pending()
        assertEquals(3, queued.size)
        assertEquals("SALE", queued.last().type)
        assertEquals(4, org.json.JSONObject(queued.last().payloadJson).getJSONObject("details").getInt("quantity"))
    }

    @Test fun failedPurchaseLeavesNoPartialState() = runBlocking {
        operations.startSession(initialCash = 500)
        try { operations.purchase(1, listOf(PaymentSource("CASH", 500))); fail() } catch (_: IllegalArgumentException) { }
        assertEquals(0, operations.dashboard().stock)
        assertEquals(500, operations.dashboard().cash)
        assertTrue(operations.history().none { it.type == "PURCHASE" })
    }

    @Test fun repeatedPaymentSourceIsValidatedAsOneTotal() = runBlocking {
        operations.startSession(initialCash = 500)
        try {
            operations.purchase(1, listOf(PaymentSource("CASH", 300), PaymentSource("CASH", 300)))
            fail()
        } catch (_: IllegalArgumentException) { }
        assertEquals(500, operations.dashboard().cash)
        assertEquals(0, operations.dashboard().stock)
    }

    @Test fun financedPurchaseAppearsInTotalDebt() = runBlocking {
        operations.startSession(initialCash = 200)
        operations.purchase(1, listOf(PaymentSource("CASH", 200), PaymentSource("DEBT", 400)))
        val data = operations.dashboard()
        assertEquals(400, data.debt)
        assertEquals(12, data.stock)
        assertEquals(0, db.operationDao().journalTotal())
    }

    @Test fun businessResetPreservesConfigurationAndPartners() = runBlocking {
        operations.startSession(initialCash = 600)
        operations.purchase(1, listOf(PaymentSource("CASH", 600)))
        try { operations.resetBusinessData(); fail("Pending movements must not be deleted") }
        catch (_: IllegalArgumentException) { }
        db.syncDao().pending().forEach { db.syncDao().acknowledge(it.clientOperationId, it.localEventId) }
        operations.resetBusinessData()
        assertEquals(0, operations.dashboard().stock)
        assertEquals(0, operations.dashboard().cash)
        assertEquals(2, business.snapshot().members.size)
        assertEquals(600, business.snapshot().config.boxCostCents)
    }
}
