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
| Android anterior | datos/tablas/source preservados; capital/socios/widgets/old sync/push fuera de navegación/runtime nuevo |
| Firebase | proyecto/configuración existente preservada; no datos de negocio nuevos; auth/push antiguo no rehabilitado |
| iOS | etapa posterior, sin build/distribución nuevos |

No hay borrado definitivo ni reversión automática de ventas confirmadas en esta versión. Rechazos conservan evidencia; corregir unidades exige motivo. Gestión de pedidos permanece en el Dashboard web abierto desde la app; no se presenta como recepción push Android implementada.
