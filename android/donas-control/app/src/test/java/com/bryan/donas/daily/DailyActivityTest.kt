package com.bryan.donas.daily

import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], qualifiers = "w360dp-h800dp-xxhdpi-night")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class DailyActivityTest {
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @Before fun bind() { Dispatchers.setMain(Handler(Looper.getMainLooper()).asCoroutineDispatcher()) }
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @After fun reset() { Dispatchers.resetMain() }
    private fun children(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { children(view.getChildAt(it)) } else emptyList()
    private fun data(): JSONObject {
        val flavors = JSONArray(); val inventory = JSONArray()
        for ((i, entry) in listOf("DR-CHOCOLATE" to "Chocolate", "DR-VAINILLA" to "Vainilla", "DR-CHOCOLATE-CHISPAS" to "Chocolate con chispas", "DR-VAINILLA-CHISPAS" to "Vainilla con chispas").withIndex()) {
            val id = "cccccccc-cccc-4ccc-8ccc-ccccccccccc$i"
            flavors.put(JSONObject().put("id", id).put("sku", entry.first).put("name", entry.second).put("active", true).put("available", true).put("unitPriceCents", 100))
            inventory.put(JSONObject().put("variant_id", id).put("name", entry.second).put("opening_quantity", 0).put("purchased_quantity", 12)
                .put("sold_quantity", 2).put("reserved_quantity", 2).put("available_quantity", 8).put("counted", true))
        }
        val summary = JSONObject()
        mapOf("revenueCents" to 4800, "cashCents" to 1800, "yappyCents" to 3000, "investmentCents" to 3000,
            "costOfSalesCents" to 1800, "profitCents" to 3000, "consumptionCostCents" to 150, "correctionCostCents" to 0,
            "unknownCostUnits" to 0, "netCashCents" to 1800, "purchasedUnits" to 40, "soldUnits" to 24, "consumedUnits" to 2).forEach { summary.put(it.key, it.value) }
        return JSONObject().put("session", JSONObject().put("id", "session-test").put("business_date", "2026-10-13"))
            .put("summary", summary).put("flavors", flavors).put("inventory", JSONObject().put("revision", 1).put("flavors", inventory))
            .put("operations", JSONArray()).put("sessions", JSONArray())
    }
    @Test fun renderDailyScreensAndEditableMixWithoutOldCapitalNavigation() {
        val controller = Robolectric.buildActivity(DailyActivity::class.java).setup().visible()
        try {
            val activity = controller.get()
            val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
            fun texts() = children(root).filterIsInstance<TextView>().map { it.text.toString() }
            assertTrue(texts().any { it.contains("Conectar cuenta") })
            fun set(name: String, value: Any) { DailyActivity::class.java.getDeclaredField(name).apply { isAccessible = true }.set(activity, value) }
            fun render() { DailyActivity::class.java.getDeclaredMethod("render").apply { isAccessible = true }.invoke(activity); shadowOf(Looper.getMainLooper()).idle() }
            set("owner", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"); set("snapshot", data()); render()
            assertTrue(texts().contains("Ingresos confirmados")); assertFalse(texts().any { it.contains("Capital") || it == "Reparto" })
            val directory = File("../../../test-output/android-daily").apply { mkdirs() }
            fun capture(name: String) {
                root.measure(View.MeasureSpec.makeMeasureSpec(1080, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(2400, View.MeasureSpec.EXACTLY)); root.layout(0, 0, 1080, 2400)
                val bitmap = android.graphics.Bitmap.createBitmap(1080, 2400, android.graphics.Bitmap.Config.ARGB_8888)
                root.draw(android.graphics.Canvas(bitmap)); File(directory, "$name.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }; bitmap.recycle()
            }
            capture("hoy")
            children(root).filterIsInstance<MaterialButton>().single { it.text.toString() == "Compra" }.performClick()
            shadowOf(Looper.getMainLooper()).idle()
            assertTrue(texts().contains("Registrar compra"))
            val inputs = children(root).filterIsInstance<TextInputEditText>()
            assertTrue(inputs.count { it.text.toString() == "4" } == 2); assertTrue(inputs.count { it.text.toString() == "2" } == 2)
            inputs[0].setText("2"); inputs[2].setText("1")
            assertTrue(texts().any { it == "9 por caja · 18 unidades" })
            capture("compra")
            set("page", "Inventario"); render(); assertTrue(texts().any { it.contains("reservadas") }); capture("inventario")
        } finally { controller.pause().stop().destroy() }
    }
}
