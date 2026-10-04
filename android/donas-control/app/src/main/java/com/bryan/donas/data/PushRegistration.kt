package com.bryan.donas.data

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.bryan.donas.BuildConfig
import com.bryan.donas.DonasApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object PushRegistration {
    fun register(context: Context) {
        if (BuildConfig.FIREBASE_APP_ID.isBlank()) return
        if (FirebaseApp.getApps(context).isEmpty()) FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
            .setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID).build())
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            CoroutineScope(Dispatchers.IO).launch {
                val app = context.applicationContext as DonasApp
                if (app.backendClient.signedIn) try { app.backendClient.registerPush(token) } catch (_: Exception) { }
            }
        }
    }
}

class DonasMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { PushRegistration.register(this) }
    override fun onMessageReceived(message: RemoteMessage) {
        if (!(application as DonasApp).backendClient.signedIn) return
        val id = message.data["orderId"] ?: return
        OrderNotifications.showNew(this, id, message.data["publicCode"].orEmpty())
        OrderSync.request(this)
    }
}
