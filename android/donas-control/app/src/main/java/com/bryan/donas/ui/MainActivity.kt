package com.bryan.donas.ui

import android.os.Bundle
import android.content.Intent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.bryan.donas.DonasApp
import com.bryan.donas.R
import com.bryan.donas.data.BusinessSnapshot
import com.bryan.donas.databinding.ActivityMainBinding
import com.bryan.donas.domain.*
import com.bryan.donas.util.Money
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date
import java.util.UUID

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val model: MainViewModel by viewModels()
    private lateinit var adapter: MemberAdapter
    private var rendering = false
    private var shownPlan = 0L
    private var shownConfig = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        val night = resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK == android.content.res.Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, binding.root).isAppearanceLightStatusBars = !night
        WindowCompat.getInsetsController(window, binding.root).isAppearanceLightNavigationBars = !night
        adapter = MemberAdapter(model) { validatePlan(); invalidateSimulation() }
        binding.sharing.members.layoutManager = LinearLayoutManager(this)
        binding.sharing.members.adapter = adapter
        binding.sharing.members.itemAnimator = null
        binding.navigation.setOnItemSelectedListener { item ->
            model.page = when (item.itemId) { R.id.nav_business -> 1; R.id.nav_sharing -> 2; else -> 0 }
            showPage(); true
        }
        binding.navigation.selectedItemId = when (model.page) { 1 -> R.id.nav_business; 2 -> R.id.nav_sharing; else -> R.id.nav_home }
        binding.home.configure.setOnClickListener { binding.navigation.selectedItemId = R.id.nav_business }
        binding.home.editPlan.setOnClickListener { binding.navigation.selectedItemId = R.id.nav_sharing }
        binding.home.openOperations.setOnClickListener { startActivity(Intent(this, OperationsActivity::class.java)) }
        binding.home.openOrders.setOnClickListener { startActivity(Intent(this, OrdersActivity::class.java)) }
        binding.retry.setOnClickListener { model.initialize() }
        binding.business.cost.doAfterTextChanged { if (!rendering) { model.cost = it.toString(); previewConfig() } }
        binding.business.units.doAfterTextChanged { if (!rendering) { model.units = it.toString(); previewConfig() } }
        binding.business.price.doAfterTextChanged { if (!rendering) { model.price = it.toString(); previewConfig() } }
        binding.business.saveConfig.setOnClickListener { saveConfig() }
        binding.business.themes.setOnCheckedChangeListener { _, checked ->
            if (!rendering) lifecycleScope.launch {
                try {
                    (application as DonasApp).themePreferences.setTheme(when (checked) {
                        R.id.darkTheme -> AppCompatDelegate.MODE_NIGHT_YES
                        R.id.lightTheme -> AppCompatDelegate.MODE_NIGHT_NO
                        else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                    })
                } catch (e: java.io.IOException) { message("No se pudo guardar el tema.") }
            }
        }
        binding.sharing.modes.setOnCheckedChangeListener { _, checked ->
            if (!rendering) {
                model.mode = if (checked == R.id.fixed) ShareMode.FIXED else ShareMode.PERCENTAGE
                refreshMembers(); invalidateSimulation()
            }
        }
        binding.sharing.partials.setOnCheckedChangeListener { _, checked ->
            if (!rendering) {
                model.partial = if (checked == R.id.fullBoxes) PartialMode.FULL_BOXES else PartialMode.PROPORTIONAL
                invalidateSimulation()
            }
        }
        binding.sharing.add.setOnClickListener {
            if (model.members.size >= 20) { message("Máximo 20 participantes."); return@setOnClickListener }
            val next = minOf(-1L, (model.members.minOfOrNull { it.id } ?: 0L) - 1L)
            model.members.add(MemberDraft(next, "Participante ${model.members.size + 1}", "0.00", "0.00", false))
            adapter.notifyItemInserted(model.members.lastIndex)
            if (model.members.size == 2) adapter.notifyItemChanged(0)
            validatePlan(); invalidateSimulation()
        }
        binding.sharing.savePlan.setOnClickListener { savePlan() }
        binding.sharing.sold.setText(model.sold)
        binding.sharing.sold.doAfterTextChanged { model.sold = it.toString(); invalidateSimulation() }
        binding.sharing.simulate.setOnClickListener { simulate() }
        binding.sharing.history.setOnClickListener { showHistory(0) }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { model.snapshot.collect { it?.let(::render) } }
                launch { model.error.collect { error ->
                    binding.loading.isVisible = error != null || model.snapshot.value == null
                    binding.progress.isVisible = error == null
                    binding.retry.isVisible = error != null
                    binding.loadMessage.text = error ?: getString(R.string.loading)
                } }
                launch { model.messages.collect { message(it) } }
                launch { model.saving.collect { saving ->
                    binding.business.saveConfig.isEnabled = !saving
                    binding.sharing.savePlan.isEnabled = !saving
                } }
                launch {
                    (application as DonasApp).themePreferences.theme.collect { mode ->
                        rendering = true
                        binding.business.themes.check(when (mode) { 1 -> R.id.lightTheme; 2 -> R.id.darkTheme; else -> R.id.systemTheme })
                        rendering = false
                        if (AppCompatDelegate.getDefaultNightMode() != mode) AppCompatDelegate.setDefaultNightMode(mode)
                    }
                }
            }
        }
    }

    private fun showPage() {
        binding.home.root.isVisible = model.page == 0
        binding.business.root.isVisible = model.page == 1
        binding.sharing.root.isVisible = model.page == 2
        binding.scroll.scrollTo(0, 0)
    }

    private fun render(snapshot: BusinessSnapshot) {
        rendering = true
        binding.loading.isVisible = false
        val c = snapshot.config
        val income = Math.multiplyExact(c.donutPriceCents, c.donutsPerBox.toLong())
        binding.home.margin.text = Money.format(income - c.boxCostCents)
        binding.home.economy.text = listOf(
            "${c.donutsPerBox} donas · ${Money.format(c.donutPriceCents)} cada una",
            "Costo ${Money.format(c.boxCostCents)} · Ingreso ${Money.format(income)}"
        ).joinToString("\n")
        binding.home.planSummary.text = describePlan(ShareMode.valueOf(snapshot.plan.mode), snapshot.members)
        binding.business.configVersion.text = getString(R.string.config_version, c.id)
        if (shownConfig != c.id) {
            binding.business.cost.setText(model.cost)
            binding.business.units.setText(model.units)
            binding.business.price.setText(model.price)
            shownConfig = c.id
            invalidateSimulation()
        }
        binding.sharing.planVersion.text = getString(R.string.plan_version, snapshot.plan.id, DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(snapshot.plan.createdAt)))
        if (shownPlan != snapshot.plan.id) {
            binding.sharing.modes.check(if (model.mode == ShareMode.FIXED) R.id.fixed else R.id.percentage)
            binding.sharing.partials.check(if (model.partial == PartialMode.FULL_BOXES) R.id.fullBoxes else R.id.proportional)
            shownPlan = snapshot.plan.id
            refreshMembers()
        }
        binding.sharing.result.text = model.simulationResult
        rendering = false
        previewConfig()
        showPage()
    }

    @android.annotation.SuppressLint("NotifyDataSetChanged") // Small, bounded configuration list; mode changes every editor.
    private fun refreshMembers() {
        binding.sharing.partials.isVisible = model.mode == ShareMode.FIXED
        adapter.notifyDataSetChanged()
        validatePlan()
    }

    private fun configInputs(): Triple<Long, Int, Long> {
        val cost = Money.parse(model.cost)
        val units = model.units.toIntOrNull() ?: error("Escribe las donas por caja.")
        val price = Money.parse(model.price)
        require(units in 1..10000 && price in 1..100_000_000L && cost <= 100_000_000) { "Usa de 1 a 10,000 donas y precios entre $0.01 y $1,000,000. El costo puede ser cero." }
        return Triple(cost, units, price)
    }

    private fun previewConfig() {
        binding.business.preview.text = try {
            val (cost, units, price) = configInputs()
            val income = Math.multiplyExact(price, units.toLong())
            "Ingreso por caja: ${Money.format(income)}\nGanancia bruta estimada: ${Money.format(income - cost)}"
        } catch (e: IllegalArgumentException) { e.message } catch (e: IllegalStateException) { e.message }
    }

    private fun saveConfig() = attempt {
        val (cost, units, price) = configInputs()
        val s = model.snapshot.value ?: return@attempt
        val warning = price * units < cost || (s.plan.mode == ShareMode.FIXED.name && ProfitCalculator.fixedExceedsEstimatedProfit(cost, price, units, s.members))
        val save = { model.perform("Configuración guardada.") { model.repository.saveConfig(cost, units, price) } }
        if (warning) MaterialAlertDialogBuilder(this).setTitle("Revisa la ganancia estimada")
            .setMessage("El costo o los pagos fijos superan la ganancia estimada. El receptor del remanente puede quedar con un importe negativo.")
            .setNegativeButton("Revisar", null).setPositiveButton("Guardar igualmente") { _, _ -> save() }.show()
        else save()
    }

    private fun validatePlan() {
        binding.sharing.validation.text = try {
            val rules = model.rules()
            ProfitCalculator.validate(model.mode, rules)
            if (model.mode == ShareMode.PERCENTAGE) "Total: 100.00% · Reparto válido"
            else {
                val c = model.snapshot.value?.config
                if (c != null && ProfitCalculator.fixedExceedsEstimatedProfit(c.boxCostCents, c.donutPriceCents, c.donutsPerBox, rules))
                    "Atención: los montos fijos superan la ganancia bruta estimada por caja."
                else "El importe restante corresponde a ${rules.first { it.remainder }.name}."
            }
        } catch (e: IllegalArgumentException) { e.message } catch (e: ArithmeticException) { "Importe demasiado grande." }
    }

    private fun savePlan() = attempt {
        val rules = model.rules()
        val mode = model.mode
        val partial = model.partial
        ProfitCalculator.validate(mode, rules)
        val c = model.snapshot.value?.config ?: return@attempt
        val key = UUID.randomUUID().toString()
        val save = { model.perform("Nuevo reparto guardado. Las versiones anteriores se conservan.") { model.repository.savePlan(mode, partial, rules, key) } }
        if (mode == ShareMode.FIXED && ProfitCalculator.fixedExceedsEstimatedProfit(c.boxCostCents, c.donutPriceCents, c.donutsPerBox, rules))
            MaterialAlertDialogBuilder(this).setTitle("El reparto supera la ganancia")
                .setMessage("Los montos fijos exceden la ganancia bruta estimada por caja. El remanente puede ser negativo. ¿Guardar estas reglas?")
                .setNegativeButton("Revisar", null).setPositiveButton("Guardar igualmente") { _, _ -> save() }.show()
        else save()
    }

    private fun invalidateSimulation() { model.simulationResult = ""; binding.sharing.result.text = "" }

    private fun simulate() = attempt {
        val c = model.snapshot.value?.config ?: return@attempt
        val quantity = model.sold.toLongOrNull() ?: error("Escribe una cantidad de donas.")
        require(quantity in 0..1_000_000) { "Prueba con 0 a 1,000,000 donas." }
        val income = Math.multiplyExact(quantity, c.donutPriceCents)
        val cost = Math.addExact(Math.multiplyExact(quantity / c.donutsPerBox, c.boxCostCents), ProfitCalculator.consumedCost(c.boxCostCents, c.donutsPerBox.toLong(), quantity % c.donutsPerBox))
        val profit = income - cost
        val amounts = ProfitCalculator.allocate(profit, quantity, c.donutsPerBox, model.mode, model.partial, model.rules())
        model.simulationResult = "EJEMPLO · Precios guardados #${c.id}\nIngreso: ${Money.format(income)}\nCosto estimado: ${Money.format(cost)}\nGanancia bruta: ${Money.format(profit)}\n\n" + amounts.joinToString("\n") { "${it.name}: ${Money.format(it.cents)}" } + "\n\nSin gastos ni pérdidas. Se calcula sobre el total acumulado, nunca redondeando cada venta por separado."
        binding.sharing.result.text = model.simulationResult
    }

    private fun describePlan(mode: ShareMode, rules: List<ShareRule>) = rules.joinToString("\n") {
        val amount = if (mode == ShareMode.PERCENTAGE) "${Money.input(it.basisPoints.toLong())}%" else if (it.remainder) "remanente" else "${Money.format(it.fixedCents)} / caja"
        getString(R.string.split_line, it.name, amount)
    }

    private fun showHistory(offset: Int) {
        lifecycleScope.launch {
            try {
                val rows = model.repository.planHistory(offset)
                val text = rows.joinToString("\n\n") { (plan, rules) ->
                    "Plan #${plan.id} · ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(plan.createdAt))}\n" + describePlan(ShareMode.valueOf(plan.mode), rules) +
                        if (plan.mode == ShareMode.FIXED.name) "\n" + getString(if (plan.partialMode == PartialMode.FULL_BOXES.name) R.string.full_boxes else R.string.proportional) else ""
                }.ifEmpty { "No hay más versiones." }
                val dialog = MaterialAlertDialogBuilder(this@MainActivity).setTitle("Versiones · página ${offset / 20 + 1}")
                    .setMessage(text).setPositiveButton("Cerrar", null)
                if (rows.size == 20) dialog.setNeutralButton("Anteriores") { _, _ -> showHistory(offset + 20) }
                if (offset > 0) dialog.setNegativeButton("Más recientes") { _, _ -> showHistory(maxOf(0, offset - 20)) }
                dialog.show()
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                message("No se pudo consultar el historial.")
            }
        }
    }

    private inline fun attempt(action: () -> Unit) {
        try { action() } catch (e: IllegalArgumentException) { message(e.message ?: "Revisa los valores.") }
        catch (e: IllegalStateException) { message(e.message ?: "Revisa los valores.") }
        catch (e: ArithmeticException) { message("El importe es demasiado grande.") }
    }
    private fun message(text: String) { Snackbar.make(binding.root, text, Snackbar.LENGTH_LONG).setAnchorView(binding.navigation).show() }
}
