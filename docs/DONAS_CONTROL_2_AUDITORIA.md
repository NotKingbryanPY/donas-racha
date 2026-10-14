# Reconstrucción Donas Control — diagnóstico previo, 13 octubre 2026

## Cambio de alcance autorizado

La solicitud actual sustituye la retirada total de Android del 12 de octubre. Se construye una interfaz nueva para compras, ventas, consumo, inventario y cierre diario. La web sigue funcionando. No se rehabilitan `/api/sync`, invitaciones, vínculos Firebase, push ni los cron anteriores.

## Evidencia revisada

Se leyeron AGENTS, las guías de `docs/knowledge`, activación del 8 de octubre, retirada web, auditoría anterior, código Kotlin/Room/API y migraciones. Git conserva la implementación 1.4.2 (`d304e46`) y la retirada (`fe8bcbb`); la web 1.5.1 está en `70164c4`. Se puede recuperar ese código sin restaurar su comportamiento. No se pueden deducir los registros de teléfonos, el costo del stock existente ni el estado actual de SQL privado a partir de Git.

Hallazgos comprobados en código:

- Room v5 conserva el libro contable, FIFO, socios, préstamos, pedidos, dos outboxes y migraciones no destructivas. La UI nueva no necesita capital ni reparto, pero sus tablas se conservarán.
- El registro antiguo de compras exige 12 unidades aunque la configuración permite otra cantidad. El trigger central también aplica 4/4/2/2; por eso no sirve para compras configurables.
- La contabilidad monetaria era por instalación. Un ACK del antiguo receptor no significaba consolidación completa de ingresos/costos. Las correcciones locales tampoco eran conteos centrales.
- La web mantiene Auth Supabase/roles, catálogo con UUID/SKU, reservas, ledger de unidades y confirmación transaccional de pedido/pago. Son componentes reutilizables.
- `/api/sync` y las rutas de autorización móvil devuelven 410 deliberadamente. No se usarán para la nueva app.
- El fallo anterior de avisos tenía una causa externa comprobada: faltaban credenciales del emisor y el secreto del workflow. Realtime no sustituye FCM. El nuevo alcance no activa avisos sin configurar y verificar una infraestructura nueva.
- La guía IA de octubre 8 conserva referencias a módulos retirados y versiones antiguas. Se consolidará con fronteras explícitas entre runtime nuevo e historia.

## Observaciones remotas de esta sesión

Firebase MCP confirmó proyecto `donascontrol-1f5df`, app Android `com.bryan.donas.control`, certificado oficial existente y Firestore Standard gratuito en us-east1. Firebase no es necesario para el nuevo libro compartido; no se crean datos comerciales allí ni se cambia facturación.

Browser/Computer falla al inicializar el kernel (`windows sandbox failed`, `helper_unknown_error`); no se accedió a Supabase Studio ni Vercel mediante UI. El SQL de producción no queda verificado por una prueba local. El usuario confirmó anteriormente `WEB_INVENTORY_READY`; no hay confirmación de archivo móvil. Los nuevos objetos no dependerán de restaurar el archivo.

## Arquitectura decidida antes de implementar

Supabase conserva la autoridad de inventario, pedidos, ventas y costos. API Vercel autenticada con las cuentas ADMIN/SELLER existentes. Room añade una cola nueva y snapshots junto a los datos v5; el worker anterior queda inactivo. UUID estable y recibo central, transacción única para operación/unidades/costos. WorkManager reintenta con conectividad y backoff; conflicto de stock/jornada conserva la operación para revisión.

El costo se calcula con lotes FIFO centrales. El costo total de una compra se reparte uniformemente entre las unidades compradas y conserva precisión decimal; el mix se guarda en la compra. Stock anterior sin costo se representa como costo desconocido, nunca como compra o ganancia ficticia. La utilidad comercial es ingresos menos costo de ventas; resultado después del consumo resta también el costo consumido. Inversión en compras y flujo neto de caja se muestran separados.

Cierre online, con cola local vacía y versión central vigente: guarda resumen, abre jornada nueva, conserva existencias e historia. No hay borrado definitivo en esta entrega. Las ventas de pedidos web completados se registran una sola vez en el libro nuevo, sin un segundo descuento de inventario ni otro crédito de puntos. No se importa automáticamente historia antigua ni pendientes contables v5.

Diseño propuesto: Hoy, Inventario, Historial; acciones Compra/Venta/Consumo, formularios con mix editable, pago dividido, sincronización visible. Paleta tomada de `assets/css/redesign.css`: fondo #100d17, tarjetas #1d1728, lavanda #c5a3ee y rosa #d986b4. Ejemplo generado antes de implementar la UI; sus cifras son ilustrativas.

## Límites y activación

Pruebas aisladas y build se registrarán en el informe final. SQL nuevo requiere preflight real y ejecución autorizada; falta acceso operativo a Studio en esta sesión. No se cambiará stock ni costo de producción para fabricar un resultado. iOS queda fuera de esta etapa. Recepción física de notificaciones no se promete ni se considera implementada por conservar clases históricas.
