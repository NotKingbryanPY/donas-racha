# Donas Control 2.1.1 — comprobación de avisos

## Problema y causa comprobada

El usuario, desde Samsung A23, recibió una notificación Android real al enviar la prueba, pero Activar/comprobar avisos conservaba el texto Comprobando teléfono y emisor. DailyActivity guardaba ese literal en orderFeedback; las actualizaciones de PushHealth repintaban la pantalla sin finalizar ese mensaje. La recepción de la prueba no demuestra todavía recepción de un pedido con pantalla bloqueada.

## Corrección

El registro devuelve su UUID real de WorkManager. La comprobación manual tiene feedback separado de los pedidos y observa WorkInfo con el ciclo de vida: pendiente/red, ejecución, espera de trabajo anterior, reintento y finalización. SUCCEEDED/FAILED/CANCELLED rehabilitan el botón; no se confunde terminar una consulta con que Android haya mostrado un aviso. Durante el seguimiento se impide otra pulsación. UUID/propietario se conservan al recrear la pantalla y se descartan al cambiar cuenta. El worker persiste también el fallo de configuración pública Firebase.

Room sigue en7, sin otra migración ni SQL. Se mantienen la cola duradera, los reintentos, la renovación de token, el emisor configurado y los registros comerciales existentes.

## APK y verificaciones

- Distribución oficial firmada, com.bryan.donas.control, versión2.1.1/código17; mínimo API23, objetivo35.
- 5,381,968 bytes; SHA-256 `5da6fc695951e929250ed70b9d89ebf9d5ce5286e9aa600e0c63d170787d2e76`.
- Certificado SHA-256 `5681a1329740c46b2c7a718e3e8a431951c7b6486fc625196dc3dd7ecadb249d`, igual al anterior; firma v1/v2 válida y alineación16KB comprobada.
- PASS120 pruebas Android sin fallos/errores, lintDebug/lintOfficial y build optimizado R8. Las tres regresiones nuevas ejercitan WorkManager/lifecycle: éxito, fallo/reintento y finalización mientras la pantalla está detenida.
- Escaneo de992 entradas sin PEM privado, JSON de cuenta de servicio, JWT service_role, keystore o base local empaquetados. Este escaneo no sustituye una auditoría completa.
- CI, publicación de descarga y recepción física con esta versión se registrarán después de verificarlas; no se deducen del build local.

[Descarga prevista de distribución](https://www.dracha.store/downloads/Donas-Control-2.1.1-oficial.apk) · [SHA-256](https://www.dracha.store/downloads/Donas-Control-2.1.1-oficial.apk.sha256). Confirmar publicación antes de usar el enlace.

## Instalar y comprobar

Instalar como actualización sobre la versión oficial, sin desinstalar ni borrar datos. En Pedidos pulsar Activar/comprobar avisos: el mensaje debe terminar y el diagnóstico debe mostrar el resultado. Enviar prueba a este teléfono y verificar aviso del sistema. El usuario ya confirmó que Activar recuperación del servidor devolvió programada en2.1.0; no repetir SQL ni el script que rota CRON_SECRET para instalar2.1.1.

Pendiente probar pedido web real con app en segundo plano/pantalla bloqueada, tap al pedido y gestión sin doble cobro/reserva/registro. No garantizar entrega instantánea ni recepción después de detener forzosamente Android.

## Estado externo y credenciales

Ver [activación2.1](DONAS_CONTROL_2_1_PEDIDOS.md): SQL02/03 validado por resultados del usuario, cuatro variables protegidas en Vercel Production, redeploy Ready y OAuth/FCM validate_only200 verificados por el agente. Usuario confirmó prueba del sistema recibida en A23 y configuración de recuperación; no se comprobó directamente la ejecución posterior de un cron ni la entrega bloqueado.

La clave privada adjuntada al chat sigue pendiente de sustitución/revocación; no se incorporó al APK/Git/guías ni se imprimieron sus valores. La nueva credencial debe transferirse directamente al servidor, sin adjuntarla al chat. La comprobación IAM no verificó gestión de claves; no se ampliaron roles ni se alteraron claves.
