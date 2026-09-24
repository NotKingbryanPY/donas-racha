package com.bryan.donas.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.data.db.*
import com.bryan.donas.domain.*
import kotlinx.coroutines.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class BusinessRepositoryTest {
    private lateinit var database: AppDatabase
    private lateinit var repository: BusinessRepository
    @Before fun setup() {
        database = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java).build()
        repository = BusinessRepository(database)
    }
    @After fun close() { database.close() }

    @Test fun seedIsIdempotentAndComplete() = runBlocking {
        repository.initialize(); repository.initialize()
        val value = repository.snapshot()
        assertEquals(600L, value.config.boxCostCents)
        assertEquals(12, value.config.donutsPerBox)
        assertEquals(100L, value.config.donutPriceCents)
        assertEquals(listOf("CASH", "YAPPY"), value.accounts.map { it.code }.take(2))
        assertEquals(10, value.accounts.size)
        assertEquals(listOf("Yo", "Socio"), value.members.map { it.name })
        assertEquals(10000, value.members.sumOf { it.basisPoints })
        assertEquals(8, database.businessDao().categories().size)
        assertEquals(1, database.businessDao().plans(20, 0).size)
    }
    @Test fun simultaneousInitializationCreatesOneSet() = runBlocking {
        coroutineScope { repeat(12) { launch(Dispatchers.IO) { repository.initialize() } } }
        assertEquals(2, database.businessDao().partners().size)
        assertEquals(1, database.businessDao().configs(20, 0).size)
    }
    @Test fun configChangesPreservePreviousSnapshot() = runBlocking {
        repository.initialize()
        val old = repository.snapshot().config
        repository.saveConfig(725, 15, 125)
        assertEquals(old, database.businessDao().config(old.id))
        assertEquals(725L, repository.snapshot().config.boxCostCents)
        assertEquals(2, database.businessDao().configs(20, 0).size)
    }
    @Test fun unchangedConfigurationDoesNotMakeAnotherVersion() = runBlocking {
        repository.initialize(); repository.saveConfig(600, 12, 100)
        assertEquals(1, database.businessDao().configs(20, 0).size)
    }
    @Test fun invalidConfigurationIsAtomic() = runBlocking {
        repository.initialize()
        val before = repository.snapshot()
        try { repository.saveConfig(600, 0, 100); fail("Expected validation failure") } catch (_: IllegalArgumentException) { }
        assertEquals(before, repository.snapshot())
    }
    @Test fun invalidPlanCannotPartiallyCreatePartners() = runBlocking {
        repository.initialize()
        val before = repository.snapshot()
        val invalid = listOf(ShareRule(-1, "Nuevo", 4000, 0, true))
        try { repository.savePlan(ShareMode.PERCENTAGE, PartialMode.PROPORTIONAL, invalid, "bad"); fail() } catch (_: IllegalArgumentException) { }
        assertEquals(before, repository.snapshot())
        assertEquals(2, database.businessDao().partners().size)
    }
    @Test fun unknownPartnerRollsBackEarlierInsertWithinTransaction() = runBlocking {
        repository.initialize()
        val rules = listOf(ShareRule(-1, "Nuevo", 5000, 0, true), ShareRule(999, "Inexistente", 5000, 0, false))
        try { repository.savePlan(ShareMode.PERCENTAGE, PartialMode.PROPORTIONAL, rules, "rollback"); fail() } catch (_: IllegalArgumentException) { }
        assertEquals(2, database.businessDao().partners().size)
        assertEquals(1, database.businessDao().plans(20, 0).size)
    }
    @Test fun newPlanRetainsHistoricalNamesAndRules() = runBlocking {
        repository.initialize()
        val initial = repository.snapshot()
        val rules = initial.members.mapIndexed { index, member -> member.copy(name = "Nombre $index", basisPoints = 0, fixedCents = if (index == 1) 240 else 0) }
        repository.savePlan(ShareMode.FIXED, PartialMode.PROPORTIONAL, rules, "fixed")
        val history = repository.planHistory(0)
        assertEquals(2, history.size)
        assertEquals(initial.members, history.last().second)
        assertEquals(ShareMode.FIXED.name, history.first().first.mode)
    }
    @Test fun concurrentRetriesUseUniqueRequestKey() = runBlocking {
        repository.initialize()
        val rules = repository.snapshot().members
        coroutineScope { repeat(8) { launch(Dispatchers.IO) { repository.savePlan(ShareMode.PERCENTAGE, PartialMode.PROPORTIONAL, rules, "same-request") } } }
        assertEquals(2, database.businessDao().plans(20, 0).size)
    }
    @Test fun replayOfOlderRequestDoesNotReplaceNewerPlan() = runBlocking {
        repository.initialize()
        val rules = repository.snapshot().members
        repository.savePlan(ShareMode.PERCENTAGE, PartialMode.PROPORTIONAL, rules, "first")
        repository.savePlan(ShareMode.FIXED, PartialMode.FULL_BOXES, rules, "second")
        val current = repository.snapshot()
        repository.savePlan(ShareMode.PERCENTAGE, PartialMode.PROPORTIONAL, rules, "first")
        assertEquals(current, repository.snapshot())
    }
    @Test fun historyUsesBoundedPages() = runBlocking {
        repository.initialize()
        val rules = repository.snapshot().members
        repeat(23) { repository.savePlan(ShareMode.PERCENTAGE, PartialMode.PROPORTIONAL, rules, "page-$it") }
        assertEquals(20, repository.planHistory(0).size)
        assertEquals(4, repository.planHistory(20).size)
    }
    @Test fun foreignKeysRejectMissingPlan() = runBlocking {
        repository.initialize()
        try {
            database.businessDao().insertMembers(listOf(ProfitShareMemberEntity(999, 1, "Yo", 10000, 0, true, 0)))
            fail("Foreign key should reject orphan")
        } catch (_: android.database.sqlite.SQLiteConstraintException) { }
    }
    @Test fun reopeningDiskDatabasePreservesBusiness() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "persistence-test.db"
        context.deleteDatabase(name)
        val first = Room.databaseBuilder(context, AppDatabase::class.java, name).build()
        val firstRepo = BusinessRepository(first)
        firstRepo.initialize(); firstRepo.saveConfig(900, 18, 150)
        first.close()
        val second = Room.databaseBuilder(context, AppDatabase::class.java, name).build()
        val secondRepo = BusinessRepository(second)
        secondRepo.initialize()
        assertEquals(900L, secondRepo.snapshot().config.boxCostCents)
        assertEquals(2, second.businessDao().configs(20, 0).size)
        second.close()
        context.deleteDatabase(name)
        Unit
    }
}
