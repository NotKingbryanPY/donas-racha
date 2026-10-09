# Donas Control 1.3.0 oficial

Distribución por APK para el negocio. Versión 1.3.0, código de actualización 10, paquete permanente `com.bryan.donas.control`. Compilación optimizada con R8, sin depuración, nombre Donas Control y dominio `https://dracha.store`. Conserva las cajas de 12 con mezcla 4/4/2/2.

## Instalación y datos del piloto

La clave con la que se firmó el piloto entregado no está en la máquina local y ya no aparece en la caché de GitHub Actions. Un APK no contiene esa clave privada. Por eso la versión oficial tiene una identidad y una firma propias: convive con el piloto y no lo borra ni lo actualiza directamente.

1. Activar el servidor con las cuatro migraciones indicadas abajo y publicar la rama después de sus funciones SQL.
2. En el piloto 1.3.0, conectar la cuenta administradora y Wi‑Fi estable. Esperar a que no queden movimientos pendientes o rechazados y exportar la copia `.donasbackup` desde la pantalla de operaciones.
3. Instalar `Donas-Control-1.3.0-oficial.apk`. No desinstalar el piloto.
4. En la oficial, importar la copia antes de conectar una cuenta. La validación conserva saldos, lotes, ventas, pedidos y cola. La base anterior de la oficial se conserva internamente antes de sustituirla.
5. Conectar **la misma cuenta administradora**. La oficial recupera la identidad de sincronización del libro mediante una operación de la copia comprobada por el servidor. Hasta verificarla, no sube sus movimientos.
6. Comparar saldos, inventario e historial con el piloto. Continuar registrando únicamente en la oficial. Una vez verificado el traslado, el servidor rechaza nuevas escrituras del piloto para ese libro.

La app 1.1.1 original tenía otro esquema de base y no se convierte con este procedimiento. Conservarla y extraer su SQLite según `ANDROID_RECOVERY.md` antes de plantear una conversión.

## Inventario de varios dispositivos

Los pedidos online se reservan bajo el mismo bloqueo de inventario. Dos solicitudes simultáneas no pueden reservar la última unidad dos veces. Cobrar y entregar confirma pago, puntos y stock una sola vez. Un recibo contable de la entrega no descuenta otra vez el servidor.

Los conteos requieren una revisión: una venta, reserva o conteo posterior invalida un formulario viejo. Las operaciones de cada equipo mantienen sus identificadores para que los reintentos no dupliquen ventas. La cola Android conserva el orden del libro aunque se cambie la hora del teléfono. Cobros, entregas y reservas adquieren los bloqueos en el mismo orden.

Una venta offline solo aparece en otros equipos al sincronizar. Si varias personas venden las mismas unidades físicas sin conexión, ningún sistema puede conocer esas ventas todavía. El servidor exige conciliación cuando una venta tardía afecta stock reservado. Distribuir existencias físicas por persona o mantener un libro administrador y cuentas SELLER para los socios que atienden pedidos. Los libros de dinero no se fusionan automáticamente.

## Activación del servidor

Respaldar Supabase y sincronizar los equipos antes del cambio. Confirmar cuáles migraciones ya están aplicadas; no repetirlas. Aplicar las pendientes en este orden:

1. `202610030001_shared_inventory.sql`
2. `202610030002_order_push.sql`
3. `202610050001_inventory_lock_order.sql`
4. `202610050002_mobile_restore_identity.sql`

Después publicar la web/API de la rama de revisión y hacer un conteo físico de todo el negocio, incluidas las unidades reservadas. El workspace no tiene acceso administrativo a Supabase/Vercel: las migraciones productivas no se ejecutaron desde aquí. La web productiva comprobada aún no carga el módulo de inventario compartido.

## Notificaciones y dispositivos

El código FCM está implementado. Registrar Firebase para **com.bryan.donas.control**, configurar la app Android al compilar y las credenciales FCM del servidor. El APK generado sin esos datos conserva las notificaciones locales al consultar pedidos; no ofrece push inmediato con la app cerrada. Las variables y secretos se detallan en `DONAS_CONTROL_1.3.0_ANALISIS_Y_ACTIVACION.md`.

La contabilidad, cola e inventario se verifican con pruebas automatizadas y emuladores Android. Esto no garantiza ausencia de errores en todos los fabricantes. Sigue pendiente probar teléfonos físicos, entrega real de notificaciones y el inventario productivo tras activarlo.

## Firma y futuras actualizaciones

La clave permanente se guarda privadamente fuera del repositorio en la carpeta del usuario `.codex/keys/donas-control-official`. Conservar una copia privada de esa carpeta y sus credenciales. No publicarlas ni enviarlas junto al APK. Las próximas versiones oficiales deben usar ese mismo paquete y certificado con un código de versión superior.

El workflow de CI usa claves temporales y etiqueta sus APK como `validation-only`: esos archivos son para pruebas. El entregable oficial se firma con la clave permanente. No se publicó en Google Play ni se incluyeron claves privadas en GitHub.

## Estado de iOS

La app SwiftUI está implementada, compilada y probada en simulador, con 17 pruebas de libro y sesión. Su dirección de API ahora es dracha.store. El ZIP `.swiftpm` permite ejecutar el proyecto con Swift Playgrounds; no es un IPA instalable.

Para una instalación independiente, TestFlight o App Store faltan la cuenta/equipo Apple, firma y perfiles de distribución. Para push real faltan la capacidad de notificaciones y las claves APNs del servidor. Hay que probar el iPad físico y activar el mismo servidor que Android. No importa automáticamente el historial Room de Android; iOS conserva su propio libro, y no replica los modos de reparto fijo avanzados, widget ni escáner Android.
