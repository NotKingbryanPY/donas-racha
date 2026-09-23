package com.bryan.donas.sync

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "sync_operations_local",
    indices = [Index(value = ["state", "nextAttemptAtEpochMs"])]
)
data class SyncOperationEntity(
    @PrimaryKey val clientOperationId: String,
    val operationType: String,
    val requestHash: String,
    val payloadJson: String,
    val occurredAtIso: String,
    val state: String = "PENDING",
    val attempts: Int = 0,
    val nextAttemptAtEpochMs: Long = 0,
    val lastError: String? = null,
    val serverSequence: Long? = null
)

