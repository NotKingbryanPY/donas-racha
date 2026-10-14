package com.bryan.donas.daily

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

/** UUID and payload are immutable even after a timeout or process death. */
@Entity(tableName = "daily_outbox", indices = [Index(value = ["ownerId", "createdAt"]), Index(value = ["ownerId", "state", "sequence"])])
data class DailyOperation(
    @PrimaryKey val id: String,
    val ownerId: String,
    val sessionId: String,
    val kind: String,
    val payload: String,
    val createdAt: Long,
    val state: String = "PENDING",
    val sequence: Long? = null,
    val error: String? = null,
    val attempts: Int = 0,
)
@Entity(tableName = "daily_cache")
data class DailyCache(@PrimaryKey val ownerId: String, val json: String, val receivedAt: Long)

@Dao
interface DailyDao {
    @Query("SELECT * FROM daily_outbox WHERE id=:id") suspend fun operation(id: String): DailyOperation?
    @Insert(onConflict = OnConflictStrategy.ABORT) suspend fun enqueue(item: DailyOperation)
    @Query("SELECT * FROM daily_outbox WHERE ownerId=:owner ORDER BY createdAt,id") suspend fun all(owner: String): List<DailyOperation>
    @Query("SELECT * FROM daily_outbox WHERE ownerId=:owner AND state='PENDING' ORDER BY rowid LIMIT 50") suspend fun pending(owner: String): List<DailyOperation>
    @Query("SELECT * FROM daily_outbox WHERE ownerId=:owner AND (state IN ('PENDING','CONFLICT') OR id IN (SELECT id FROM daily_outbox WHERE ownerId=:owner AND state NOT IN ('PENDING','CONFLICT') ORDER BY createdAt DESC LIMIT 200)) ORDER BY createdAt DESC") fun observe(owner: String): Flow<List<DailyOperation>>
    @Query("SELECT * FROM daily_outbox WHERE ownerId=:owner AND (state IN ('PENDING','CONFLICT') OR (state='ACKED' AND sequence>:afterSequence)) ORDER BY rowid") suspend fun projecting(owner: String, afterSequence: Long): List<DailyOperation>
    @Query("SELECT COUNT(*) FROM daily_outbox WHERE ownerId=:owner AND state='CONFLICT'") suspend fun conflicts(owner: String): Int
    @Query("UPDATE daily_outbox SET state='ACKED',sequence=:sequence,error=NULL WHERE id=:id") suspend fun acknowledge(id: String, sequence: Long)
    @Query("UPDATE daily_outbox SET state=:state,error=:error,attempts=attempts+1 WHERE id=:id") suspend fun issue(id: String, state: String, error: String)
    @Query("UPDATE daily_outbox SET state='PENDING',error=NULL WHERE id=:id AND state='CONFLICT'") suspend fun retry(id: String)
    @Query("UPDATE daily_outbox SET state='CANCELLED',error='Descartado explícitamente; no confirmado en servidor' WHERE id=:id AND state='CONFLICT'") suspend fun discard(id: String)
    @Upsert suspend fun cache(item: DailyCache)
    @Query("SELECT * FROM daily_cache WHERE ownerId=:owner") suspend fun cache(owner: String): DailyCache?
    @Query("SELECT * FROM daily_cache WHERE ownerId=:owner") fun observeCache(owner: String): Flow<DailyCache?>
    @Query("SELECT COUNT(*) FROM sync_outbox WHERE state!='ACKED'") suspend fun legacyPending(): Int
}
