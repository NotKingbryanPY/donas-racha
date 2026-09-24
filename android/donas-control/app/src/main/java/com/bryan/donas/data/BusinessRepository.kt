package com.bryan.donas.data

import androidx.room.withTransaction
import com.bryan.donas.data.db.*
import com.bryan.donas.domain.*
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.map

data class BusinessSnapshot(val config: BusinessConfigEntity, val plan: ProfitSharePlanEntity, val members: List<ShareRule>, val accounts: List<AccountEntity>)

class BusinessRepository(private val db: AppDatabase) {
    private val dao = db.businessDao()
    val snapshots = dao.observeState().filterNotNull().map { snapshot() }

    suspend fun initialize() = db.withTransaction {
        if (dao.state() == null) {
            val now = System.currentTimeMillis()
            val config = dao.insertConfig(BusinessConfigEntity(boxCostCents = 600, donutsPerBox = 12, donutPriceCents = 100, createdAt = now))
            val owner = dao.insertPartner(PartnerEntity(name = "Yo", createdAt = now))
            val partner = dao.insertPartner(PartnerEntity(name = "Socio", createdAt = now))
            val plan = dao.insertPlan(ProfitSharePlanEntity(mode = ShareMode.PERCENTAGE.name, partialMode = PartialMode.PROPORTIONAL.name, createdAt = now, requestKey = "initial-plan"))
            dao.insertMembers(listOf(
                ProfitShareMemberEntity(plan, owner, "Yo", 5000, 0, true, 0),
                ProfitShareMemberEntity(plan, partner, "Socio", 5000, 215, false, 1)
            ))
            dao.insertCategories(listOf("Transporte", "Comida", "Universidad", "Entretenimiento", "Donas", "Publicidad", "Materiales", "Otro").map { ExpenseCategoryEntity(name = it) })
            dao.insertState(AppStateEntity(configId = config, planId = plan))
        }
        listOf("CASH" to "Efectivo", "YAPPY" to "Yappy", "INVENTORY" to "Inventario", "SALES" to "Ventas", "COGS" to "Costo vendido", "BUSINESS_EXPENSE" to "Gastos negocio", "PERSONAL" to "Gastos personales", "DEBT" to "Deudas", "EQUITY" to "Capital", "PARTNER" to "Socios").forEach { (code, name) ->
            if (dao.account(code) == null) dao.insertAccount(AccountEntity(code = code, name = name))
        }
    }

    suspend fun snapshot(): BusinessSnapshot = db.withTransaction {
        val state = requireNotNull(dao.state())
        BusinessSnapshot(dao.config(state.configId), dao.plan(state.planId), rules(state.planId), dao.accounts())
    }

    private suspend fun rules(id: Long) = dao.members(id).map { ShareRule(it.partnerId, it.nameSnapshot, it.basisPoints, it.fixedCents, it.remainder) }

    suspend fun saveConfig(cost: Long, perBox: Int, price: Long) = db.withTransaction {
        require(cost in 0..100_000_000L && price in 1..100_000_000L && perBox in 1..10000) { "Revisa los importes (máximo $1,000,000) y las donas por caja (1–10,000)." }
        val state = requireNotNull(dao.state())
        val current = dao.config(state.configId)
        if (current.boxCostCents == cost && current.donutsPerBox == perBox && current.donutPriceCents == price) return@withTransaction
        val id = dao.insertConfig(BusinessConfigEntity(boxCostCents = cost, donutsPerBox = perBox, donutPriceCents = price, createdAt = System.currentTimeMillis()))
        dao.updateState(state.copy(configId = id))
    }

    suspend fun savePlan(mode: ShareMode, partial: PartialMode, members: List<ShareRule>, requestKey: String) = db.withTransaction {
        require(requestKey.isNotBlank())
        ProfitCalculator.validate(mode, members)
        require(members.size <= 20) { "Se admiten hasta 20 participantes." }
        require(members.all { it.name.trim().length in 1..40 && it.fixedCents <= 100_000_000 }) { "Nombre: 1–40 caracteres. Importe máximo: $1,000,000." }
        require(members.map { it.name.trim().lowercase(java.util.Locale.ROOT) }.distinct().size == members.size) { "Los nombres de los participantes deben ser distintos." }
        // An external retry does not create another plan or overwrite a newer plan.
        if (dao.planByKey(requestKey) != null) return@withTransaction
        val now = System.currentTimeMillis()
        val state = requireNotNull(dao.state())
        val existingIds = dao.partners().map { it.id }.toSet()
        val resolved = members.map {
            if (it.partnerId < 0) it.copy(partnerId = dao.insertPartner(PartnerEntity(name = it.name.trim(), createdAt = now)))
            else { require(it.partnerId in existingIds) { "Socio inexistente." }; it }
        }
        val id = dao.insertPlan(ProfitSharePlanEntity(mode = mode.name, partialMode = partial.name, createdAt = now, requestKey = requestKey))
        dao.insertMembers(resolved.mapIndexed { index, it -> ProfitShareMemberEntity(id, it.partnerId, it.name.trim(), it.basisPoints, it.fixedCents, it.remainder, index) })
        dao.updateState(state.copy(planId = id))
    }

    suspend fun planHistory(offset: Int): List<Pair<ProfitSharePlanEntity, List<ShareRule>>> = db.withTransaction {
        dao.plans(20, offset).map { it to rules(it.id) }
    }
}
