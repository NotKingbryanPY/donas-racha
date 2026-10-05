# Donas Control 1.3.0

Aplicación Android nativa para administrar un negocio ambulante de donas. La contabilidad funciona sin conexión; los pedidos se sincronizan cuando hay red. Android 6.0/API 23 o superior. La variante oficial usa `com.bryan.donas.control`, versión 1.3.0/código 10 y firma permanente; consultar [la guía de instalación y traslado](../../docs/ANDROID_OFICIAL_1.3.0.md).

## Funciones

- Configuración versionada de costo por caja y precio unitario. Caja fija de 12: 4 chocolate, 4 vainilla y 2 de cada sabor con chispas.
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
- Widget de cuatro sabores con − / cantidad / + por sabor (máximo 99 donas por venta). Al tocar Efectivo o Yappy guarda la venta local directamente, sin abrir la app; el resumen muestra el stock local total. La app ofrece el mismo selector visual de sabores desde «Nueva venta».
- Pedidos desde el backend: inicio de sesión administrador, cola local de operaciones, copia local de pedidos, aceptar/cancelar/en camino y cierre «Cobrado y entregado» con elección de efectivo o Yappy. Pago, entrega y fidelidad se confirman juntos.
- La sesión se renueva sin volver a pedir contraseña; la lista guardada se muestra apenas se abre Pedidos. Tras iniciar sesión una vez, WorkManager consulta pedidos automáticamente con conexión (Wi-Fi o datos) en intervalos del sistema de al menos 15 minutos y muestra una notificación por cada pedido nuevo pendiente detectado. Android 13+ pide permiso para avisos. El ahorro de batería, falta de red o permisos pueden retrasarlos; el soporte FCM y la cola están implementados, pero requieren configurar Firebase en la build y las claves del servidor para avisar con la app cerrada.
- Exportación/importación SQLite, reinicio de movimientos y restablecimiento de fábrica con doble confirmación `RESETEAR`.
- Material 3 XML, ViewBinding, modo oscuro, Room, WorkManager y DataStore. Permiso de Internet solo para pedidos y sincronización.

## Integridad

El dinero se almacena como `Long` en centavos. Los cálculos fraccionarios usan enteros y `BigInteger` para evitar overflow. Los asientos de cada evento suman cero. Ventas, reversiones, compras, transferencias, gastos, préstamos, cierre, pagos y restablecimientos usan transacciones Room. Las acciones externas admiten claves únicas de idempotencia.

El método porcentual usa mayor residuo con desempate estable. El fijo proporcional se calcula sobre las donas acumuladas, de modo que los residuos se recuperan al completar una caja. Las ventas conservan precio y costo aplicados. El cierre conserva el plan y la configuración asociados al inicio de la jornada.

Room exporta esquemas en `app/schemas`, migra automáticamente de v1 a v2 y manualmente de v2 a v3 y de v3 a v4 para conservar los datos al agregar sincronización y conciliación de pedidos. No se usa `fallbackToDestructiveMigration`. El token renovable se cifra con Android Keystore; no se guarda la contraseña.

La entrega confirmada registra la venta por sabor y los puntos en una transacción de Supabase. Room incorpora esa venta con una clave estable y sincroniza un recibo sin duplicar la venta central. Las ventas presenciales por sabor y compras de cajas se encolan sin conexión; el servidor las registra una sola vez por operación. La cola no reemplaza el libro contable local. El widget usa una clave estable por selección para que un reintento no duplique la venta; la selección se vacía solo cuando Room confirma el registro. El inventario local contabiliza unidades totales. Con las migraciones del 3 de octubre, compras y ventas offline actualizan el inventario publicado después de 10 segundos de Wi-Fi estable. Los conteos físicos se guardan online con revisión. El libro de dinero sigue siendo propio de cada dispositivo. Consultar `docs/DONAS_CONTROL_1.3.0_ANALISIS_Y_ACTIVACION.md`.

## Compilar

JDK 17, Android SDK 35, Build Tools 35.0.0 y Gradle 8.11.1:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug lintDebug assembleDebugAndroidTest
```

Las pruebas instrumentadas se compilan con el comando anterior. Para ejecutarlas hace falta un Android conectado y autorizado: `connectedDebugAndroidTest`.

El APK debug se genera en `app/build/outputs/apk/debug/app-debug.apk`. Para generar el APK oficial con su clave permanente privada usar `scripts/build-android-official.ps1` desde la raíz, con JDK/SDK configurados. El script no publica claves y entrega `outputs/Donas-Control-1.3.0-oficial.apk`. Los APK de CI tienen firma temporal para pruebas y no deben distribuirse como actualizaciones oficiales.

## Pasar desde el APK 1.1.1

El APK 1.1.1 y este proyecto tienen el mismo paquete `com.bryan.donas`, pero sus certificados de firma son distintos. Android rechaza la actualización directa. Además, la base Room antigua tiene un esquema diferente: instalar encima, aunque se consiguiera la firma, no constituye una migración de datos.

Para probar sin borrar la instalación antigua, compilar `assemblePilot` e instalar `app/build/outputs/apk/pilot/app-pilot.apk`. La variante **Donas Control Piloto** usa `com.bryan.donas.pilot` y almacena sus datos por separado. No registrar ventas reales en las dos apps a la vez: sus libros e inventarios no están conciliados.

Antes de sustituir la app antigua, conectar el teléfono por USB con depuración autorizada y ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File tools/export-legacy-debug-db.ps1
```

La herramienta conserva `donas.db` y, si existen, sus archivos WAL/SHM en `outputs/legacy-db-*`. Requiere que el APK 1.1.1 **debug** siga instalado; `run-as` no funciona con una versión release. La exportación CSV de la app antigua sirve para consultar asientos, pero no contiene toda la configuración, las cantidades ni los lotes FIFO. No desinstalar 1.1.1 hasta validar una conversión completa de la base extraída y sus saldos.

## Roles y configuración push

ADMIN sincroniza movimientos y modifica el inventario; SELLER consulta y atiende pedidos. La build recibe propiedades Gradle `FIREBASE_APP_ID`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SENDER_ID`. Vacías, no inicia Firebase y usa avisos al consultar. No incluir la clave de servicio privada en el APK. El workflow usa las Repository Variables documentadas en la guía.
