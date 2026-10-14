package com.bryan.donas

import android.app.Application
import com.bryan.donas.data.BusinessRepository
import com.bryan.donas.data.OperationsRepository
import com.bryan.donas.data.ThemePreferences
import com.bryan.donas.data.BackendClient
import com.bryan.donas.data.db.AppDatabase

class DonasApp : Application() {
    lateinit var database: AppDatabase
        private set
    lateinit var repository: BusinessRepository
        private set
    lateinit var operations: OperationsRepository
        private set
    val themePreferences by lazy { ThemePreferences(this) }
    val backendClient by lazy { BackendClient(this) }
    val daily by lazy { com.bryan.donas.daily.DailyRepository(database, backendClient) }

    override fun onCreate() {
        super.onCreate()
        reopenDatabase()
        // Some process/test startup paths do not run the default initializer provider.
        try { androidx.work.WorkManager.getInstance(this) } catch (_: IllegalStateException) {
            androidx.work.WorkManager.initialize(this, androidx.work.Configuration.Builder().build())
        }
        // Preserve legacy data but retire old background writers and token registration.
        com.bryan.donas.data.OrderSync.stop(this)
        if (backendClient.dailyOwner != null) com.bryan.donas.daily.DailySync.schedule(this)
    }

    fun reopenDatabase() {
        database = AppDatabase.open(this)
        repository = BusinessRepository(database)
        operations = OperationsRepository(database)
    }
}
