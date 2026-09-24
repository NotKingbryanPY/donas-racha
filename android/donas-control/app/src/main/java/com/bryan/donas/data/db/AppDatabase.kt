package com.bryan.donas.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.AutoMigration
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [BusinessConfigEntity::class, AccountEntity::class, PartnerEntity::class,
    ProfitSharePlanEntity::class, ProfitShareMemberEntity::class, AppStateEntity::class,
    ExpenseCategoryEntity::class, EventEntity::class, JournalEntryEntity::class,
    BusinessSessionEntity::class, PurchaseEntity::class, PurchasePaymentEntity::class,
    InventoryLotEntity::class, InventoryMovementEntity::class, SaleEntity::class,
    SaleLotAllocationEntity::class, ExpenseEntity::class, AccountTransferEntity::class,
    LoanEntity::class, LoanPaymentEntity::class, ProfitAllocationEntity::class,
    PartnerPaymentEntity::class, SyncOutboxEntity::class, RemoteOrderEntity::class,
    SyncStateEntity::class], version = 3, exportSchema = true,
    autoMigrations = [AutoMigration(from = 1, to = 2)])
abstract class AppDatabase : RoomDatabase() {
    abstract fun businessDao(): BusinessDao
    abstract fun operationDao(): OperationDao
    abstract fun syncDao(): SyncDao
    companion object {
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""CREATE TABLE IF NOT EXISTS sync_outbox (clientOperationId TEXT NOT NULL PRIMARY KEY, localEventId INTEGER NOT NULL, type TEXT NOT NULL, occurredAt TEXT NOT NULL, payloadJson TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL, serverSequence INTEGER, lastError TEXT)""")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_sync_outbox_state_occurredAt ON sync_outbox(state, occurredAt)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_sync_outbox_localEventId ON sync_outbox(localEventId)")
                db.execSQL("""CREATE TABLE IF NOT EXISTS remote_orders (id TEXT NOT NULL PRIMARY KEY, publicCode TEXT NOT NULL, status TEXT NOT NULL, paymentMethod TEXT NOT NULL, paymentStatus TEXT NOT NULL, deliveryLocation TEXT NOT NULL, customerName TEXT NOT NULL, customerPhone TEXT NOT NULL, totalCents INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, itemsJson TEXT NOT NULL)""")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_remote_orders_status_createdAt ON remote_orders(status, createdAt)")
                db.execSQL("CREATE TABLE IF NOT EXISTS sync_state (id INTEGER NOT NULL PRIMARY KEY, orderCursor TEXT)")
            }
        }
        fun open(context: Context) = Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, "donas.db")
            .addMigrations(MIGRATION_2_3).build()
    }
}
