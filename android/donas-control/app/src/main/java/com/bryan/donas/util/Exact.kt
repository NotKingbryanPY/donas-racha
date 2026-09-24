package com.bryan.donas.util

import java.math.BigInteger

/** BigInteger.longValueExact is only available on Android 12; keep API 23 support. */
fun BigInteger.toLongChecked(): Long {
    if (this < Long.MIN_VALUE.toBigInteger() || this > Long.MAX_VALUE.toBigInteger())
        throw ArithmeticException("Importe fuera del rango de Long")
    return toLong()
}
