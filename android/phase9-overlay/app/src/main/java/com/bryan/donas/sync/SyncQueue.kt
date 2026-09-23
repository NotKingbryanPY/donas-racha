package com.bryan.donas.sync

import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

object SyncQueue {
    private val allowedTypes = setOf(
        "SEED", "OPENING_BALANCE", "SALE", "PURCHASE", "EXPENSE", "LOAN",
        "LOAN_PAYMENT", "PARTNER_PAYMENT", "ADJUSTMENT", "SESSION"
    )

    suspend fun enqueue(dao: SyncDao, type: String, payloadJson: String, operationId: String = UUID.randomUUID().toString()): String {
        require(type in allowedTypes)
        val normalized = payloadJson.trim()
        require(normalized.startsWith("{") && normalized.endsWith("}"))
        val hash = MessageDigest.getInstance("SHA-256").digest(normalized.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        dao.insert(SyncOperationEntity(operationId, type, hash, normalized, Instant.now().toString()))
        return operationId
    }
}

