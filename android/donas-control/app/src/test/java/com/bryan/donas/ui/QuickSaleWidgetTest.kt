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

    @Test fun eachWidgetKeepsItsOwnFlavorSelection() {
        QuickSaleUi.clearQuantities(context, intArrayOf(31, 32))
        assertEquals(0, QuickSaleUi.basket(context, 31).total)
        repeat(3) { QuickSaleUi.changeFlavor(context, 31, 0, 1) }
        QuickSaleUi.changeFlavor(context, 31, 2, 1)
        assertEquals(4, QuickSaleUi.basket(context, 31).total)
        assertEquals(3, QuickSaleUi.basket(context, 31).count(0))
        assertEquals(1, QuickSaleUi.basket(context, 31).count(2))
        assertEquals(0, QuickSaleUi.basket(context, 32).total)
        QuickSaleUi.clearQuantities(context, intArrayOf(31, 32))
        assertEquals(0, QuickSaleUi.basket(context, 31).total)
    }

    @Test fun plusAndMinusReceiverOnlyChangeTheSelectedWidget() {
        QuickSaleUi.clearQuantities(context, intArrayOf(41, 42))
        val receiver = QuickSaleReceiver()
        val plus = Intent(context, QuickSaleReceiver::class.java)
            .setAction(QuickSaleUi.ADD_FLAVOR).putExtra(QuickSaleUi.EXTRA_WIDGET_ID, 41)
            .putExtra(QuickSaleUi.EXTRA_FLAVOR_INDEX, 1)
        repeat(3) { receiver.onReceive(context, plus) }
        assertEquals(3, QuickSaleUi.basket(context, 41).count(1))
        assertEquals(0, QuickSaleUi.basket(context, 42).total)
        receiver.onReceive(context, Intent(context, QuickSaleReceiver::class.java)
            .setAction(QuickSaleUi.REMOVE_FLAVOR).putExtra(QuickSaleUi.EXTRA_WIDGET_ID, 41)
            .putExtra(QuickSaleUi.EXTRA_FLAVOR_INDEX, 1))
        assertEquals(2, QuickSaleUi.basket(context, 41).count(1))
        assertEquals(0, QuickSaleUi.basket(context, AppWidgetManager.INVALID_APPWIDGET_ID).total)
    }
}
