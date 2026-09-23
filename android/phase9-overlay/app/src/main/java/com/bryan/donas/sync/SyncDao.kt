package com.bryan.donas.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface SyncDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(operation: SyncOperationEntity): Long

    @Query("SELECT * FROM sync_operations_local WHERE state IN ('PENDING','RETRY') AND nextAttemptAtEpochMs <= :now ORDER BY occurredAtIso, clientOperationId LIMIT :limit")
    suspend fun pending(now: Long, limit: Int = 50): List<SyncOperationEntity>

    @Query("UPDATE sync_operations_local SET state = 'SENDING', attempts = attempts + 1, lastError = NULL WHERE clientOperationId IN (:ids) AND state IN ('PENDING','RETRY')")
    suspend fun markSending(ids: List<String>): Int

    @Query("UPDATE sync_operations_local SET state = 'ACKED', serverSequence = :serverSequence, lastError = NULL WHERE clientOperationId = :id")
    suspend fun markAcknowledged(id: String, serverSequence: Long)

    @Query("UPDATE sync_operations_local SET state = 'RETRY', nextAttemptAtEpochMs = :nextAttemptAt, lastError = :error WHERE clientOperationId IN (:ids) AND state = 'SENDING'")
    suspend fun markForRetry(ids: List<String>, nextAttemptAt: Long, error: String)

    @Query("UPDATE sync_operations_local SET state = 'RETRY' WHERE state = 'SENDING'")
    suspend fun recoverInterruptedUploads()
}

