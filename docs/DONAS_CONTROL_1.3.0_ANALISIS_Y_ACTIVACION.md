# Donas Control 1.3.0: análisis y activación

## Punto de partida y decisión

La página ya gestionaba clientes, fidelidad, pedidos y roles ADMIN/SELLER con Supabase. Android tenía una contabilidad offline amplia con Room, FIFO, jornadas, socios y widget. El archivo iOS anterior solo consultaba pedidos. El inventario web era un conteo independiente de las ventas offline.

Se conservó Android nativo para proteger sus datos y funciones. Se amplió iOS en SwiftUI, con proyecto Xcode y paquete para Swift Playgrounds desde el iPad. Ambos usan la misma API y el inventario central.

## Cambios implementados

- Caja fija de **12**: 4 chocolate, 4 vainilla, 2 chocolate con chispas y 2 vainilla con chispas.
- Sesión renovable guardada de forma segura. Errores de red, 429 y fallos temporales no borran la sesión. Renovaciones simultáneas coordinadas y tokens nuevos persistidos antes de usarlos.
- Android: resumen operativo en Inicio, pedidos guardados, inventario compartido y conteos con revisión. Se conservan ventas, contabilidad, widget y escáner.
- iOS: Inicio, Pedidos, Ventas por sabor, Inventario y Ajustes; FIFO, efectivo/Yappy, compras, gastos, transferencias, préstamos, socios, historial, apertura/cierre, reversión presencial y copias. Abrir jornada concilia el saldo real sin sumar otra vez el capital anterior.
- Movimientos offline enviados después de **10 segundos de Wi‑Fi estable**, con acuses e identificadores únicos. Pedidos y avisos pueden usar datos móviles. iOS evita subir en modo de datos limitados.
- Inventario publicado: conteo físico más compras y menos ventas posteriores, descontando reservas. Una entrega no se descuenta de nuevo al subir el recibo contable. La página consulta disponibilidad cada 20 segundos mientras está visible y conectada.
- Conteo físico protegido por revisión: si cambia una venta o pedido, el conteo viejo se rechaza. Los conteos físicos no se guardan offline.
- FCM/APNs, registro/desvinculación de dispositivos, cola persistente, leases y reintentos. Un fallo del proveedor no cancela el pedido. Un resultado tardío de token inválido no desactiva uno ya renovado.
- SELLER consulta y atiende pedidos desde ambas apps; ADMIN escribe movimientos y conteos compartidos.

## Simultaneidad y límites offline

Tras sincronizar, las tres interfaces consultan el mismo inventario del servidor. Sin conexión, el servidor no conoce todavía una venta local: no puede mostrarla inmediatamente en otros dispositivos. Queda pendiente hasta volver el Wi‑Fi estable. La pantalla distingue stock local y stock publicado.

Si dos personas venden las mismas unidades físicas offline, puede haber una diferencia al reconectar. Se señalan existencias que necesitan conciliación. Asignar stock físico por persona o mantener un libro administrador principal y cuentas SELLER para quienes atienden pedidos online. El inventario compartido no fusiona los libros de dinero de cada instalación.

## Activación productiva

No se modificó la base productiva ni se publicaron automáticamente las migraciones: no hay credenciales Supabase/Vercel en este workspace. Los cambios quedan en una rama de revisión.

1. Respaldar Supabase y las bases locales. Sincronizar todos los dispositivos con pendientes antes del cambio.
2. Verificar las migraciones anteriores, incluidas vendedores y clientes. Aplicar en orden `supabase/migrations/202610030001_shared_inventory.sql` y `supabase/migrations/202610030002_order_push.sql`.
3. Publicar la web/API de la rama después de sus funciones SQL.
4. Revisar los cuatro sabores. La migración conserva el balance anterior y no suma nuevamente las compras históricas. Hacer un conteo físico de todo el negocio, incluidas las unidades reservadas, con todos los equipos sincronizados.
5. Actualizar apps, conectar cada cuenta una vez y autorizar avisos. Probar caja 4/4/2/2, venta offline, reconexión Wi‑Fi, pedido, cancelación, cobro/entrega y descuento único.

