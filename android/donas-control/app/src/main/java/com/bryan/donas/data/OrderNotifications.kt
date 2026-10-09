package com.bryan.donas.data

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.core.content.edit
import com.bryan.donas.R
import com.bryan.donas.data.db.RemoteOrderEntity
import com.bryan.donas.ui.OrdersActivity

object OrderNotifications {
    private const val CHANNEL = "new_orders"
    fun showNew(context: Context, id: String, code: String) = showMessage(context, id,
        "Donas Racha — Nuevo pedido", "Pedido $code recibido. Toca para consultar los detalles.")

    @android.annotation.SuppressLint("MissingPermission") // Permission is checked immediately before posting.
    fun show(context: Context, order: RemoteOrderEntity) {
        showMessage(context, order.id, "Donas Racha — Nuevo pedido", "Pedido ${order.publicCode} recibido. Toca para consultar los detalles.")
    }

    @android.annotation.SuppressLint("MissingPermission")
    @Synchronized private fun showMessage(context: Context, id: String, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        val seen = context.getSharedPreferences("order_alerts", Context.MODE_PRIVATE)
        if (seen.contains(id)) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Pedidos nuevos", NotificationManager.IMPORTANCE_HIGH))
        val intent = Intent(context, OrdersActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            data = "donas-control://orders/$id".toUri()
            putExtra("orderId", id)
        }
        val open = PendingIntent.getActivity(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_donut)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setOnlyAlertOnce(true)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        NotificationManagerCompat.from(context).notify(id, 0, notification)
        seen.edit(commit = true) { putBoolean(id, true) }
    }
}
