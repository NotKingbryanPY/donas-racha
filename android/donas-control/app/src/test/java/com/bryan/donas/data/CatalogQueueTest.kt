package com.bryan.donas.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.data.db.AppDatabase
import com.bryan.donas.data.db.FlavorEntity
import com.bryan.donas.data.db.CatalogOperationEntity
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class CatalogQueueTest {
    @Test fun flavorChangesStayPendingAcrossProcessStorageReopenAndConflictIsExplicit() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val name = "catalog-queue-test.db"
        context.deleteDatabase(name)
        fun open() = Room.databaseBuilder(context, AppDatabase::class.java, name).build()
        var db = open()
        try {
            val operation = CatalogOperationEntity("op-1", "flavor-1", "Chocolate nuevo", false, "2026-10-07T10:00:00Z")
            db.syncDao().cacheFlavors(listOf(FlavorEntity("flavor-1", "DR-CHOCOLATE", "Chocolate", true, true, operation.expectedUpdatedAt)))
            db.syncDao().enqueueCatalog(operation)
            db.close(); db = open()
            assertEquals(operation, db.syncDao().pendingCatalog().single())
            assertEquals("Chocolate", db.syncDao().flavors().single().name) // Server copy is separate from local intent.
            db.syncDao().catalogResult(operation.operationId, "CONFLICT", "Cambió en otro dispositivo")
            assertTrue(db.syncDao().pendingCatalog().isEmpty())
            assertEquals("CONFLICT", db.syncDao().catalogIssues().single().state)
            db.syncDao().discardCatalogConflict(operation.operationId)
            assertTrue(db.syncDao().catalogIssues().isEmpty())
        } finally { db.close(); context.deleteDatabase(name) }
    }
}
