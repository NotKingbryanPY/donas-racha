package com.bryan.donas.ui

import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.bryan.donas.DonasApp
import com.bryan.donas.data.BackendException
import com.bryan.donas.data.CustomerPurchaseProfile
import com.bryan.donas.data.CustomerQr
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.util.UUID

class CustomerPurchaseActivity : AppCompatActivity() {
    private val backend get() = (application as DonasApp).backendClient
    private lateinit var email: TextInputEditText
    private lateinit var password: TextInputEditText
    private lateinit var idInput: TextInputEditText
    private lateinit var loginFields: LinearLayout
    private lateinit var scanControls: LinearLayout
    private lateinit var scanButton: MaterialButton
    private lateinit var lookupButton: MaterialButton
    private lateinit var registerButton: MaterialButton
    private lateinit var card: MaterialCardView
    private lateinit var nameLine: TextView
    private lateinit var phoneLine: TextView
    private lateinit var idLine: TextView
    private lateinit var countLine: TextView
    private lateinit var status: TextView
    private var profile: CustomerPurchaseProfile? = null
    private var pendingKey: String? = null
    private var pendingCustomerId: String? = null
    private var busy = false
    private var scanning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(18.dp, 18.dp, 18.dp, 18.dp) }
        val scroll = ScrollView(this).apply { fillViewport = true; addView(root) }
        setContentView(scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        val night = resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, scroll).isAppearanceLightStatusBars = !night
        WindowCompat.getInsetsController(window, scroll).isAppearanceLightNavigationBars = !night

        root.addView(button("← Volver") { finish() }, fullWidth())
        root.addView(line("Cliente por QR", 24f, true), fullWidth())
        root.addView(line("Escanea Mi QR, comprueba el perfil y confirma la compra con puntos.", 14f), fullWidth())
        status = line("Inicia sesión como vendedor para consultar clientes.", 14f).apply {
            setPadding(0, 14.dp, 0, 14.dp)
            accessibilityLiveRegion = android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        root.addView(status, fullWidth())

        loginFields = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val emailField = input("Correo de vendedor", false)
        val passwordField = input("Contraseña", true)
        email = emailField.editText as TextInputEditText
        password = passwordField.editText as TextInputEditText
        loginFields.addView(emailField, fullWidth())
        loginFields.addView(passwordField, fullWidth())
        loginFields.addView(button("Iniciar sesión") { signIn() }, fullWidth())
        root.addView(loginFields, fullWidth())

        scanControls = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scanButton = button("Escanear QR") { scan() }
        scanControls.addView(scanButton, fullWidth())
        scanControls.addView(line("Si no puedes usar la cámara, busca al cliente por su ID.", 13f), fullWidth())
        val idField = input("ID del cliente", false)
        idInput = idField.editText as TextInputEditText
        idInput.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        scanControls.addView(idField, fullWidth())
        lookupButton = button("Buscar cliente") { lookup(CustomerQr.customerId(idInput.text?.toString())) }
        scanControls.addView(lookupButton, fullWidth())
        root.addView(scanControls, fullWidth())

        card = MaterialCardView(this).apply { radius = 18.dp.toFloat(); cardElevation = 0f }
        val details = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(18.dp, 18.dp, 18.dp, 18.dp) }
        nameLine = line("", 22f, true)
        phoneLine = line("", 15f)
        idLine = line("", 13f)
        countLine = line("", 15f, true)
        details.addView(nameLine, fullWidth())
        details.addView(phoneLine, fullWidth())
        details.addView(idLine, fullWidth())
        details.addView(countLine, fullWidth())
        registerButton = button("Registrar compra") { confirmPurchase() }
        details.addView(registerButton, fullWidth())
        details.addView(line("Acredita puntos en el perfil. Las ventas de caja se registran aparte en Control de ventas.", 12f), fullWidth())
        card.addView(details)
        root.addView(card, fullWidth())
        pendingKey = savedInstanceState?.getString("pendingPurchaseKey")
        pendingCustomerId = savedInstanceState?.getString("pendingCustomerId")
        render()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString("pendingPurchaseKey", pendingKey)
        outState.putString("pendingCustomerId", pendingCustomerId)
    }

    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
    private fun fullWidth() = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    private fun line(value: String, size: Float, bold: Boolean = false) = TextView(this).apply {
        text = value; textSize = size; setPadding(0, 6.dp, 0, 6.dp)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    private fun button(label: String, action: () -> Unit) = MaterialButton(this).apply {
        text = label; setOnClickListener { action() }
    }
    private fun input(label: String, secret: Boolean): TextInputLayout {
        val layout = TextInputLayout(this).apply { hint = label }
        val field = TextInputEditText(layout.context).apply {
            inputType = if (secret) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        layout.addView(field)
        return layout
    }

    private fun render() {
        loginFields.isVisible = !backend.signedIn
        scanControls.isVisible = backend.signedIn
        card.isVisible = backend.signedIn && profile != null
        scanButton.isEnabled = !busy && !scanning
        lookupButton.isEnabled = !busy && !scanning
        val customer = profile ?: return
        nameLine.text = customer.name
        phoneLine.text = "WhatsApp: ${customer.phone.ifBlank { "No registrado" }}"
        idLine.text = "ID: ${customer.id}"
        countLine.text = "Compras con puntos hoy: ${customer.purchasesToday} de ${customer.dailyPurchaseLimit}"
        registerButton.isEnabled = !busy && !scanning && customer.purchasesToday < customer.dailyPurchaseLimit
        registerButton.text = if (customer.purchasesToday >= customer.dailyPurchaseLimit) "Límite de hoy alcanzado"
            else "Registrar compra · +${customer.nextPurchasePoints} pts"
    }

    private fun signIn() {
        val address = email.text?.toString().orEmpty()
        val secret = password.text?.toString().orEmpty()
        if (address.isBlank() || secret.isBlank()) { status.text = "Escribe correo y contraseña."; return }
        if (busy) return
        busy = true
        status.text = "Iniciando sesión…"
        render()
        lifecycleScope.launch {
            try {
                backend.login(address, secret)
                password.setText("")
                val dao = (application as DonasApp).database.syncDao()
                dao.clearOrders(); dao.clearState()
                status.text = "Sesión lista. Escanea el QR del cliente."
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { status.text = e.message ?: "No se pudo iniciar sesión." }
            finally { busy = false; render() }
        }
    }

    private fun scan() {
        if (busy || scanning || !backend.signedIn) return
        scanning = true
        status.text = "Abriendo escáner…"
        render()
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build()
        try {
            GmsBarcodeScanning.getClient(this, options).startScan()
                .addOnSuccessListener { barcode ->
                    if (isFinishing || isDestroyed) return@addOnSuccessListener
                    scanning = false
                    lookup(CustomerQr.customerId(barcode.rawValue))
                }
                .addOnCanceledListener {
                    if (isFinishing || isDestroyed) return@addOnCanceledListener
                    scanning = false; status.text = "Escaneo cancelado."; render()
                }
                .addOnFailureListener {
                    if (isFinishing || isDestroyed) return@addOnFailureListener
                    scanning = false
                    status.text = "No se pudo abrir el escáner. Comprueba Google Play Services o usa el ID del cliente."
                    render()
                }
        } catch (_: Exception) {
            scanning = false
            status.text = "El escáner no está disponible. Usa el ID del cliente."
            render()
        }
    }

    private fun lookup(id: String?) {
        if (id == null) { status.text = "Ese QR o ID no corresponde a Donas Racha."; render(); return }
        if (busy || !backend.signedIn) return
        busy = true
        profile = null
        if (pendingCustomerId != id) { pendingKey = null; pendingCustomerId = null }
        idInput.setText(id)
        status.text = "Consultando el perfil…"
        render()
        lifecycleScope.launch {
            try {
                profile = backend.customerProfile(id)
                status.text = "Comprueba los datos antes de registrar."
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { status.text = e.message ?: "No se pudo consultar el cliente." }
            finally { busy = false; render() }
        }
    }

    private fun confirmPurchase() {
        val customer = profile ?: return
        if (busy || customer.purchasesToday >= customer.dailyPurchaseLimit) return
        MaterialAlertDialogBuilder(this)
            .setTitle("¿Registrar compra con puntos?")
            .setMessage("${customer.name} · ${customer.id}\nHoy: ${customer.purchasesToday} de ${customer.dailyPurchaseLimit} compras. Se acreditarán los puntos de esta compra.")
            .setNegativeButton("Volver", null)
            .setPositiveButton("Registrar compra") { _, _ -> registerPurchase(customer) }
            .show()
    }

    private fun registerPurchase(customer: CustomerPurchaseProfile) {
        if (busy || profile?.id != customer.id) return
        busy = true
        val key = pendingKey ?: UUID.randomUUID().toString().also { pendingKey = it; pendingCustomerId = customer.id }
        status.text = "Registrando compra…"
        render()
        lifecycleScope.launch {
            try {
                val result = backend.registerCustomerPurchase(customer.id, key)
                profile = result.profile
                pendingKey = null
                pendingCustomerId = null
                status.text = if (result.replayed) "Esta compra ya estaba registrada. Perfil actualizado."
                    else "Compra registrada: +${result.pointsEarned} puntos."
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                status.text = e.message ?: "No se pudo registrar. Reintenta para comprobar el resultado."
                if (e is BackendException && e.code == "DAILY_PURCHASE_LIMIT") {
                    pendingKey = null
                    pendingCustomerId = null
                    try { profile = backend.customerProfile(customer.id) } catch (_: Exception) { }
                }
            } finally { busy = false; render() }
        }
    }
}
