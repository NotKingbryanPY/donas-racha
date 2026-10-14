package com.bryan.donas.daily

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.testing.WorkManagerTestInitHelper
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BackendClient
import com.bryan.donas.data.PushHealth
import com.bryan.donas.data.SessionTokens
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
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
import java.util.UUID

/** Exercises lifecycle/WorkManager completion, without sending a real push. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationCheckActivityTest {
    private val owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    private lateinit var app: DonasApp
    private lateinit var manager: WorkManager
    private class Tokens : SessionTokens {
        override fun save(refreshToken: String) {}
        override fun refreshToken() = "test-refresh"
        override fun hasSession() = true
        override fun clear() {}
    }
    class CheckResultWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
        override fun doWork(): Result {
            if (inputData.getBoolean("reject", false)) {
                PushHealth.failed(applicationContext, "FCM_AUTH_FAILED")
                return Result.failure()
            }
            PushHealth.registered(applicationContext, JSONObject().put("registered", true))
            PushHealth.checked(applicationContext, JSONObject("""{"configured":{"android":true},"check":{"status":"FCM_VALIDATED"}}"""))
            return Result.success()
        }
    }
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @Before fun prepare() {
        Dispatchers.setMain(Handler(Looper.getMainLooper()).asCoroutineDispatcher())
        app = ApplicationProvider.getApplicationContext()
        BackendClient::class.java.getDeclaredField("sessions").apply { isAccessible = true }.set(app.backendClient, Tokens())
        app.getSharedPreferences("remote_device", Context.MODE_PRIVATE).edit().putString("dailyOwner", owner).commit()
        PushHealth.clear(app)
        val direct = java.util.concurrent.Executor { it.run() }
        WorkManagerTestInitHelper.initializeTestWorkManager(app,
            Configuration.Builder().setExecutor(direct).setTaskExecutor(direct).build())
        manager = WorkManager.getInstance(app)
    }
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @After fun reset() { Dispatchers.resetMain() }
    private fun children(view: View): List<View> = listOf(view) + if (view is ViewGroup)
        (0 until view.childCount).flatMap { children(view.getChildAt(it)) } else emptyList()
    private fun views(activity: DailyActivity) = children(activity.findViewById(android.R.id.content))
    private fun checkButton(activity: DailyActivity) = views(activity).filterIsInstance<MaterialButton>()
        .single { it.text.toString() == "Activar / comprobar avisos" }
    private fun texts(activity: DailyActivity) = views(activity).filterIsInstance<TextView>().map { it.text.toString() }
    private fun track(activity: DailyActivity, reject: Boolean = false): UUID {
        val request = OneTimeWorkRequestBuilder<CheckResultWorker>()
            .setConstraints(Constraints.Builder().setRequiresCharging(true).build())
            .setInputData(Data.Builder().putBoolean("reject", reject).build()).build()
        manager.enqueue(request).result.get()
        DailyActivity::class.java.getDeclaredMethod("trackNotificationCheck", String::class.java, UUID::class.java)
            .apply { isAccessible = true }.invoke(activity, owner, request.id)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(WorkInfo.State.ENQUEUED, manager.getWorkInfoById(request.id).get().state)
        assertFalse("No double tap while the check is pending", checkButton(activity).isEnabled)
        return request.id
    }
    private fun complete(id: UUID) {
        WorkManagerTestInitHelper.getTestDriver(app)!!.setAllConstraintsMet(id)
        shadowOf(Looper.getMainLooper()).idle()
    }
    @Test fun finishedCheckRemovesProgressAndEnablesTheButton() {
        val controller = Robolectric.buildActivity(DailyActivity::class.java).setup().visible()
        try {
            val activity = controller.get()
            val id = track(activity)
            complete(id)
            assertEquals(WorkInfo.State.SUCCEEDED, manager.getWorkInfoById(id).get().state)
            assertTrue(checkButton(activity).isEnabled)
            assertTrue(texts(activity).contains("Comprobación finalizada. Revisa el estado de avisos."))
            assertFalse(texts(activity).contains("Comprobando teléfono y emisor…"))
            assertEquals("FCM_VALIDATED", app.getSharedPreferences("push_health", Context.MODE_PRIVATE).getString("check", ""))
        } finally { controller.pause().stop().destroy() }
    }
    @Test fun failedCheckAllowsAnotherCheckWithoutAnOldObserverRestoringProgress() {
        val controller = Robolectric.buildActivity(DailyActivity::class.java).setup().visible()
        try {
            val activity = controller.get()
            val first = track(activity, true)
            complete(first)
            assertEquals(WorkInfo.State.FAILED, manager.getWorkInfoById(first).get().state)
            assertTrue(checkButton(activity).isEnabled)
            assertTrue(texts(activity).any { it.startsWith("No se completó la comprobación.") })
            val retry = track(activity)
            complete(retry)
            assertEquals(WorkInfo.State.SUCCEEDED, manager.getWorkInfoById(retry).get().state)
            assertTrue(checkButton(activity).isEnabled)
            assertFalse(texts(activity).contains("Comprobando teléfono y emisor…"))
        } finally { controller.pause().stop().destroy() }
    }
    @Test fun completionWhileStoppedIsDisplayedWhenTheScreenReturns() {
        val controller = Robolectric.buildActivity(DailyActivity::class.java).setup().visible()
        try {
            val activity = controller.get()
            val id = track(activity)
            controller.pause().stop()
            complete(id)
            controller.start().resume().visible()
            shadowOf(Looper.getMainLooper()).idle()
            assertTrue(checkButton(activity).isEnabled)
            assertTrue(texts(activity).contains("Comprobación finalizada. Revisa el estado de avisos."))
            assertFalse(texts(activity).contains("Comprobando teléfono y emisor…"))
        } finally { controller.pause().stop().destroy() }
    }
}
