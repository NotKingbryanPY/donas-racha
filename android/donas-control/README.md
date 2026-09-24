# Donas Control 1.2.0

Aplicación Android nativa para administrar un negocio ambulante de donas. La contabilidad funciona sin conexión; los pedidos se sincronizan cuando hay red. Package `com.bryan.donas`, Android 6.0/API 23 o superior.

## Funciones

- Configuración versionada de costo por caja, donas por caja y precio unitario.
- Cuentas Efectivo y Yappy con libro de asientos balanceados.
- Jornadas con stock inicial, conciliación física, cierre y reparto definitivo.
- Compras con pagos combinados: Efectivo, Yappy y préstamo.
- Inventario por movimientos y lotes FIFO con costo restante exacto.
- Venta rápida por Efectivo o Yappy y reversión explícita de la última venta.
- Transferencias entre Efectivo y Yappy; únicamente la comisión se registra como gasto.
- Gastos personales y de negocio por categoría.
- Préstamos, pagos parciales y saldo pendiente.
- Reparto porcentual o monto fijo proporcional/por cajas completas; receptor del remanente.
- Ganancia asignada y pagos a socios separados.
- Dashboard, estadísticas de hoy/semana/mes e historial paginado con filtros.
- Widget con selector − / cantidad / + (1–99) y venta directa de varias donas en Efectivo/Yappy; vuelve a 1 tras una venta correcta.
- Pedidos desde el backend: inicio de sesión administrador, cola local de operaciones, copia local de pedidos, aceptar/cancelar/en camino y confirmación del cobro presencial.
- Exportación/importación SQLite, reinicio de movimientos y restablecimiento de fábrica con doble confirmación `RESETEAR`.
- Material 3 XML, ViewBinding, modo oscuro, Room, WorkManager y DataStore. Permiso de Internet solo para pedidos y sincronización.

## Integridad

El dinero se almacena como `Long` en centavos. Los cálculos fraccionarios usan enteros y `BigInteger` para evitar overflow. Los asientos de cada evento suman cero. Ventas, reversiones, compras, transferencias, gastos, préstamos, cierre, pagos y restablecimientos usan transacciones Room. Las acciones externas admiten claves únicas de idempotencia.

El método porcentual usa mayor residuo con desempate estable. El fijo proporcional se calcula sobre las donas acumuladas, de modo que los residuos se recuperan al completar una caja. Las ventas conservan precio y costo aplicados. El cierre conserva el plan y la configuración asociados al inicio de la jornada.

Room exporta esquemas en `app/schemas`, migra automáticamente de v1 a v2 y manualmente de v2 a v3 para conservar los datos al agregar la cola de sincronización. No se usa `fallbackToDestructiveMigration`. El token renovable se cifra con Android Keystore; no se guarda la contraseña.

La recepción del pedido y el cobro se pueden registrar. La opción de completar la entrega permanece deshabilitada hasta implementar una transacción única que reserve/descuente inventario, cree la venta, concilie el pago y otorgue puntos, sin duplicaciones entre Room y Supabase. La cola de operaciones es un registro de auditoría remoto; todavía no reemplaza el libro contable local. La API requiere la migración `202609230001_android_event_types.sql` y el endpoint `/api/auth/session` desplegados.

## Compilar

JDK 17, Android SDK 35, Build Tools 35.0.0 y Gradle 8.11.1:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug lintDebug assembleDebugAndroidTest
```

Las pruebas instrumentadas se compilan con el comando anterior. Para ejecutarlas hace falta un Android conectado y autorizado: `connectedDebugAndroidTest`.

El APK debug se genera en `app/build/outputs/apk/debug/app-debug.apk`. Para distribución pública debe crearse una clave release privada y conservarse para futuras actualizaciones.

## Pasar desde el APK 1.1.1

El APK 1.1.1 y este proyecto tienen el mismo paquete `com.bryan.donas`, pero sus certificados de firma son distintos. Android rechaza la actualización directa. Además, la base Room antigua tiene un esquema diferente: instalar encima, aunque se consiguiera la firma, no constituye una migración de datos.

Para probar sin borrar la instalación antigua, compilar `assemblePilot` e instalar `app/build/outputs/apk/pilot/app-pilot.apk`. La variante **Donas Control Piloto** usa `com.bryan.donas.pilot` y almacena sus datos por separado. No registrar ventas reales en las dos apps a la vez: sus libros e inventarios no están conciliados.

Antes de sustituir la app antigua, conectar el teléfono por USB con depuración autorizada y ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File tools/export-legacy-debug-db.ps1
```

La herramienta conserva `donas.db` y, si existen, sus archivos WAL/SHM en `outputs/legacy-db-*`. Requiere que el APK 1.1.1 **debug** siga instalado; `run-as` no funciona con una versión release. La exportación CSV de la app antigua sirve para consultar asientos, pero no contiene toda la configuración, las cantidades ni los lotes FIFO. No desinstalar 1.1.1 hasta validar una conversión completa de la base extraída y sus saldos.
