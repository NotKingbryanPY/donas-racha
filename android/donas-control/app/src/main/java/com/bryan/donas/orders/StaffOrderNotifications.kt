package com.bryan.donas.orders

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.edit
import androidx.core.net.toUri
import com.bryan.donas.DonasApp
import com.bryan.donas.R
import com.bryan.donas.daily.DailyActivity
import com.bryan.donas.data.OrderNotifications
import java.util.UUID

object StaffOrderNotifications {
    fun validId(value: String?): Boolean = value != null && runCatching { UUID.fromString(value).toString() == value.lowercase() }.getOrDefault(false)
    fun showOrder(context: Context, owner: String, id: String) = show(context, owner, id, false)
    fun showTest(context: Context, owner: String, id: String) = show(context, owner, id, true)
    @android.annotation.SuppressLint("MissingPermission")
    @Synchronized private fun show(context: Context, owner: String, id: String, test: Boolean) {
        if (!validId(id) || (context.applicationContext as DonasApp).backendClient.dailyOwner != owner) return
        OrderNotifications.ensureChannel(context)
        if (!OrderNotifications.enabled(context)) return
        val seen = context.getSharedPreferences("staff_order_alerts", Context.MODE_PRIVATE)
        val key = "$owner:$id"
        if (seen.contains(key)) return
        val intent = Intent(context, DailyActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            data = "donas-control://staff-orders/$id".toUri()
            putExtra("notificationOwner", owner)
            if (!test) putExtra("orderId", id)
            putExtra("openOrders", true)
        }
        val open = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, "new_orders")
            .setSmallIcon(R.drawable.ic_donut)
            .setContentTitle(if (test) "Donas Racha — Prueba de avisos" else "Donas Racha — Nuevo pedido")
            .setContentText(if (test) "Este teléfono recibió la prueba FCM." else "Pedido recibido. Toca para consultar los detalles.")
            .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setOnlyAlertOnce(true)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .setAutoCancel(true).setContentIntent(open).build()
        NotificationManagerCompat.from(context).notify(key, 0, notification)
        seen.edit(commit = true) { putBoolean(key, true) }
    }
}
