# Donas Control 2.0.0

Android nativo Kotlin/Views/Material. Paquete oficial `com.bryan.donas.control`, código15, Android6/API23+, SDK35, JDK17. Nueva navegación Hoy/Inventario/Historial. El capital/reparto/préstamos y widgets anteriores no forman parte de la operación nueva; sus datos Room permanecen.

## Operación

- Compra: cajas, costo total, mezcla inicial4/4/2/2 editable, total calculado por suma de sabores. Guarda composición por compra y último mix preferido.
- Venta: cantidades/precio por sabor, efectivo/Yappy/dividido; suma del pago igual al total.
- Consumo del vendedor: salida sin ingreso, costo separado.
- Corrección: ADMIN, motivo, conexión y revisión vigente.
- Resumen central confirmado: inversión, unidades, ingresos por método, FIFO/costo vendido, utilidad comercial y resultado después del consumo. Costo histórico desconocido queda pendiente, no se inventa.
- Cierre online: cola local vacía, revisión/secuencia vigentes; conserva inventario e historial y abre otra jornada.

Supabase mantiene el único inventario/libro compartido. Room guarda daily_outbox/daily_cache junto al esquema anterior. WorkManager reintenta con conexión/backoff, UUID/payload inmutables y orden de inserción; fallos y conflictos no borran registros. Sin conexión solo se usa una copia previamente autorizada (hasta24h), y los pendientes no son ventas confirmadas. Un conteo físico inicial es obligatorio; comprar no presume existencia previa cero.

La sesión del Dashboard Supabase se conserva cifrada; email/password, no contraseña persistida ni rol automático Firebase. Firebase/FCM/provisión antiguos no se rehabilitan; pedidos se gestionan en el Dashboard web abierto desde la app. No se promete recepción push fuera de la aplicación. iOS se pospone.

## Activar, compilar e instalar

Leer [activación](../../docs/DONAS_CONTROL_2_ACTIVACION.md) y [guía IA](../../docs/knowledge/AI_CONTEXT.md). SQL nuevo en supabase/sql-editor/daily-v2, orden00/01/02. No repetir seed/paquete02antiguo ni reiniciar producción. El backend nuevo devuelve activación pendiente hasta instalar SQL.

Desde raíz, PowerShell con JDK17/SDK35 configurados:

```powershell
.\scripts\build-android-official.ps1 -FirebaseConfigPath .\.firebase\android\google-services.json
```

El script conserva firma oficial y valida unit/lint/build. Entrega outputs/Donas-Control-2.0.0-oficial.apk + SHA256. APK oficial de distribución privada; no es aprobación de tienda. CI usa firma temporal y sus APK no sustituyen la actualización oficial.

Instalar sobre la app oficial existente sin desinstalar: Room migra a v6 preservando todas las filas. .pilot y com.bryan.donas son paquetes distintos; no asumir traslado de datos por nombre. Pendientes contables antiguos necesitan conciliación, no se reenvían automáticamente. No hay borrado definitivo en la UI nueva.

Para tests desde este proyecto: `./gradlew.bat testDebugUnitTest lintDebug assembleDebugAndroidTest`. Instrumentación necesita dispositivo/emulador; compilar tests no equivale a ejecutarlos. Resultados y límites en docs/knowledge/VALIDATION.md. Historial1.3/1.4 recuperable con Git, por ejemplo `git show d304e46:android/donas-control/README.md`; sus instrucciones ya no describen el runtime2.
