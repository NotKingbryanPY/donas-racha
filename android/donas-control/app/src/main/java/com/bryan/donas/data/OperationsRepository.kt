package com.bryan.donas.data

import androidx.room.withTransaction
import com.bryan.donas.data.db.*
import com.bryan.donas.domain.*
import java.util.Calendar
import java.util.UUID
import org.json.JSONObject

data class PaymentSource(val accountCode: String, val cents: Long)
data class DashboardData(val cash: Long, val yappy: Long, val stock: Long, val inventoryValue: Long, val today: SalesAggregate, val businessExpenses: Long, val debt: Long, val partnerPending: Long, val activeSession: BusinessSessionEntity?)
data class StatisticsData(val today: SalesAggregate, val week: SalesAggregate, val month: SalesAggregate, val todayExpenses: Long)

class OperationsRepository(private val db: AppDatabase) {
    private val ops = db.operationDao()
    private val business = db.businessDao()

    private suspend fun account(code: String) = requireNotNull(business.account(code)) { "Cuenta $code no disponible." }
    private fun now() = System.currentTimeMillis()
    private fun key() = UUID.randomUUID().toString()

    private suspend fun event(type: String, title: String, amount: Long, accountCode: String?, sessionId: Long?, requestKey: String, reversed: Long? = null, details: JSONObject? = null): Long {
        require(requestKey.isNotBlank())
        val event = EventEntity(timestamp = now(), type = type, title = title, amountCents = amount, accountCode = accountCode, sessionId = sessionId, reversedEventId = reversed, requestKey = requestKey)
        val id = ops.insertEvent(event)
        db.syncDao().enqueue(EventSyncMapper.outbox(event.copy(id = id), details))
        return id
    }

    private suspend fun journal(eventId: Long, vararg lines: Triple<String, Long, String>) {
        require(lines.isNotEmpty())
        val total = lines.fold(0L) { sum, line -> Math.addExact(sum, line.second) }
        require(total == 0L) { "El asiento no está balanceado." }
        ops.insertEntries(lines.map { JournalEntryEntity(eventId = eventId, accountId = account(it.first).id, deltaCents = it.second, memo = it.third) })
    }

    suspend fun dashboard(): DashboardData = db.withTransaction {
        val balances = ops.balances().associate { it.code to it.cents }
        val calendar = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
        val start = calendar.timeInMillis
        DashboardData(balances["CASH"] ?: 0, balances["YAPPY"] ?: 0, ops.stock(), ops.inventoryValue(), ops.salesBetween(start, Math.addExact(start, 86_400_000L)), ops.businessExpenses(start, Math.addExact(start, 86_400_000L)), ops.debt(), ops.partnerPending(), ops.activeSession())
    }

