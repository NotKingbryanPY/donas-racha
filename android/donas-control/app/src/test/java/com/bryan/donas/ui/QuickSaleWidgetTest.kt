package com.bryan.donas.ui

import android.appwidget.AppWidgetManager
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.DonasApp
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class QuickSaleWidgetTest {
    private val context get() = ApplicationProvider.getApplicationContext<DonasApp>()

    @Test fun eachWidgetKeepsItsOwnBoundedQuantity() {
        QuickSaleUi.clearQuantities(context, intArrayOf(31, 32))
        assertEquals(1, QuickSaleUi.quantity(context, 31))
        assertEquals(4, QuickSaleUi.changeQuantity(context, 31, 3))
        assertEquals(1, QuickSaleUi.quantity(context, 32))
        assertEquals(1, QuickSaleUi.changeQuantity(context, 31, -100))
        assertEquals(99, QuickSaleUi.changeQuantity(context, 31, 200))
        QuickSaleUi.clearQuantities(context, intArrayOf(31, 32))
        assertEquals(1, QuickSaleUi.quantity(context, 31))
    }

    @Test fun plusAndMinusReceiverOnlyChangeTheSelectedWidget() {
        QuickSaleUi.clearQuantities(context, intArrayOf(41, 42))
        val receiver = QuickSaleReceiver()
        val plus = Intent(context, QuickSaleReceiver::class.java)
            .setAction(QuickSaleUi.INCREASE).putExtra(QuickSaleUi.EXTRA_WIDGET_ID, 41)
        repeat(3) { receiver.onReceive(context, plus) }
        assertEquals(4, QuickSaleUi.quantity(context, 41))
        assertEquals(1, QuickSaleUi.quantity(context, 42))
        receiver.onReceive(context, Intent(context, QuickSaleReceiver::class.java)
            .setAction(QuickSaleUi.DECREASE).putExtra(QuickSaleUi.EXTRA_WIDGET_ID, 41))
        assertEquals(3, QuickSaleUi.quantity(context, 41))
        assertEquals(1, QuickSaleUi.quantity(context, AppWidgetManager.INVALID_APPWIDGET_ID))
    }
}
