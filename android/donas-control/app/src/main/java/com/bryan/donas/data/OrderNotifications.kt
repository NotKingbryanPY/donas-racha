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
import com.bryan.donas.R
import com.bryan.donas.data.db.RemoteOrderEntity
import com.bryan.donas.ui.OrdersActivity

object OrderNotifications {
    private const val CHANNEL = "new_orders"

    @android.annotation.SuppressLint("MissingPermission") // Permission is checked immediately before posting.
    fun show(context: Context, order: RemoteOrderEntity) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Pedidos nuevos", NotificationManager.IMPORTANCE_HIGH))
        val intent = Intent(context, OrdersActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val open = PendingIntent.getActivity(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_donut)
            .setContentTitle("Nuevo pedido ${order.publicCode}")
            .setContentText("${order.customerName} · ${order.deliveryLocation}")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        NotificationManagerCompat.from(context).notify(order.id.hashCode(), notification)
    }
}
