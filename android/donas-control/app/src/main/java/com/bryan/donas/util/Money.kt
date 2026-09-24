package com.bryan.donas.util

import java.math.BigInteger

object Money {
    // Accept decimal comma or decimal point; reject thousands separators and rounding.
    fun parse(text: String): Long {
        val value = text.trim().replace(',', '.')
        require(Regex("[0-9]{1,15}(\\.[0-9]{1,2})?").matches(value)) { "Usa un importe positivo con hasta 2 decimales." }
        val parts = value.split('.')
        return Math.addExact(Math.multiplyExact(parts[0].toLong(), 100L), parts.getOrElse(1) { "0" }.padEnd(2, '0').toLong())
    }
    fun input(cents: Long): String {
        val absolute = cents.toBigInteger().abs()
        val hundred = BigInteger.valueOf(100)
        return (if (cents < 0) "-" else "") + (absolute / hundred).toString() + "." + (absolute % hundred).toString().padStart(2, '0')
    }
    fun format(cents: Long) = (if (cents < 0) "−$" else "$") + input(cents).removePrefix("-")
}
