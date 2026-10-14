package com.bryan.donas.daily

import android.app.Application
import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.data.BackendException
import com.bryan.donas.data.db.AppDatabase
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class DailyOperationsTest {
    private val owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    private val session = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    private val variant = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    private fun snapshot() = JSONObject().put("schemaVersion", 2).put("session", JSONObject().put("id", session))
        .put("inventory", JSONObject().put("flavors", JSONArray().put(JSONObject().put("variant_id", variant)
            .put("opening_quantity", 4).put("purchased_quantity", 0).put("sold_quantity", 0).put("reserved_quantity", 2).put("available_quantity", 2))))
        .put("operations", JSONArray())
    private fun sale() = JSONObject().put("kind", "SALE").put("sessionId", session).put("occurredAt", DailyRules.time())
        .put("items", JSONArray().put(JSONObject().put("variantId", variant).put("quantity", 2).put("unitPriceCents", 100)))
        .put("payment", JSONObject().put("cashCents", 100).put("yappyCents", 100))
    private class Transport(override var dailyOwner: String?) : DailyTransport {
        lateinit var data: JSONObject
        var fail = false
        var conflict = false
        var accepted = 0
        val ids = mutableSetOf<String>()
        override suspend fun dailySnapshot(beforeSequence: Long?) = JSONObject(data.toString())
        override suspend fun dailyApply(payload: JSONObject, expectedOwner: String): JSONObject {
            check(dailyOwner == expectedOwner)
            if (conflict) throw BackendException(409, "Jornada cerrada", "SESSION_CLOSED")
            val id = payload.getString("operationId")
            if (ids.add(id)) accepted++
            if (fail) { fail = false; throw BackendException(503, "Respuesta perdida", "NETWORK") }
            return JSONObject().put("operationId", id).put("serverSequence", 1).put("replayed", true)
        }
    }
    @Test fun moneyIsExactAndRejectsFractionsOrInvalidText() {
        assertEquals(1234L, DailyRules.money("12,34")); assertEquals(1L, DailyRules.money("0.01"))
        for (value in listOf("NaN", "1.001", "-1", "", "1e2")) {
            try { DailyRules.money(value); fail("Must reject $value") } catch (_: IllegalArgumentException) { }
        }
    }
    @Test fun pendingOrderUsesDurableInsertionEvenWhenPhoneClockMovesBackward() = runBlocking {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java).build()
        try {
            db.dailyDao().enqueue(DailyOperation("first-purchase", owner, session, "PURCHASE", "{}", 100))
            db.dailyDao().enqueue(DailyOperation("later-sale", owner, session, "SALE", "{}", 1))
            assertEquals(listOf("first-purchase", "later-sale"), db.dailyDao().pending(owner).map { it.id })
        } finally { db.close() }
    }
    @Test fun pendingProjectionRespectsReservationsAndDoesNotDoubleCountAcknowledgedRows() {
        val state = snapshot()
        val op = DailyOperation("sale-1", owner, session, "SALE", sale().toString(), 1)
        assertEquals(0L, DailyRules.projected(state, listOf(op))[variant])
        state.getJSONArray("operations").put(JSONObject().put("id", "sale-1").put("server_sequence", 1))
        assertEquals(2L, DailyRules.projected(state, listOf(op))[variant])
        state.getJSONObject("inventory").getJSONArray("flavors").getJSONObject(0).put("opening_quantity", 0)
        assertEquals("A reservation shortage must not disappear behind clamped zero", -2L, DailyRules.projected(state, emptyList())[variant])
    }
    @Test fun timeoutReplaysSameUuidAfterDatabaseReopen() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>(); val name = "daily-retry-test.db"
        context.deleteDatabase(name)
        var db = Room.databaseBuilder(context, AppDatabase::class.java, name).build()
        val transport = Transport(owner).apply { data = snapshot(); fail = true }
        try {
            var repo = DailyRepository(db, transport); repo.refresh(owner)
            val operation = repo.enqueue(sale(), "same-id")
            try { DailySynchronizer(repo, transport).synchronize(owner); fail("Expected lost response") } catch (_: BackendException) { }
            assertEquals("PENDING", repo.dao.all(owner).single().state)
            db.close(); db = Room.databaseBuilder(context, AppDatabase::class.java, name).build(); repo = DailyRepository(db, transport)
            DailySynchronizer(repo, transport).synchronize(owner)
            assertEquals(1, transport.accepted); assertEquals(operation.payload, repo.dao.all(owner).single().payload)
            assertEquals("ACKED", repo.dao.all(owner).single().state)
        } finally { db.close(); context.deleteDatabase(name) }
    }
    @Test fun conflictRetainsPayloadAndStopsDependentOperationsUntilReview() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
        val transport = Transport(owner).apply { data = snapshot(); conflict = true }
        try {
            val repo = DailyRepository(db, transport); repo.refresh(owner); val original = repo.enqueue(sale(), "conflict-id")
            assertFalse(DailySynchronizer(repo, transport).synchronize(owner))
            assertEquals("CONFLICT", repo.dao.all(owner).single().state)
            assertEquals(original.payload, repo.dao.all(owner).single().payload)
            try { repo.enqueue(sale(), "dependent-id"); fail("Unresolved conflict must block dependent records") } catch (_: IllegalArgumentException) { }
            repo.dao.discard("conflict-id"); assertEquals("CANCELLED", repo.dao.all(owner).single().state)
        } finally { db.close() }
    }
    @Test fun cachesAndOutboxesStayBoundToTheAuthorizedOwner() = runBlocking {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java).build()
        val transport = Transport(owner).apply { data = snapshot() }
        try {
            val repo = DailyRepository(db, transport); repo.refresh(owner); repo.enqueue(sale(), "owner-id")
            transport.dailyOwner = "another-owner"
            try { repo.enqueue(sale(), "other-id"); fail("Other account cannot use old cache") } catch (_: IllegalStateException) { }
            assertTrue(repo.dao.pending("another-owner").isEmpty()); assertEquals(1, repo.dao.pending(owner).size)
        } finally { db.close() }
    }
    @Test fun migrationFiveToSixKeepsLegacyRowsAndCreatesOnlyNewTables() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>(); val name = "daily-migration-test.db"
        context.deleteDatabase(name)
        val schema = JSONObject(File("schemas/com.bryan.donas.data.db.AppDatabase/5.json").readText()).getJSONObject("database")
        val raw = context.openOrCreateDatabase(name, Context.MODE_PRIVATE, null)
        try {
            val entities = schema.getJSONArray("entities")
            for (i in 0 until entities.length()) {
                val entity = entities.getJSONObject(i); val table = entity.getString("tableName")
                raw.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", table))
                val indexes = entity.optJSONArray("indices")
                for (j in 0 until (indexes?.length() ?: 0)) raw.execSQL(indexes!!.getJSONObject(j).getString("createSql").replace("\${TABLE_NAME}", table))
            }
            val setup = schema.getJSONArray("setupQueries")
            for (i in 0 until setup.length()) raw.execSQL(setup.getString(i))
            raw.execSQL("INSERT INTO sync_outbox(clientOperationId,localEventId,type,occurredAt,payloadJson,state,attempts) VALUES('legacy-id',9,'SALE','2026-10-08','legacy-payload','PENDING',3)")
            raw.version = 5
        } finally { raw.close() }
        val db = Room.databaseBuilder(context, AppDatabase::class.java, name).addMigrations(AppDatabase.MIGRATION_5_6).build()
        try {
            assertEquals("legacy-payload", db.syncDao().pending().single().payloadJson)
            assertEquals(3, db.syncDao().pending().single().attempts)
            assertEquals(1, db.dailyDao().legacyPending())
            db.dailyDao().enqueue(DailyOperation("new-id", owner, session, "SALE", sale().toString(), 1))
            assertEquals("new-id", db.dailyDao().pending(owner).single().id)
        } finally { db.close(); context.deleteDatabase(name) }
    }
}
