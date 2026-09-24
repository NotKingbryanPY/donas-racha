package com.bryan.donas.data.db

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "events", indices = [Index("timestamp"), Index("type"), Index("accountCode"), Index(value = ["requestKey"], unique = true)])
data class EventEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val timestamp: Long, val type: String, val title: String, val amountCents: Long, val accountCode: String?, val sessionId: Long?, val reversedEventId: Long?, val requestKey: String)

@Entity(tableName = "journal_entries", foreignKeys = [ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.CASCADE), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["accountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("eventId"), Index("accountId")])
data class JournalEntryEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val eventId: Long, val accountId: Long, val deltaCents: Long, val memo: String)

@Entity(tableName = "business_sessions", foreignKeys = [ForeignKey(entity = BusinessConfigEntity::class, parentColumns = ["id"], childColumns = ["configId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = ProfitSharePlanEntity::class, parentColumns = ["id"], childColumns = ["planId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("configId"), Index("planId"), Index("startedAt"), Index("closedAt")])
data class BusinessSessionEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val startedAt: Long, val closedAt: Long?, val initialStock: Long, val physicalClosingStock: Long?, val configId: Long, val planId: Long)

@Entity(tableName = "purchases", foreignKeys = [ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = BusinessSessionEntity::class, parentColumns = ["id"], childColumns = ["sessionId"], onDelete = ForeignKey.SET_NULL)], indices = [Index(value = ["eventId"], unique = true), Index("sessionId")])
data class PurchaseEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val eventId: Long, val sessionId: Long?, val boxes: Int, val donutsPerBox: Int, val boxCostCents: Long, val totalCents: Long, val timestamp: Long)

@Entity(tableName = "purchase_payments", foreignKeys = [ForeignKey(entity = PurchaseEntity::class, parentColumns = ["id"], childColumns = ["purchaseId"], onDelete = ForeignKey.CASCADE), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["accountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("purchaseId"), Index("accountId")])
data class PurchasePaymentEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val purchaseId: Long, val accountId: Long, val amountCents: Long)

@Entity(tableName = "inventory_lots", foreignKeys = [ForeignKey(entity = PurchaseEntity::class, parentColumns = ["id"], childColumns = ["purchaseId"], onDelete = ForeignKey.RESTRICT)], indices = [Index(value = ["purchaseId"], unique = true), Index("createdAt")])
data class InventoryLotEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val purchaseId: Long?, val originalQuantity: Long, val remainingQuantity: Long, val originalCostCents: Long, val remainingCostCents: Long, val createdAt: Long)

@Entity(tableName = "inventory_movements", foreignKeys = [ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("eventId"), Index("timestamp")])
data class InventoryMovementEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val eventId: Long, val type: String, val quantityDelta: Long, val costDeltaCents: Long, val timestamp: Long)

@Entity(tableName = "sales", foreignKeys = [ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = BusinessSessionEntity::class, parentColumns = ["id"], childColumns = ["sessionId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["accountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index(value = ["eventId"], unique = true), Index("sessionId"), Index("accountId"), Index("timestamp"), Index("reversedAt")])
data class SaleEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val eventId: Long, val sessionId: Long, val accountId: Long, val quantity: Long, val unitPriceCents: Long, val revenueCents: Long, val costCents: Long, val timestamp: Long, val reversedAt: Long?)

@Entity(tableName = "sale_lot_allocations", primaryKeys = ["saleId", "lotId"], foreignKeys = [ForeignKey(entity = SaleEntity::class, parentColumns = ["id"], childColumns = ["saleId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = InventoryLotEntity::class, parentColumns = ["id"], childColumns = ["lotId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("lotId")])
data class SaleLotAllocationEntity(val saleId: Long, val lotId: Long, val quantity: Long, val costCents: Long)

@Entity(tableName = "expenses", foreignKeys = [ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = ExpenseCategoryEntity::class, parentColumns = ["id"], childColumns = ["categoryId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["accountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index(value = ["eventId"], unique = true), Index("categoryId"), Index("accountId"), Index("timestamp")])
data class ExpenseEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val eventId: Long, val categoryId: Long, val accountId: Long, val amountCents: Long, val business: Boolean, val description: String, val timestamp: Long, val sessionId: Long?)

@Entity(tableName = "account_transfers", foreignKeys = [ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["fromAccountId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["toAccountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index(value = ["eventId"], unique = true), Index("fromAccountId"), Index("toAccountId")])
data class AccountTransferEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val eventId: Long, val fromAccountId: Long, val toAccountId: Long, val amountCents: Long, val feeCents: Long, val description: String, val timestamp: Long)

@Entity(tableName = "loans", foreignKeys = [ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["receivedAccountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index(value = ["eventId"], unique = true), Index("receivedAccountId"), Index("timestamp")])
data class LoanEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val eventId: Long, val person: String, val originalCents: Long, val paidCents: Long, val receivedAccountId: Long, val description: String, val timestamp: Long)

@Entity(tableName = "loan_payments", foreignKeys = [ForeignKey(entity = LoanEntity::class, parentColumns = ["id"], childColumns = ["loanId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["accountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("loanId"), Index(value = ["eventId"], unique = true), Index("accountId")])
data class LoanPaymentEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val loanId: Long, val eventId: Long, val accountId: Long, val amountCents: Long, val timestamp: Long)

@Entity(tableName = "profit_allocations", foreignKeys = [ForeignKey(entity = BusinessSessionEntity::class, parentColumns = ["id"], childColumns = ["sessionId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = PartnerEntity::class, parentColumns = ["id"], childColumns = ["partnerId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("sessionId"), Index("partnerId")])
data class ProfitAllocationEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val sessionId: Long, val partnerId: Long, val nameSnapshot: String, val allocatedCents: Long, val paidCents: Long)

@Entity(tableName = "partner_payments", foreignKeys = [ForeignKey(entity = ProfitAllocationEntity::class, parentColumns = ["id"], childColumns = ["allocationId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = EventEntity::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.RESTRICT), ForeignKey(entity = AccountEntity::class, parentColumns = ["id"], childColumns = ["accountId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("allocationId"), Index(value = ["eventId"], unique = true), Index("accountId")])
data class PartnerPaymentEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, val allocationId: Long, val eventId: Long, val accountId: Long, val amountCents: Long, val timestamp: Long)
