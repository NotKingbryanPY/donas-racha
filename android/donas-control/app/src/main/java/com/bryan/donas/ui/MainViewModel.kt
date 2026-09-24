package com.bryan.donas.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BusinessSnapshot
import com.bryan.donas.domain.*
import com.bryan.donas.util.Money
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

data class MemberDraft(val id: Long, var name: String, var percent: String, var fixed: String, var remainder: Boolean)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    val repository = (app as DonasApp).repository
    val snapshot = MutableStateFlow<BusinessSnapshot?>(null)
    val error = MutableStateFlow<String?>(null)
    val saving = MutableStateFlow(false)
    val messages = MutableSharedFlow<String>(extraBufferCapacity = 4)
    var page = 0
    var cost = ""
    var units = ""
    var price = ""
    var sold = "6"
    var simulationResult = ""
    var mode = ShareMode.PERCENTAGE
    var partial = PartialMode.PROPORTIONAL
    var members = mutableListOf<MemberDraft>()
    private var configVersion = 0L
    private var planVersion = 0L
    private var starting = false

    init { initialize() }

    fun initialize() {
        if (starting) return
        starting = true
        error.value = null
        viewModelScope.launch(Dispatchers.IO) {
            try {
                repository.initialize()
                repository.snapshots.collect { value ->
                    // Drafts are owned by the main thread along with the UI.
                    kotlinx.coroutines.withContext(Dispatchers.Main) {
                        if (value.config.id != configVersion) {
                            cost = Money.input(value.config.boxCostCents)
                            units = value.config.donutsPerBox.toString()
                            price = Money.input(value.config.donutPriceCents)
                            configVersion = value.config.id
                        }
                        if (value.plan.id != planVersion) {
                            mode = ShareMode.valueOf(value.plan.mode)
                            partial = PartialMode.valueOf(value.plan.partialMode)
                            members = value.members.map { MemberDraft(it.partnerId, it.name, Money.input(it.basisPoints.toLong()), Money.input(it.fixedCents), it.remainder) }.toMutableList()
                            planVersion = value.plan.id
                        }
                        snapshot.value = value
                    }
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                error.value = "No se pudo abrir la base de datos. Tus datos no se han borrado. ${e.localizedMessage.orEmpty()}"
                starting = false
            }
        }
    }

    fun rules(): List<ShareRule> = members.map {
        val points = if (mode == ShareMode.PERCENTAGE) Money.parse(it.percent) else 0L
        require(points in 0..10000) { "El porcentaje debe estar entre 0 y 100." }
        ShareRule(it.id, it.name.trim(), points.toInt(), if (mode == ShareMode.FIXED && !it.remainder) Money.parse(it.fixed) else 0, it.remainder)
    }

    fun perform(message: String, block: suspend () -> Unit) {
        if (saving.value) return
        saving.value = true
        viewModelScope.launch {
            try {
                kotlinx.coroutines.withContext(Dispatchers.IO) { block() }
                messages.emit(message)
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                messages.emit(e.localizedMessage ?: "No se pudo guardar. Inténtalo de nuevo.")
            } finally { saving.value = false }
        }
    }
}