El conteo absorbe los movimientos ya aplicados. Una venta aún offline en otro equipo llegará después: sincronizar todos antes de contar. El servidor vuelve a comprobar existencias al crear cada pedido.

## Avisos con la app cerrada

El código está implementado; las claves Firebase/Apple no están disponibles y no se han probado entregas push reales.

**Android:** crear Firebase para el paquete distribuido (`com.bryan.donas.pilot` en el piloto). Configurar GitHub Repository Variables `FIREBASE_ANDROID_APP_ID`, `FIREBASE_ANDROID_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SENDER_ID`; el workflow las pasa a Gradle. Para build local, usar propiedades `FIREBASE_APP_ID`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SENDER_ID`. Una configuración de otro paquete no es intercambiable.

**Servidor FCM:** configurar en Vercel `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` de una cuenta de servicio autorizada. La clave privada nunca se incluye en el APK.

**iOS:** firmar con el equipo Apple del propietario y habilitar Push Notifications. Configurar en Vercel `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID=com.bryan.donas.control`. Debug registra sandbox; Release, producción. El paquete Playgrounds permite ejecutar desde iPad, pero no configura por sí solo las capacidades de distribución/push.

**Reintentos:** poner el mismo valor aleatorio en Vercel `CRON_SECRET` y GitHub Actions Secret `ORDER_PUSH_CRON_SECRET`. El workflow `order-push-retry.yml` reintenta cada cinco minutos una vez incorporado a main. Se intenta enviar también al crear pedidos y registrar dispositivos. Sin configuración, siguen los avisos locales al consultar. Los sistemas operativos pueden retrasar tareas y avisos.

## Sesiones durante semanas o meses

La app no impone un cierre semanal/mensual: conserva y renueva hasta cerrar sesión, revocación o política del servidor. Revisar Supabase Auth: duración máxima, inactividad y sesión única. Una política de sesión única puede cerrar otros dispositivos. Preferir una cuenta SELLER propia por socio.

Referencias oficiales: [sesiones Supabase](https://supabase.com/docs/guides/auth/sessions), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [APNs con token](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns).

## Instalación y traslado

El APK entregado es **Donas Control Piloto 1.3.0**, firmado con la clave reutilizada en CI. Convive con el original porque usa otro paquete. Si un piloto tiene otra firma, Android rechazará actualizar: conservar/exportar sus datos antes de cualquier cambio. No desinstalar para resolverlo sin verificar la copia. El README Android describe el caso del APK 1.1.1.

`Donas-Control-iPad-1.3.0.zip` contiene un proyecto `.swiftpm`, no un IPA. Descomprimir en Archivos y abrir/ejecutar con Swift Playgrounds. La app completa sí compiló en macOS y abrió en simulador iPad mediante CI; falta comprobar el paquete en el iPad físico. Un icono independiente, TestFlight o App Store requieren firma Apple; no se produjo un IPA instalable sin ella.

iOS empieza con libro propio. No importa automáticamente Room ni comparte saldos/préstamos Android. Registrar saldos y existencias iniciales sin repetir compras ya enviadas al servidor. Una conversión histórica completa SQLite necesita una copia real de los datos. El reparto iOS es porcentual estimado; no replica modos fijos avanzados, widget ni escáner Android.

## Verificación

Pruebas de FIFO, mezcla 4/4/2/2, centavos, reversión, idempotencia, copias, fallos temporales, revocación y renovación simultánea. PostgreSQL ejecuta las migraciones y verifica reservas, entregas, movimientos retrasados, conteos con revisión, RLS y cola push. Contratos web/API y conservación del carrito al actualizar disponibilidad.

Android ejecuta tests y lint; iOS Swift tests, Xcode y apertura en simulador. No hay Android ni iPad físico conectado, firma Apple ni claves push. Quedan pendientes validación en dispositivos, notificaciones reales, migración productiva y actualización de equipos con esas configuraciones.
