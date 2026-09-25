package com.bryan.donas.ui

import android.os.Bundle
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BackendClient
import com.bryan.donas.data.OrderSync
import com.bryan.donas.data.db.RemoteOrderEntity
import com.bryan.donas.util.Money
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch
import org.json.JSONArray
import java.util.UUID

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
    private val app get() = application as DonasApp

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        client = app.backendClient
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
        root.addView(button("← Volver") { finish() }, fullWidth())
        root.addView(TextView(this).apply { text = "Pedidos"; textSize = 24f }, fullWidth())
        notice = TextView(this).apply { text = "Los pedidos requieren una cuenta administradora. Las ventas sin conexión se concilian al volver la red." }
        root.addView(notice, fullWidth())
        loginFields = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val emailInput = input("Correo", false)
        val passwordInput = input("Contraseña", true)
        email = emailInput.editText as TextInputEditText
        password = passwordInput.editText as TextInputEditText
        loginFields.addView(emailInput, fullWidth())
        loginFields.addView(passwordInput, fullWidth())
        login = button("Iniciar sesión") { signIn() }
        loginFields.addView(login, fullWidth())
        root.addView(loginFields, fullWidth())
        sync = button("Actualizar pedidos") { OrderSync.request(this); notice.text = "Sincronización solicitada…" }
        logout = button("Cerrar sesión") {
            client.logout()
            WorkManager.getInstance(this).cancelUniqueWork("donas-order-sync")
            renderSession()
            lifecycleScope.launch {
                val dao = app.database.syncDao()
                dao.clearOrders(); dao.clearState()
            }
            notice.text = "Sesión cerrada."
        }
        root.addView(sync, fullWidth())
        root.addView(logout, fullWidth())
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(list, fullWidth())
        WorkManager.getInstance(this).getWorkInfosForUniqueWorkLiveData("donas-order-sync").observe(this) { jobs ->
            val job = jobs.lastOrNull() ?: return@observe
            if (job.state == WorkInfo.State.SUCCEEDED) { notice.text = "Pedidos actualizados."; loadOrders() }
            if (job.state == WorkInfo.State.FAILED) notice.text = "No se pudo sincronizar. Comprueba la sesión, la conexión y la configuración del servidor."
        }
        renderSession()
        if (client.signedIn) loadOrders()
        if (client.signedIn) OrderSync.request(this)
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
        if (!client.signedIn) {
            list.removeAllViews()
            showEmptyState("Inicia sesión para consultar pedidos. No hay pedidos visibles sin una cuenta administradora.")
        }
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
                renderSession()
                notice.text = "Sesión iniciada. Actualizando pedidos…"
                loadOrders()
                OrderSync.request(this@OrdersActivity)
            } catch (e: Exception) { notice.text = e.message ?: "No se pudo iniciar sesión." }
            finally { login.isEnabled = true }
        }
    }

    private fun loadOrders() = lifecycleScope.launch {
        list.removeAllViews()
        val orders = app.database.syncDao().recentOrders()
        val rejected = app.database.syncDao().rejectedCount()
        val unbooked = orders.count { it.status == "COMPLETED" && it.settled && app.database.operationDao().eventByKey("order-${it.id}") == null }
        if (rejected > 0 || unbooked > 0) notice.text = "Requieren conciliación: $rejected ventas rechazadas por el servidor y $unbooked pedidos sin asiento local. No repitas la venta."
        if (orders.isEmpty()) showEmptyState("No hay pedidos todavía. Pulsa Actualizar pedidos para comprobar de nuevo.")
        orders.forEach(::renderOrder)
    }

    private fun renderOrder(order: RemoteOrderEntity) {
        val card = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, 12.dp, 0, 12.dp) }
        val flavors = JSONArray(order.itemsJson)
        val details = (0 until flavors.length()).joinToString(" · ") { index ->
            val item = flavors.getJSONObject(index)
            "${item.optInt("quantity")}× ${item.optString("variantName")}"
        }
        card.addView(TextView(this).apply {
            text = "${order.publicCode} · ${order.status}\n${order.customerName} · ${order.customerPhone}\n$details\n${Money.format(order.totalCents)} · ${order.paymentMethod} · ${order.paymentStatus}\n${order.deliveryLocation}"
            textSize = 15f
        }, fullWidth())
        fun action(label: String, target: String) {
            val control = button(label) { transition(order, target) }
            card.addView(control, fullWidth())
        }
        when (order.status) {
            "PENDING" -> { action("Aceptar", "ACCEPTED"); action("Cancelar", "CANCELLED") }
            "ACCEPTED" -> { action("En camino", "OUT_FOR_DELIVERY"); action("Cancelar", "CANCELLED") }
            "OUT_FOR_DELIVERY" -> {
                if (order.paymentStatus != "CONFIRMED") card.addView(button("Confirmar cobro presencial") { confirmPayment(order) }, fullWidth())
                else card.addView(button("Completar entrega y registrar venta") { transition(order, "COMPLETED") }, fullWidth())
            }
        }
        list.addView(card, fullWidth())
    }

    private fun transition(order: RemoteOrderEntity, status: String) = lifecycleScope.launch {
        try {
            client.transition(order.id, status)
            notice.text = "Estado actualizado. Sincronizando…"
            OrderSync.request(this@OrdersActivity)
        } catch (e: Exception) { notice.text = e.message ?: "No se pudo actualizar el pedido." }
    }

    private fun confirmPayment(order: RemoteOrderEntity) = lifecycleScope.launch {
        try {
            val key = UUID.nameUUIDFromBytes("${order.id}:CONFIRMED".toByteArray()).toString()
            client.confirmPayment(order.id, key)
            notice.text = "Cobro confirmado. Sincronizando…"
            OrderSync.request(this@OrdersActivity)
        } catch (e: Exception) { notice.text = e.message ?: "No se pudo confirmar el cobro." }
    }
}
