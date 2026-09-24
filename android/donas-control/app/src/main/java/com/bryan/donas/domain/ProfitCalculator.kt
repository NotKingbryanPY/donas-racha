package com.bryan.donas.domain

import java.math.BigInteger
import com.bryan.donas.util.toLongChecked

enum class ShareMode { PERCENTAGE, FIXED }
enum class PartialMode { PROPORTIONAL, FULL_BOXES }

data class ShareRule(val partnerId: Long, val name: String, val basisPoints: Int, val fixedCents: Long, val remainder: Boolean)
data class Allocation(val partnerId: Long, val name: String, val cents: Long)

/** Pure integer calculations. Stable tie breaking follows the saved member order. */
object ProfitCalculator {
    fun validate(mode: ShareMode, members: List<ShareRule>) {
        require(members.isNotEmpty()) { "Agrega al menos un participante." }
        require(members.map { it.partnerId }.distinct().size == members.size) { "Hay socios duplicados." }
        require(members.all { it.name.isNotBlank() && it.basisPoints in 0..10000 && it.fixedCents >= 0 }) { "Revisa los valores de los socios." }
        when (mode) {
            ShareMode.PERCENTAGE -> require(members.sumOf { it.basisPoints.toLong() } == 10000L) { "Los porcentajes deben sumar exactamente 100%." }
            ShareMode.FIXED -> require(members.count { it.remainder } == 1) { "Selecciona un único receptor del remanente." }
        }
    }

    fun allocate(profitCents: Long, sold: Long, perBox: Int, mode: ShareMode, partial: PartialMode, members: List<ShareRule>): List<Allocation> {
        validate(mode, members)
        require(sold >= 0 && perBox > 0) { "Cantidad de donas inválida." }
        val profit = profitCents.toBigInteger()
        val amounts = if (mode == ShareMode.PERCENTAGE) {
            // Largest remainder on absolute profit, then restore the sign for losses.
            val numerator = members.map { profit.abs() * it.basisPoints.toBigInteger() }
            val divisor = BigInteger.valueOf(10000)
            val base = numerator.map { it / divisor }.toMutableList()
            val missing = (profit.abs() - base.fold(BigInteger.ZERO, BigInteger::add)).toInt()
            val order = numerator.indices.sortedWith(compareByDescending<Int> { numerator[it] % divisor }.thenBy { it })
            repeat(missing) { base[order[it]] += BigInteger.ONE }
            base.map { if (profit.signum() < 0) -it else it }
        } else {
            val denominator = perBox.toBigInteger()
            val counts = sold.toBigInteger()
            val base = members.map {
                if (it.remainder) BigInteger.ZERO
                else if (partial == PartialMode.PROPORTIONAL) it.fixedCents.toBigInteger() * counts / denominator
                else it.fixedCents.toBigInteger() * (counts / denominator)
            }.toMutableList()
            val remainderIndex = members.indexOfFirst { it.remainder }
            base[remainderIndex] = profit - base.fold(BigInteger.ZERO, BigInteger::add)
            base
        }
        return members.mapIndexed { index, member -> Allocation(member.partnerId, member.name, amounts[index].toLongChecked()) }
    }

    fun fixedExceedsEstimatedProfit(cost: Long, price: Long, perBox: Int, members: List<ShareRule>): Boolean =
        members.filterNot { it.remainder }.fold(BigInteger.ZERO) { sum, member -> sum + member.fixedCents.toBigInteger() } >
            price.toBigInteger() * perBox.toBigInteger() - cost.toBigInteger()

    /** Allocate a remaining FIFO lot cost; the final unit consumes every remaining cent. */
    fun consumedCost(remainingCost: Long, remainingUnits: Long, consumed: Long): Long {
        require(remainingCost >= 0 && remainingUnits > 0 && consumed in 0..remainingUnits)
        return (remainingCost.toBigInteger() * consumed.toBigInteger() / remainingUnits.toBigInteger()).toLongChecked()
    }
}