    suspend fun statistics(): StatisticsData = db.withTransaction {
        val current = Calendar.getInstance()
        val today = (current.clone() as Calendar).apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        val week = (current.clone() as Calendar).apply { firstDayOfWeek = Calendar.MONDAY; set(Calendar.DAY_OF_WEEK, Calendar.MONDAY); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        val month = (current.clone() as Calendar).apply { set(Calendar.DAY_OF_MONTH, 1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        val end = Long.MAX_VALUE
        StatisticsData(ops.salesBetween(today, end), ops.salesBetween(week, end), ops.salesBetween(month, end), ops.businessExpenses(today, end))
    }

    suspend fun startSession(initialCash: Long = 0, initialYappy: Long = 0, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.sessionId?.let { return@withTransaction it }
        require(ops.activeSession() == null) { "Ya existe una jornada activa." }
        require(initialCash >= 0 && initialYappy >= 0)
        val state = requireNotNull(business.state())
        val id = ops.insertSession(BusinessSessionEntity(startedAt = now(), closedAt = null, initialStock = ops.stock(), physicalClosingStock = null, configId = state.configId, planId = state.planId))
        val event = event("SESSION_START", "Inicio de jornada", initialCash + initialYappy, null, id, requestKey)
        val lines = mutableListOf<Triple<String, Long, String>>()
        if (initialCash > 0) lines += Triple("CASH", initialCash, "Efectivo inicial")
        if (initialYappy > 0) lines += Triple("YAPPY", initialYappy, "Yappy inicial")
        if (initialCash + initialYappy > 0) lines += Triple("EQUITY", -(initialCash + initialYappy), "Capital inicial")
        if (lines.isNotEmpty()) journal(event, *lines.toTypedArray())
        id
    }

    suspend fun purchase(boxes: Int, sources: List<PaymentSource>, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        require(boxes in 1..10000) { "Cantidad de cajas inválida." }
        val state = requireNotNull(business.state())
        val config = business.config(state.configId)
        val total = Math.multiplyExact(boxes.toLong(), config.boxCostCents)
        require(sources.isNotEmpty() && sources.all { it.cents > 0 } && sources.fold(0L) { a, b -> Math.addExact(a, b.cents) } == total) { "Las fuentes deben coincidir exactamente con el total." }
        val balances = ops.balances().associate { it.code to it.cents }
        sources.groupBy { it.accountCode }.mapValues { (_, rows) -> rows.fold(0L) { sum, row -> Math.addExact(sum, row.cents) } }
            .filterKeys { it == "CASH" || it == "YAPPY" }
            .forEach { (code, required) -> require((balances[code] ?: 0) >= required) { "Saldo insuficiente en $code." } }
        val session = ops.activeSession()?.id
        val event = event("PURCHASE", "Compra de $boxes caja(s)", -total, null, session, requestKey)
        val purchase = ops.insertPurchase(PurchaseEntity(eventId = event, sessionId = session, boxes = boxes, donutsPerBox = config.donutsPerBox, boxCostCents = config.boxCostCents, totalCents = total, timestamp = now()))
        val resolved = sources.map { it to account(it.accountCode) }
        ops.insertPurchasePayments(resolved.map { PurchasePaymentEntity(purchaseId = purchase, accountId = it.second.id, amountCents = it.first.cents) })
        val quantity = Math.multiplyExact(boxes.toLong(), config.donutsPerBox.toLong())
        ops.insertLot(InventoryLotEntity(purchaseId = purchase, originalQuantity = quantity, remainingQuantity = quantity, originalCostCents = total, remainingCostCents = total, createdAt = now()))
        ops.insertMovement(InventoryMovementEntity(eventId = event, type = "PURCHASE", quantityDelta = quantity, costDeltaCents = total, timestamp = now()))
        journal(event, *listOf(Triple("INVENTORY", total, "Compra de inventario") ).plus(resolved.map { Triple(it.first.accountCode, -it.first.cents, "Pago de compra") }).toTypedArray())
        event
    }

    private suspend fun consume(quantity: Long): Pair<Long, List<Triple<InventoryLotEntity, Long, Long>>> {
        require(quantity > 0)
        var pending = quantity
        var totalCost = 0L
        val used = mutableListOf<Triple<InventoryLotEntity, Long, Long>>()
        for (lot in ops.availableLots()) {
            if (pending == 0L) break
            val take = minOf(pending, lot.remainingQuantity)
            val cost = ProfitCalculator.consumedCost(lot.remainingCostCents, lot.remainingQuantity, take)
            ops.updateLot(lot.copy(remainingQuantity = lot.remainingQuantity - take, remainingCostCents = lot.remainingCostCents - cost))
            used += Triple(lot, take, cost)
            pending -= take
            totalCost = Math.addExact(totalCost, cost)
        }
        require(pending == 0L) { "Inventario insuficiente." }
        return totalCost to used
    }

    suspend fun quickSale(accountCode: String, quantity: Long = 1, requestKey: String = key(), flavors: Map<String, Int> = emptyMap(), remoteOrderId: String? = null): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        require(accountCode == "CASH" || accountCode == "YAPPY")
        val session = requireNotNull(ops.activeSession()) { "Inicia una jornada antes de vender." }
        require(quantity in 1..10000)
        if (flavors.isNotEmpty()) {
            require(flavors.keys.all { it in setOf("DR-CHOCOLATE", "DR-VAINILLA", "DR-VAINILLA-CHISPAS", "DR-CHOCOLATE-CHISPAS") }) { "Sabor inválido." }
            require(flavors.values.all { it in 1..99 } && flavors.values.sum().toLong() == quantity) { "Las cantidades por sabor no coinciden." }
        }
        require(remoteOrderId == null || flavors.isEmpty())
        require(ops.stock() >= quantity) { "No hay suficientes donas." }
        val config = business.config(session.configId)
        val revenue = Math.multiplyExact(config.donutPriceCents, quantity)
        val (cost, used) = consume(quantity)
        val details = JSONObject().put("quantity", quantity).put("unitPriceCents", config.donutPriceCents).put("costCents", cost)
        if (flavors.isNotEmpty()) {
            val items = org.json.JSONArray()
            flavors.toSortedMap().forEach { (sku, count) -> items.put(JSONObject().put("sku", sku).put("quantity", count)) }
            details.put("items", items)
        }
        if (remoteOrderId != null) details.put("remoteOrderId", remoteOrderId)
        val event = event("SALE", "Venta · ${account(accountCode).name}", revenue, accountCode, session.id, requestKey,
            details = details)
        val sale = ops.insertSale(SaleEntity(eventId = event, sessionId = session.id, accountId = account(accountCode).id, quantity = quantity, unitPriceCents = config.donutPriceCents, revenueCents = revenue, costCents = cost, timestamp = now(), reversedAt = null))
        ops.insertAllocations(used.map { SaleLotAllocationEntity(sale, it.first.id, it.second, it.third) })
        ops.insertMovement(InventoryMovementEntity(eventId = event, type = "SALE", quantityDelta = -quantity, costDeltaCents = -cost, timestamp = now()))
        journal(event, Triple(accountCode, revenue, "Cobro de venta"), Triple("SALES", -revenue, "Ingreso de venta"), Triple("COGS", cost, "Costo vendido"), Triple("INVENTORY", -cost, "Salida FIFO"))
        event
    }

    suspend fun bookRemoteOrder(order: RemoteOrderEntity): Long {
        require(order.status == "COMPLETED" && order.settled && order.paymentStatus == "CONFIRMED")
        val requestKey = "order-${order.id}"
        ops.eventByKey(requestKey)?.let { return it.id }
        val items = org.json.JSONArray(order.itemsJson)
        val quantity = (0 until items.length()).sumOf { items.getJSONObject(it).getLong("quantity") }
        require(quantity in 1..10000) { "Cantidad de pedido inválida." }
        val state = requireNotNull(business.state())
        val config = business.config(state.configId)
        require(Math.multiplyExact(config.donutPriceCents, quantity) == order.totalCents) {
            "El precio local no coincide con el pedido; requiere conciliación."
        }
        if (ops.activeSession() == null) startSession(requestKey = "order-session-${order.id}")
        return quickSale(order.paymentMethod, quantity, requestKey, remoteOrderId = order.id)
    }

    suspend fun undoLastSale(requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        val sale = requireNotNull(ops.lastSale()) { "No hay una venta activa para deshacer." }
        val originalEvent = ops.event(sale.eventId)
        require(!originalEvent.requestKey.startsWith("order-")) {
            "Un pedido entregado requiere una devolución conciliada en el servidor."
        }
        val event = event("REVERSAL", "Reversión · ${originalEvent.title}", -sale.revenueCents, originalEvent.accountCode, sale.sessionId, requestKey, sale.eventId)
        ops.saleAllocations(sale.id).forEach { allocation ->
            val lot = ops.lot(allocation.lotId)
            ops.updateLot(lot.copy(remainingQuantity = Math.addExact(lot.remainingQuantity, allocation.quantity), remainingCostCents = Math.addExact(lot.remainingCostCents, allocation.costCents)))
        }
        ops.updateSale(sale.copy(reversedAt = now()))
        ops.insertMovement(InventoryMovementEntity(eventId = event, type = "REVERSAL", quantityDelta = sale.quantity, costDeltaCents = sale.costCents, timestamp = now()))
        val reversedLines = ops.entriesForEvent(sale.eventId).map { entry -> JournalEntryEntity(eventId = event, accountId = entry.accountId, deltaCents = Math.negateExact(entry.deltaCents), memo = "Reversión") }
        require(reversedLines.fold(0L) { sum, line -> Math.addExact(sum, line.deltaCents) } == 0L)
        ops.insertEntries(reversedLines)
        event
    }

    suspend fun transfer(from: String, to: String, amount: Long, fee: Long, description: String, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        require(from != to && amount > 0 && fee >= 0)
        val available = ops.balances().firstOrNull { it.code == from }?.cents ?: 0
        require(available >= Math.addExact(amount, fee)) { "Saldo insuficiente." }
        val event = event("TRANSFER", "Transferencia ${account(from).name} → ${account(to).name}", amount, from, ops.activeSession()?.id, requestKey)
        ops.insertTransfer(AccountTransferEntity(eventId = event, fromAccountId = account(from).id, toAccountId = account(to).id, amountCents = amount, feeCents = fee, description = description.take(120), timestamp = now()))
        val lines = mutableListOf(Triple(from, -Math.addExact(amount, fee), "Salida"), Triple(to, amount, "Entrada"))
        if (fee > 0) lines += Triple("BUSINESS_EXPENSE", fee, "Comisión")
        journal(event, *lines.toTypedArray())
        event
    }

    suspend fun expense(category: String, accountCode: String, amount: Long, businessExpense: Boolean, description: String, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        require(amount > 0)
        val available = ops.balances().firstOrNull { it.code == accountCode }?.cents ?: 0
        require(available >= amount) { "Saldo insuficiente." }
        val cat = requireNotNull(business.category(category))
        val session = ops.activeSession()?.id
        val event = event("EXPENSE", "$category · ${if (businessExpense) "Negocio" else "Personal"}", -amount, accountCode, session, requestKey)
        ops.insertExpense(ExpenseEntity(eventId = event, categoryId = cat.id, accountId = account(accountCode).id, amountCents = amount, business = businessExpense, description = description.take(120), timestamp = now(), sessionId = session))
        journal(event, Triple(if (businessExpense) "BUSINESS_EXPENSE" else "PERSONAL", amount, "Gasto"), Triple(accountCode, -amount, "Pago"))
        event
    }

    suspend fun receiveLoan(person: String, amount: Long, accountCode: String, description: String, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        require(person.trim().isNotEmpty() && amount > 0)
        val event = event("LOAN", "Préstamo · ${person.trim()}", amount, accountCode, ops.activeSession()?.id, requestKey)
        ops.insertLoan(LoanEntity(eventId = event, person = person.trim().take(50), originalCents = amount, paidCents = 0, receivedAccountId = account(accountCode).id, description = description.take(120), timestamp = now()))
        journal(event, Triple(accountCode, amount, "Préstamo recibido"), Triple("DEBT", -amount, "Deuda"))
        event
    }

    suspend fun payLoan(loanId: Long, amount: Long, accountCode: String, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        val loan = ops.loan(loanId)
        require(amount > 0 && amount <= loan.originalCents - loan.paidCents)
        require((ops.balances().firstOrNull { it.code == accountCode }?.cents ?: 0) >= amount) { "Saldo insuficiente." }
        val event = event("LOAN_PAYMENT", "Pago préstamo · ${loan.person}", -amount, accountCode, ops.activeSession()?.id, requestKey)
        ops.insertLoanPayment(LoanPaymentEntity(loanId = loanId, eventId = event, accountId = account(accountCode).id, amountCents = amount, timestamp = now()))
        ops.updateLoan(loan.copy(paidCents = Math.addExact(loan.paidCents, amount)))
        journal(event, Triple("DEBT", amount, "Reduce deuda"), Triple(accountCode, -amount, "Pago"))
        event
    }

    suspend fun closeSession(physicalStock: Long, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        val session = requireNotNull(ops.activeSession()) { "No hay jornada activa." }
        require(physicalStock >= 0)
        val expected = ops.stock()
        val difference = physicalStock - expected
        if (difference != 0L) adjustInventory(difference, if (difference < 0) "Pérdida al conciliar" else "Sobrante al conciliar", "close-adjust-${requestKey}")
        val sales = ops.salesForSession(session.id)
        val net = sales.revenue - sales.cost - ops.businessExpensesForSession(session.id)
        val plan = business.plan(session.planId)
        val rules = business.members(session.planId).map { ShareRule(it.partnerId, it.nameSnapshot, it.basisPoints, it.fixedCents, it.remainder) }
        val allocations = ProfitCalculator.allocate(net, sales.quantity, business.config(session.configId).donutsPerBox, ShareMode.valueOf(plan.mode), PartialMode.valueOf(plan.partialMode), rules)
        ops.insertProfitAllocations(allocations.map { ProfitAllocationEntity(sessionId = session.id, partnerId = it.partnerId, nameSnapshot = it.name, allocatedCents = it.cents, paidCents = 0) })
        ops.updateSession(session.copy(closedAt = now(), physicalClosingStock = physicalStock))
        event("SESSION_CLOSE", "Cierre de jornada", net, null, session.id, requestKey)
    }

    suspend fun adjustInventory(delta: Long, description: String, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        require(delta != 0L)
        val config = business.config(requireNotNull(business.state()).configId)
        val session = ops.activeSession()?.id
        val estimated = ProfitCalculator.consumedCost(config.boxCostCents, config.donutsPerBox.toLong(), kotlin.math.abs(delta % config.donutsPerBox)) + Math.multiplyExact(kotlin.math.abs(delta) / config.donutsPerBox, config.boxCostCents)
        val event = event("ADJUSTMENT", description.take(80), 0, null, session, requestKey)
        val cost: Long
        if (delta > 0) {
            cost = estimated
            ops.insertLot(InventoryLotEntity(purchaseId = null, originalQuantity = delta, remainingQuantity = delta, originalCostCents = cost, remainingCostCents = cost, createdAt = now()))
            journal(event, Triple("INVENTORY", cost, "Ajuste positivo"), Triple("EQUITY", -cost, "Contrapartida ajuste"))
        } else {
            require(ops.stock() >= -delta) { "El ajuste supera el inventario." }
            cost = consume(-delta).first
            journal(event, Triple("COGS", cost, "Pérdida de inventario"), Triple("INVENTORY", -cost, "Ajuste negativo"))
        }
        ops.insertMovement(InventoryMovementEntity(eventId = event, type = if (delta > 0) "ADJUSTMENT_IN" else "LOSS", quantityDelta = delta, costDeltaCents = if (delta > 0) cost else -cost, timestamp = now()))
        event
    }

    suspend fun payPartner(allocationId: Long, amount: Long, accountCode: String, requestKey: String = key()): Long = db.withTransaction {
        ops.eventByKey(requestKey)?.id?.let { return@withTransaction it }
        val allocation = ops.unpaidAllocations().firstOrNull { it.id == allocationId } ?: error("Asignación no disponible.")
        require(amount > 0 && amount <= allocation.allocatedCents - allocation.paidCents)
        require((ops.balances().firstOrNull { it.code == accountCode }?.cents ?: 0) >= amount) { "Saldo insuficiente." }
        val event = event("PARTNER_PAYMENT", "Pago socio · ${allocation.nameSnapshot}", -amount, accountCode, allocation.sessionId, requestKey)
        ops.insertPartnerPayment(PartnerPaymentEntity(allocationId = allocationId, eventId = event, accountId = account(accountCode).id, amountCents = amount, timestamp = now()))
        ops.updateProfitAllocation(allocation.copy(paidCents = allocation.paidCents + amount))
        journal(event, Triple("PARTNER", amount, "Pago de ganancia asignada"), Triple(accountCode, -amount, "Salida"))
        event
    }

    suspend fun history(type: String? = null, account: String? = null, offset: Int = 0) = ops.filteredEvents(type, account, 50, offset)
    suspend fun openLoans() = ops.openLoans()
    suspend fun unpaidAllocations() = ops.unpaidAllocations()

    suspend fun resetBusinessData() = db.withTransaction {
        require(db.syncDao().pendingCount() == 0 && db.syncDao().rejectedCount() == 0 &&
            db.syncDao().unqueuedEvents(1).isEmpty()) {
            "Concilia los movimientos pendientes o rechazados antes de borrar los datos del negocio."
        }
        ops.clearPartnerPayments(); ops.clearProfitAllocations(); ops.clearLoanPayments(); ops.clearLoans(); ops.clearTransfers(); ops.clearExpenses(); ops.clearSaleAllocations(); ops.clearSales(); ops.clearMovements(); ops.clearLots(); ops.clearPurchasePayments(); ops.clearPurchases(); ops.clearEntries(); ops.clearEvents(); ops.clearSessions()
    }

    suspend fun resetCurrentSession() = db.withTransaction {
        val session = requireNotNull(ops.activeSession()) { "No hay jornada activa." }
        val unsupported = ops.eventsForSession(session.id).filter { it.type !in setOf("SESSION_START", "SALE", "REVERSAL") }
        require(unsupported.isEmpty()) { "Esta jornada contiene compras, gastos u otros movimientos. Reviértelos individualmente o cierra la jornada para conservar el historial." }
        while (ops.activeSalesForSession(session.id).isNotEmpty()) undoLastSale("session-reset-${session.id}-${ops.activeSalesForSession(session.id).size}")
        closeSession(ops.stock(), "session-reset-close-${session.id}")
    }
}
