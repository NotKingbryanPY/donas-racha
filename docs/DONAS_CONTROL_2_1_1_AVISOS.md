# Donas Control 2.1.1 — comprobación de avisos

## Problema y causa comprobada

El usuario, desde Samsung A23, recibió una notificación Android real al enviar la prueba, pero Activar/comprobar avisos conservaba el texto Comprobando teléfono y emisor. DailyActivity guardaba ese literal en orderFeedback; las actualizaciones de PushHealth repintaban la pantalla sin finalizar ese mensaje. La recepción de la prueba no demuestra todavía recepción de un pedido con pantalla bloqueada.

Después de instalar2.1.1 el usuario informó el estado terminal No se completó la comprobación. La lectura sanitizada de Vercel encontró20 errores recientes400/VALIDATION_ERROR en POST /api/auth/session. La API exigía20 caracteres al refresh token; [Supabase Auth genera también tokens opacos de12](https://github.com/supabase/auth/blob/master/internal/models/refresh_token.go). La regresión reprodujo400 para ese caso y la prueba pública con un token ficticio de12 confirmó el rechazo previo a Supabase. No se leyeron tokens reales ni registros de clientes. La asociación exacta con el fallo del A23 queda pendiente de su diagnóstico/prueba posterior; este error comprobado bloqueaba toda renovación válida corta, incluidos registro FCM, pedidos y datos diarios.

## Corrección

El registro devuelve su UUID real de WorkManager. La comprobación manual tiene feedback separado de los pedidos y observa WorkInfo con el ciclo de vida: pendiente/red, ejecución, espera de trabajo anterior, reintento y finalización. SUCCEEDED/FAILED/CANCELLED rehabilitan el botón; no se confunde terminar una consulta con que Android haya mostrado un aviso. Durante el seguimiento se impide otra pulsación. UUID/propietario se conservan al recrear la pantalla y se descartan al cambiar cuenta. El worker persiste también el fallo de configuración pública Firebase.

Room sigue en7, sin otra migración ni SQL. Se mantienen la cola duradera, los reintentos, la renovación de token, el emisor configurado y los registros comerciales existentes.

POST /api/auth/session acepta ahora una cadena opaca no vacía, acotada y sin espacios, sin imponer una longitud mínima arbitraria ni convertir objetos/números en tokens. Supabase verifica su validez y la API vuelve a comprobar ADMIN/SELLER; se mantienen rate limit, rotación y respuestas401/403 para credenciales/roles inválidos. La corrección es del servidor y sirve al APK2.1.1 ya instalado; no requiere otra versión ni borrar sesión/Room. Pruebas de renovación cubren12 caracteres, formato largo, token rotado, input malformado, permisos y fallos temporales.

## APK y verificaciones

- Distribución oficial firmada, com.bryan.donas.control, versión2.1.1/código17; mínimo API23, objetivo35.
- 5,381,968 bytes; SHA-256 `5da6fc695951e929250ed70b9d89ebf9d5ce5286e9aa600e0c63d170787d2e76`.
- Certificado SHA-256 `5681a1329740c46b2c7a718e3e8a431951c7b6486fc625196dc3dd7ecadb249d`, igual al anterior; firma v1/v2 válida y alineación16KB comprobada.
- PASS120 pruebas Android sin fallos/errores, lintDebug/lintOfficial y build optimizado R8. Las tres regresiones nuevas ejercitan WorkManager/lifecycle: éxito, fallo/reintento y finalización mientras la pantalla está detenida.
- Escaneo de992 entradas sin PEM privado, JSON de cuenta de servicio, JWT service_role, keystore o base local empaquetados. Este escaneo no sustituye una auditoría completa.
- CI del APK9d48f05 aprobado; CI posterior86b0971 aprobado en las tres workflows: Android (build y emuladores API23/35), web/API/SQL/browser/concurrencia y conocimiento. La corrección de sesión tiene su propia validación.
- PASS local de renovación/regresión y contraseña de6, backend completo, seguridad, sesión de cliente, lookup de notificación, API/proveedor FCM y sintaxis web. Prueba previa al cambio de servidor: token ficticio de12 devuelve400/VALIDATION_ERROR en producción.
- El APK se publicó y verificó en GitHub mediante URL inmutable9d48f05 con tamaño/hash idénticos; el usuario lo instaló. Descarga dracha.store200 con5,381,968 bytes/hash idénticos verificada después del despliegue; comprobación física posterior de avisos pendiente.

[Descarga oficial verificada](https://www.dracha.store/downloads/Donas-Control-2.1.1-oficial.apk) · [SHA-256](https://www.dracha.store/downloads/Donas-Control-2.1.1-oficial.apk.sha256).

## Despliegue verificado — 14 octubre2026,21:25UTC

[PR44](https://github.com/NotKingbryanPY/donas-racha/pull/44) integrado tras CI en main a6067d89af513e79a502dec557ea1d29a32802c4. [Vercel Production](https://vercel.com/king-entertainment/donas-racha/ZKUMjhaFUVXVKKb5etaNp1DPH6A1): dpl_ZKUMjhaFUVXVKKb5etaNp1DPH6A1 Ready y alias dracha.store/www.dracha.store comprobados. El mismo token ficticio de12 pasó del rechazo local400/VALIDATION_ERROR a401/INVALID_CREDENTIALS de Supabase; demuestra que alcanza al proveedor, sin validar una sesión privada real. Token vacío continúa400. Web/catálogo/inventario200; pedidos/avisos/despacho anónimos401; rutas móviles retiradas410; descarga oficial2.1.1/hash200 idénticos. La prueba en preview quedó en401 de protección Vercel y no certificó la API; se verificó el dominio Production después. Sin SQL nuevo ni rotación accidental de CRON_SECRET.

El usuario puede volver a Activar/comprobar avisos con el APK2.1.1 instalado. Si falla, conservar el diagnóstico exacto. No se afirma todavía renovación autenticada real en el A23, pedido bloqueado/segundo plano ni tap/gestión tras esta corrección.

## Instalar y comprobar

Instalar como actualización sobre la versión oficial, sin desinstalar ni borrar datos. En Pedidos pulsar Activar/comprobar avisos: el mensaje debe terminar y el diagnóstico debe mostrar el resultado. Enviar prueba a este teléfono y verificar aviso del sistema. El usuario ya confirmó que Activar recuperación del servidor devolvió programada en2.1.0; no repetir SQL ni el script que rota CRON_SECRET para instalar2.1.1.

Pendiente probar pedido web real con app en segundo plano/pantalla bloqueada, tap al pedido y gestión sin doble cobro/reserva/registro. No garantizar entrega instantánea ni recepción después de detener forzosamente Android.

## Estado externo y credenciales

Ver [activación2.1](DONAS_CONTROL_2_1_PEDIDOS.md): SQL02/03 validado por resultados del usuario, cuatro variables protegidas en Vercel Production, redeploy Ready y OAuth/FCM validate_only200 verificados por el agente. Usuario confirmó prueba del sistema recibida en A23 y configuración de recuperación; no se comprobó directamente la ejecución posterior de un cron ni la entrega bloqueado.

La clave privada adjuntada al chat sigue pendiente de sustitución/revocación; no se incorporó al APK/Git/guías ni se imprimieron sus valores. La nueva credencial debe transferirse directamente al servidor, sin adjuntarla al chat. La comprobación IAM no verificó gestión de claves; no se ampliaron roles ni se alteraron claves.
