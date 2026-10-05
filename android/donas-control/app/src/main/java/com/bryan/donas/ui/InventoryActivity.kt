package com.bryan.donas.ui

import android.os.Bundle
import android.content.Context
import androidx.core.content.edit
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.bryan.donas.DonasApp
import com.bryan.donas.data.OrderSync
import com.bryan.donas.data.StableWifi
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch
import org.json.JSONObject

class InventoryActivity : AppCompatActivity() {
    private val app get() = application as DonasApp
    private lateinit var rows: LinearLayout
    private lateinit var notice: TextView
    private var snapshot: JSONObject? = null
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 28, 28, 28) }
        val scroll = ScrollView(this).apply { addView(root) }
        setContentView(scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        fun button(label: String, action: () -> Unit) = MaterialButton(this).apply { text = label; setOnClickListener { action() } }
        root.addView(button("← Inicio") { finish() })
        root.addView(TextView(this).apply { text = "Inventario compartido"; textSize = 26f })
        notice = TextView(this).apply { text = "Las ventas quedan guardadas y se envían con Wi‑Fi estable. Las reservas web se muestran por separado." }
        root.addView(notice)
        root.addView(button("Actualizar") { refresh() })
        rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(rows)
        root.addView(button("Registrar conteo físico") { count() })
        snapshot = getSharedPreferences("shared_inventory", Context.MODE_PRIVATE).getString("snapshot", null)?.let {
            try { JSONObject(it) } catch (_: Exception) { null }
        }
        render()
        refresh()
    }

    private fun render() {
        rows.removeAllViews()
        val flavors = snapshot?.optJSONArray("flavors") ?: return
        for (i in 0 until flavors.length()) {
            val item = flavors.getJSONObject(i)
            rows.addView(TextView(this).apply {
                text = "${item.optString("name")}\n${item.optLong("available_quantity")} disponibles · ${item.optLong("reserved_quantity")} reservadas" +
                    if (!item.optBoolean("counted")) "\nRequiere conteo / conciliación" else ""
                textSize = 18f; setPadding(0, 22, 0, 22)
            })
        }
    }

    private fun refresh() = lifecycleScope.launch {
        if (busy) return@launch
        busy = true
        try {
            if (!app.backendClient.signedIn) { notice.text = "Conecta tu cuenta desde Pedidos. El control local sigue disponible."; return@launch }
            snapshot = app.backendClient.inventory()
            getSharedPreferences("shared_inventory", Context.MODE_PRIVATE).edit { putString("snapshot", snapshot.toString()) }
            render()
            val pending = app.database.syncDao().pendingCount()
            notice.text = "$pending registros pendientes de enviar por Wi‑Fi. Última consulta: ${snapshot?.optString("serverTime").orEmpty()}"
            OrderSync.request(this@InventoryActivity)
        } catch (e: Exception) { notice.text = "Mostrando última copia guardada. ${e.message.orEmpty()}" }
        finally { busy = false }
    }

    private fun count() = lifecycleScope.launch {
        if (busy) return@launch
        if (!StableWifi.connected(this@InventoryActivity) || app.database.syncDao().pendingCount() > 0) {
            notice.text = "Primero conecta Wi‑Fi y sincroniza los registros pendientes antes de contar."
            OrderSync.request(this@InventoryActivity); return@launch
        }
        val current = snapshot ?: return@launch
        if (!current.optBoolean("shared") || !current.has("revision")) {
            notice.text = "El inventario compartido todavía no está activado en el servidor. Actualiza el servidor antes de guardar un conteo desde la app."
            return@launch
        }
        val flavors = current.optJSONArray("flavors") ?: return@launch
        val fields = mutableMapOf<String, TextInputEditText>()
        val form = LinearLayout(this@InventoryActivity).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 0, 28, 0) }
        for (i in 0 until flavors.length()) {
            val flavor = flavors.getJSONObject(i)
            val layout = TextInputLayout(this@InventoryActivity).apply { hint = flavor.getString("name") }
            val field = TextInputEditText(layout.context).apply { inputType = android.text.InputType.TYPE_CLASS_NUMBER }
            layout.addView(field); form.addView(layout); fields[flavor.getString("sku")] = field
        }
        MaterialAlertDialogBuilder(this@InventoryActivity).setTitle("Conteo físico de todo el negocio")
            .setMessage("Incluye donas reservadas y existencias de todos los socios. Si otro dispositivo tiene ventas pendientes, sincronízalo primero.")
            .setView(form).setNegativeButton("Volver", null).setPositiveButton("Guardar", null).create().also { dialog ->
                dialog.setOnShowListener {
                    dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                        val counts = JSONObject()
                        for ((sku, field) in fields) {
                            val quantity = field.text.toString().toIntOrNull()
                            if (quantity == null || quantity !in 0..100000) { field.error = "Cantidad entre 0 y 100000"; return@setOnClickListener }
                            counts.put(sku, quantity)
                        }
                        dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).isEnabled = false
                        lifecycleScope.launch {
                            try {
                                check(StableWifi.ready(this@InventoryActivity)) { "Espera a tener Wi‑Fi estable." }
                                check(app.database.syncDao().pendingCount() == 0) { "Hay nuevos registros pendientes. Sincroniza primero." }
                                app.backendClient.saveInventory(counts, current.getLong("revision"))
                                dialog.dismiss(); refresh()
                            } catch (e: Exception) { notice.text = e.message; dialog.dismiss(); refresh() }
                        }
                    }
                }
                dialog.show()
            }
    }
}
