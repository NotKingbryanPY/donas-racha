package com.bryan.donas.ui

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.widget.RemoteViews
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.core.net.toUri
import com.bryan.donas.DonasApp
import com.bryan.donas.R
import com.bryan.donas.data.DashboardData
import com.bryan.donas.util.Money
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

object QuickSaleUi {
    const val CASH = "com.bryan.donas.SALE_CASH"
    const val YAPPY = "com.bryan.donas.SALE_YAPPY"
    const val INCREASE = "com.bryan.donas.QUANTITY_INCREASE"
    const val DECREASE = "com.bryan.donas.QUANTITY_DECREASE"
    const val EXTRA_WIDGET_ID = "com.bryan.donas.WIDGET_ID"
    const val EXTRA_OPEN_PURCHASE = "com.bryan.donas.OPEN_PURCHASE"
    private const val CHANNEL = "active_sales"
    private const val QUANTITY_PREFS = "quick_sale_widget_quantities"
    private const val MAX_QUANTITY = 99
    private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun quantity(context: Context, id: Int): Int = if (id == AppWidgetManager.INVALID_APPWIDGET_ID) 1
        else context.getSharedPreferences(QUANTITY_PREFS, Context.MODE_PRIVATE)
            .getInt(id.toString(), 1).coerceIn(1, MAX_QUANTITY)

    fun changeQuantity(context: Context, id: Int, delta: Int): Int {
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return 1
        val next = (quantity(context, id) + delta).coerceIn(1, MAX_QUANTITY)
        context.getSharedPreferences(QUANTITY_PREFS, Context.MODE_PRIVATE)
            .edit { putInt(id.toString(), next) }
        AppWidgetManager.getInstance(context).partiallyUpdateAppWidget(
            id, RemoteViews(context.packageName, R.layout.widget_donas).apply {
                setTextViewText(R.id.widgetQuantity, next.toString())
            },
        )
        return next
    }

    fun clearQuantities(context: Context, ids: IntArray) {
        context.getSharedPreferences(QUANTITY_PREFS, Context.MODE_PRIVATE).edit {
            ids.forEach { remove(it.toString()) }
        }
    }

    fun updateAll(context: Context) {
        backgroundScope.launch {
            runCatching { refresh(context.applicationContext) }
                .onFailure { showError(context.applicationContext, "Abre Donas Control para actualizar") }
        }
    }

    fun showInitial(context: Context, ids: IntArray) {
        ids.forEach { updateWidget(context, it, null, "Cargando ventas e inventario…") }
    }

    fun showError(context: Context, message: String) {
        widgetIds(context).forEach { updateWidget(context, it, null, message) }
    }

    suspend fun refresh(context: Context) {
        val app = context.applicationContext as DonasApp
        app.repository.initialize()
        val data = app.operations.dashboard()
        widgetIds(context).forEach { updateWidget(context, it, data, null) }
        updateNotification(context, data)
    }

    private fun widgetIds(context: Context): IntArray {
        val manager = AppWidgetManager.getInstance(context)
        return manager.getAppWidgetIds(ComponentName(context, DonasWidgetProvider::class.java))
    }

    private fun updateWidget(context: Context, id: Int, data: DashboardData?, status: String?) {
        val views = RemoteViews(context.packageName, R.layout.widget_donas)
        val summary = when {
            status != null -> status
            data?.activeSession == null -> "Sin jornada · Stock: ${data?.stock ?: 0}"
            else -> "Hoy: ${Money.format(data.today.revenue)} · Stock: ${data.stock}"
        }
        views.setTextViewText(R.id.widgetSummary, summary)
        views.setTextViewText(R.id.widgetQuantity, quantity(context, id).toString())
        views.setOnClickPendingIntent(R.id.widgetMinus, widgetAction(context, DECREASE, id, 1))
        views.setOnClickPendingIntent(R.id.widgetPlus, widgetAction(context, INCREASE, id, 2))
        views.setOnClickPendingIntent(R.id.widgetCash, widgetAction(context, CASH, id, 3))
        views.setOnClickPendingIntent(R.id.widgetYappy, widgetAction(context, YAPPY, id, 4))
        views.setOnClickPendingIntent(R.id.widgetPurchase, purchaseAction(context, id * 10 + 3))
        views.setOnClickPendingIntent(R.id.widgetTitle, openApp(context, id * 10 + 4))
        AppWidgetManager.getInstance(context).updateAppWidget(id, views)
    }

