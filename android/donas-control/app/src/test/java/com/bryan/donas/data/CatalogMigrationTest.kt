package com.bryan.donas.data

import android.app.Application
import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.data.db.AppDatabase
import com.bryan.donas.data.db.CatalogOperationEntity
import java.io.File
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class CatalogMigrationTest {
    @Test fun migrationFourToFivePreservesOrdersAndPendingOperations() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "migration-four-to-five.db"
        context.deleteDatabase(name)
        val schema = JSONObject(File("schemas/com.bryan.donas.data.db.AppDatabase/4.json").readText()).getJSONObject("database")
        val raw = context.openOrCreateDatabase(name, Context.MODE_PRIVATE, null)
        try {
            val entities = schema.getJSONArray("entities")
            for (index in 0 until entities.length()) {
                val entity = entities.getJSONObject(index)
                val table = entity.getString("tableName")
                raw.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", table))
                val indices = entity.optJSONArray("indices")
                for (i in 0 until (indices?.length() ?: 0)) raw.execSQL(indices!!.getJSONObject(i).getString("createSql").replace("\${TABLE_NAME}", table))
            }
            val setup = schema.getJSONArray("setupQueries")
            for (index in 0 until setup.length()) raw.execSQL(setup.getString(index))
            raw.execSQL("""INSERT INTO remote_orders (id,publicCode,status,paymentMethod,paymentStatus,
                deliveryLocation,customerName,customerPhone,totalCents,createdAt,updatedAt,itemsJson,settled)
                VALUES ('order-1','DR-1','PENDING','CASH','PENDING','UTP','Cliente','',100,
                '2026-10-07T00:00:00Z','2026-10-07T00:00:00Z','[]',0)""")
            raw.execSQL("""INSERT INTO sync_outbox (clientOperationId,localEventId,type,occurredAt,payloadJson,state,attempts,lastError,serverSequence)
                VALUES ('operation-1',1,'SALE','2026-10-07T00:00:00Z','{}','PENDING',2,'Sin red',NULL)""")
            raw.version = 4
        } finally { raw.close() }
        val db = Room.databaseBuilder(context, AppDatabase::class.java, name).addMigrations(AppDatabase.MIGRATION_4_5).build()
        try {
            assertEquals("DR-1", db.syncDao().order("order-1")!!.publicCode)
            val pending = db.syncDao().pending().single()
            assertEquals("operation-1", pending.clientOperationId)
            assertEquals(2, pending.attempts)
            db.syncDao().enqueueCatalog(CatalogOperationEntity("catalog-1", "variant-1", "Chocolate", false, "2026-10-07T00:00:00Z"))
            assertEquals(1, db.syncDao().pendingCatalog().size)
        } finally { db.close(); context.deleteDatabase(name) }
    }
}