package com.bryan.donas

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.bryan.donas.data.BusinessRepository
import com.bryan.donas.data.db.AppDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.Assert.assertEquals
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
}
