package com.bryan.donas.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

data class AccountBalance(val code: String, val name: String, val cents: Long)
data class SalesAggregate(val quantity: Long, val revenue: Long, val cost: Long)

@Dao
interface OperationDao {
    @Insert suspend fun insertEvent(value: EventEntity): Long
    @Insert suspend fun insertEntries(values: List<JournalEntryEntity>)
    @Query("SELECT * FROM journal_entries WHERE eventId=:eventId") suspend fun entriesForEvent(eventId: Long): List<JournalEntryEntity>
    @Insert suspend fun insertSession(value: BusinessSessionEntity): Long
    @Update suspend fun updateSession(value: BusinessSessionEntity)
    @Query("SELECT * FROM business_sessions WHERE closedAt IS NULL ORDER BY id DESC LIMIT 1") suspend fun activeSession(): BusinessSessionEntity?
    @Query("SELECT * FROM business_sessions WHERE id=:id") suspend fun session(id: Long): BusinessSessionEntity
    @Query("SELECT COALESCE(SUM(quantityDelta),0) FROM inventory_movements") suspend fun stock(): Long
    @Query("SELECT COALESCE(SUM(remainingCostCents),0) FROM inventory_lots") suspend fun inventoryValue(): Long
    @Insert suspend fun insertPurchase(value: PurchaseEntity): Long
    @Insert suspend fun insertPurchasePayments(values: List<PurchasePaymentEntity>)
    @Insert suspend fun insertLot(value: InventoryLotEntity): Long
    @Update suspend fun updateLot(value: InventoryLotEntity)
    @Query("SELECT * FROM inventory_lots WHERE remainingQuantity > 0 ORDER BY createdAt,id") suspend fun availableLots(): List<InventoryLotEntity>
    @Query("SELECT * FROM inventory_lots WHERE id=:id") suspend fun lot(id: Long): InventoryLotEntity
    @Insert suspend fun insertMovement(value: InventoryMovementEntity)
    @Insert suspend fun insertSale(value: SaleEntity): Long
    @Update suspend fun updateSale(value: SaleEntity)
    @Query("SELECT * FROM sales WHERE reversedAt IS NULL ORDER BY timestamp DESC,id DESC LIMIT 1") suspend fun lastSale(): SaleEntity?
    @Query("SELECT * FROM sales WHERE eventId=:eventId LIMIT 1") suspend fun saleForEvent(eventId: Long): SaleEntity?
    @Insert suspend fun insertAllocations(values: List<SaleLotAllocationEntity>)
    @Query("SELECT * FROM sale_lot_allocations WHERE saleId=:saleId") suspend fun saleAllocations(saleId: Long): List<SaleLotAllocationEntity>
    @Insert suspend fun insertExpense(value: ExpenseEntity): Long
    @Insert suspend fun insertTransfer(value: AccountTransferEntity): Long
    @Insert suspend fun insertLoan(value: LoanEntity): Long
    @Update suspend fun updateLoan(value: LoanEntity)
    @Query("SELECT * FROM loans WHERE id=:id") suspend fun loan(id: Long): LoanEntity
    @Query("SELECT * FROM loans WHERE originalCents > paidCents ORDER BY timestamp DESC") suspend fun openLoans(): List<LoanEntity>
    @Insert suspend fun insertLoanPayment(value: LoanPaymentEntity)
    @Insert suspend fun insertProfitAllocations(values: List<ProfitAllocationEntity>)
    @Query("SELECT * FROM profit_allocations WHERE allocatedCents > paidCents ORDER BY id") suspend fun unpaidAllocations(): List<ProfitAllocationEntity>
    @Query("SELECT * FROM profit_allocations WHERE sessionId=:sessionId ORDER BY id") suspend fun allocationsForSession(sessionId: Long): List<ProfitAllocationEntity>
    @Update suspend fun updateProfitAllocation(value: ProfitAllocationEntity)
    @Insert suspend fun insertPartnerPayment(value: PartnerPaymentEntity)
    @Query("SELECT * FROM events WHERE requestKey=:key LIMIT 1") suspend fun eventByKey(key: String): EventEntity?
    @Query("SELECT * FROM events WHERE id=:id") suspend fun event(id: Long): EventEntity
    @Query("SELECT * FROM events ORDER BY timestamp DESC,id DESC LIMIT :limit OFFSET :offset") suspend fun events(limit: Int, offset: Int): List<EventEntity>
    @Query("SELECT * FROM events WHERE (:type IS NULL OR type=:type) AND (:account IS NULL OR accountCode=:account) ORDER BY timestamp DESC,id DESC LIMIT :limit OFFSET :offset") suspend fun filteredEvents(type: String?, account: String?, limit: Int, offset: Int): List<EventEntity>
    @Query("SELECT * FROM events WHERE sessionId=:sessionId ORDER BY timestamp DESC,id DESC") suspend fun eventsForSession(sessionId: Long): List<EventEntity>
    @Query("SELECT a.code,a.name,COALESCE(SUM(j.deltaCents),0) cents FROM accounts a LEFT JOIN journal_entries j ON j.accountId=a.id GROUP BY a.id ORDER BY a.id") suspend fun balances(): List<AccountBalance>
    @Query("SELECT a.code,a.name,COALESCE(SUM(j.deltaCents),0) cents FROM accounts a LEFT JOIN journal_entries j ON j.accountId=a.id GROUP BY a.id ORDER BY a.id") fun observeBalances(): Flow<List<AccountBalance>>
    @Query("SELECT COALESCE(SUM(quantity),0) quantity,COALESCE(SUM(revenueCents),0) revenue,COALESCE(SUM(costCents),0) cost FROM sales WHERE reversedAt IS NULL AND timestamp>=:from AND timestamp<:to") suspend fun salesBetween(from: Long, to: Long): SalesAggregate
    @Query("SELECT COALESCE(SUM(quantity),0) quantity,COALESCE(SUM(revenueCents),0) revenue,COALESCE(SUM(costCents),0) cost FROM sales WHERE reversedAt IS NULL AND sessionId=:sessionId") suspend fun salesForSession(sessionId: Long): SalesAggregate
    @Query("SELECT * FROM sales WHERE reversedAt IS NULL AND sessionId=:sessionId ORDER BY timestamp DESC,id DESC") suspend fun activeSalesForSession(sessionId: Long): List<SaleEntity>
    @Query("SELECT COALESCE(SUM(j.deltaCents),0) FROM journal_entries j JOIN accounts a ON a.id=j.accountId JOIN events e ON e.id=j.eventId WHERE a.code='BUSINESS_EXPENSE' AND e.timestamp>=:from AND e.timestamp<:to") suspend fun businessExpenses(from: Long, to: Long): Long
    @Query("SELECT COALESCE(SUM(j.deltaCents),0) FROM journal_entries j JOIN accounts a ON a.id=j.accountId JOIN events e ON e.id=j.eventId WHERE a.code='BUSINESS_EXPENSE' AND e.sessionId=:sessionId") suspend fun businessExpensesForSession(sessionId: Long): Long
    @Query("SELECT -COALESCE(SUM(j.deltaCents),0) FROM journal_entries j JOIN accounts a ON a.id=j.accountId WHERE a.code='DEBT'") suspend fun debt(): Long
    @Query("SELECT COALESCE(SUM(allocatedCents-paidCents),0) FROM profit_allocations") suspend fun partnerPending(): Long
    @Query("SELECT COALESCE(SUM(deltaCents),0) FROM journal_entries") suspend fun journalTotal(): Long
    @Query("DELETE FROM partner_payments") suspend fun clearPartnerPayments()
    @Query("DELETE FROM profit_allocations") suspend fun clearProfitAllocations()
    @Query("DELETE FROM loan_payments") suspend fun clearLoanPayments()
    @Query("DELETE FROM loans") suspend fun clearLoans()
    @Query("DELETE FROM account_transfers") suspend fun clearTransfers()
    @Query("DELETE FROM expenses") suspend fun clearExpenses()
    @Query("DELETE FROM sale_lot_allocations") suspend fun clearSaleAllocations()
    @Query("DELETE FROM sales") suspend fun clearSales()
    @Query("DELETE FROM inventory_movements") suspend fun clearMovements()
    @Query("DELETE FROM inventory_lots") suspend fun clearLots()
    @Query("DELETE FROM purchase_payments") suspend fun clearPurchasePayments()
    @Query("DELETE FROM purchases") suspend fun clearPurchases()
    @Query("DELETE FROM journal_entries") suspend fun clearEntries()
    @Query("DELETE FROM events") suspend fun clearEvents()
    @Query("DELETE FROM business_sessions") suspend fun clearSessions()
}
