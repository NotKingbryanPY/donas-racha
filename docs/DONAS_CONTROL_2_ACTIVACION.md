# Activar Donas Control 2 sin reiniciar producción

## Orden y alcance

Leer primero `ACTIVACION_2026-10-08.md` y `DONAS_CONTROL_2_AUDITORIA.md`. Proyecto Supabase `yopntnzhcfudaabudbld`, web `www.dracha.store`. La nueva API usa la configuración Supabase protegida que ya utiliza la web; no necesita FCM, CRON_SECRET, cuenta de servicio Firebase ni otra base de inventario.

El usuario autorizó avanzar con la reconstrucción y preservar datos. Browser/Computer no inicia en esta sesión; por tanto **no se ejecutó este SQL en producción**. Las pruebas aisladas pasaron, pero no certifican objetos privados reales. Preparar respaldo y una ventana breve sin conteos/ventas concurrentes; no introducir clientes/pedidos de prueba en producción sin distinguirlos.

| Orden | Archivo | Objetivo/dependencias | Riesgo y verificación |
|---|---|---|---|
| 0 | `supabase/sql-editor/daily-v2/00_preflight.sql` | Solo lectura: tablas/vista/RPC compartidos y triggers de pedidos. | Deben existir ledger/revisión/snapshot; exportar cifras sin secretos para comparar después. Si difieren del esquema esperado, detener instalación y revisar. |
| 1 | `supabase/sql-editor/daily-v2/01_apply.sql` | Copia exacta de `202610130001_daily_operations.sql`: añade cuatro tablas RLS, RPC y trigger contable nuevo. No requiere restaurar archivo móvil. | Transacción y lock_timeout5s/statement_timeout60s. No cambia unidades, puntos ni ventas viejas al instalar. Las entregas futuras sumarán un recibo financiero; una falla de ese trigger revierte la entrega, por eso se probó el flujo aislado. |
| 2 | `supabase/sql-editor/daily-v2/02_verify.sql` | Solo lectura: una jornada abierta, grants/RLS/duplicados/stock. | server_can_apply=true, anon/authenticated=false; RLStrue y lecturas públicasfalse; anomalías0; stock/reservas iguales al preflight si no hubo operaciones concurrentes. |
| opcional | `supabase/sql-editor/daily-v2/03_suspend.sql` | Suspensión del RPC/trigger nuevo; conserva tablas y movimientos. | No revierte ventas ya registradas ni borra stock. Coordinar clientes; volver a01 restablece acceso, sin reinicializar historia. |

En Supabase SQL Editor abrir una consulta nueva por archivo, pegarlo **completo**, ejecutar y comprobar resultado. Si falla, conservar el error; ROLLBACK si quedó transacción abortada. No ejecutar fragmentos con `$$` incompletos. El archivo01 puede repetirse para reinstalar definiciones/grants, no importa datos antiguos ni reinicia jornadas existentes. No ejecutar seed, paquete02deoctubre8 ni archivo móvil de retirada para activar v2.

## Publicar e instalar

Código/guías/CI en el mismo PR y main ligado al proyecto Vercel existente. No crear hosting alternativo ni cambiar SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY. Hasta aplicar SQL, el panel nuevo informa activación pendiente y los flujos web existentes siguen disponibles.

APK oficial: paquete `com.bryan.donas.control`, versión2.0.0/código15, firma de distribución existente. Instalar como actualización; **no desinstalar** para resolver migración. Room6 agrega las dos tablas nuevas y conserva el libro v5. Una app .pilot es otra instalación: no asumir que compartir nombre trae sus datos.

Entrar con la misma cuenta Supabase ADMIN/SELLER del Dashboard; Firebase antiguo no es esa cuenta. La contraseña no se guarda. Primera consulta online necesaria antes de registrar offline. Compras registran costo total/mix; el último mix se conserva como preferencia local y cada recibo guarda su composición histórica.

## Recorrido manual obligatorio tras activación

1. Comparar stock inicial sin alterarlo. Registrar una compra real indicando cajas, mix y costo; esperar confirmación, comprobar aumento por sabor en Dashboard/catálogo.
2. Registrar una venta real por Yappy, otra efectivo y una dividida; comprobar que suma pago=total y stock reservado no se vende dos veces.
3. Registrar consumo real; comprobar salida sin ingreso y costo separado. Revisar costo desconocido si había stock anterior sin compras nuevas.
4. Desconectar red, registrar una operación autorizada, cerrar/abrir app; comprobar PENDING persistente. Reconectar y confirmar un solo recibo/movimiento. No confundirlo con venta servidor antes del ACK.
5. Con dos equipos, agotar stock/cerrar jornada desde uno; el pendiente incompatible del otro debe quedar como conflicto. Reintento conserva UUID; no duplicar la venta para ocultarlo.
6. Completar un pedido web real una sola vez; comprobar recibo WEB_SALE, único cobro/salida/fidelidad. Cancelar en camino mantiene el flujo existente.
7. Cerrar jornada sin pendientes; comprobar resumen histórico y stock idéntico, nuevo resumen cero. No borrar producción para probar este paso.
8. Cuenta sin rol y anónimo deben ser rechazados; retirar rol de una cuenta de prueba autorizada corta acceso al reconectar. No usar credenciales ajenas.

Sin teléfono ADB y sin acceso privado real no se declara este recorrido verificado. Notificaciones FCM fuera de la app e iOS quedan fuera del runtime2 actual, no se rehabilitan cron ni emisores antiguos. La app abre el Dashboard para pedidos. Un respaldo WorkManager no promete recepción instantánea.

Fuentes oficiales consultadas para la decisión: [Android offline-first](https://developer.android.com/topic/architecture/data-layer/offline-first), [sesiones Supabase](https://supabase.com/docs/guides/auth/sessions). Las reglas de negocio se validan en PostgreSQL; la caché local no es autoridad global.
