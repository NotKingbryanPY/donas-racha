# Donas Control 1.3.1 oficial

Actualización de conexión para el APK oficial 1.3.0. Mantiene el paquete `com.bryan.donas.control` y la clave permanente; código de versión 11. Se instala encima de la oficial sin borrar la base de datos ni cerrar la sesión.

El 5 de octubre de 2026 se comprobó que `POST https://dracha.store/api/auth/session` devolvía HTTP 308 hacia `https://www.dracha.store/api/auth/session`. HttpURLConnection no seguía esa redirección para el inicio de sesión. La API en el dominio con `www` respondió JSON de validación a la misma petición vacía, confirmando que esa ruta está disponible.

La app usa directamente `https://www.dracha.store`. También admite hasta dos redirecciones 307/308 manteniendo el método, el cuerpo JSON y la autorización: únicamente dentro del mismo origen, o entre los dos dominios HTTPS de Donas Racha con igual ruta y consulta. Rechaza destinos externos, cambios de puerto, credenciales en la URL y bucles. No utiliza caché HTTP para sesión, pedidos o inventario. Si llega una respuesta 304 sin datos, informa el problema y conserva la sesión y los registros locales.

Las pruebas de regresión simulan inicio de sesión POST tras un 308, una escritura autenticada tras un 307, un destino externo, un bucle y un 304 seguido de una consulta válida. Esta corrección no sustituye la activación de las migraciones de inventario ni configura Firebase/APNs.

## Instalar

1. Descargar `Donas-Control-1.3.1-oficial.apk` y abrirlo en Android.
2. Aceptar actualizar la app oficial 1.3.0. **No desinstalar ni borrar sus datos.**
3. Abrir la app y conectar la cuenta administradora desde la sección de pedidos/sincronización. Es la cuenta del negocio, distinta del usuario de cliente.

El piloto es una aplicación separada. Su traslado sigue las instrucciones de `ANDROID_OFICIAL_1.3.0.md`; conservarlo hasta verificar la copia y los saldos.

El origen y la política de caché del código iOS también se actualizaron al dominio canónico. No se generó un IPA firmado con este cambio.

SHA-256 del APK: 65f79ac3d84a607c6014d63fb7e792ccdd7667faabfcdc9ceac969fc4987822d

Validación local: 94 pruebas de Android y lint aprobados. La misma firma permanente que 1.3.0. Las nuevas ejecuciones CI y de emuladores están pendientes al publicar; las pruebas de compatibilidad de 1.3.0 pasaron en Android 6 y 15.

