package com.bryan.donas.data

/** The four sale quantities travel together: a payment never records an unnamed donut. */
class FlavorBasket private constructor(private val counts: IntArray) {
    companion object {
        val skus = listOf(
            "DR-CHOCOLATE",
            "DR-VAINILLA",
            "DR-CHOCOLATE-CHISPAS",
            "DR-VAINILLA-CHISPAS",
        )
        val names = listOf("Chocolate", "Vainilla", "Chocolate con chispas", "Vainilla con chispas")
        const val MAX_TOTAL = 99

        fun empty() = FlavorBasket(IntArray(skus.size))

        fun from(values: IntArray): FlavorBasket {
            require(values.size == skus.size && values.all { it in 0..MAX_TOTAL } && values.sum() <= MAX_TOTAL)
            return FlavorBasket(values.copyOf())
        }
    }

    val total: Int get() = counts.sum()
    fun count(index: Int): Int = counts[index]
    fun values(): IntArray = counts.copyOf()

    fun change(index: Int, delta: Int): FlavorBasket {
        require(index in skus.indices && delta in -1..1 && delta != 0)
        val next = counts.copyOf()
        if (delta > 0 && total == MAX_TOTAL) return this
        next[index] = (next[index] + delta).coerceIn(0, MAX_TOTAL)
        return from(next)
    }

    fun items(): Map<String, Int> = skus.indices.mapNotNull { index ->
        count(index).takeIf { it > 0 }?.let { skus[index] to it }
    }.toMap()
}
