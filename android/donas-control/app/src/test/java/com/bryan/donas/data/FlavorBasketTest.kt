package com.bryan.donas.data

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class FlavorBasketTest {
    @Test fun mixedSaleCarriesEveryFlavorAndClampsTheTotal() {
        val basket = FlavorBasket.empty().change(0, 1).change(0, 1).change(3, 1)
        assertEquals(3, basket.total)
        assertEquals(mapOf("DR-CHOCOLATE" to 2, "DR-VAINILLA-CHISPAS" to 1), basket.items())
        assertEquals(2, basket.change(0, -1).total)
        assertArrayEquals(intArrayOf(2, 0, 0, 1), basket.values())

        var full = FlavorBasket.empty()
        repeat(105) { full = full.change(1, 1) }
        assertEquals(99, full.total)
        assertEquals(99, full.count(1))
        assertEquals(0, full.change(0, 1).count(0))
        assertEquals(0, FlavorBasket.empty().change(0, -1).total)
    }

    @Test fun rejectsInvalidStoredOrRequestedQuantities() {
        assertThrows(IllegalArgumentException::class.java) { FlavorBasket.from(intArrayOf(1, 2)) }
        assertThrows(IllegalArgumentException::class.java) { FlavorBasket.from(intArrayOf(50, 50, 0, 0)) }
        assertThrows(IllegalArgumentException::class.java) { FlavorBasket.empty().change(4, 1) }
    }
}
