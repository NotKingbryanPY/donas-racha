# Funciones y límites

[Contexto](AI_CONTEXT.md) · [Pruebas](VALIDATION.md)

| Función | Implementación nueva / límite |
|---|---|
| Compra por caja | mix inicial 4/4/2/2, cantidad y total configurables; 0 excluye sabor; último mix preferido local; snapshot por compra |
| Venta | sabores/cantidades/precio; efectivo/Yappy/dividido; centavos exactos, pago debe sumar total |
| Consumo | salida diferenciada, sin ingreso, costo separado |
| Corrección | ADMIN, motivo, delta, online/revisión; positivo sin compra no inventa costo |
| Resumen | confirmado central; inversión, unidades, ingresos por método, costos/utilidad/flujo; costo desconocido visible |
| Cierre | online, cola vacía, revisión/secuencia; conserva historia y existencias; reinicia resumen después de confirmación |
| Offline | copia autorizada + outbox; máximo 24 h sin nueva validación, pendiente no confirmado; conflictos revisables |
| Historial | recibos centrales paginados de 50, últimos cierres (30), pendientes/rechazados locales |
| Web | panel diario de lectura, stock compartido, pedidos/puntos/perfiles/canjes/tutorial existentes |
| Pedidos nativos | entrada principal; aceptar/en camino/cobrar-entregar/cancelar; API existente online, copia por propietario y tap a UUID incluso fuera de página reciente |
| Avisos externos | FCM alta prioridad, canal/sonido/permisos, dedupe duradero, token renovable/revocable y prueba real al propio teléfono; requiere SQL/emisor/reintento |
| Diagnóstico servidor | recuperación protegida espera envío/ACK; logs con códigos/contadores; SELECT seguro05 para correlacionar pedido y cola, sin certificar entrega |
| Comprobación de avisos | UUID real de WorkManager observado con lifecycle; espera/red/reintento/finalización explícitos, botón sin doble pulsación y diagnóstico persistente |
| Android anterior | datos/tablas/source preservados; capital/socios/widgets/sync contable/provisión/push antiguos fuera del runtime; avisos2.1 autorizados se reconstruyen |
| Firebase | proyecto/configuración existente preservada; no datos de negocio nuevos; FCM nuevo; auth antiguo no rehabilitado |
| iOS | etapa posterior, sin build/distribución nuevos |

No hay borrado definitivo ni reversión automática de ventas confirmadas en esta versión. Rechazos conservan evidencia; corregir unidades exige motivo. Gestión de pedidos disponible nativa y en Dashboard. Emisor configurado; el usuario informó una prueba real recibida en Samsung A23 y recuperación programada. Falta confirmar recepción fuera de app/bloqueado y pedido real completo; compilar no certifica esos recorridos.

## Web Drachas18octubre

Identidad C vectorial, favicon/social/PNG derivados. Activos destacados, contador/acceso desde Perfil, detalle privado, historial paginado y enlace recuperable. Actualización15s visible/con activos, banner/toast deduplicados, offline identificado y backoff. Recibo con artículos/pago/entrega/WhatsApp, animación1s solo confirmada, movimiento reducido, sin repetir por render. Tutorial conserva versión/progreso y carrito móvil legible. Avisos dentro de web; no notificaciones del sistema con navegador cerrado. [Informe y pruebas](../DRACHAS_WEB_2026-10-18.md).
