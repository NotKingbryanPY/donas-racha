package com.bryan.donas.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlin.math.min

object SyncDependencies {
    @Volatile var dao: SyncDao? = null
    @Volatile var api: SyncApiClient? = null
}

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val dao = SyncDependencies.dao ?: return Result.failure()
        val api = SyncDependencies.api ?: return Result.failure()
        dao.recoverInterruptedUploads()
        val operations = dao.pending(System.currentTimeMillis(), 50)
        if (operations.isEmpty()) return Result.success()
        val ids = operations.map { it.clientOperationId }
        if (dao.markSending(ids) != ids.size) return Result.retry()
        return try {
            val acknowledgements = api.push(operations)
            acknowledgements.forEach { dao.markAcknowledged(it.clientOperationId, it.serverSequence) }
            if (acknowledgements.size != operations.size) {
                val acknowledged = acknowledgements.mapTo(hashSetOf()) { it.clientOperationId }
                dao.markForRetry(ids.filterNot(acknowledged::contains), System.currentTimeMillis() + 60_000, "ACK_INCOMPLETO")
                Result.retry()
            } else Result.success()
        } catch (error: Exception) {
            val maxAttempts = operations.maxOfOrNull { it.attempts + 1 } ?: 1
            val delay = min(6 * 60 * 60 * 1000L, 30_000L shl min(maxAttempts - 1, 10))
            dao.markForRetry(ids, System.currentTimeMillis() + delay, error.message?.take(300) ?: "SYNC_ERROR")
            Result.retry()
        }
    }
}

