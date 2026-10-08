package com.bryan.donas.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
import com.google.firebase.firestore.PersistentCacheSettings
import com.google.firebase.firestore.Source
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.TimeoutCancellationException

/** Standard Firestore stores personal preferences only. Business data remains in Room/Supabase. */
object FirebasePreferences {
    private val database by lazy {
        FirebaseFirestore.getInstance().apply {
            firestoreSettings = FirebaseFirestoreSettings.Builder()
                .setLocalCacheSettings(PersistentCacheSettings.newBuilder().setSizeBytes(20L * 1024 * 1024).build())
                .build()
        }
    }
    private fun userId(): String {
        val user = FirebaseAuth.getInstance().currentUser
        check(user != null && user.isEmailVerified) { "Verifica tu correo antes de guardar preferencias." }
        return user.uid
    }
    fun saveTheme(mode: Int): com.google.android.gms.tasks.Task<Void> {
        require(mode in listOf(-1, 1, 2))
        val uid = userId()
        return database.collection("userPreferences").document(uid).set(mapOf(
            "uid" to uid, "schemaVersion" to 1, "theme" to mode, "updatedAt" to FieldValue.serverTimestamp()
        ))
    }
    suspend fun loadTheme(): Pair<Int, Boolean> {
        val uid = userId()
        val document = database.collection("userPreferences").document(uid)
        val snapshot = try { withTimeout(10_000) { document.get(Source.SERVER).awaitFirebase() } }
            catch (_: TimeoutCancellationException) { document.get(Source.CACHE).awaitFirebase() }
            catch (e: com.google.firebase.firestore.FirebaseFirestoreException) {
                if (e.code != com.google.firebase.firestore.FirebaseFirestoreException.Code.UNAVAILABLE) throw e
                document.get(Source.CACHE).awaitFirebase()
            }
        check(snapshot.exists() && snapshot.getString("uid") == uid && snapshot.getLong("schemaVersion") == 1L) {
            "Todavía no hay preferencias guardadas para esta cuenta."
        }
        val mode = snapshot.getLong("theme")?.toInt()
        check(mode in listOf(-1, 1, 2)) { "La preferencia guardada no es válida." }
        return requireNotNull(mode) to snapshot.metadata.isFromCache
    }
}
