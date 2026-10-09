package com.bryan.donas.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CustomerQrTest {
    @Test fun acceptsTheCurrentProfileQrAndPlainId() {
        assertEquals("C1234", CustomerQr.customerId("https://donas-racha.vercel.app/?profile=1&id=C1234"))
        assertEquals("C1234", CustomerQr.customerId(" c1234 "))
        assertEquals("C1234", CustomerQr.customerId("https://donas-racha.vercel.app/?id=C1234&profile=1"))
    }

    @Test fun rejectsForeignOrMalformedCodes() {
        assertNull(CustomerQr.customerId("https://example.org/?profile=1&id=C1234"))
        assertNull(CustomerQr.customerId("http://donas-racha.vercel.app/?profile=1&id=C1234"))
        assertNull(CustomerQr.customerId("https://donas-racha.vercel.app/other?profile=1&id=C1234"))
        assertNull(CustomerQr.customerId("https://donas-racha.vercel.app/?id=C1234"))
        assertNull(CustomerQr.customerId("C1"))
        assertNull(CustomerQr.customerId(null))
    }

    @Test fun acceptsOfficialDomainWithoutAcceptingLookalikesOrCredentials() {
        assertEquals("C1234", CustomerQr.customerId("https://dracha.store/?profile=1&id=C1234"))
        assertEquals("C1234", CustomerQr.customerId("https://www.dracha.store/?profile=1&id=C1234"))
        assertNull(CustomerQr.customerId("https://dracha.store.evil.example/?profile=1&id=C1234"))
        assertNull(CustomerQr.customerId("https://user@dracha.store/?profile=1&id=C1234"))
    }
}
