# Donas Control2.1.0

Android nativo Kotlin/Views/Material, paquete oficial com.bryan.donas.control, código16, mínimoAPI23/target35. Pedidos como entrada; Hoy/Stock/Historial conservan operación diaria. Estilo oscuro/lavanda de dracha.store. No capital/reparto/préstamos en navegación; datos viejos conservados.

## Pedidos y notificaciones

Lista activa paginada,50 recientes y detalle exacto por UUID. Aceptar, en camino, cobrado-entregado(CASH/YAPPY) y cancelar incluso en camino usan API/transacciones web; no otro cobro/stock/puntos. Cambios requieren conexión. Caché Room7 por propietario,40 tarjetas por página de UI.

FCM alta prioridad es el mecanismo fuera de app: StaffMessagingService valida owner/device/UUID, avisa inmediatamente con canal/sonido/permisos y PendingIntent nativo; WorkManager recupera datos después. Dedupe persistente por usuario/pedido. El SDK/config público no reemplaza credenciales privadas del emisor Vercel. CloudFirestore no guarda otro inventario. [Activación y pruebas físicas](../../docs/DONAS_CONTROL_2_1_PEDIDOS.md).

Primera entrada con cuenta Supabase ADMIN/SELLER del Dashboard; sesión cifrada y password no persistida. SDK Firebase anterior no concede rol. Permitir notificaciones; Activar/comprobar avisos, Activar recuperación(ADMIN) y Enviar prueba. FCM aceptado no equivale a Android mostrando aviso. Offline no llegan nuevos pedidos; abrir/reconectar recupera activos. Sin servicios permanentes ni permisos generales de batería.

## Diarios preservados

Compras por caja con composición4/4/2/2 editable y snapshot; ventas efectivo/Yappy/dividido; consumo separado; costos FIFO centrales, utilidad desconocida visible. Outbox UUID/payload estable, backoff/conflictos, cierre confirmado conservando historia/stock. Room1..6→7 aditivo, sin fallback destructivo ni reenvío automático del libro anterior.

## Compilar e instalar

JDK17, SDK35/build-tools35 y Gradle wrapper. Desde raíz PowerShell:

```powershell
.\scripts\build-android-official.ps1 -FirebaseConfigPath .\.firebase\android\google-services.json
```

Firma oficial existente, unit/lint/build estrictos; outputs/Donas-Control-2.1.0-oficial.apk y checksum. Distribución privada firmada, no aprobación de tienda. Instalar como actualización sin desinstalar/borrar datos; .pilot es otro paquete. No bajar APK/Room7 a6 para suspender avisos: usar SQL04 correspondiente. CI usa otra firma temporal; su APK no sustituye la distribución oficial.

Tests locales: gradlew.bat testDebugUnitTest lintDebug lintOfficial. Instrumentación/emuladores23/35 en workflow Android. [Guía IA](../../docs/knowledge/AI_CONTEXT.md) debe acompañar cada cambio; pruebas y límites en VALIDATION. [Servidor/SQL2.1](../../docs/DONAS_CONTROL_2_1_PEDIDOS.md) se configura aparte de compilar.
