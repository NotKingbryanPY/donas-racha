package com.bryan.donas.data

import java.net.URI
import java.net.URLDecoder
import java.util.Locale

/** The QR identifies a profile; authorization and the daily limit are checked by the server. */
object CustomerQr {
    private val publicId = Regex("^C[0-9A-Z_-]{3,63}$")

    fun customerId(raw: String?): String? {
        val value = raw?.trim()?.takeIf { it.isNotEmpty() && it.length <= 2048 } ?: return null
        val direct = value.uppercase(Locale.ROOT)
        if (publicId.matches(direct)) return direct
        return runCatching {
            val uri = URI(value)
            if (uri.scheme != "https" || uri.host?.lowercase(Locale.ROOT) !in
                setOf("donas-racha.vercel.app", "dracha.store", "www.dracha.store") ||
                uri.rawUserInfo != null ||
                uri.port != -1 || uri.path != "/" || uri.fragment != null) return null
            val params = uri.rawQuery?.split('&')?.mapNotNull { part ->
                val bits = part.split('=', limit = 2)
                if (bits.size != 2) null else URLDecoder.decode(bits[0], "UTF-8") to URLDecoder.decode(bits[1], "UTF-8")
            }.orEmpty().toMap()
            if (params["profile"] != "1") return null
            params["id"]?.uppercase(Locale.ROOT)?.takeIf(publicId::matches)
        }.getOrNull()
    }
}
