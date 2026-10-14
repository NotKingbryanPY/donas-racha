package com.bryan.donas.daily

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import android.text.InputType
import android.text.TextWatcher
import android.text.Editable
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.edit
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.bryan.donas.DonasApp
import com.bryan.donas.data.NetworkConnection
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import com.bryan.donas.orders.StaffInboxSync
import com.bryan.donas.orders.StaffNotificationRegistration
import com.bryan.donas.orders.StaffOrderNotifications
import com.bryan.donas.data.OrderNotifications
import com.bryan.donas.data.PushHealth
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.UUID

/** New daily UI. The old ledger and outbox remain preserved, outside this navigation. */
class DailyActivity : AppCompatActivity() {
    private val app get() = application as DonasApp
    private val prefs by lazy { getSharedPreferences("daily_ui", Context.MODE_PRIVATE) }
    private val bg = Color.rgb(16, 13, 23)
    private val cardColor = Color.rgb(29, 23, 40)
    private val accent = Color.rgb(197, 163, 238)
    private val white = Color.rgb(250, 246, 255)
    private val muted = Color.rgb(192, 182, 205)
    private lateinit var root: LinearLayout
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private var page = "Pedidos"
    private var inbox: JSONObject? = null
    private var inboxUpdatedAt = 0L
    private var orderTargetId: String? = null
    private var orderTargetOwner: String? = null
    private var orderDetail: JSONObject? = null
    private var detailRequested: String? = null
    private var orderFeedback = ""
    private var notificationCheckId: UUID? = null
    private var notificationFeedback = ""
    private var showRecentOrders = false
    private var visibleOrderCount = 40
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        startNotificationCheck()
    }
    private val notificationListener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        runOnUiThread { if (page == "Pedidos") render() }
    }
    private var snapshot: JSONObject? = null
    private var rows: List<DailyOperation> = emptyList()
    private var draft = JSONObject()
    private var busy = false
    private val owners = MutableStateFlow<String?>(null)
    private var owner: String? = null
    private var legacyPending = 0
    private var historyOlder = JSONArray()
    private val navButtons = linkedMapOf<String, MaterialButton>()

    override fun onCreate(savedInstanceState: Bundle?) {
        delegate.localNightMode = AppCompatDelegate.MODE_NIGHT_YES
        super.onCreate(savedInstanceState)
        page = savedInstanceState?.getString("page") ?: "Pedidos"
        draft = savedInstanceState?.getString("draft")?.let { JSONObject(it) } ?: JSONObject()
        owner = app.backendClient.dailyOwner
        orderTargetId = savedInstanceState?.getString("orderId") ?: intent.getStringExtra("orderId")
        orderTargetOwner = savedInstanceState?.getString("notificationOwner") ?: intent.getStringExtra("notificationOwner")
        if (intent.getBooleanExtra("openOrders", false)) page = "Pedidos"
        owners.value = owner
        createLayout()
        observe()
        observeOrders()
        if (owner != null) DailySync.schedule(this)
        if (owner != null && savedInstanceState?.getString("notificationCheckOwner") == owner) {
            savedInstanceState?.getString("notificationCheckId")?.let { value ->
                runCatching { UUID.fromString(value) }.getOrNull()?.let { trackNotificationCheck(owner!!, it) }
            }
        }
    }
    override fun onStart() {
        super.onStart()
        getSharedPreferences("push_health", MODE_PRIVATE).registerOnSharedPreferenceChangeListener(notificationListener)
        getSharedPreferences("staff_inbox_status", MODE_PRIVATE).registerOnSharedPreferenceChangeListener(notificationListener)
    }
    override fun onStop() {
        getSharedPreferences("push_health", MODE_PRIVATE).unregisterOnSharedPreferenceChangeListener(notificationListener)
        getSharedPreferences("staff_inbox_status", MODE_PRIVATE).unregisterOnSharedPreferenceChangeListener(notificationListener)
        super.onStop()
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent); setIntent(intent)
        orderTargetId = intent.getStringExtra("orderId"); orderTargetOwner = intent.getStringExtra("notificationOwner")
        orderDetail = null; detailRequested = null; page = "Pedidos"; render()
        if (owner != null) StaffInboxSync.request(this)
    }
    override fun onResume() {
        super.onResume()
        if (owner != app.backendClient.dailyOwner) {
            owner = app.backendClient.dailyOwner
            notificationCheckId = null; notificationFeedback = ""
            snapshot = null; rows = emptyList(); inbox = null; orderDetail = null; detailRequested = null; page = "Pedidos"; owners.value = owner; render()
        }
        if (owner != null) {
            DailySync.request(this); StaffInboxSync.request(this); StaffNotificationRegistration.ensure(this)
        }
    }
    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("page", page); outState.putString("draft", draft.toString())
        outState.putString("orderId", orderTargetId); outState.putString("notificationOwner", orderTargetOwner)
        outState.putString("notificationCheckId", notificationCheckId?.toString())
        outState.putString("notificationCheckOwner", owner)
        super.onSaveInstanceState(outState)
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun shape(color: Int, radius: Int = 22) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat(); setStroke(dp(1), Color.rgb(52, 43, 66))
    }
    private fun label(text: String, size: Float = 14f, color: Int = white, bold: Boolean = false) = TextView(this).apply {
        this.text = text; textSize = size; setTextColor(color); setPadding(0, dp(5), 0, dp(5))
        if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    private fun button(text: String, primary: Boolean = false, action: () -> Unit) = MaterialButton(this).apply {
        this.text = text; isAllCaps = false; minHeight = dp(52); cornerRadius = dp(14)
        textSize = 14f; maxLines = 1; setPadding(dp(8), dp(8), dp(8), dp(8))
        backgroundTintList = ColorStateList.valueOf(if (primary) accent else cardColor)
        setTextColor(if (primary) bg else white); setOnClickListener { if (!busy) action() }
    }
    private fun card(parent: LinearLayout = content, action: LinearLayout.() -> Unit): LinearLayout = column().apply {
        background = shape(cardColor); setPadding(dp(18), dp(14), dp(18), dp(14))
        parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) }); action()
    }
    private fun createLayout() {
        root = column().apply { setBackgroundColor(bg) }
        setContentView(root)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = false; isAppearanceLightNavigationBars = false
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        val header = column().apply { setPadding(dp(20), dp(8), dp(20), dp(6)) }
        header.addView(label("Donas Control", 25f, bold = true))
        status = label("Conecta tu cuenta para sincronizar", 12f, muted)
        header.addView(status); root.addView(header)
        val scroll = ScrollView(this).apply { isFillViewport = true }
        content = column().apply { setPadding(dp(18), dp(8), dp(18), dp(24)) }
        scroll.addView(content); root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val nav = LinearLayout(this).apply { gravity = Gravity.CENTER; setPadding(dp(10), 0, dp(10), dp(4)); background = shape(cardColor) }
        for (name in listOf("Pedidos", "Hoy", "Inventario", "Historial")) {
            val item = button(if (name == "Inventario") "Stock" else name) { page = name; render() }.apply { textSize = 12f }
            navButtons[name] = item
            nav.addView(item, LinearLayout.LayoutParams(0, -2, 1f))
        }
        root.addView(nav); render()
    }
    private fun observe() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                owners.collectLatest { current ->
                    if (current == null) return@collectLatest
                    legacyPending = app.daily.dao.legacyPending()
                combine(app.daily.dao.observeCache(current), app.daily.dao.observe(current)) { cache, items -> Pair(cache, items) }
                    .collect { (cache, items) ->
                        if (owner != current) return@collect
                        val updated = cache?.json?.let { JSONObject(it) }
                        if (updated != null && snapshot != null && DailyRules.watermark(updated) != DailyRules.watermark(snapshot!!)) historyOlder = JSONArray()
                        snapshot = updated; rows = items
                        updateStatus()
                        if (page in listOf("Hoy", "Inventario", "Historial")) render()
                    }
                }
            }
        }
    }
    private fun updateStatus() {
        if (page == "Pedidos") {
            val error = getSharedPreferences("staff_inbox_status", MODE_PRIVATE).getString("error:$owner", null)
            status.text = when {
                owner == null -> "Conecta tu cuenta del Dashboard"
                !NetworkConnection.connected(this) -> "Sin conexión · copia de pedidos guardada"
                error != null -> error
                inbox == null -> "Consultando pedidos…"
                else -> "Pedidos consultados ${java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(java.util.Date(inboxUpdatedAt))}"
            }
            return
        }
        val pending = rows.count { it.state == "PENDING" }
        val conflicts = rows.count { it.state == "CONFLICT" }
        val error = getSharedPreferences("daily_sync", Context.MODE_PRIVATE).getString("error", null)
        status.text = when {
            owner == null -> "Conecta tu cuenta del Dashboard"
            conflicts > 0 -> "$conflicts registros requieren revisión"
            !NetworkConnection.connected(this) -> "Sin conexión · $pending pendientes"
            pending > 0 -> "Pendiente de sincronización · $pending registros"
            snapshot == null -> error ?: "Actualizando datos del servidor…"
            error != null -> "Error de sincronización · actualiza para reintentar"
            else -> "Sincronizado · datos confirmados por el servidor"
        }
    }
    private fun cash(cents: Long) = String.format(Locale.US, "$%.2f", cents / 100.0)
    private fun render() {
        if (!::content.isInitialized) return
        content.removeAllViews(); updateStatus()
        for ((name, item) in navButtons) {
            val selected = name == page || (name == "Hoy" && page !in listOf("Pedidos", "Inventario", "Historial"))
            item.backgroundTintList = ColorStateList.valueOf(if (selected) accent else cardColor)
            item.setTextColor(if (selected) bg else white)
        }
        if (owner == null) { login(); return }
        if (page == "Pedidos") { orders(); return }
        if (page in listOf("Hoy", "Inventario", "Historial")) content.addView(label(page, 28f, bold = true))
        if (snapshot == null) {
            content.addView(label("Conecta a Internet y pulsa Actualizar. El registro diario necesita su activación SQL en Supabase y una primera consulta autorizada.", color = muted))
            content.addView(button("Actualizar", true) { refresh() })
            content.addView(button("Cambiar cuenta") { logout() }); return
        }
        when (page) {
            "Hoy" -> today()
            "Inventario" -> inventory()
            "Historial" -> history()
            else -> form()
        }
    }
    private fun login() {
        content.addView(label("Tus pedidos, a tiempo", 27f, bold = true))
        content.addView(label("Recibe avisos, gestiona pedidos y registra la operación diaria. Entra una vez con la misma cuenta del Dashboard de dracha.store.", color = muted))
        val email = field(content, "Correo de administrador o vendedor", "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        val password = field(content, "Contraseña", "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        val feedback = label("La sesión se conserva cifrada. La contraseña no se guarda.", color = muted); content.addView(feedback)
        val login = button("Conectar cuenta", true) {}
        login.setOnClickListener {
            if (busy) return@setOnClickListener
            busy = true; login.isEnabled = false; feedback.text = "Conectando…"
            lifecycleScope.launch {
                try {
                    app.backendClient.login(email.text.toString(), password.text.toString())
                    owner = app.backendClient.dailyOwner; snapshot = null; rows = emptyList(); inbox = null; page = "Pedidos"
                    owners.value = owner; DailySync.schedule(this@DailyActivity); StaffInboxSync.schedule(this@DailyActivity)
                    PushHealth.clear(this@DailyActivity); StaffNotificationRegistration.request(this@DailyActivity)
                    render(); refresh()
                } catch (e: Exception) { feedback.text = e.message ?: "No se pudo conectar. Revisa la cuenta y la conexión." }
                finally { busy = false; login.isEnabled = true }
            }
        }
        content.addView(login)
    }
    private fun observeOrders() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                owners.collectLatest { current ->
                    if (current == null) return@collectLatest
                    kotlinx.coroutines.coroutineScope {
                        launch {
                            app.database.staffOrderDao().observe(current).collect { cache ->
                                if (owner == current) {
                                    inbox = cache?.json?.let { JSONObject(it) }; inboxUpdatedAt = cache?.receivedAt ?: 0L
                                    if (cache != null && orderFeedback == "Solicitando actualización…") orderFeedback = ""
                                    if (page == "Pedidos") {
                                        if (!busy) detailRequested = null
                                        render()
                                    }
                                }
                            }
                        }
                        while (true) {
                            kotlinx.coroutines.delay(60_000)
                            if (owner == current && page == "Pedidos" && NetworkConnection.connected(this@DailyActivity)) StaffInboxSync.request(this@DailyActivity)
                        }
                    }
                }
            }
        }
    }
    private fun orderStatus(value: String) = when (value) {
        "PENDING" -> "Nuevo"; "ACCEPTED" -> "Aceptado"; "OUT_FOR_DELIVERY" -> "En camino"
        "COMPLETED" -> "Cobrado y entregado"; "CANCELLED" -> "Cancelado"; else -> "Actualizar estado"
    }
    private fun startNotificationCheck() {
        val current = owner ?: return
        if (notificationCheckId != null) return
        val id = StaffNotificationRegistration.request(this)
        if (id == null) { notificationFeedback = ""; render(); return }
        trackNotificationCheck(current, id)
    }
    private fun trackNotificationCheck(current: String, id: UUID) {
        notificationCheckId = id
        notificationFeedback = "Comprobación pendiente de Android."
        val work = WorkManager.getInstance(this).getWorkInfoByIdLiveData(id)
        work.observe(this) { info ->
            if (owner != current || notificationCheckId != id) {
                work.removeObservers(this)
                return@observe
            }
            if (info == null) return@observe
            notificationFeedback = when (info.state) {
                WorkInfo.State.RUNNING -> "Comprobando teléfono y emisor…"
                WorkInfo.State.BLOCKED -> "Esperando que termine la comprobación anterior."
                WorkInfo.State.ENQUEUED -> when {
                    !NetworkConnection.connected(this) -> "Sin conexión. La comprobación se hará al recuperar Internet."
                    info.runAttemptCount > 0 -> "Reintento pendiente. Revisa el diagnóstico de avisos."
                    else -> "Comprobación pendiente de Android."
                }
                WorkInfo.State.SUCCEEDED -> "Comprobación finalizada. Revisa el estado de avisos."
                WorkInfo.State.FAILED -> "No se completó la comprobación. Revisa el diagnóstico y vuelve a intentarlo."
                WorkInfo.State.CANCELLED -> "Comprobación cancelada. Puedes volver a intentarlo."
            }
            if (info.state.isFinished) {
                notificationCheckId = null
                work.removeObservers(this)
            }
            if (page == "Pedidos") render()
        }
        if (page == "Pedidos") render()
    }
    private fun orders() {
        val current = owner ?: return
        content.addView(label("Pedidos", 28f, bold = true))
        card {
            addView(label("Avisos fuera de la app", 18f, bold = true))
            addView(label(PushHealth.summary(this@DailyActivity, true), 13f, muted))
            if (notificationFeedback.isNotBlank()) addView(label(notificationFeedback, 13f, muted))
            addView(button("Activar / comprobar avisos", true) {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                else if (!OrderNotifications.enabled(this@DailyActivity)) {
                    val settings = if (Build.VERSION.SDK_INT >= 26) Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
                    else Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "package:$packageName".toUri())
                    startActivity(settings)
                }
                else startNotificationCheck()
            }.apply { isEnabled = notificationCheckId == null })
            addView(button("Enviar prueba a este teléfono") {
                lifecycleScope.launch {
                    try {
                        val result = app.backendClient.staffNotificationTest(current)
                        if (owner == current) message(if (result.optBoolean("accepted"))
                            "FCM aceptó la prueba. Comprueba que aparezca el aviso del sistema; la aceptación no confirma que Android lo haya mostrado."
                            else "No se pudo enviar: ${result.optString("status")}. Activa/comprueba los avisos para ver el diagnóstico.")
                    } catch (e: Exception) { if (owner == current) message(e.message ?: "No se pudo enviar la prueba.") }
                }
            })
            if (app.backendClient.role == "ADMIN") addView(button("Activar recuperación del servidor") {
                lifecycleScope.launch {
                    try {
                        app.backendClient.staffNotificationConfigureRetry(current)
                        StaffNotificationRegistration.request(this@DailyActivity)
                        if (owner == current) message("La recuperación de avisos quedó programada en el servidor.")
                    } catch (e: Exception) { if (owner == current) message(e.message ?: "No se pudo configurar la recuperación.") }
                }
            })
        }
        content.addView(button("Actualizar pedidos") { detailRequested = null; StaffInboxSync.request(this); orderFeedback = "Solicitando actualización…"; render() })
        if (orderFeedback.isNotBlank()) content.addView(label(orderFeedback, 13f, muted))
        val active = inbox?.optJSONArray("active") ?: JSONArray()
        val recent = inbox?.optJSONArray("recent") ?: JSONArray()
        if (orderTargetOwner != null && orderTargetOwner != current) {
            orderTargetId = null; orderTargetOwner = null; orderDetail = null
            content.addView(label("El aviso pertenece a otra cuenta. Consulta los pedidos con tu acceso actual.", color = muted))
        }
        val target = orderTargetId?.takeIf { StaffOrderNotifications.validId(it) }
        if (target != null) {
            val cached = (0 until active.length()).map { active.getJSONObject(it) }.plus((0 until recent.length()).map { recent.getJSONObject(it) })
                .firstOrNull { it.optString("id") == target }
            val fetched = orderDetail?.takeIf { it.optString("id") == target }
            val detail = if (cached != null && (fetched == null || cached.optString("updated_at") >= fetched.optString("updated_at"))) cached else fetched
            if (detail != null) orderDetails(detail, current)
            else content.addView(label("Consulta los detalles de este pedido con Internet.", color = muted))
            content.addView(button("← Todos los pedidos") { orderTargetId = null; orderDetail = null; detailRequested = null; render() })
            if (detailRequested != target && NetworkConnection.connected(this)) {
                detailRequested = target
                lifecycleScope.launch {
                    try {
                        val data = app.staffInbox.detail(current, target)
                        if (owner == current && orderTargetId == target) { orderDetail = data; orderFeedback = ""; render() }
                    } catch (e: Exception) { if (owner == current) { orderFeedback = e.message ?: "No se pudo consultar el pedido."; render() } }
                }
            }
        } else {
            content.addView(button(if (showRecentOrders) "Ver activos" else "Ver recientes") { showRecentOrders = !showRecentOrders; visibleOrderCount = 40; render() })
            val source = if (showRecentOrders) recent else active
            if (inbox == null) content.addView(label("Los pedidos guardados aparecerán después de la primera consulta autorizada.", color = muted))
            else if (source.length() == 0) content.addView(label(if (showRecentOrders) "No hay pedidos recientes en esta consulta." else "No hay pedidos activos en la última consulta.", color = muted))
            for (i in 0 until minOf(source.length(), visibleOrderCount)) {
                val order = source.getJSONObject(i)
                card {
                    addView(label(order.optString("public_code"), 20f, accent, true))
                    addView(label("${orderStatus(order.optString("status"))} · ${cash(order.optLong("total_cents"))}", bold = true))
                    addView(label(order.optString("customer_name_snapshot"), 14f))
                    addView(label(order.optString("delivery_location"), 13f, muted))
                    addView(button("Consultar pedido") {
                        orderTargetId = order.getString("id"); orderTargetOwner = current
                        orderDetail = null; detailRequested = null; orderFeedback = ""; render()
                    })
                }
            }
            if (source.length() > visibleOrderCount) content.addView(button("Mostrar más pedidos") { visibleOrderCount += 40; render() })
        }
        content.addView(label("Sin Internet no llegan pedidos nuevos. Los avisos dependen de Android, FCM y la conexión.", 12f, muted))
        content.addView(button("Abrir Dashboard web") { openWeb() })
        content.addView(button("Cerrar sesión") { logout() })
    }
    private fun orderDetails(order: JSONObject, current: String) {
        card {
            addView(label("Pedido ${order.optString("public_code")}", 24f, accent, true))
            addView(label(orderStatus(order.optString("status")), 18f, bold = true))
            addView(label(order.optString("customer_name_snapshot")))
            addView(label(order.optString("customer_phone_snapshot"), color = muted))
            addView(label(order.optString("delivery_location")))
            val items = order.optJSONArray("order_items") ?: JSONArray()
            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                addView(label("${item.optLong("quantity")} × ${item.optString("variant_name_snapshot")} · ${cash(item.optLong("line_total_cents"))}"))
            }
            addView(label("Total ${cash(order.optLong("total_cents"))}", 26f, accent, true))
            addView(label("Pago: ${if (order.optString("payment_method") == "YAPPY") "Yappy" else "Efectivo"} · ${if (order.optString("payment_status") == "CONFIRMED") "Confirmado" else "Pendiente"}", color = muted))
            val notes = order.optString("customer_notes").takeIf { it.isNotBlank() && it != "null" }
            if (notes != null) addView(label("Nota: $notes"))
            if (busy) addView(label("Confirmando en el servidor…", color = accent))
            when (order.optString("status")) {
                "PENDING" -> addView(button("Aceptar pedido", true) { orderAction(order, current, "ACCEPTED") })
                "ACCEPTED" -> addView(button("Marcar en camino", true) { orderAction(order, current, "OUT_FOR_DELIVERY") })
                "OUT_FOR_DELIVERY" -> addView(button("Cobrado y entregado", true) {
                    if (order.optString("payment_status") == "CONFIRMED") {
                        MaterialAlertDialogBuilder(this@DailyActivity).setTitle("Confirmar entrega")
                            .setMessage("El pago ya está confirmado. Esta acción confirma la entrega; no vuelvas a cobrar.")
                            .setPositiveButton("Entregado") { _, _ -> orderAction(order, current, "COMPLETED", order.getString("payment_method")) }
                            .setNegativeButton("Volver", null).show()
                    } else MaterialAlertDialogBuilder(this@DailyActivity).setTitle("Confirma el cobro real")
                        .setItems(arrayOf("Recibí ${cash(order.optLong("total_cents"))} en efectivo", "Recibí ${cash(order.optLong("total_cents"))} por Yappy")) { _, which ->
                            orderAction(order, current, "COMPLETED", if (which == 0) "CASH" else "YAPPY")
                        }.setNegativeButton("Volver", null).show()
                })
            }
            if (order.optString("status") in listOf("PENDING", "ACCEPTED", "OUT_FOR_DELIVERY")) addView(button("Cancelar pedido") {
                MaterialAlertDialogBuilder(this@DailyActivity).setTitle("Cancelar ${order.optString("public_code")}")
                    .setMessage(if (order.optString("payment_status") == "CONFIRMED") "El pago está confirmado. Cancelar no devuelve el dinero automáticamente. Coordina la devolución antes de continuar." else "El pedido se cancelará en el servidor y liberará su reserva de inventario.")
                    .setNegativeButton("Conservar pedido", null).setPositiveButton("Cancelar pedido") { _, _ -> orderAction(order, current, "CANCELLED") }.show()
            })
        }
    }
    private fun orderAction(order: JSONObject, current: String, next: String, paymentMethod: String? = null) {
        if (busy) return
        if (!NetworkConnection.connected(this)) { message("Conecta a Internet para confirmar el cambio de estado o el cobro."); return }
        busy = true; render()
        lifecycleScope.launch {
            try {
                val response = app.backendClient.staffOrderAction(current, order.getString("id"), next, paymentMethod).getJSONObject("order")
                require(response.getString("id") == order.getString("id")) { "Confirmación incompleta; actualiza el pedido antes de reintentar." }
                if (owner == current) {
                    val updated = JSONObject(order.toString())
                    for (key in response.keys()) updated.put(key, response.get(key))
                    orderDetail = updated; orderFeedback = "${orderStatus(response.getString("status"))} · confirmado por el servidor"
                    StaffInboxSync.request(this@DailyActivity); DailySync.request(this@DailyActivity)
                }
            } catch (e: Exception) { if (owner == current) orderFeedback = e.message ?: "No se pudo confirmar. Actualiza para recuperar el estado del servidor." }
            finally { busy = false; if (owner == current) render() }
        }
    }
    private fun today() {
        val state = snapshot!!; val summary = state.getJSONObject("summary")
        content.addView(label("Jornada ${state.getJSONObject("session").getString("business_date")}", color = muted))
        card {
            background = shape(Color.rgb(48, 33, 63))
            addView(label("Ingresos confirmados", color = muted))
            addView(label(cash(summary.getLong("revenueCents")), 38f, accent, true))
            addView(label("Efectivo ${cash(summary.getLong("cashCents"))}  ·  Yappy ${cash(summary.getLong("yappyCents"))}", 13f))
        }
        val quick = LinearLayout(this)
        for ((title, kind) in listOf("Compra" to "PURCHASE", "Venta" to "SALE", "Consumo" to "CONSUMPTION"))
            quick.addView(button(title, kind == "PURCHASE") { startForm(kind) }, LinearLayout.LayoutParams(0, -2, 1f))
        content.addView(quick)
        card {
            addView(label("Resumen de la jornada", 18f, bold = true))
            addView(label("Inversión en compras     ${cash(summary.getLong("investmentCents"))}"))
            addView(label("Costo de lo vendido     ${cash(summary.getLong("costOfSalesCents"))}"))
            addView(label("Utilidad comercial     ${if (summary.isNull("profitCents")) "Costo pendiente" else cash(summary.getLong("profitCents"))}", 20f, accent, true))
            addView(label("Costo del consumo     ${cash(summary.getLong("consumptionCostCents"))}"))
            val result = if (summary.getLong("unknownCostUnits") == 0L && !summary.isNull("profitCents"))
                cash(summary.getLong("profitCents") - summary.getLong("consumptionCostCents") - summary.getLong("correctionCostCents")) else "Costo pendiente"
            addView(label("Resultado después de consumo/correcciones: $result", 13f))
            addView(label("Flujo de caja: ${cash(summary.getLong("netCashCents"))} (ingresos − compras)", 12f, muted))
            addView(label("${summary.getLong("purchasedUnits")} compradas · ${summary.getLong("soldUnits")} vendidas · ${summary.getLong("consumedUnits")} consumidas", 13f))
            if (summary.getLong("unknownCostUnits") > 0) addView(label("Hay ${summary.getLong("unknownCostUnits")} unidades sin costo histórico. No se calcula una ganancia ficticia.", color = muted))
            addView(label("Las existencias restantes no se consideran pérdida. Los pendientes locales no forman parte de estas cifras.", 12f, muted))
        }
        if (rows.any { it.state in listOf("PENDING", "CONFLICT") }) card {
            addView(label("Registros en este teléfono", 18f, bold = true))
            addView(label("${rows.count { it.state == "PENDING" }} pendientes · ${rows.count { it.state == "CONFLICT" }} con conflicto", color = muted))
            addView(button("Revisar pendientes") { page = "Historial"; render() })
        }
        if (legacyPending > 0) card {
            addView(label("Datos de la versión anterior", 18f, bold = true))
            addView(label("Se conservan $legacyPending registros antiguos sin confirmar. No se reenviarán automáticamente: necesitan conciliación para evitar duplicar stock.", color = muted))
        }
        content.addView(button("Actualizar y sincronizar") { refresh() })
        content.addView(button("Cerrar jornada") { closeDay() })
        content.addView(button("Abrir Dashboard y pedidos web") { openWeb() })
        content.addView(button("Cerrar sesión") { logout() })
    }
    private fun inventory() {
        val state = snapshot!!; val list = state.getJSONObject("inventory").getJSONArray("flavors")
        val projected = DailyRules.projected(state, rows)
        for (i in 0 until list.length()) {
            val item = list.getJSONObject(i); val id = item.getString("variant_id")
            val physical = item.getLong("opening_quantity") + item.getLong("purchased_quantity") - item.getLong("sold_quantity")
            card {
                addView(label(item.getString("name"), 19f, bold = true))
                addView(label("$physical unidades físicas", 24f, accent, true))
                addView(label("${item.getLong("reserved_quantity")} reservadas · ${item.getLong("available_quantity")} libres confirmadas", 13f, muted))
                if (projected[id] != item.getLong("available_quantity")) addView(label("${projected[id]} libres estimadas tras pendientes locales", 13f))
                if (!item.getBoolean("counted")) addView(label("Requiere conciliación de conteo/reservas. No registra existencias ficticias.", color = muted))
                if (app.backendClient.role == "ADMIN") addView(button("Corregir cantidad") { startForm("CORRECTION", id) })
            }
        }
        content.addView(button("Actualizar inventario", true) { refresh() })
        content.addView(label("La oferta comercial se gestiona en el catálogo del Dashboard; desactivar un sabor no cambia sus unidades físicas.", color = muted))
    }
    private fun title(kind: String) = when (kind) {
        "PURCHASE" -> "Compra"; "SALE" -> "Venta"; "CONSUMPTION" -> "Consumo"; "CORRECTION" -> "Corrección"; "WEB_SALE" -> "Pedido web entregado"; "CLOSE" -> "Cierre de jornada"; else -> kind
    }
    private fun history() {
        for (row in rows.filter { it.state != "ACKED" }.asReversed().take(50)) card {
            addView(label("${title(row.kind)} · ${when(row.state) { "PENDING" -> "Pendiente"; "CONFLICT" -> "Revisar"; else -> "Descartado" }}", 18f, bold = true))
            addView(label(row.error?.substringAfter(": ") ?: "Guardado en este teléfono. Esperando confirmación del servidor.", 13f, muted))
            addView(button("Ver registro") { showDetails(JSONObject(row.payload)) })
            if (row.state == "CONFLICT") {
                val mustReview = row.error?.substringBefore(':') in listOf("SESSION_CLOSED", "INVENTORY_CONFLICT", "DAILY_SUMMARY_CONFLICT", "INVALID_DAILY_OPERATION")
                if (mustReview) addView(label("Actualiza y revisa. Descarta este rechazo explícito y registra de nuevo con la jornada o revisión vigente; repetirlo sin cambios no lo resuelve.", color = muted))
                else addView(button("Reintentar el mismo registro") { lifecycleScope.launch { app.daily.dao.retry(row.id); DailySync.request(this@DailyActivity) } })
                addView(button("Descartar registro rechazado") { MaterialAlertDialogBuilder(this@DailyActivity)
                    .setTitle("Descartar el pendiente rechazado").setMessage("El servidor lo rechazó. Se conservará en el historial local como descartado. No se borra una venta confirmada.")
                    .setNegativeButton("Conservar", null).setPositiveButton("Descartar") { _, _ -> lifecycleScope.launch { app.daily.dao.discard(row.id); DailySync.request(this@DailyActivity) } }.show() })
            }
        }
        content.addView(label("Historial confirmado", 21f, bold = true))
        val operations = JSONArray(snapshot!!.getJSONArray("operations").toString())
        for (i in 0 until historyOlder.length()) operations.put(historyOlder.getJSONObject(i))
        for (i in 0 until operations.length()) {
            val item = operations.getJSONObject(i)
            card {
                addView(label(title(item.getString("kind")), 18f, bold = true))
                val amount = if (item.getString("kind") == "PURCHASE") item.getLong("investment_cents") else item.getLong("revenue_cents")
                addView(label("${cash(amount)} · ${item.getString("occurred_at").take(16).replace('T', ' ')} UTC", color = muted))
                addView(button("Ver detalles") { showDetails(item) })
            }
        }
        if (operations.length() > 0) content.addView(button("Cargar registros anteriores") {
            lifecycleScope.launch {
                try {
                    val last = operations.getJSONObject(operations.length() - 1).getLong("server_sequence")
                    val older = app.daily.refresh(owner!!, last).getJSONArray("operations")
                    for (i in 0 until older.length()) historyOlder.put(older.getJSONObject(i))
                    if (older.length() == 0) message("Ya se mostraron todos los registros.") else render()
                } catch (e: Exception) { message(e.message ?: "No se pudo consultar el historial.") }
            }
        })
        content.addView(label("Jornadas cerradas", 21f, bold = true))
        val sessions = snapshot!!.getJSONArray("sessions")
        for (i in 0 until sessions.length()) {
            val session = sessions.getJSONObject(i)
            if (session.isNull("closed_at")) continue
            card { addView(label(session.getString("business_date"), 18f, bold = true)); addView(button("Ver cierre") { showDetails(session.getJSONObject("closing_summary")) }) }
        }
    }
    private fun showDetails(json: JSONObject) {
        val text = when {
            json.has("revenueCents") -> "Ingresos: ${cash(json.getLong("revenueCents"))}\nCompras: ${cash(json.getLong("investmentCents"))}\nCosto vendido: ${cash(json.getLong("costOfSalesCents"))}\nVendidas: ${json.getLong("soldUnits")}\nConsumidas: ${json.getLong("consumedUnits")}\nEfectivo: ${cash(json.getLong("cashCents"))}\nYappy: ${cash(json.getLong("yappyCents"))}\nUtilidad: ${if (json.isNull("profitCents")) "Costo pendiente" else cash(json.getLong("profitCents"))}"
            else -> {
                val payload = json.optJSONObject("payload") ?: json
                val items = json.optJSONArray("items") ?: payload.optJSONArray("items") ?: JSONArray()
                val flavors = snapshot!!.getJSONArray("flavors")
                buildString {
                    if (payload.has("boxes")) append("${payload.getInt("boxes")} cajas\nMix por caja guardado en esta compra.\n")
                    if (payload.has("note")) append(payload.getString("note") + "\n")
                    for (i in 0 until items.length()) {
                        val item = items.getJSONObject(i)
                        val id = item.optString("variantId", item.optString("variant_id"))
                        val name = item.optString("name_snapshot").ifBlank { (0 until flavors.length()).map { flavors.getJSONObject(it) }.find { it.getString("id") == id }?.getString("name") ?: id }
                        append("$name: ${item.getLong("quantity")}")
                        if (item.has("per_box_quantity") && !item.isNull("per_box_quantity")) append(" (${item.getInt("per_box_quantity")} por caja)")
                        append('\n')
                    }
                    if (json.has("cash_cents")) append("Efectivo ${cash(json.getLong("cash_cents"))} · Yappy ${cash(json.getLong("yappy_cents"))}\n")
                }
            }
        }
        MaterialAlertDialogBuilder(this).setTitle("Detalles del registro").setMessage(text).setPositiveButton("Listo", null).show()
    }
    private fun startForm(kind: String, selected: String? = null) {
        val restored = prefs.getString("draft:$owner:$kind", null)
        draft = restored?.let { JSONObject(it) } ?: JSONObject().put("operationId", app.daily.id())
        if (selected != null) draft.put("selected", selected)
        page = kind; render()
    }
    private fun persistDraft() { prefs.edit { putString("draft:$owner:$page", draft.toString()) } }
    private fun field(parent: LinearLayout, name: String, value: String, type: Int = InputType.TYPE_CLASS_NUMBER,
                      changed: ((String) -> Unit)? = null): TextInputEditText {
        val layout = TextInputLayout(this).apply { hint = name; boxBackgroundMode = TextInputLayout.BOX_BACKGROUND_OUTLINE }
        val input = TextInputEditText(layout.context).apply {
            inputType = type; setText(value); setTextColor(white); minHeight = dp(54); isSingleLine = true
        }
        layout.addView(input); parent.addView(layout, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        if (changed != null) input.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { changed(s.toString()) }
            override fun afterTextChanged(s: Editable?) {}
        })
        return input
    }
    private fun draftField(parent: LinearLayout, name: String, key: String, initial: String = "0", signed: Boolean = false,
                           text: Boolean = false): TextInputEditText {
        if (!draft.has(key)) draft.put(key, initial)
        return field(parent, name, draft.getString(key), if (text) InputType.TYPE_CLASS_TEXT else
            InputType.TYPE_CLASS_NUMBER or (if (signed) InputType.TYPE_NUMBER_FLAG_SIGNED else if (key == "boxes" || key.startsWith("qty:")) 0 else InputType.TYPE_NUMBER_FLAG_DECIMAL)) {
            draft.put(key, it); persistDraft()
        }
    }
    private fun form() {
        val state = snapshot!!; val kind = page
        content.addView(button("← Volver a Hoy") { page = "Hoy"; render() })
        content.addView(label("Registrar ${title(kind).lowercase(Locale.getDefault())}", 25f, bold = true))
        if (kind == "PURCHASE") {
            draftField(content, "Cantidad de cajas", "boxes", "1")
            draftField(content, "Costo total de todas las cajas ($)", "cost", "")
            content.addView(label("Composición por caja · usa 0 para excluir un sabor", color = muted))
        } else if (kind == "CORRECTION") {
            content.addView(label("Ajuste de unidades: + agrega, − descuenta. Requiere conexión y revisión actual. No reemplaza compras ni inventa su costo.", color = muted))
        } else content.addView(label("Cantidades por sabor. Las reservas de pedidos web no se pueden vender ni consumir aquí.", color = muted))
        val flavors = state.getJSONArray("flavors")
        for (i in 0 until flavors.length()) {
            val flavor = flavors.getJSONObject(i); val id = flavor.getString("id")
            if (kind == "CORRECTION" && draft.optString("selected") != id) continue
            card {
                val initial = if (kind == "PURCHASE") when (flavor.getString("sku")) {
                    "DR-CHOCOLATE", "DR-VAINILLA" -> "4"; "DR-CHOCOLATE-CHISPAS", "DR-VAINILLA-CHISPAS" -> "2"; else -> "0"
                } else "0"
                draftField(this, flavor.getString("name"), "qty:$id", if (kind == "PURCHASE") prefs.getString("mix:$owner:$id", initial) ?: initial else initial, kind == "CORRECTION")
                if (kind == "SALE") draftField(this, "Precio por unidad ($)", "price:$id", String.format(Locale.US, "%.2f", flavor.getLong("unitPriceCents") / 100.0))
            }
        }
        val preview = label("", 15f, accent, true); content.addView(preview)
        val previewAction: () -> Unit = {
            try {
                var units = 0L; var total = 0L
                for (i in 0 until flavors.length()) {
                    val id = flavors.getJSONObject(i).getString("id")
                    val qty = draft.optString("qty:$id", "0").toLongOrNull() ?: 0
                    units += qty
                    if (kind == "SALE") total += qty * DailyRules.money(draft.optString("price:$id", "0"))
                }
                preview.text = if (kind == "PURCHASE") "$units por caja · ${units * (draft.optString("boxes").toLongOrNull() ?: 0)} unidades" else "$units unidades${if (kind == "SALE") " · ${cash(total)}" else ""}"
            } catch (_: Exception) { preview.text = "Revisa los importes." }
        }
        // Text watchers run after persistence; preview updates do not recreate the form/focus.
        fun watch(view: android.view.View) {
            if (view is TextInputEditText) view.addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { previewAction() }
                override fun afterTextChanged(s: Editable?) {}
            })
            if (view is android.view.ViewGroup) for (i in 0 until view.childCount) watch(view.getChildAt(i))
        }
        watch(content); previewAction()
        if (kind == "SALE") {
            content.addView(label("Pago recibido · completa ambos importes, usa 0 en el que no corresponda", color = muted))
            draftField(content, "Efectivo ($)", "cash", "0")
            draftField(content, "Yappy ($)", "yappy", "0")
        }
        draftField(content, if (kind == "CORRECTION") "Motivo de la corrección" else "Nota (opcional)", "note", "", text = true)
        val feedback = label("", color = muted); content.addView(feedback)
        val save = button("Guardar ${title(kind).lowercase(Locale.getDefault())}", true) {}
        save.setOnClickListener {
            if (busy) return@setOnClickListener
            lifecycleScope.launch {
                try {
                    val body = app.daily.body(state, kind).put("note", draft.optString("note"))
                    val items = JSONArray(); var units = 0L; var total = 0L
                    for (i in 0 until flavors.length()) {
                        val flavor = flavors.getJSONObject(i); val id = flavor.getString("id")
                        if (kind == "CORRECTION" && draft.optString("selected") != id) continue
                        val quantity = draft.optString("qty:$id", "0").toLongOrNull() ?: error("Escribe cantidades enteras.")
                        require(quantity in (if (kind == "CORRECTION") -100000L else 0L)..100000L) { "Cantidad fuera de rango." }
                        if (quantity == 0L) continue
                        val item = JSONObject().put("variantId", id).put("quantity", quantity)
                        if (kind == "SALE") {
                            require(flavor.getBoolean("active") && flavor.getBoolean("available")) { "Este sabor está deshabilitado en el catálogo." }
                            val price = DailyRules.money(draft.getString("price:$id")); item.put("unitPriceCents", price); total += quantity * price
                            require(price <= 1_000_000 && total <= 100_000_000) { "El precio o total supera el límite permitido." }
                        }
                        units += kotlin.math.abs(quantity); items.put(item)
                    }
                    require(items.length() > 0 && units <= 100000) { "Selecciona al menos una unidad." }
                    body.put("items", items)
                    if (kind == "PURCHASE") {
                        val boxes = draft.getString("boxes").toIntOrNull() ?: error("Escribe un número entero de cajas.")
                        require(boxes in 1..10000 && units * boxes <= 100000) { "Revisa cajas y total de unidades." }
                        body.put("boxes", boxes).put("totalCostCents", DailyRules.money(draft.getString("cost")))
                    }
                    if (kind == "SALE") {
                        val cashCents = DailyRules.money(draft.getString("cash")); val yappy = DailyRules.money(draft.getString("yappy"))
                        require(cashCents + yappy == total) { "Efectivo más Yappy debe ser igual a ${cash(total)}." }
                        body.put("payment", JSONObject().put("cashCents", cashCents).put("yappyCents", yappy))
                    }
                    if (kind == "CORRECTION") {
                        require(NetworkConnection.connected(this@DailyActivity)) { "Conecta a Internet para corregir existencias." }
                        require(draft.optString("note").trim().length >= 5) { "Explica el motivo de la corrección." }
                        body.put("expectedRevision", state.getJSONObject("inventory").getLong("revision"))
                    }
                    busy = true; save.isEnabled = false
                    app.daily.enqueue(body, draft.getString("operationId"))
                    if (kind == "PURCHASE") prefs.edit {
                        for (i in 0 until flavors.length()) { val id = flavors.getJSONObject(i).getString("id"); putString("mix:$owner:$id", draft.optString("qty:$id", "0")) }
                    }
                    prefs.edit { remove("draft:$owner:$kind") }; draft = JSONObject(); page = "Hoy"
                    DailySync.request(this@DailyActivity); render(); message("Guardado en este teléfono. Se mostrará como confirmado al sincronizar.")
                } catch (e: Exception) { feedback.text = e.message ?: "No se pudo guardar. El borrador se conserva." }
                finally { busy = false; save.isEnabled = true }
            }
        }
        content.addView(save); persistDraft()
    }
    private fun refresh() = lifecycleScope.launch {
        val current = owner ?: return@launch
        if (busy) return@launch
        busy = true; status.text = "Consultando servidor…"
        try { app.daily.refresh(current); DailySync.request(this@DailyActivity) }
        catch (e: Exception) { message(e.message ?: "No se pudo actualizar. La copia local se conserva.") }
        finally {
            busy = false
            if (owner != app.backendClient.dailyOwner) {
                owner = app.backendClient.dailyOwner; snapshot = null; rows = emptyList(); page = "Hoy"; owners.value = owner; render()
            } else updateStatus()
        }
    }
    private fun closeDay() {
        if (!NetworkConnection.connected(this)) { message("El cierre necesita Internet y todos los registros sincronizados."); return }
        if (rows.any { it.state in listOf("PENDING", "CONFLICT") }) { message("Sincroniza o revisa los pendientes antes del cierre."); return }
        MaterialAlertDialogBuilder(this).setTitle("Cerrar jornada y empezar otra")
            .setMessage("Se guarda el resumen confirmado y se abre una jornada nueva. Conserva el inventario y el historial. Otros equipos con registros offline deberán revisarlos si esta jornada ya está cerrada.")
            .setNegativeButton("Continuar jornada", null).setPositiveButton("Cerrar jornada") { _, _ -> lifecycleScope.launch {
                try {
                    val state = snapshot!!
                    val body = app.daily.body(state, "CLOSE").put("expectedRevision", state.getJSONObject("inventory").getLong("revision"))
                        .put("expectedSequence", state.getJSONObject("summary").getLong("lastSequence")).put("nextSessionId", app.daily.id())
                    app.daily.enqueue(body, app.daily.id()); DailySync.request(this@DailyActivity)
                    message("Cierre pendiente de confirmación. El resumen se reinicia cuando el servidor lo confirma.")
                } catch (e: Exception) { message(e.message ?: "No se pudo cerrar.") }
            } }.show()
    }
    private fun logout() {
        MaterialAlertDialogBuilder(this).setTitle("Cerrar sesión")
            .setMessage("Los registros locales se conservan para esta cuenta. Los pendientes necesitan que vuelvas a entrar con la misma cuenta.")
            .setNegativeButton("Volver", null).setPositiveButton("Cerrar sesión") { _, _ ->
                if (busy) return@setPositiveButton
                busy = true
                val previousOwner = owner
                lifecycleScope.launch {
                    if (previousOwner != null) {
                        try { app.backendClient.staffNotificationStop(previousOwner) } catch (_: Exception) { /* Locally block all pushes even offline. */ }
                        StaffInboxSync.stop(this@DailyActivity, previousOwner); StaffNotificationRegistration.stop(this@DailyActivity, previousOwner)
                    }
                    if (owner == previousOwner) {
                        DailySync.stop(this@DailyActivity); app.backendClient.logout(); owner = null; owners.value = null
                        notificationCheckId = null; notificationFeedback = ""
                        snapshot = null; inbox = null; orderDetail = null; orderTargetId = null; orderTargetOwner = null
                        rows = emptyList(); draft = JSONObject(); page = "Pedidos"
                    }
                    busy = false; render()
                }
            }.show()
    }
    private fun openWeb() { startActivity(Intent(Intent.ACTION_VIEW, "https://www.dracha.store/?staff=dashboard".toUri())) }
    private fun message(text: String) { MaterialAlertDialogBuilder(this).setMessage(text).setPositiveButton("Listo", null).show() }
}
