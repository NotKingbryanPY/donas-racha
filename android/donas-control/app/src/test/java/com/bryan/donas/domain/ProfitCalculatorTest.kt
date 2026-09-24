package com.bryan.donas.domain

import com.bryan.donas.util.Money
import org.junit.Assert.*
import org.junit.Test

class ProfitCalculatorTest {
    private fun member(id: Long, points: Int = 0, fixed: Long = 0, remainder: Boolean = false) = ShareRule(id, "Socio $id", points, fixed, remainder)
    private fun percentage(profit: Long, vararg points: Int) = ProfitCalculator.allocate(profit, 12, 12, ShareMode.PERCENTAGE, PartialMode.PROPORTIONAL, points.mapIndexed { index, point -> member(index.toLong(), point) }).map { it.cents }
    private fun fixed(profit: Long, sold: Long, cents: Long, partial: PartialMode = PartialMode.PROPORTIONAL) = ProfitCalculator.allocate(profit, sold, 12, ShareMode.FIXED, partial, listOf(member(1, remainder = true), member(2, fixed = cents))).map { it.cents }

    @Test fun defaultsSplitSixDollarsEqually() { assertEquals(listOf(300L, 300L), percentage(600, 5000, 5000)) }
    @Test fun supportsSixtyForty() { assertEquals(listOf(360L, 240L), percentage(600, 6000, 4000)) }
    @Test fun supportsSeventyThirty() { assertEquals(listOf(420L, 180L), percentage(600, 7000, 3000)) }
    @Test fun supportsOnlyOwner() { assertEquals(listOf(600L, 0L), percentage(600, 10000, 0)) }
    @Test fun oddCentHasStableRecipient() { assertEquals(listOf(51L, 50L), percentage(101, 5000, 5000)) }
    @Test fun largestRemainderThreePartners() { assertEquals(listOf(1L, 0L, 1L), percentage(2, 3333, 3333, 3334)) }
    @Test fun lossesAlsoBalanceExactly() { assertEquals(listOf(-51L, -50L), percentage(-101, 5000, 5000)) }
    @Test fun zeroProfit() { assertEquals(listOf(0L, 0L), percentage(0, 5000, 5000)) }
    @Test fun fullLongRangeDoesNotOverflowIntermediateArithmetic() {
        assertEquals(Long.MAX_VALUE, percentage(Long.MAX_VALUE, 5000, 5000).reduce(Math::addExact))
        assertEquals(Long.MIN_VALUE, percentage(Long.MIN_VALUE, 5000, 5000).reduce(Math::addExact))
    }
    @Test fun invalidPercentageTotalFails() { assertThrows(IllegalArgumentException::class.java) { percentage(600, 5000, 4000) } }
    @Test fun duplicatePartnersFail() { assertThrows(IllegalArgumentException::class.java) { ProfitCalculator.validate(ShareMode.PERCENTAGE, listOf(member(1, 5000), member(1, 5000))) } }
    @Test fun negativePercentageFails() { assertThrows(IllegalArgumentException::class.java) { percentage(600, -1, 10001) } }
    @Test fun twoFifteenPerBox() { assertEquals(listOf(385L, 215L), fixed(600, 12, 215)) }
    @Test fun halfBoxPaysOneTwenty() { assertEquals(listOf(180L, 120L), fixed(300, 6, 240)) }
    @Test fun fixedFractionGoesToRemainder() { assertEquals(listOf(193L, 107L), fixed(300, 6, 215)) }
    @Test fun cumulativeFractionsRecoverEveryCent() {
        val increments = (1L..12).map { sold -> fixed(sold * 50, sold, 215)[1] - fixed((sold - 1) * 50, sold - 1, 215)[1] }
        assertEquals(215L, increments.sum())
        assertTrue(increments.all { it == 17L || it == 18L })
    }
    @Test fun completeBoxesIgnorePartialBox() { assertEquals(listOf(300L, 0L), fixed(300, 6, 240, PartialMode.FULL_BOXES)) }
    @Test fun completeBoxesPayOnceForEighteen() { assertEquals(listOf(660L, 240L), fixed(900, 18, 240, PartialMode.FULL_BOXES)) }
    @Test fun fixedCanCreateNegativeRemainder() { assertEquals(listOf(-100L, 700L), fixed(600, 12, 700)) }
    @Test fun multipleFixedPartners() {
        val rules = listOf(member(1, remainder = true), member(2, fixed = 215), member(3, fixed = 100))
        assertEquals(listOf(143L, 107L, 50L), ProfitCalculator.allocate(300, 6, 12, ShareMode.FIXED, PartialMode.PROPORTIONAL, rules).map { it.cents })
    }
    @Test fun fixedRequiresExactlyOneRemainder() {
        assertThrows(IllegalArgumentException::class.java) { ProfitCalculator.validate(ShareMode.FIXED, listOf(member(1))) }
        assertThrows(IllegalArgumentException::class.java) { ProfitCalculator.validate(ShareMode.FIXED, listOf(member(1, remainder = true), member(2, remainder = true))) }
    }
    @Test fun warnsOnlyAboveEstimatedProfit() {
        assertFalse(ProfitCalculator.fixedExceedsEstimatedProfit(600, 100, 12, listOf(member(1, fixed = 600))))
        assertTrue(ProfitCalculator.fixedExceedsEstimatedProfit(600, 100, 12, listOf(member(1, fixed = 601))))
    }
    @Test fun impossibleOutputDoesNotWrap() { assertThrows(ArithmeticException::class.java) { fixed(Long.MIN_VALUE, 12, 1) } }
    @Test fun fifoConsumesEveryCent() {
        var remaining = 601L
        val costs = (12L downTo 1L).map { units -> ProfitCalculator.consumedCost(remaining, units, 1).also { remaining -= it } }
        assertEquals(601L, costs.sum())
        assertEquals(0L, remaining)
    }
    @Test fun fifoRejectsOverConsumption() { assertThrows(IllegalArgumentException::class.java) { ProfitCalculator.consumedCost(600, 12, 13) } }
    @Test fun percentPropertyAllCentTotalsConserved() {
        for (profit in -101L..1001L) for (points in listOf(0, 1, 3333, 5000, 7000, 9999, 10000)) {
            assertEquals(profit, percentage(profit, points, 10000 - points).sum())
        }
    }
    @Test fun moneyUsesExactDecimals() {
        assertEquals(215L, Money.parse("2.15")); assertEquals(215L, Money.parse("2,15"))
        assertEquals(200L, Money.parse("2")); assertEquals(210L, Money.parse("2.1"))
        assertEquals("$2.15", Money.format(215)); assertEquals("−$2.15", Money.format(-215))
    }
    @Test fun moneyRejectsRoundingAndAmbiguity() {
        listOf("2.155", "1,000.00", "1e3", "-2", "NaN", "", " ").forEach { input ->
            assertThrows(IllegalArgumentException::class.java) { Money.parse(input) }
        }
    }
    @Test fun formatsMinimumLongSafely() { assertEquals("-92233720368547758.08", Money.input(Long.MIN_VALUE)) }
}
