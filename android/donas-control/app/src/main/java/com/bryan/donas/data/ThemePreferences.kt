package com.bryan.donas.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.map

private val Context.visualPreferences by preferencesDataStore(name = "visual")
class ThemePreferences(private val context: Context) {
    private val key = intPreferencesKey("night_mode")
    val theme = context.visualPreferences.data.map { it[key] ?: -1 }
    suspend fun setTheme(mode: Int) { context.visualPreferences.edit { it[key] = mode } }
}
