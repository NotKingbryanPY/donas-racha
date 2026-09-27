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
import com.bryan.donas.data.FlavorBasket
import com.bryan.donas.data.OrderSync
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
    const val ADD_FLAVOR = "com.bryan.donas.ADD_FLAVOR"
    const val REMOVE_FLAVOR = "com.bryan.donas.REMOVE_FLAVOR"
    const val EXTRA_WIDGET_ID = "com.bryan.donas.WIDGET_ID"
    const val EXTRA_FLAVOR_INDEX = "com.bryan.donas.FLAVOR_INDEX"
    const val EXTRA_OPEN_PURCHASE = "com.bryan.donas.OPEN_PURCHASE"
    const val EXTRA_SALE_ACCOUNT = "com.bryan.donas.SALE_ACCOUNT"
    const val EXTRA_SALE_QUANTITY = "com.bryan.donas.SALE_QUANTITY"
    private const val CHANNEL = "active_sales"
    private const val PREFS = "quick_sale_widget_baskets"
    private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val salesInFlight = mutableSetOf<Int>()
    private val countViews = intArrayOf(R.id.widgetCount0, R.id.widgetCount1, R.id.widgetCount2, R.id.widgetCount3)
    private val plusViews = intArrayOf(R.id.widgetPlus0, R.id.widgetPlus1, R.id.widgetPlus2, R.id.widgetPlus3)
    private val minusViews = intArrayOf(R.id.widgetMinus0, R.id.widgetMinus1, R.id.widgetMinus2, R.id.widgetMinus3)
    private val flavorViews = intArrayOf(R.id.widgetFlavor0, R.id.widgetFlavor1, R.id.widgetFlavor2, R.id.widgetFlavor3)

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun countKey(id: Int, index: Int) = "$id:$index"
    private fun operationKey(id: Int) = "$id:operation"

    fun basket(context: Context, id: Int): FlavorBasket {
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return FlavorBasket.empty()
        val values = IntArray(FlavorBasket.skus.size) { prefs(context).getInt(countKey(id, it), 0) }
        return runCatching { FlavorBasket.from(values) }.getOrDefault(FlavorBasket.empty())
    }

    fun changeFlavor(context: Context, id: Int, index: Int, delta: Int) {
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID || index !in FlavorBasket.skus.indices) return
        if (synchronized(salesInFlight) { id in salesInFlight }) return
        val next = basket(context, id).change(index, delta)
        prefs(context).edit { putInt(countKey(id, index), next.count(index)) }
        updateSelection(context, id, next, null)
    }

    @android.annotation.SuppressLint("UseKtx") // commit() must report persistence failure before a sale.
    fun requestKey(context: Context, id: Int): String {
        val preferences = prefs(context)
        preferences.getString(operationKey(id), null)?.let { return it }
        val key = UUID.randomUUID().toString()
        check(preferences.edit().putString(operationKey(id), key).commit()) { "No se pudo guardar la clave de la venta." }
        return key
    }

    @android.annotation.SuppressLint("UseKtx") // commit() must report persistence failure after a sale.
    fun clearSelection(context: Context, id: Int) {
        val editor = prefs(context).edit()
        FlavorBasket.skus.indices.forEach { editor.remove(countKey(id, it)) }
        check(editor.remove(operationKey(id)).commit()) { "No se pudo limpiar la venta confirmada." }
        updateSelection(context, id, FlavorBasket.empty(), null)
    }

    fun clearQuantities(context: Context, ids: IntArray) {
        prefs(context).edit {
            ids.forEach { id ->
                FlavorBasket.skus.indices.forEach { remove(countKey(id, it)) }
                remove(operationKey(id))
            }
        }
    }

    fun beginSale(id: Int): Boolean = synchronized(salesInFlight) { salesInFlight.add(id) }
    fun endSale(id: Int) { synchronized(salesInFlight) { salesInFlight.remove(id) } }

    fun updateAll(context: Context) {
        backgroundScope.launch {
            runCatching { refresh(context.applicationContext) }
                .onFailure { showError(context.applicationContext, "No se pudo actualizar el stock") }
        }
    }

    fun showInitial(context: Context, ids: IntArray) {
        ids.forEach { updateWidget(context, it, null, "Cargando stock local…") }
    }

    fun showError(context: Context, message: String) {
        widgetIds(context).forEach { updateSelection(context, it, basket(context, it), message) }
    }

    fun showMessage(context: Context, id: Int, message: String) {
        updateSelection(context, id, basket(context, id), message)
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

    private fun selectionMessage(basket: FlavorBasket) =
        if (basket.total == 0) "Elige sabores · toca +" else "${basket.total} seleccionadas · toca cómo cobrar"

    private fun updateSelection(context: Context, id: Int, basket: FlavorBasket, message: String?) {
        val views = RemoteViews(context.packageName, R.layout.widget_donas)
        countViews.forEachIndexed { index, view -> views.setTextViewText(view, basket.count(index).toString()) }
        views.setTextViewText(R.id.widgetMessage, message ?: selectionMessage(basket))
        AppWidgetManager.getInstance(context).partiallyUpdateAppWidget(id, views)
    }

    private fun updateWidget(context: Context, id: Int, data: DashboardData?, status: String?) {
        val views = RemoteViews(context.packageName, R.layout.widget_donas)
        val summary = when {
            status != null -> status
            data == null -> "Stock local: —"
            else -> "Stock ${data.stock} · Hoy ${Money.format(data.today.revenue)}"
        }
        views.setTextViewText(R.id.widgetSummary, summary)
        val basket = basket(context, id)
        countViews.forEachIndexed { index, view -> views.setTextViewText(view, basket.count(index).toString()) }
        views.setTextViewText(R.id.widgetMessage, selectionMessage(basket))
        for (index in FlavorBasket.skus.indices) {
            views.setOnClickPendingIntent(flavorViews[index], action(context, id, ADD_FLAVOR, index, 10 + index))
            views.setOnClickPendingIntent(plusViews[index], action(context, id, ADD_FLAVOR, index, 20 + index))
            views.setOnClickPendingIntent(minusViews[index], action(context, id, REMOVE_FLAVOR, index, 30 + index))
        }
        views.setOnClickPendingIntent(R.id.widgetCash, action(context, id, CASH, -1, 40))
        views.setOnClickPendingIntent(R.id.widgetYappy, action(context, id, YAPPY, -1, 41))
        views.setOnClickPendingIntent(R.id.widgetTitle, openApp(context, id * 100 + 42))
        AppWidgetManager.getInstance(context).updateAppWidget(id, views)
    }

    private fun action(context: Context, id: Int, action: String, index: Int, slot: Int): PendingIntent =
        PendingIntent.getBroadcast(context, id * 100 + slot,
            Intent(context, QuickSaleReceiver::class.java).setAction(action)
                .setData("donas-control://widget/$id/$slot".toUri())
                .putExtra(EXTRA_WIDGET_ID, id).putExtra(EXTRA_FLAVOR_INDEX, index),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun salePickerAction(context: Context, account: String, code: Int): PendingIntent =
        PendingIntent.getActivity(context, code,
            Intent(context, OperationsActivity::class.java)
                .setData("donas-control://notification/$account".toUri())
                .putExtra(EXTRA_SALE_ACCOUNT, account).putExtra(EXTRA_SALE_QUANTITY, 1),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun openApp(context: Context, code: Int): PendingIntent =
        PendingIntent.getActivity(context, code, Intent(context, OperationsActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun updateNotification(context: Context, data: DashboardData) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, "Jornada de ventas", NotificationManager.IMPORTANCE_LOW),
            )
        }
        if (data.activeSession == null) { manager.cancel(41); return }
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_donut)
            .setContentTitle("Venta de Donas")
            .setContentText("Hoy ${Money.format(data.today.revenue)} · ${data.today.quantity} vendidas · ${data.stock} disponibles")
            .setContentIntent(openApp(context, 40))
            .setOngoing(true).setOnlyAlertOnce(true)
            .addAction(0, "Elegir sabores · Efectivo", salePickerAction(context, "CASH", 401))
            .addAction(0, "Elegir sabores · Yappy", salePickerAction(context, "YAPPY", 402))
            .build()
        manager.notify(41, notification)
    }
}

class QuickSaleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(QuickSaleUi.EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return
        when (intent.action) {
            QuickSaleUi.ADD_FLAVOR, QuickSaleUi.REMOVE_FLAVOR -> {
                val index = intent.getIntExtra(QuickSaleUi.EXTRA_FLAVOR_INDEX, -1)
                QuickSaleUi.changeFlavor(context, id, index, if (intent.action == QuickSaleUi.ADD_FLAVOR) 1 else -1)
            }
            QuickSaleUi.CASH, QuickSaleUi.YAPPY -> {
                if (!QuickSaleUi.beginSale(id)) return
                val pending = goAsync()
                CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
                    var saved = false
                    try {
                        val basket = QuickSaleUi.basket(context, id)
                        require(basket.total > 0) { "Selecciona al menos una dona." }
                        val app = context.applicationContext as DonasApp
                        app.repository.initialize()
                        val key = QuickSaleUi.requestKey(context, id)
                        if (app.operations.dashboard().activeSession == null) {
                            app.operations.startSession(requestKey = "widget-session-$key")
                        }
                        val account = if (intent.action == QuickSaleUi.YAPPY) "YAPPY" else "CASH"
                        app.operations.quickSale(account, basket.total.toLong(), requestKey = key, flavors = basket.items())
                        saved = true
                        QuickSaleUi.clearSelection(context, id)
                        val syncQueued = app.backendClient.signedIn && runCatching { OrderSync.request(context) }.isSuccess
                        runCatching { QuickSaleUi.refresh(context.applicationContext) }
                        val message = if (syncQueued) "Venta guardada · ${basket.total} donas" else "Venta local guardada · sincroniza después"
                        QuickSaleUi.showMessage(context, id, message)
                        runCatching { withContext(Dispatchers.Main) { Toast.makeText(context, message, Toast.LENGTH_SHORT).show() } }
                    } catch (e: Exception) {
                        val message = if (saved) "Venta guardada; revisa el resumen antes de repetir" else e.localizedMessage ?: "No se guardó la venta"
                        QuickSaleUi.showMessage(context, id, message)
                    } finally {
                        QuickSaleUi.endSale(id)
                        pending.finish()
                    }
                }
            }
        }
    }
}

class DonasWidgetProvider : android.appwidget.AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        QuickSaleUi.showInitial(context, ids)
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try { QuickSaleUi.refresh(context.applicationContext) }
            catch (_: Exception) { QuickSaleUi.showError(context.applicationContext, "No se pudo actualizar el stock") }
            finally { pendingResult.finish() }
        }
    }

    override fun onEnabled(context: Context) { QuickSaleUi.updateAll(context) }
    override fun onDeleted(context: Context, appWidgetIds: IntArray) { QuickSaleUi.clearQuantities(context, appWidgetIds) }
}
