# Datos y contratos

[Contexto](AI_CONTEXT.md) · [Catálogo SQL completo](generated/SQL_CATALOG.md) · [Relaciones](diagrams/07-database.md)

El catálogo generado indexa declaraciones locales, no materializa la evolución ni certifica el esquema remoto. Leer migraciones/wrappers y preflight. No contiene registros reales ni secretos.

## Tablas nuevas

| Tabla | Contrato |
|---|---|
| daily_sessions | UUID, business_date Panamá, opened_at/closed_at/closed_by, closing_operation_id único, closing_summary; una sola abierta global |
| daily_operations | UUID global, secuencia servidor, jornada/actor, kind, hash/payload inmutable, occurred_at/created_at, inversión/ingreso/pago/costo/costo desconocido, order_id único |
| daily_operation_items | PK operación+variante, snapshots nombre/SKU, cantidad, composición por caja, precio y costo |
| daily_cost_lots | FIFO por variante, compra de origen opcional, unidades restantes y costo unitario decimal/null |

Tipos: PURCHASE, SALE, CONSUMPTION, CORRECTION, WEB_SALE, CLOSE. Cantidades enteras; dinero de entrada entero en centavos; costo calculado decimal, salida redondeada. Fechas del servidor ordenan recepción y fecha efectiva del cliente se valida contra apertura y futuro máximo de cinco minutos. Solo service_role puede ejecutar api_daily_apply/api_daily_snapshot; API valida cuenta/rol. Helpers internos no se conceden a clientes ni service_role. RLS activo, tablas nuevas sin lectura anon/authenticated.

## Modelo compartido reutilizado

products/product_variants: UUID y cuatro SKUs existentes; active/available comercial separado de unidades. inventory_manual_counts fija referencia física y movement_sequence; inventory_movements registra delta con source_key único; inventory_revision protege conteos; inventory_by_flavor calcula físico − reservas. Compras v2 insertan movimientos daily:UUID:variant; no pasan por el trigger antiguo de caja fija. Ventas y consumo comprueban counted/stock libre bajo el mismo lock 26092601. Un error revierte recibo, dinero, costo y stock.

orders/items/events/payments y funciones de estados/pago/fidelidad existentes se conservan. Nuevo trigger de entrega solo contabiliza costo/ingreso. customers, cuentas/transacciones de puntos, rachas, insignias, recompensas/canjes, onboarding, configuración y autenticación no se migran ni se reinician.

app_devices/sync_operations/box_purchases/flavor_sales e invitaciones/push/Firebase son históricos; algunas tablas pueden estar en donas_mobile_archive según la ejecución real de retirada. v2 no depende de restaurarlas ni importa sus operaciones. Las vistas/helpers históricos renombrados pueden seguir siendo dependencias de pedidos actuales: no eliminarlos por nombre.

## Room

AppDatabase v6 mantiene todas las entidades v5 en donas.db. Migración 5→6 solo CREATE TABLE/INDEX daily_outbox y daily_cache. Conserva migraciones 1→2 automática, 2→3, 3→4 y 4→5. Sin fallback destructivo.

daily_outbox: UUID, ownerId, sessionId, kind, payload, createdAt, state PENDING/ACKED/CONFLICT/CANCELLED, sequence/error/attempts. daily_cache: PK usuario, JSON y receivedAt. Las tablas viejas de capital/FIFO/socios/pedidos/outbox permanecen para conciliación. No se equiparan los ledgers SQLite y PostgreSQL por compartir nombres.

## Fórmulas

- Inversión = suma del costo de compras de la jornada.
- Ingresos = ventas presenciales + pedidos web entregados nuevos; efectivo + Yappy.
- Costo vendido = suma FIFO de unidades vendidas con costo conocido.
- Utilidad comercial = ingresos − costo vendido, pendiente si falta costo vendido.
- Resultado operativo mostrado = utilidad − costo consumo − costo correcciones; pendiente si cualquier salida carece de costo.
- Flujo de caja = ingresos − compras; no equivale a utilidad.
- Existencias = conteo + movimientos; disponible = físico − reservas, con déficit detectado.

Inventario no vendido conserva unidades/costo y no se imputa como pérdida del día. No se reconstruye una inversión histórica desconocida.
