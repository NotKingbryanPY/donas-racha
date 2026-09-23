package com.bryan.donas.sync

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val DONAS_MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sync_operations_local (
              clientOperationId TEXT NOT NULL PRIMARY KEY,
              operationType TEXT NOT NULL,
              requestHash TEXT NOT NULL,
              payloadJson TEXT NOT NULL,
              occurredAtIso TEXT NOT NULL,
              state TEXT NOT NULL DEFAULT 'PENDING',
              attempts INTEGER NOT NULL DEFAULT 0,
              nextAttemptAtEpochMs INTEGER NOT NULL DEFAULT 0,
              lastError TEXT,
              serverSequence INTEGER
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS index_sync_operations_local_state_nextAttemptAtEpochMs ON sync_operations_local(state, nextAttemptAtEpochMs)")
    }
}

