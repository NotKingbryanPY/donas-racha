package com.bryan.donas.data

import android.content.Context
import androidx.room.withTransaction
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Constraints
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bryan.donas.DonasApp
import com.bryan.donas.data.db.RemoteOrderEntity
import com.bryan.donas.data.db.SyncStateEntity
import org.json.JSONObject

class OrderSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as DonasApp
        val client = app.backendClient
        if (!client.signedIn) return Result.success()
        val db = app.database
        val sync = db.syncDao()
        return try {
            app.repository.initialize()
            // Backfill operations created before the outbox migration, without changing the accounting ledger.
            while (true) {
                val events = sync.unqueuedEvents()
                if (events.isEmpty()) break
                db.withTransaction {
                    events.forEach { event ->
                        val sale = if (event.type == "SALE") db.operationDao().saleForEvent(event.id) else null
                        val details = sale?.let { JSONObject().put("quantity", it.quantity)
                            .put("unitPriceCents", it.unitPriceCents).put("costCents", it.costCents) }
                        sync.enqueue(EventSyncMapper.outbox(event, details))
                    }
                }
            }
            while (true) {
                val pending = sync.pending()
                if (pending.isEmpty()) break
                val acks = try { client.push(pending) } catch (e: Exception) {
                    sync.markAttempt(pending.map { it.clientOperationId }, e.message?.take(160) ?: "Error de red")
                    throw e
                }
                var awaitingApplication = false
                db.withTransaction {
                    for (index in 0 until acks.length()) {
                        val ack = acks.getJSONObject(index)
                        val id = ack.getString("clientOperationId")
                        when (ack.getString("status")) {
                            "APPLIED" -> sync.acknowledge(id, ack.getLong("serverSequence"))
                            "REJECTED" -> sync.reject(id, ack.getLong("serverSequence"), ack.optString("errorCode", "Requiere conciliación"))
                            "RECEIVED" -> if (pending.firstOrNull { it.clientOperationId == id }?.type !in setOf("SALE", "REVERSAL"))
                                sync.acknowledge(id, ack.getLong("serverSequence")) else awaitingApplication = true
                        }
                    }
                }
                if (acks.length() != pending.size) return Result.retry()
                if (awaitingApplication) return Result.retry()
            }
            var pages = 0
            do {
                val response = client.pull(sync.orderCursor())
                val rows = response.getJSONArray("orders")
                val orders = (0 until rows.length()).map { index ->
                    val item = rows.getJSONObject(index)
                    RemoteOrderEntity(
                        id = item.getString("id"), publicCode = item.getString("public_code"),
                        status = item.getString("status"), paymentMethod = item.getString("payment_method"),
                        paymentStatus = item.getString("payment_status"),
                        deliveryLocation = item.optString("delivery_location"),
                        customerName = item.optString("customer_name"), customerPhone = item.optString("customer_phone"),
                        totalCents = item.getLong("total_cents"), createdAt = item.getString("created_at"),
                        updatedAt = item.getString("updated_at"), itemsJson = item.getJSONArray("items").toString(),
                        settled = item.optBoolean("settled")
                    )
                }
                db.withTransaction {
                    sync.upsertOrders(orders)
                    sync.saveState(SyncStateEntity(orderCursor = response.optString("nextCursor").ifBlank { null }))
                }
                pages++
            } while (response.optBoolean("hasMore") && pages < 20)
            var needsRetry = false
            for (order in sync.settledOrders()) {
                try {
                    val before = db.operationDao().eventByKey("order-${order.id}")
                    if (before == null) {
                        app.operations.bookRemoteOrder(order)
                        needsRetry = true // Push the local accounting receipt on the next pass.
                    }
                } catch (_: Exception) { needsRetry = true }
            }
            if (needsRetry) Result.retry() else Result.success()
        } catch (e: BackendException) {
            if (e.status in 400..499 && e.status != 429) Result.failure() else Result.retry()
        } catch (_: Exception) { Result.retry() }
    }
}

object OrderSync {
    fun request(context: Context) {
        val work = OneTimeWorkRequestBuilder<OrderSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("donas-order-sync", ExistingWorkPolicy.KEEP, work)
    }
}
