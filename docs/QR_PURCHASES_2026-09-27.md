# Compras por QR y tres compras con puntos al día

## Regla

El QR de **Mi QR** identifica el perfil. Donas Control exige una sesión de vendedor, consulta los datos en el servidor y pide confirmación antes de registrar la compra. El escaneo por sí solo no acredita puntos ni registra una venta de caja. La búsqueda manual por ID ofrece la misma confirmación.

El servidor permite hasta **tres compras con puntos por cliente y día calendario de Panamá**. Se cuentan las compras registradas por vendedor y los pedidos cobrados y completados. Cada compra aceptada suma los puntos que correspondan a la racha vigente y aumenta el contador de compras. Solo la primera compra del día hace avanzar la racha; las otras dos mantienen ese nivel de puntos. El cuarto intento no altera puntos ni racha. Un reintento con la misma clave conserva el resultado original. Un pedido adicional puede completarse, pero ya no suma puntos.

## Orden de publicación

1. En el proyecto Supabase de Donas Racha, abrir **SQL Editor → New query** y ejecutar el contenido completo de [`supabase/migrations/202609270004_three_daily_purchases.sql`](../supabase/migrations/202609270004_three_daily_purchases.sql). Debe terminar sin errores. No ejecutar una segunda vez si el sistema de migraciones ya lo aplicó.
2. Publicar la web y API desde `main` después de aplicar la migración. La web muestra el contador de 0 a 3 y mantiene **Registrar compra** activo hasta la tercera.
3. Instalar el APK piloto 1.2.2 generado por el flujo Android. Abrir **Escanear QR de cliente**, iniciar sesión como vendedor si hace falta, escanear el QR o escribir el ID, comprobar los datos y confirmar. La app consulta el contador actualizado después de registrar.

## Verificación

En una base PostgreSQL desechable se aplicaron todas las migraciones y se comprobaron tres acreditaciones, el cuarto intento, reintentos, un pedido como origen de compra, el límite de la racha diaria, el cierre de temporada y el permiso denegado a `anon`. También pasó la prueba de API con sesión administrativa y la prueba de interfaz web con API simulada en móvil y escritorio. El parser del QR pasó una prueba Kotlin JVM. La compilación completa del APK y la prueba de cámara quedan sujetas al flujo de GitHub Actions y a un teléfono físico.
