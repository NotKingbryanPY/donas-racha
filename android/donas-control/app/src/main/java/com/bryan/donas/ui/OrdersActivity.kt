package com.bryan.donas.ui

import android.os.Bundle
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.isVisible
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import androidx.room.withTransaction
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BackendClient
import com.bryan.donas.data.OrderSync
import com.bryan.donas.data.OrderNotifications
import com.bryan.donas.data.db.RemoteOrderEntity
import com.bryan.donas.util.Money
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch
import org.json.JSONArray

class OrdersActivity : AppCompatActivity() {
    private lateinit var client: BackendClient
    private lateinit var root: LinearLayout
    private lateinit var email: TextInputEditText
    private lateinit var password: TextInputEditText
    private lateinit var login: MaterialButton
    private lateinit var logout: MaterialButton
    private lateinit var sync: MaterialButton
    private lateinit var notice: TextView
    private lateinit var list: LinearLayout
    private lateinit var loginFields: LinearLayout
    private val pendingOrders = mutableSetOf<String>()
    private var confirmationOpen = false
    private var refreshing = false
    private var targetOrderId: String? = null
    private val app get() = application as DonasApp
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        client = app.backendClient
        targetOrderId = savedInstanceState?.getString("orderId") ?: intent.getStringExtra("orderId")
        root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(18.dp, 18.dp, 18.dp, 18.dp) }
        val scroll = ScrollView(this).apply { addView(root) }
        setContentView(scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        val dark = resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, scroll).isAppearanceLightStatusBars = !dark
        WindowCompat.getInsetsController(window, scroll).isAppearanceLightNavigationBars = !dark
        root.addView(button("← Volver · Administración") { startActivity(android.content.Intent(this, MainActivity::class.java)) }, fullWidth())
        root.addView(TextView(this).apply { text = "Pedidos"; textSize = 24f }, fullWidth())
        notice = TextView(this).apply { text = "Acepta, entrega y cobra. Los puntos se aplican al finalizar, hasta 3 compras con puntos por cliente al día."; textSize = 14f; setPadding(0, 8.dp, 0, 12.dp) }
        root.addView(notice, fullWidth())
        loginFields = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val invitationInput = input("Invitación de dispositivo (un solo uso)", false)
        val invitation = invitationInput.editText as TextInputEditText
        loginFields.addView(invitationInput, fullWidth())
        loginFields.addView(button("Autorizar este dispositivo") {
            lifecycleScope.launch {
                try {
                    client.provision(invitation.text?.toString().orEmpty())
                    invitation.setText(""); renderSession()
                    com.bryan.donas.data.PushRegistration.register(this@OrdersActivity)
                    OrderSync.schedule(this@OrdersActivity); refreshOrders()
                } catch (e: Exception) { notice.text = e.message ?: "No se pudo autorizar." }
            }
        }, fullWidth())
        val emailInput = input("Correo (acceso Supabase anterior)", false)
        val passwordInput = input("Contraseña", true)
        email = emailInput.editText as TextInputEditText
        password = passwordInput.editText as TextInputEditText
        loginFields.addView(emailInput, fullWidth())
        loginFields.addView(passwordInput, fullWidth())
        login = button("Iniciar sesión") { signIn() }
        loginFields.addView(login, fullWidth())
        root.addView(loginFields, fullWidth())
        sync = button("Actualizar pedidos") { refreshOrders() }
        logout = button("Cerrar sesión") {
            lifecycleScope.launch {
                try { if (com.bryan.donas.data.PushRegistration.configured) client.unregisterPush() } catch (_: Exception) {
                    notice.text = "Conecta a Internet para desvincular los avisos y cerrar sesión."
                    return@launch
                }
                client.logout()
                OrderSync.stop(this@OrdersActivity)
                renderSession()
                val dao = app.database.syncDao()
                dao.clearOrders(); dao.clearState()
                notice.text = "Sesión cerrada."
            }
        }
        root.addView(sync, fullWidth())
        root.addView(logout, fullWidth())
        root.addView(button("Sabores y disponibilidad") { startActivity(android.content.Intent(this, CatalogActivity::class.java)) }, fullWidth())
        root.addView(button("Cuenta · Correo o Google") { startActivity(android.content.Intent(this, FirebaseAccountActivity::class.java)) }, fullWidth())
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(list, fullWidth())
        WorkManager.getInstance(this).getWorkInfosForUniqueWorkLiveData("donas-order-sync").observe(this) { jobs ->
            val job = jobs.lastOrNull() ?: return@observe
            if (job.state == WorkInfo.State.SUCCEEDED) { notice.text = "Pedidos actualizados."; loadOrders() }
            if (job.state == WorkInfo.State.FAILED) { renderSession(); loadOrders(); notice.text = "No se pudo sincronizar. Comprueba la sesión, la conexión y la configuración del servidor." }
        }
        renderSession()
        loadOrders()
        if (client.signedIn) {
            OrderSync.schedule(this)
            refreshOrders()
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent); setIntent(intent)
        targetOrderId = intent.getStringExtra("orderId"); loadOrders()
        if (client.signedIn) refreshOrders()
    }
    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("orderId", targetOrderId); super.onSaveInstanceState(outState)
    }

    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
    private fun fullWidth() = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    private fun input(label: String, secret: Boolean): TextInputLayout {
        val layout = TextInputLayout(this).apply { hint = label }
        val field = TextInputEditText(layout.context).apply {
            inputType = if (secret) android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                else android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        layout.addView(field)
        return layout
    }
    private fun button(label: String, action: () -> Unit) = MaterialButton(this).apply { text = label; setOnClickListener { action() } }

    private fun renderSession() {
        loginFields.isVisible = !client.signedIn
        logout.isVisible = client.signedIn
        sync.isVisible = client.signedIn
        list.isVisible = true
        if (!client.signedIn) notice.text = "Autoriza este dispositivo con una invitación. Inicia sesión una vez como alternativa. Sin red no llegan pedidos nuevos."
    }

    private fun showEmptyState(message: String) {
        list.addView(TextView(this).apply {
            text = message
            textSize = 16f
            setPadding(0, 20.dp, 0, 20.dp)
        }, fullWidth())
    }

    private fun signIn() {
        val address = email.text?.toString().orEmpty()
        val pass = password.text?.toString().orEmpty()
        if (address.isBlank() || pass.isBlank()) { notice.text = "Escribe correo y contraseña."; return }
        login.isEnabled = false
        lifecycleScope.launch {
            try {
                client.login(address, pass)
                password.setText("")
                app.database.syncDao().clearOrders()
                app.database.syncDao().clearState()
                renderSession()
                com.bryan.donas.data.PushRegistration.register(this@OrdersActivity)
                OrderSync.schedule(this@OrdersActivity)
                refreshOrders()
            } catch (e: Exception) { notice.text = e.message ?: "No se pudo iniciar sesión." }
            finally { login.isEnabled = true }
        }
    }

    private fun loadOrders() = lifecycleScope.launch {
        val orders = app.database.syncDao().recentOrders(targetOrderId)
        val pending = app.database.syncDao().pendingCount()
        val rejected = app.database.syncDao().rejectedCount()
        val unbooked = orders.count { it.status == "COMPLETED" && it.settled && app.database.operationDao().eventByKey("order-${it.id}") == null }
        // Finish Room reads before repainting so overlapping refreshes cannot append duplicate cards.
        list.removeAllViews()
        notice.text = if (!com.bryan.donas.data.NetworkConnection.connected(this@OrdersActivity))
            "Sin conexión · $pending operaciones pendientes. Mostrando pedidos guardados; no llegan pedidos nuevos."
            else if (pending > 0) "Pendiente de sincronización · $pending operaciones locales; no son ventas confirmadas por el servidor."
            else if (client.signedIn) {
                val state = getSharedPreferences("sync_status", MODE_PRIVATE)
                if (state.contains("error")) "Error de sincronización: ${state.getString("error", "")}. Mostrando la copia guardada."
                else if (state.getLong("lastPull", 0) > 0) "Sincronizado · última consulta ${java.text.DateFormat.getTimeInstance().format(java.util.Date(state.getLong("lastPull", 0)))}"
                else "Última copia guardada. Actualiza para comprobar el servidor."
            }
            else "Autoriza el dispositivo. Inicia sesión una vez como alternativa."
        if (rejected > 0 || unbooked > 0) notice.text = "Requieren conciliación: $rejected ventas rechazadas por el servidor y $unbooked pedidos sin asiento local. No repitas la venta."
        if (orders.isEmpty()) showEmptyState(if (client.signedIn) "Todo al día. Todavía no hay pedidos." else "Inicia sesión una vez para recibir pedidos.")
        orders.sortedBy { if (it.id == targetOrderId) -1 else if (it.status in listOf("COMPLETED", "CANCELLED")) 1 else 0 }.forEach(::renderOrder)
    }

    private fun refreshOrders() = lifecycleScope.launch {
        if (refreshing) return@launch
        refreshing = true
        sync.isEnabled = false
        notice.text = "Consultando pedidos…"
        try {
            val rows = client.recentOrders()
            val selectedId = targetOrderId
            if (selectedId != null && (0 until rows.length()).none { rows.getJSONObject(it).getString("id") == selectedId }) {
                val selected = client.recentOrders(selectedId)
                if (selected.length() == 0) throw com.bryan.donas.data.BackendException(404,
                    "El pedido de esta notificación no está disponible. Actualiza o consulta su código.", "ORDER_NOT_FOUND")
                rows.put(selected.getJSONObject(0))
            }
            val dao = app.database.syncDao()
            val oldIds = dao.recentOrders().map { it.id }.toSet()
            val orders = (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                val id = row.getString("id")
                val items = row.optJSONArray("order_items") ?: JSONArray()
                val normalizedItems = JSONArray()
                for (itemIndex in 0 until items.length()) {
                    val item = items.getJSONObject(itemIndex)
                    normalizedItems.put(org.json.JSONObject()
                        .put("quantity", item.optInt("quantity"))
                        .put("variantName", item.optString("variant_name_snapshot"))
                        .put("productVariantId", item.optString("product_variant_id"))
                        .put("productName", item.optString("product_name_snapshot"))
                        .put("sku", item.optString("sku_snapshot"))
                        .put("unitPriceCents", item.optInt("unit_price_cents"))
                        .put("lineTotalCents", item.optInt("line_total_cents")))
                }
                RemoteOrderEntity(
                    id = id,
                    publicCode = row.getString("public_code"),
                    status = row.getString("status"),
                    paymentMethod = row.getString("payment_method"),
                    paymentStatus = row.getString("payment_status"),
                    deliveryLocation = row.optString("delivery_location"),
                    customerName = row.optString("customer_name_snapshot"),
                    customerPhone = row.optString("customer_phone_snapshot"),
                    totalCents = row.getLong("total_cents"),
                    createdAt = row.getString("created_at"),
                    updatedAt = row.getString("updated_at"),
                    itemsJson = normalizedItems.toString(),
                    settled = dao.order(id)?.settled == true ||
                        (row.getString("status") == "COMPLETED" && row.getString("payment_status") == "CONFIRMED")
                )
            }
            app.database.withTransaction {
                dao.upsertOrders(orders)
            }
            orders.filter { it.id !in oldIds && it.status == "PENDING" }
                .forEach { OrderNotifications.show(this@OrdersActivity, it) }
            loadOrders()
            notice.text = if (orders.isEmpty()) "No hay pedidos en el servidor." else "${orders.size} pedidos consultados."
            OrderSync.request(this@OrdersActivity)
        } catch (e: Exception) {
            if ((e as? com.bryan.donas.data.BackendException)?.code == "DEVICE_REVOKED") {
                app.database.syncDao().clearOrders(); app.database.syncDao().clearState(); renderSession(); loadOrders()
            }
            notice.text = "No se pudieron consultar los pedidos: ${e.message ?: "error de conexión"}"
        } finally {
            refreshing = false
            sync.isEnabled = true
        }
    }

    private fun renderOrder(order: RemoteOrderEntity) {
        val shell = MaterialCardView(this).apply { radius = 20.dp.toFloat(); cardElevation = 0f; if (order.id == targetOrderId) strokeWidth = 3.dp }
        val card = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(18.dp, 18.dp, 18.dp, 18.dp) }
        shell.addView(card)
        fun line(label: String, size: Float, bold: Boolean = false) {
            card.addView(TextView(this).apply {
                text = label; textSize = size; setPadding(0, 4.dp, 0, 4.dp)
                if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            }, fullWidth())
        }
        val statusName = when (order.status) {
            "PENDING" -> "Pendiente"; "ACCEPTED" -> "Aceptado"; "OUT_FOR_DELIVERY" -> "En camino"
            "COMPLETED" -> "Entregado"; "CANCELLED" -> "Cancelado"; else -> "Recibido"
        }
        line("$statusName · ${order.publicCode}", 12f, true)
        line(order.customerName, 21f, true)
        line(order.customerPhone, 13f)
        val flavors = JSONArray(order.itemsJson)
        val details = (0 until flavors.length()).joinToString(" · ") { index ->
            val item = flavors.getJSONObject(index)
            "${item.optInt("quantity")}× ${item.optString("variantName")}"
        }
        line(details, 15f)
        line("📍 ${order.deliveryLocation}", 14f)
        line(Money.format(order.totalCents), 24f, true)
        line(if (order.paymentStatus == "CONFIRMED") "Cobrado" else if (order.paymentMethod == "YAPPY") "Yappy al recibir" else "Efectivo al recibir", 13f)
        fun action(label: String, target: String) {
            val control = button(label) {
                if (target == "CANCELLED") MaterialAlertDialogBuilder(this)
                    .setTitle("¿Cancelar pedido?").setMessage("Las donas apartadas volverán a estar disponibles.")
                    .setNegativeButton("Volver", null).setPositiveButton("Cancelar pedido") { _, _ -> transition(order, target) }.show()
                else transition(order, target)
            }.apply { isEnabled = order.id !in pendingOrders }
            card.addView(control, fullWidth())
        }
        when (order.status) {
            "PENDING" -> { action("Aceptar", "ACCEPTED"); action("Cancelar", "CANCELLED") }
            "ACCEPTED" -> { action("En camino", "OUT_FOR_DELIVERY"); action("Cancelar", "CANCELLED") }
            "OUT_FOR_DELIVERY" -> {
                card.addView(button("Cobrado y entregado") { confirmCompletion(order) }.apply { isEnabled = order.id !in pendingOrders }, fullWidth())
            }
        }
        list.addView(shell, fullWidth().apply { topMargin = 12.dp })
    }

    private fun transition(order: RemoteOrderEntity, status: String) = lifecycleScope.launch {
        if (!pendingOrders.add(order.id)) return@launch
        try {
            loadOrders()
            client.transition(order.id, status)
            refreshOrders().join()
        } catch (e: Exception) { notice.text = e.message ?: "No se pudo actualizar el pedido." }
        finally { pendingOrders.remove(order.id); loadOrders() }
    }

    private fun confirmCompletion(order: RemoteOrderEntity) {
        if (confirmationOpen || order.id in pendingOrders) return
        confirmationOpen = true
        val methods = if (order.paymentStatus == "CONFIRMED") arrayOf(order.paymentMethod) else arrayOf("CASH", "YAPPY")
        var selected = methods.indexOf(order.paymentMethod).coerceAtLeast(0)
        MaterialAlertDialogBuilder(this).setTitle("${Money.format(order.totalCents)} · ¿Ya cobraste y entregaste?")
            .setSingleChoiceItems(methods.map { if (it == "YAPPY") "Yappy" else "Efectivo" }.toTypedArray(), selected) { _, which -> selected = which }
            .setNegativeButton("Volver", null)
            .setPositiveButton("Sí, finalizar") { _, _ ->
                lifecycleScope.launch {
                    if (!pendingOrders.add(order.id)) return@launch
                    try {
                        loadOrders()
                        client.completeDelivery(order.id, methods[selected])
                        refreshOrders().join()
                        notice.text = "Entrega finalizada. Puntos y racha actualizados según las reglas del cliente."
                    } catch (e: Exception) { notice.text = e.message ?: "No se pudo finalizar. Actualiza para comprobar el estado." }
                    finally { pendingOrders.remove(order.id); loadOrders() }
                }
            }.setOnDismissListener { confirmationOpen = false }.show()
    }
}
