package com.bryan.donas.ui

import android.os.Bundle
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
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
        root.addView(TextView(this).apply { text = "Pedidos"; textSize = 24f }, fullWidth())
        notice = TextView(this).apply { text = "Los pedidos requieren una cuenta administradora. La venta local se registra por separado hasta completar la conciliación." }
        root.addView(notice, fullWidth())
        loginFields = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        email = input("Correo", false)
        password = input("Contraseña", true)
        loginFields.addView(email.parent as TextInputLayout, fullWidth())
        loginFields.addView(password.parent as TextInputLayout, fullWidth())
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
                list.removeAllViews()
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
    private fun input(label: String, secret: Boolean): TextInputEditText {
        val layout = TextInputLayout(this).apply { hint = label }
        val field = TextInputEditText(layout.context).apply {
            inputType = if (secret) android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                else android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        layout.addView(field)
        return field
    }
    private fun button(label: String, action: () -> Unit) = MaterialButton(this).apply { text = label; setOnClickListener { action() } }

    private fun renderSession() {
        loginFields.isVisible = !client.signedIn
        logout.isVisible = client.signedIn
        sync.isVisible = client.signedIn
        list.isVisible = client.signedIn
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
                OrderSync.request(this@OrdersActivity)
            } catch (e: Exception) { notice.text = e.message ?: "No se pudo iniciar sesión." }
            finally { login.isEnabled = true }
        }
    }

    private fun loadOrders() = lifecycleScope.launch {
        list.removeAllViews()
        val orders = app.database.syncDao().recentOrders()
        if (orders.isEmpty()) list.addView(TextView(this@OrdersActivity).apply { text = "Aún no hay pedidos sincronizados." })
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
                // Completing an order requires the server-side atomic sale, inventory and points transaction.
                card.addView(TextView(this).apply { text = "Entrega pendiente de conciliación automática con inventario y venta." }, fullWidth())
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
