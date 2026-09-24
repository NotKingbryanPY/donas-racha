package com.bryan.donas.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert

@Dao
interface SyncDao {
    @Query("SELECT e.* FROM events e LEFT JOIN sync_outbox s ON s.localEventId=e.id WHERE s.localEventId IS NULL ORDER BY e.id LIMIT :limit")
    suspend fun unqueuedEvents(limit: Int = 50): List<EventEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun enqueue(item: SyncOutboxEntity): Long

    @Query("SELECT * FROM sync_outbox WHERE state = 'PENDING' ORDER BY occurredAt, localEventId LIMIT :limit")
    suspend fun pending(limit: Int = 50): List<SyncOutboxEntity>

    @Query("UPDATE sync_outbox SET state='ACKED', serverSequence=:sequence, lastError=NULL WHERE clientOperationId=:id")
    suspend fun acknowledge(id: String, sequence: Long)

    @Query("UPDATE sync_outbox SET attempts=attempts+1, lastError=:error WHERE clientOperationId IN (:ids)")
    suspend fun markAttempt(ids: List<String>, error: String)

    @Query("SELECT COUNT(*) FROM sync_outbox WHERE state='PENDING'")
    suspend fun pendingCount(): Int

    @Upsert
    suspend fun upsertOrders(orders: List<RemoteOrderEntity>)

    @Query("SELECT * FROM remote_orders ORDER BY createdAt DESC LIMIT 100")
    suspend fun recentOrders(): List<RemoteOrderEntity>

    @Query("SELECT * FROM remote_orders WHERE id=:id LIMIT 1")
    suspend fun order(id: String): RemoteOrderEntity?

    @Query("DELETE FROM remote_orders")
    suspend fun clearOrders()

    @Query("SELECT orderCursor FROM sync_state WHERE id=1")
    suspend fun orderCursor(): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveState(state: SyncStateEntity)

    @Query("DELETE FROM sync_state")
    suspend fun clearState()
}
