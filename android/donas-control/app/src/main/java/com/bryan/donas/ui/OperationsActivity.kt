package com.bryan.donas.ui

import android.content.Intent
import android.Manifest
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.LinearLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.bryan.donas.DonasApp
import com.bryan.donas.data.PaymentSource
import com.bryan.donas.databinding.ActivityOperationsBinding
import com.bryan.donas.util.Money
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date
import java.util.UUID

class OperationsActivity : AppCompatActivity() {
    private lateinit var binding: ActivityOperationsBinding
    private val app get() = application as DonasApp
    private var historyOffset = 0
    private var historyType: String? = null
    private var historyAccount: String? = null
    private var busy = false
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { refresh() }

    private val exportBackup = registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        uri ?: return@registerForActivityResult
        runAction("Copia de seguridad exportada.") {
            app.database.openHelper.writableDatabase.query("PRAGMA wal_checkpoint(FULL)").close()
            contentResolver.openOutputStream(uri)?.use { output -> applicationContext.getDatabasePath("donas.db").inputStream().use { it.copyTo(output) } } ?: error("No se pudo abrir el archivo de destino.")
        }
    }
    private val importBackup = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@registerForActivityResult
        confirmImport(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOperationsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.setNavigationOnClickListener { finish() }
        binding.startSession.setOnClickListener { startSession() }
        binding.closeSession.setOnClickListener { closeSession() }
        binding.saleCash.setOnClickListener { sale("CASH") }
        binding.saleYappy.setOnClickListener { sale("YAPPY") }
        binding.undo.setOnClickListener { runAction("Venta revertida.") { app.operations.undoLastSale() } }
        binding.purchase.setOnClickListener { purchase() }
        binding.transfer.setOnClickListener { transfer() }
        binding.expense.setOnClickListener { expense() }
        binding.loan.setOnClickListener { loanMenu() }
        binding.adjust.setOnClickListener { adjust() }
        binding.partner.setOnClickListener { partnerPayment() }
        binding.moreHistory.setOnClickListener { historyOffset += 50; refresh() }
        binding.filterHistory.setOnClickListener { filterHistory() }
        binding.export.setOnClickListener { exportBackup.launch("donas-control-${System.currentTimeMillis()}.donasbackup") }
        binding.importData.setOnClickListener { importBackup.launch(arrayOf("application/octet-stream", "application/x-sqlite3", "*/*")) }
        binding.resetBusiness.setOnClickListener { destructiveReset(false) }
        binding.resetSession.setOnClickListener {
            MaterialAlertDialogBuilder(this).setTitle("Reiniciar jornada actual").setMessage("Las ventas se revertirán con eventos y la jornada quedará cerrada. Si contiene otras operaciones, el reinicio se rechazará para proteger el historial.").setNegativeButton("Cancelar", null).setPositiveButton("Revertir") { _, _ -> runAction("Jornada revertida.") { app.operations.resetCurrentSession() } }.show()
        }
        binding.factoryReset.setOnClickListener { destructiveReset(true) }
        if (intent.getBooleanExtra(QuickSaleUi.EXTRA_OPEN_PURCHASE, false)) {
            intent.removeExtra(QuickSaleUi.EXTRA_OPEN_PURCHASE)
            binding.root.post { purchase() }
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onResume() { super.onResume(); refresh() }

    private fun refresh() {
        lifecycleScope.launch {
            try {
                val data = withContext(Dispatchers.IO) { app.operations.dashboard() }
                val stats = withContext(Dispatchers.IO) { app.operations.statistics() }
                val history = withContext(Dispatchers.IO) { app.operations.history(historyType, historyAccount, historyOffset) }
                binding.session.text = if (data.activeSession == null) "Sin jornada activa" else "Jornada activa · ${DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(data.activeSession.startedAt))}"
                binding.dashboard.text = "CAPITAL DISPONIBLE\nEfectivo ${Money.format(data.cash)} · Yappy ${Money.format(data.yappy)}\nTotal líquido ${Money.format(data.cash + data.yappy)}\n\nVENTAS DE HOY\n${data.today.quantity} donas · ${Money.format(data.today.revenue)}\nGanancia bruta ${Money.format(data.today.revenue - data.today.cost)}\n\nINVENTARIO\n${data.stock} donas · ${Money.format(data.inventoryValue)} invertidos\n\nDEUDAS Y SOCIOS\nDeuda ${Money.format(data.debt)} · Pendiente socios ${Money.format(data.partnerPending)}"
                binding.startSession.isVisible = data.activeSession == null
                binding.closeSession.isVisible = data.activeSession != null
                binding.saleCash.isEnabled = data.activeSession != null && data.stock > 0
                binding.saleYappy.isEnabled = binding.saleCash.isEnabled
                binding.statistics.text = "Hoy: ${stats.today.quantity} donas · ${Money.format(stats.today.revenue)}\nSemana: ${stats.week.quantity} · ${Money.format(stats.week.revenue)}\nMes: ${stats.month.quantity} · ${Money.format(stats.month.revenue)}\nGastos de negocio hoy: ${Money.format(stats.todayExpenses)}\nGanancia neta hoy: ${Money.format(stats.today.revenue - stats.today.cost - stats.todayExpenses)}"
                binding.history.text = history.joinToString("\n") { "${DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it.timestamp))}   ${if (it.amountCents == 0L) "" else Money.format(it.amountCents)}   ${it.title}" }.ifEmpty { "Todavía no hay movimientos." }
                binding.moreHistory.isVisible = history.size == 50
                QuickSaleUi.updateAll(this@OperationsActivity)
            } catch (e: Exception) { message(e.localizedMessage ?: "No se pudo actualizar.") }
        }
    }

    private fun sale(code: String) = runAction("Venta registrada.") { app.operations.quickSale(code) }

    private fun startSession() {
        val fields = form("Efectivo inicial ($)" to "0.00", "Yappy inicial ($)" to "0.00")
        dialog("Iniciar jornada", fields) { app.operations.startSession(Money.parse(fields[0].text.toString()), Money.parse(fields[1].text.toString())) }
    }
    private fun closeSession() {
        lifecycleScope.launch {
            val stock = withContext(Dispatchers.IO) { app.operations.dashboard().stock }
            val fields = form("Stock físico" to stock.toString())
            dialog("Cerrar y conciliar jornada", fields) { app.operations.closeSession(fields[0].text.toString().toLong()) }
        }
    }
    private fun purchase() {
        val fields = form("Cantidad de cajas" to "1", "Efectivo ($)" to "0.00", "Yappy ($)" to "0.00", "Préstamo ($)" to "0.00", "Capital de socio / otro ($)" to "0.00")
        dialog("Compra con pago combinado", fields) {
            val sources = listOf("CASH", "YAPPY", "DEBT", "EQUITY").zip(fields.drop(1)).map { PaymentSource(it.first, Money.parse(it.second.text.toString())) }.filter { it.cents > 0 }
            app.operations.purchase(fields[0].text.toString().toInt(), sources)
        }
    }
    private fun transfer() {
        val choices = arrayOf("Yappy → Efectivo", "Efectivo → Yappy")
        MaterialAlertDialogBuilder(this).setTitle("Dirección").setItems(choices) { _, which ->
            val fields = form("Cantidad ($)" to "", "Comisión ($)" to "0.00", "Descripción" to "Transferencia")
            dialog("Transferir dinero", fields) {
                val from = if (which == 0) "YAPPY" else "CASH"; val to = if (which == 0) "CASH" else "YAPPY"
                app.operations.transfer(from, to, Money.parse(fields[0].text.toString()), Money.parse(fields[1].text.toString()), fields[2].text.toString())
            }
        }.show()
    }
    private fun expense() {
        val categories = arrayOf("Transporte", "Comida", "Universidad", "Entretenimiento", "Donas", "Publicidad", "Materiales", "Otro")
        MaterialAlertDialogBuilder(this).setTitle("Categoría").setItems(categories) { _, categoryIndex ->
            val types = arrayOf("Negocio · Efectivo", "Negocio · Yappy", "Personal · Efectivo", "Personal · Yappy")
            MaterialAlertDialogBuilder(this).setTitle("Tipo y cuenta").setItems(types) { _, type ->
                val fields = form("Cantidad ($)" to "", "Descripción" to categories[categoryIndex])
                dialog("Registrar gasto", fields) { app.operations.expense(categories[categoryIndex], if (type % 2 == 0) "CASH" else "YAPPY", Money.parse(fields[0].text.toString()), type < 2, fields[1].text.toString()) }
            }.show()
        }.show()
    }
    private fun loanMenu() {
        MaterialAlertDialogBuilder(this).setTitle("Préstamos").setItems(arrayOf("Registrar préstamo recibido", "Registrar pago parcial")) { _, option -> if (option == 0) receiveLoan() else payLoan() }.show()
    }
    private fun receiveLoan() {
        val fields = form("Persona" to "", "Cantidad ($)" to "", "Descripción" to "Préstamo")
        MaterialAlertDialogBuilder(this).setTitle("Cuenta receptora").setItems(arrayOf("Efectivo", "Yappy")) { _, account ->
            dialog("Préstamo recibido", fields) { app.operations.receiveLoan(fields[0].text.toString(), Money.parse(fields[1].text.toString()), if (account == 0) "CASH" else "YAPPY", fields[2].text.toString()) }
        }.show()
    }
    private fun payLoan() = lifecycleScope.launch {
        val loans = withContext(Dispatchers.IO) { app.operations.openLoans() }
        if (loans.isEmpty()) { message("No hay préstamos pendientes."); return@launch }
        MaterialAlertDialogBuilder(this@OperationsActivity).setTitle("Selecciona préstamo").setItems(loans.map { "${it.person} · ${Money.format(it.originalCents - it.paidCents)}" }.toTypedArray()) { _, index ->
            val fields = form("Cantidad ($)" to Money.input(loans[index].originalCents - loans[index].paidCents))
            MaterialAlertDialogBuilder(this@OperationsActivity).setTitle("Cuenta de pago").setItems(arrayOf("Efectivo", "Yappy")) { _, acct -> dialog("Pagar préstamo", fields) { app.operations.payLoan(loans[index].id, Money.parse(fields[0].text.toString()), if (acct == 0) "CASH" else "YAPPY") } }.show()
        }.show()
    }
    private fun adjust() {
        val fields = form("Cambio de donas (ej. -1 o 12)" to "", "Motivo" to "Ajuste manual")
        fields[0].inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED
        dialog("Ajustar inventario", fields) { app.operations.adjustInventory(fields[0].text.toString().toLong(), fields[1].text.toString()) }
    }
    private fun partnerPayment() = lifecycleScope.launch {
        val rows = withContext(Dispatchers.IO) { app.operations.unpaidAllocations() }
        if (rows.isEmpty()) { message("No hay ganancias pendientes de pago."); return@launch }
        MaterialAlertDialogBuilder(this@OperationsActivity).setTitle("Ganancia pendiente").setItems(rows.map { "${it.nameSnapshot} · ${Money.format(it.allocatedCents - it.paidCents)}" }.toTypedArray()) { _, index ->
            val fields = form("Cantidad ($)" to Money.input(rows[index].allocatedCents - rows[index].paidCents))
            MaterialAlertDialogBuilder(this@OperationsActivity).setTitle("Cuenta de pago").setItems(arrayOf("Efectivo", "Yappy")) { _, acct -> dialog("Pagar a socio", fields) { app.operations.payPartner(rows[index].id, Money.parse(fields[0].text.toString()), if (acct == 0) "CASH" else "YAPPY") } }.show()
        }.show()
    }

    private fun form(vararg fields: Pair<String, String>): List<TextInputEditText> {
        val container = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(36, 8, 36, 0) }
        val editors = fields.map { (hint, value) ->
            TextInputEditText(this).apply { setText(value); inputType = if (hint.contains("Descripción") || hint.contains("Persona") || hint.contains("Motivo")) InputType.TYPE_CLASS_TEXT else InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL }
                .also { editor -> container.addView(TextInputLayout(this).apply { this.hint = hint; addView(editor) }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = 10 }) }
        }
        editors.first().setTag(com.bryan.donas.R.id.root, container)
        return editors
    }
    private fun dialog(title: String, fields: List<TextInputEditText>, operation: suspend () -> Any) {
        val view = fields.first().getTag(com.bryan.donas.R.id.root) as View
        val dialog = MaterialAlertDialogBuilder(this).setTitle(title).setView(view).setNegativeButton("Cancelar", null).setPositiveButton("Guardar", null).create()
        dialog.setOnShowListener { dialog.getButton(-1).setOnClickListener { dialog.dismiss(); runAction("Operación guardada.", operation) } }
        dialog.show()
    }
    private fun runAction(success: String, operation: suspend () -> Any) {
        if (busy) return
        busy = true
        lifecycleScope.launch {
            try { withContext(Dispatchers.IO) { operation() }; if (!isFinishing) { message(success); refresh() } }
            catch (e: Exception) { message(e.localizedMessage ?: "La operación no se pudo completar.") }
            finally { busy = false }
        }
    }
    private fun message(text: String) = Snackbar.make(binding.root, text, Snackbar.LENGTH_LONG).show()

    private fun confirmImport(uri: android.net.Uri) {
        MaterialAlertDialogBuilder(this).setTitle("Importar copia")
            .setMessage("La copia reemplazará todos los datos actuales. Esta operación valida la base antes de aplicarla.")
            .setNegativeButton("Cancelar", null).setPositiveButton("Importar") { _, _ -> runAction("Copia importada.") { importDatabase(uri) } }.show()
    }
    private suspend fun importDatabase(uri: android.net.Uri) {
        val main = applicationContext.getDatabasePath("donas.db")
        val temp = applicationContext.getDatabasePath("donas-import.db")
        contentResolver.openInputStream(uri)?.use { input -> temp.outputStream().use { input.copyTo(it) } } ?: error("No se pudo leer la copia.")
        val validation = androidx.room.Room.databaseBuilder(applicationContext, com.bryan.donas.data.db.AppDatabase::class.java, "donas-import.db").build()
        try { requireNotNull(validation.businessDao().state()) { "La copia no contiene configuración válida." } } finally { validation.close() }
        app.database.close()
        temp.copyTo(main, overwrite = true); temp.delete()
        applicationContext.getDatabasePath("donas.db-wal").delete(); applicationContext.getDatabasePath("donas.db-shm").delete()
        app.reopenDatabase(); app.repository.initialize()
        withContext(Dispatchers.Main) { restartApp() }
    }
    private fun destructiveReset(factory: Boolean) {
        val fields = form("Escribe RESETEAR" to "")
        val title = if (factory) "Restablecer toda la aplicación" else "Reiniciar datos del negocio"
        val first = MaterialAlertDialogBuilder(this).setTitle(title).setMessage("Crea una copia de seguridad antes. Esta acción eliminará los movimientos locales.").setView(fields.first().getTag(com.bryan.donas.R.id.root) as View).setNegativeButton("Cancelar", null).setPositiveButton("Continuar", null).create()
        first.setOnShowListener { first.getButton(-1).setOnClickListener {
            if (fields[0].text.toString() != "RESETEAR") { fields[0].error = "Escribe RESETEAR"; return@setOnClickListener }
            first.dismiss()
            MaterialAlertDialogBuilder(this).setTitle("Confirmación final").setMessage("¿Eliminar los datos ahora?").setNegativeButton("Cancelar", null).setPositiveButton("Eliminar") { _, _ ->
                runAction("Datos reiniciados.") {
                    if (factory) {
                        app.database.close(); applicationContext.deleteDatabase("donas.db"); app.reopenDatabase(); app.repository.initialize()
                        app.themePreferences.setTheme(androidx.appcompat.app.AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
                        withContext(Dispatchers.Main) { restartApp() }
                    } else app.operations.resetBusinessData()
                }
            }.show()
        } }; first.show()
    }

    private fun filterHistory() {
        val labels = arrayOf("Todo", "Ventas", "Compras", "Gastos", "Préstamos", "Transferencias", "Reversiones", "Solo Efectivo", "Solo Yappy")
        MaterialAlertDialogBuilder(this).setTitle("Filtrar historial").setItems(labels) { _, index ->
            historyType = when (index) { 1 -> "SALE"; 2 -> "PURCHASE"; 3 -> "EXPENSE"; 4 -> "LOAN"; 5 -> "TRANSFER"; 6 -> "REVERSAL"; else -> null }
            historyAccount = when (index) { 7 -> "CASH"; 8 -> "YAPPY"; else -> null }
            historyOffset = 0; refresh()
        }.show()
    }

    private fun restartApp() {
        val intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        finishAffinity(); startActivity(intent)
    }
}
