package com.bryan.donas

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.bryan.donas.data.BusinessRepository
import com.bryan.donas.data.OperationsRepository
import com.bryan.donas.data.PaymentSource
import com.bryan.donas.data.db.AppDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertFalse
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DatabaseDeviceTest {
    @Test fun initializeAndPersistConfiguration() = runBlocking {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java).build()
        try {
            val repository = BusinessRepository(db)
            repository.initialize()
            repository.saveConfig(650, 12, 125)
            assertEquals(650L, repository.snapshot().config.boxCostCents)
            assertEquals(10, db.businessDao().accounts().size)
        } finally { db.close() }
    }

    @Test fun offlineFlavoredSaleSurvivesDatabaseReopen() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val name = "donas-device-test.db"
        context.deleteDatabase(name)
        fun open() = Room.databaseBuilder(context, AppDatabase::class.java, name)
            .addMigrations(AppDatabase.MIGRATION_2_3, AppDatabase.MIGRATION_3_4).build()
        var db = open()
        try {
            BusinessRepository(db).initialize()
            val operations = OperationsRepository(db)
            operations.startSession(initialCash = 600)
            operations.purchase(1, listOf(PaymentSource("CASH", 600)))
            val saleId = operations.quickSale("YAPPY", 2, "device-sale-test",
                mapOf("DR-CHOCOLATE" to 1, "DR-VAINILLA" to 1))
            val operationId = db.syncDao().pending().single { it.type == "SALE" }.clientOperationId
            db.close()
            db = open()
            assertEquals(10, OperationsRepository(db).dashboard().stock)
            val saved = db.syncDao().pending().single { it.type == "SALE" }
            assertEquals(operationId, saved.clientOperationId)
            assertNotNull(saved.payloadJson)
            assertEquals(saleId, OperationsRepository(db).quickSale("YAPPY", 2, "device-sale-test",
                mapOf("DR-CHOCOLATE" to 1, "DR-VAINILLA" to 1)))
            assertEquals(10, OperationsRepository(db).dashboard().stock)
        } finally {
            db.close()
            context.deleteDatabase(name)
        }
    }

    @Test fun migrationThreeToFourPreservesRemoteOrders() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val name = "donas-migration-test.db"
        context.deleteDatabase(name)
        val asset = InstrumentationRegistry.getInstrumentation().context.assets.open(
            "com.bryan.donas.data.db.AppDatabase/3.json").bufferedReader().use { it.readText() }
        val schema = org.json.JSONObject(asset).getJSONObject("database")
        val raw = context.openOrCreateDatabase(name, android.content.Context.MODE_PRIVATE, null)
        try {
            val entities = schema.getJSONArray("entities")
            for (index in 0 until entities.length()) {
                val entity = entities.getJSONObject(index)
                val tableName = entity.getString("tableName")
                raw.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", tableName))
                val indices = entity.optJSONArray("indices")
                for (item in 0 until (indices?.length() ?: 0)) {
                    raw.execSQL(indices!!.getJSONObject(item).getString("createSql").replace("\${TABLE_NAME}", tableName))
                }
            }
            val setup = schema.getJSONArray("setupQueries")
            for (index in 0 until setup.length()) raw.execSQL(setup.getString(index))
            raw.execSQL("""INSERT INTO remote_orders (id,publicCode,status,paymentMethod,paymentStatus,
                deliveryLocation,customerName,customerPhone,totalCents,createdAt,updatedAt,itemsJson)
                VALUES ('test-order','TEST-1','PENDING','CASH','PENDING','UTP','Cliente','',100,
                '2026-09-24T00:00:00Z','2026-09-24T00:00:00Z','[]')""")
            raw.version = 3
        } finally { raw.close() }
        val migrated = Room.databaseBuilder(context, AppDatabase::class.java, name)
            .addMigrations(AppDatabase.MIGRATION_2_3, AppDatabase.MIGRATION_3_4).build()
        try {
            val order = migrated.syncDao().order("test-order")
            assertNotNull(order)
            assertFalse(order!!.settled)
            assertEquals("TEST-1", order.publicCode)
        } finally {
            migrated.close()
            context.deleteDatabase(name)
        }
    }
}
