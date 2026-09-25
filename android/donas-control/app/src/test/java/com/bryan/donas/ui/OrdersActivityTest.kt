package com.bryan.donas.ui

import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.WorkManager
import com.bryan.donas.DonasApp
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class OrdersActivityTest {
    @Test fun ordersScreenStaysOpenAndExplainsWhenNoSessionExists() {
        val app = ApplicationProvider.getApplicationContext<DonasApp>()
        app.backendClient.logout()
        WorkManager.initialize(app, Configuration.Builder().build())
        val controller = Robolectric.buildActivity(OrdersActivity::class.java).setup().visible()
        val activity = controller.get()
        assertTrue(!activity.isFinishing)
        val labels = mutableListOf<String>()
        fun collect(view: android.view.View) {
            if (view is TextView) labels.add(view.text.toString())
            if (view is android.view.ViewGroup) (0 until view.childCount).forEach { collect(view.getChildAt(it)) }
        }
        collect(activity.findViewById(android.R.id.content))
        assertTrue(labels.toString(), labels.any { it.contains("Inicia sesión para consultar pedidos") })
        assertTrue(labels.toString(), labels.any { it.contains("Volver") })
        controller.pause().stop().destroy()
    }
}
