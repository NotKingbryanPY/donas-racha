package com.bryan.donas.ui

import android.os.Looper
import android.os.Handler
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatDelegate
import androidx.test.core.app.ApplicationProvider
import com.bryan.donas.DonasApp
import com.bryan.donas.R
import com.google.android.material.bottomnavigation.BottomNavigationView
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.test.resetMain
import org.junit.Before
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], qualifiers = "w360dp-h800dp")
class MainActivityTest {
    private var inspected: MainActivity? = null
    // Each Robolectric test creates a fresh Android main looper. Rebind Main to it.
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @Before fun bindMainDispatcher() {
        Dispatchers.setMain(Handler(Looper.getMainLooper()).asCoroutineDispatcher())
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
        runBlocking { ApplicationProvider.getApplicationContext<DonasApp>().themePreferences.setTheme(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM) }
    }
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @After fun resetMainDispatcher() { Dispatchers.resetMain() }
    @Test fun defaultHomeAndSimulationAreUsable() {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
        val app = ApplicationProvider.getApplicationContext<DonasApp>()
        runBlocking { app.themePreferences.setTheme(AppCompatDelegate.MODE_NIGHT_NO) }
        runBlocking { app.repository.initialize() }
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup().visible().also { inspected = it.get() }
        val activity = controller.get()
        await { activity.findViewById<TextView>(R.id.margin).text.toString() == "$6.00" }
        assertEquals("$6.00", activity.findViewById<TextView>(R.id.margin).text.toString())
        activity.findViewById<BottomNavigationView>(R.id.navigation).selectedItemId = R.id.nav_sharing
        activity.findViewById<EditText>(R.id.sold).setText("6")
        activity.findViewById<android.view.View>(R.id.simulate).performClick()
        val result = activity.findViewById<TextView>(R.id.result).text.toString()
        assertTrue(result, result.contains("Yo: $1.50"))
        assertTrue(result, result.contains("Socio: $1.50"))
        assertEquals(1, runBlocking { app.repository.planHistory(0).size })
        controller.pause().stop().destroy()
    }

    @Test
    @Config(sdk = [28], qualifiers = "w360dp-h800dp-night")
    fun nightPaletteIsAvailableOnAndroidNine() {
        val context = ApplicationProvider.getApplicationContext<DonasApp>()
        assertEquals(0xFF191714.toInt(), context.getColor(R.color.background))
        assertEquals(0xFFEEE1D7.toInt(), context.getColor(R.color.on_surface))
    }

    @Test
    @Config(sdk = [28], qualifiers = "w360dp-h800dp-xxhdpi")
    @org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.NATIVE)
    fun renderPreviews() {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
        val app = ApplicationProvider.getApplicationContext<DonasApp>()
        runBlocking { app.repository.initialize() }
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup().visible().also { inspected = it.get() }
        await { controller.get().findViewById<TextView>(R.id.margin).text.isNotEmpty() }
        val activity = controller.get()
        val directory = java.io.File("../work/previews").apply { mkdirs() }
        fun capture(name: String) {
            val root = activity.findViewById<android.view.View>(R.id.root)
            val width = 1080
            val height = 2400
            root.measure(android.view.View.MeasureSpec.makeMeasureSpec(width, android.view.View.MeasureSpec.EXACTLY), android.view.View.MeasureSpec.makeMeasureSpec(height, android.view.View.MeasureSpec.EXACTLY))
            root.layout(0, 0, width, height)
            val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            canvas.drawColor(activity.getColor(R.color.background))
            root.draw(canvas)
            java.io.File(directory, "$name.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
        capture("inicio")
        activity.findViewById<BottomNavigationView>(R.id.navigation).selectedItemId = R.id.nav_business
        capture("negocio")
        activity.findViewById<BottomNavigationView>(R.id.navigation).selectedItemId = R.id.nav_sharing
        capture("reparto")
        controller.pause().stop().destroy()
    }

    private fun await(condition: () -> Boolean) {
        val end = System.nanoTime() + 15_000_000_000L
        while (!condition() && System.nanoTime() < end) {
            shadowOf(Looper.getMainLooper()).idle()
            Thread.sleep(20)
        }
        val diagnostic = inspected?.let {
            val model = androidx.lifecycle.ViewModelProvider(it)[MainViewModel::class.java]
            "lifecycle=${it.lifecycle.currentState}, error=${model.error.value}, snapshot=${model.snapshot.value}, message=${it.findViewById<TextView>(R.id.loadMessage).text}"
        }
        assertTrue("La pantalla no terminó de cargar: $diagnostic", condition())
    }
}