    private fun widgetAction(context: Context, action: String, id: Int, slot: Int): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            slot,
            Intent(context, QuickSaleReceiver::class.java).setAction(action)
                .setData("donas-control://widget/$id/$slot".toUri())
                .putExtra(EXTRA_WIDGET_ID, id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun saleAction(context: Context, action: String, code: Int): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            code,
            Intent(context, QuickSaleReceiver::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun purchaseAction(context: Context, code: Int): PendingIntent =
        PendingIntent.getActivity(
            context,
            code,
            Intent(context, OperationsActivity::class.java).putExtra(EXTRA_OPEN_PURCHASE, true),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun openApp(context: Context, code: Int): PendingIntent =
        PendingIntent.getActivity(
            context,
            code,
            Intent(context, OperationsActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun updateNotification(context: Context, data: DashboardData) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, "Jornada de ventas", NotificationManager.IMPORTANCE_LOW),
            )
        }
        if (data.activeSession == null) {
            manager.cancel(41)
            return
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_donut)
            .setContentTitle("Venta de Donas")
            .setContentText("Hoy ${Money.format(data.today.revenue)} · ${data.today.quantity} vendidas · ${data.stock} disponibles")
            .setContentIntent(openApp(context, 40))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, "EFECTIVO +1", saleAction(context, CASH, 401))
            .addAction(0, "YAPPY +1", saleAction(context, YAPPY, 402))
            .build()
        manager.notify(41, notification)
    }
}

class QuickSaleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val widgetId = intent.getIntExtra(QuickSaleUi.EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        when (intent.action) {
            QuickSaleUi.INCREASE -> { QuickSaleUi.changeQuantity(context, widgetId, 1); return }
            QuickSaleUi.DECREASE -> { QuickSaleUi.changeQuantity(context, widgetId, -1); return }
            QuickSaleUi.CASH, QuickSaleUi.YAPPY -> Unit
            else -> return
        }
        val quantity = QuickSaleUi.quantity(context, widgetId).toLong()
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            val message = runCatching {
                val app = context.applicationContext as DonasApp
                app.repository.initialize()
                if (app.operations.dashboard().activeSession == null) {
                    app.operations.startSession(requestKey = "widget-session-${UUID.randomUUID()}")
                }
                val account = if (intent.action == QuickSaleUi.YAPPY) "YAPPY" else "CASH"
                app.operations.quickSale(account, quantity = quantity, requestKey = UUID.randomUUID().toString())
                if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    QuickSaleUi.changeQuantity(context.applicationContext, widgetId, 1 - quantity.toInt())
                }
                QuickSaleUi.refresh(context.applicationContext)
                if (account == "YAPPY") "$quantity donas registradas en Yappy" else "$quantity donas registradas en efectivo"
            }.getOrElse { error ->
                QuickSaleUi.showError(context.applicationContext, error.localizedMessage ?: "No se pudo registrar")
                error.localizedMessage ?: "No se pudo registrar la venta"
            }
            withContext(Dispatchers.Main) {
                Toast.makeText(context.applicationContext, message, Toast.LENGTH_SHORT).show()
            }
            pendingResult.finish()
        }
    }
}

class DonasWidgetProvider : android.appwidget.AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        QuickSaleUi.showInitial(context, ids)
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            runCatching { QuickSaleUi.refresh(context.applicationContext) }
                .onFailure { QuickSaleUi.showError(context.applicationContext, "Toca para abrir Donas Control") }
            pendingResult.finish()
        }
    }

    override fun onEnabled(context: Context) {
        QuickSaleUi.updateAll(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        QuickSaleUi.clearQuantities(context, appWidgetIds)
    }
}
