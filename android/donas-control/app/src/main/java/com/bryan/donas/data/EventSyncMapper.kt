package com.bryan.donas.data

import com.bryan.donas.data.db.EventEntity
import com.bryan.donas.data.db.SyncOutboxEntity
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

object EventSyncMapper {
    fun outbox(event: EventEntity, details: JSONObject? = null): SyncOutboxEntity {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val payload = JSONObject()
            .put("localEventId", event.id)
            .put("requestKey", event.requestKey)
            .put("amountCents", event.amountCents)
            .put("accountCode", event.accountCode)
            .put("sessionId", event.sessionId)
            .put("reversedEventId", event.reversedEventId)
        if (details != null) payload.put("details", details)
        return SyncOutboxEntity(
            clientOperationId = UUID.randomUUID().toString(),
            localEventId = event.id,
            type = event.type,
            occurredAt = formatter.format(Date(event.timestamp)),
            payloadJson = payload.toString(),
        )
    }
}
