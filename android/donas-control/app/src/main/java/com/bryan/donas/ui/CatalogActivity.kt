package com.bryan.donas.ui

import android.os.Bundle
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.room.withTransaction
import com.bryan.donas.DonasApp
import com.bryan.donas.data.NetworkConnection
import com.bryan.donas.data.OrderSync
import com.bryan.donas.data.db.CatalogOperationEntity
import com.bryan.donas.data.db.FlavorEntity
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.google.android.material.materialswitch.MaterialSwitch
import kotlinx.coroutines.launch
import java.util.UUID

class CatalogActivity : AppCompatActivity() {
    private val app get() = application as DonasApp
    private lateinit var rows: LinearLayout
    private lateinit var notice: TextView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 28, 28, 28) }
        val scroll = ScrollView(this).apply { addView(root) }
        setContentView(scroll)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        root.addView(MaterialButton(this).apply { text = "Volver"; setOnClickListener { finish() } })
        root.addView(TextView(this).apply { text = "Sabores y disponibilidad"; textSize = 24f })
        notice = TextView(this); root.addView(notice)
        root.addView(MaterialButton(this).apply { text = "Actualizar"; setOnClickListener { refresh() } })
        rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }; root.addView(rows)
        render(); refresh()
    }
    private fun render(): kotlinx.coroutines.Job = lifecycleScope.launch {
        rows.removeAllViews()
        val dao = app.database.syncDao()
        val issues = dao.catalogIssues()
        notice.text = if (!NetworkConnection.connected(this@CatalogActivity)) "Sin conexión. Copia local; los cambios esperan sincronización."
            else if (issues.any { it.state == "CONFLICT" }) "Error de sincronización. Revisa los cambios en conflicto."
            else if (issues.isNotEmpty()) "Pendiente de sincronización. La web conserva la versión confirmada."
            else "Última copia sincronizada. La oferta comercial no cambia el conteo físico."
        for (flavor in dao.flavors()) {
            val operation = issues.firstOrNull { it.variantId == flavor.id }
            rows.addView(TextView(this@CatalogActivity).apply {
                text = "${operation?.name ?: flavor.name} · ${if (operation?.available ?: flavor.available) "Disponible para pedir" else "No ofrecido"}" +
                    (operation?.let { "\n${if (it.state == "CONFLICT") "Error: ${it.lastError}" else "Pendiente de sincronización"}" } ?: "")
                textSize = 18f; setPadding(0, 22, 0, 8)
            })
            if (app.backendClient.role == "ADMIN" && app.backendClient.signedIn) {
                rows.addView(MaterialButton(this@CatalogActivity).apply {
                    text = if (operation?.state == "CONFLICT") "Descartar cambio y revisar" else "Editar sabor"
                    isEnabled = operation == null || operation.state == "CONFLICT"
                    setOnClickListener {
                        if (operation?.state == "CONFLICT") lifecycleScope.launch {
                            dao.discardCatalogConflict(operation.operationId); refresh()
                        } else edit(flavor)
                    }
                })
            }
        }
    }
    private fun refresh(): kotlinx.coroutines.Job = lifecycleScope.launch {
        render()
        if (!app.backendClient.signedIn || !NetworkConnection.connected(this@CatalogActivity)) return@launch
        try {
            app.database.syncDao().cacheFlavors(app.backendClient.catalog()); render()
            OrderSync.request(this@CatalogActivity)
        } catch (e: Exception) { notice.text = "Última copia guardada. ${e.message.orEmpty()}" }
    }
    private fun edit(flavor: FlavorEntity) {
        val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 0, 28, 0) }
        val input = TextInputLayout(this).apply { hint = "Nombre del sabor" }
        val name = TextInputEditText(input.context).apply { setText(flavor.name) }; input.addView(name); form.addView(input)
        val available = MaterialSwitch(this).apply { text = "Ofrecer en la web"; isChecked = flavor.available }; form.addView(available)
        val dialog = MaterialAlertDialogBuilder(this).setTitle("Editar oferta comercial")
            .setMessage("No cambia las unidades físicas. Sin conexión quedará pendiente y se comprobará la versión al sincronizar.")
            .setView(form).setNegativeButton("Cancelar", null).setPositiveButton("Guardar", null).create()
        dialog.setOnShowListener {
            dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val value = name.text?.toString().orEmpty().trim()
                if (value.isBlank() || value.length > 100) { name.error = "Entre 1 y 100 caracteres"; return@setOnClickListener }
                dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).isEnabled = false
                lifecycleScope.launch {
                    app.database.withTransaction {
                        check(app.database.syncDao().catalogIssues().none { it.variantId == flavor.id }) { "Ya hay un cambio pendiente." }
                        app.database.syncDao().enqueueCatalog(CatalogOperationEntity(UUID.randomUUID().toString(), flavor.id, value, available.isChecked, flavor.updatedAt))
                    }
                    dialog.dismiss(); render(); OrderSync.request(this@CatalogActivity)
                }
            }
        }
        dialog.show()
    }
}
