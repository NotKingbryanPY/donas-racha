package com.bryan.donas.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "sync_outbox", indices = [Index(value = ["state", "occurredAt"]), Index(value = ["localEventId"], unique = true)])
data class SyncOutboxEntity(
    @PrimaryKey val clientOperationId: String,
    val localEventId: Long,
    val type: String,
    val occurredAt: String,
    val payloadJson: String,
    val state: String = "PENDING",
    val attempts: Int = 0,
    val serverSequence: Long? = null,
    val lastError: String? = null,
)

@Entity(tableName = "remote_orders", indices = [Index(value = ["status", "createdAt"])])
data class RemoteOrderEntity(
    @PrimaryKey val id: String,
    val publicCode: String,
    val status: String,
    val paymentMethod: String,
    val paymentStatus: String,
    val deliveryLocation: String,
    val customerName: String,
    val customerPhone: String,
    val totalCents: Long,
    val createdAt: String,
    val updatedAt: String,
    val itemsJson: String,
    val settled: Boolean = false,
)

@Entity(tableName = "sync_state")
data class SyncStateEntity(@PrimaryKey val id: Int = 1, val orderCursor: String?)
