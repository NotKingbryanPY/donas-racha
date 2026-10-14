package com.bryan.donas.daily

import android.content.Context
import androidx.core.content.edit
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BackendException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Dependency-injected transport enables actual durable retry tests without cloud credentials. */
class DailySynchronizer(private val repo: DailyRepository, private val client: DailyTransport) {
    suspend fun synchronize(owner: String): Boolean {
        repo.refresh(owner)
        if (repo.dao.conflicts(owner) > 0) return false
        for (item in repo.dao.pending(owner)) {
            if (client.dailyOwner != owner) return false
            try {
                val ack = client.dailyApply(JSONObject(item.payload), owner)
                require(ack.getString("operationId") == item.id && ack.getLong("serverSequence") > 0) { "Confirmación incompleta; conserva el mismo identificador." }
                repo.dao.acknowledge(item.id, ack.getLong("serverSequence"))
            } catch (e: BackendException) {
                val conflict = e.status in listOf(400, 403, 404, 409)
                repo.dao.issue(item.id, if (conflict) "CONFLICT" else "PENDING", "${e.code ?: "CONNECTION"}: ${e.message}")
                if (conflict) { repo.refresh(owner); return false }
                throw e
            }
        }
        repo.refresh(owner)
        return repo.dao.pending(owner).isEmpty()
    }
}

class DailySyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    companion object { private val lock = Mutex() }
    override suspend fun doWork(): Result = lock.withLock {
        val app = applicationContext as DonasApp
        val client = app.backendClient
        val owner = client.dailyOwner ?: return@withLock Result.success()
        val repo = app.daily
        val status = applicationContext.getSharedPreferences("daily_sync", Context.MODE_PRIVATE)
        try {
            val complete = DailySynchronizer(repo, client).synchronize(owner)
            status.edit { remove("error"); putLong("lastSuccess", System.currentTimeMillis()) }
            if (!complete && repo.dao.conflicts(owner) == 0) Result.retry() else Result.success()
        } catch (e: CancellationException) { throw e
        } catch (e: BackendException) {
            status.edit { putString("error", "${e.code ?: "CONNECTION"}: ${e.message}") }
            if (e.status in listOf(401, 403) && client.dailyOwner == owner) client.logout()
            if (e.status in listOf(401, 403) || e.code == "DAILY_SETUP_REQUIRED") Result.failure() else Result.retry()
        } catch (_: Exception) {
            status.edit { putString("error", "No se pudo sincronizar. Los registros pendientes se conservan.") }
            Result.retry()
        }
    }
}
object DailySync {
    private fun constraints() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    fun request(context: Context) {
        WorkManager.getInstance(context).enqueueUniqueWork("donas-daily-sync", ExistingWorkPolicy.APPEND_OR_REPLACE,
            OneTimeWorkRequestBuilder<DailySyncWorker>().setConstraints(constraints())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
    }
    fun schedule(context: Context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("donas-daily-backup", ExistingPeriodicWorkPolicy.UPDATE,
            PeriodicWorkRequestBuilder<DailySyncWorker>(30, TimeUnit.MINUTES).setConstraints(constraints())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
        request(context)
    }
    fun stop(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork("donas-daily-sync")
        WorkManager.getInstance(context).cancelUniqueWork("donas-daily-backup")
    }
}
