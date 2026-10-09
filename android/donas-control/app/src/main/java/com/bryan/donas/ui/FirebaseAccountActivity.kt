package com.bryan.donas.ui

import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import androidx.lifecycle.lifecycleScope
import com.bryan.donas.BuildConfig
import com.bryan.donas.DonasApp
import com.bryan.donas.data.FirebasePreferences
import com.bryan.donas.data.OrderSync
import com.bryan.donas.data.PushRegistration
import com.bryan.donas.data.awaitFirebase
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.Companion.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** Optional identity screen: opening Donas Control still goes straight to Orders. */
class FirebaseAccountActivity : AppCompatActivity() {
    private val app get() = application as DonasApp
    private lateinit var auth: FirebaseAuth
    private lateinit var status: TextView
    private lateinit var email: TextInputEditText
    private lateinit var password: TextInputEditText
    private val actions = mutableListOf<MaterialButton>()
    private lateinit var signIn: MaterialButton
    private lateinit var create: MaterialButton
    private lateinit var google: MaterialButton
    private lateinit var verify: MaterialButton
    private lateinit var link: MaterialButton
    private lateinit var save: MaterialButton
    private lateinit var load: MaterialButton
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp, 16.dp, 20.dp, 20.dp) }
        val scroll = ScrollView(this).apply { addView(root) }
        setContentView(scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        root.addView(MaterialButton(this).apply { text = "← Volver a pedidos"; setOnClickListener { finish() } })
        root.addView(TextView(this).apply { text = "Tu cuenta"; textSize = 24f })
        status = TextView(this).apply { textSize = 15f; setPadding(0, 12.dp, 0, 12.dp) }
        root.addView(status)
        if (!PushRegistration.initialize(this)) { status.text = "Firebase no está configurado en este APK."; return }
        auth = FirebaseAuth.getInstance()
        root.addView(TextView(this).apply {
            text = "Correo o Google identifica tu cuenta. Para gestionar pedidos, autoriza primero este dispositivo con una invitación en Pedidos."
        })
        fun field(label: String, secret: Boolean): TextInputEditText {
            val layout = TextInputLayout(this).apply { hint = label }
            val edit = TextInputEditText(layout.context).apply {
                inputType = android.text.InputType.TYPE_CLASS_TEXT or if (secret)
                    android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD else android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            }
            layout.addView(edit); root.addView(layout); return edit
        }
        email = field("Correo", false); password = field("Contraseña", true)
        fun action(label: String, block: suspend () -> Unit): MaterialButton = MaterialButton(this).apply {
            text = label; root.addView(this, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            actions.add(this); setOnClickListener { runAction(block) }
        }
        signIn = action("Entrar con correo") {
            auth.signInWithEmailAndPassword(email.text.toString().trim(), password.text.toString()).awaitFirebase()
            password.setText(""); status.text = accountStatus()
        }
        create = action("Crear cuenta con correo") {
            auth.createUserWithEmailAndPassword(email.text.toString().trim(), password.text.toString()).awaitFirebase()
            password.setText(""); status.text = "Cuenta creada. Pulsa Enviar verificación y revisa tu correo."
        }
        google = action("Continuar con Google") {
            // AGP 8.9 lint misses Kotlin companion references; fixed as issue 385394934 in AGP 8.10.
            // The credential type is checked and GoogleIdTokenCredential.createFrom is used below.
            @android.annotation.SuppressLint("CredentialManagerSignInWithGoogle")
            val option = GetGoogleIdOption.Builder().setFilterByAuthorizedAccounts(false)
                .setServerClientId(BuildConfig.FIREBASE_WEB_CLIENT_ID).setAutoSelectEnabled(false).build()
            val response = CredentialManager.create(this@FirebaseAccountActivity).getCredential(this@FirebaseAccountActivity,
                GetCredentialRequest.Builder().addCredentialOption(option).build())
            val credential = response.credential
            if (credential is CustomCredential && credential.type == TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                val googleCredential: GoogleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                val token = googleCredential.idToken
                auth.signInWithCredential(GoogleAuthProvider.getCredential(token, null)).awaitFirebase()
            } else error("Google no devolvió una credencial válida.")
            status.text = accountStatus()
        }
        verify = action("Enviar verificación de correo") {
            requireNotNull(auth.currentUser).sendEmailVerification().awaitFirebase()
            status.text = "Verificación enviada. Abre el enlace en tu correo y vuelve para vincular la cuenta."
        }
        action("Ya verifiqué · Actualizar cuenta") {
            val user = requireNotNull(auth.currentUser) { "Inicia sesión primero." }
            user.reload().awaitFirebase(); user.getIdToken(true).awaitFirebase()
            status.text = accountStatus()
        }
        link = action("Vincular cuenta al dispositivo autorizado") {
            val user = requireNotNull(auth.currentUser)
            user.reload().awaitFirebase()
            check(user.isEmailVerified) { "Verifica tu correo antes de vincular esta cuenta." }
            val token = requireNotNull(user.getIdToken(true).awaitFirebase().token)
            if (app.backendClient.usesFirebaseAccount || !app.backendClient.signedIn)
                app.backendClient.useLinkedFirebaseAccount(token, user.uid)
            else app.backendClient.linkFirebaseAccount(token, user.uid)
            PushRegistration.register(this@FirebaseAccountActivity); OrderSync.schedule(this@FirebaseAccountActivity)
            status.text = "Cuenta vinculada. La aplicación abrirá Pedidos sin pedir login en cada uso."
            startActivity(Intent(this@FirebaseAccountActivity, OrdersActivity::class.java)); finish()
        }
        root.addView(TextView(this).apply { text = "Preferencias personales · Firestore"; textSize = 18f; setPadding(0, 16.dp, 0, 8.dp) })
        root.addView(TextView(this).apply { text = "Guarda el tema elegido en Administración para recuperarlo con tu cuenta. Los pedidos y el inventario se sincronizan por su flujo habitual." })
        save = action("Guardar mi tema en la cuenta") {
            val task = FirebasePreferences.saveTheme(app.themePreferences.theme.first())
            status.text = "Tema guardado localmente · Pendiente de confirmación en Firebase."
            task.addOnSuccessListener(this@FirebaseAccountActivity) { status.text = "Tema sincronizado con Firebase." }
                .addOnFailureListener(this@FirebaseAccountActivity) { status.text = "Error al sincronizar el tema. Comprueba la cuenta y la conexión." }
        }
        load = action("Recuperar mi tema") {
            val (mode, cached) = FirebasePreferences.loadTheme()
            app.themePreferences.setTheme(mode)
            status.text = if (cached) "Tema recuperado de la copia local · Sin conexión." else "Tema recuperado de Firebase."
        }
        action("Salir de esta cuenta") {
            if (app.backendClient.usesFirebaseAccount) {
                app.backendClient.unregisterPush()
                app.backendClient.logout(); OrderSync.stop(this@FirebaseAccountActivity)
                app.database.syncDao().clearOrders(); app.database.syncDao().clearState()
            } else com.bryan.donas.data.FirebaseCredentialState.signOut(this@FirebaseAccountActivity)
            status.text = "Sesión de cuenta cerrada."
        }
        status.text = accountStatus(); render()
    }
    private fun accountStatus(): String = auth.currentUser?.let {
        if (it.isEmailVerified) "Cuenta verificada: ${it.email.orEmpty()}. Vincula este dispositivo para gestionar pedidos."
        else "Cuenta: ${it.email.orEmpty()}. Verifica tu correo antes de vincularla."
    } ?: "Inicia sesión o crea tu cuenta. El acceso a pedidos requiere autorización del dispositivo."

    private fun runAction(block: suspend () -> Unit) {
        if (busy) return
        busy = true; render()
        lifecycleScope.launch {
            try { block() }
            catch (_: GetCredentialCancellationException) { status.text = "Selección de Google cancelada." }
            catch (_: NoCredentialException) { status.text = "No hay credenciales de Google disponibles. Añade tu cuenta Google en Ajustes o entra con correo." }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { status.text = when (e) {
                is com.bryan.donas.data.BackendException -> e.message
                is com.google.firebase.auth.FirebaseAuthInvalidCredentialsException -> "Comprueba el correo y la contraseña."
                is com.google.firebase.auth.FirebaseAuthUserCollisionException -> "Ese correo ya tiene una cuenta. Usa Entrar con correo."
                is com.google.firebase.FirebaseNetworkException -> "Sin conexión. Vuelve a intentar cuando tengas Internet."
                is com.google.firebase.FirebaseTooManyRequestsException -> "Demasiados intentos. Espera un momento."
                is IllegalArgumentException, is IllegalStateException -> e.message
                else -> "No se pudo completar la operación. Comprueba la conexión y vuelve a intentar."
            } }
            finally { busy = false; render() }
        }
    }
    private fun render() {
        actions.forEach { it.isEnabled = !busy }
        val user = auth.currentUser
        signIn.isEnabled = !busy && user == null; create.isEnabled = signIn.isEnabled
        google.isEnabled = signIn.isEnabled && BuildConfig.FIREBASE_WEB_CLIENT_ID.isNotBlank()
        email.isEnabled = user == null && !busy; password.isEnabled = email.isEnabled
        verify.isEnabled = !busy && user != null && !user.isEmailVerified
        link.isEnabled = !busy && user != null
        save.isEnabled = !busy && user?.isEmailVerified == true; load.isEnabled = save.isEnabled
    }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
}
