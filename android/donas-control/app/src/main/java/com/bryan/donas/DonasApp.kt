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

    override fun onCreate() {
        super.onCreate()
        reopenDatabase()
    }

    fun reopenDatabase() {
        database = AppDatabase.open(this)
        repository = BusinessRepository(database)
        operations = OperationsRepository(database)
    }
}
