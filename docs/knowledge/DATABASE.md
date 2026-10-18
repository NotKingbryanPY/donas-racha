# Datos y contratos

Toda variante operada debe tener un conteo físico inicial registrado. Una compra no presume stock cero cuando falta esa referencia: INVENTORY_COUNT_REQUIRED conserva el pendiente hasta registrar el conteo real y reintentar el mismo UUID. El ledger nuevo no inserta ni reescribe conteos para facilitar la activación.

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

## Pedidos/avisos2.1

Room7 añade solo staff_order_cache(ownerId PK,json,receivedAt); 6→7 no toca tablas previas. Guarda todos los activos consultados (máximo2000) y50 recientes; UI renderiza40 por página. Detalle remoto por UUID permite abrir un pedido viejo. Costo, inventario y pagos siguen exclusivamente en las tablas/RPC comerciales ya activadas.

202610140001 reutiliza/crea push_devices/order_push_jobs sin importar archivo histórico. Añade auth_mode(defaultLEGACY),revoked_at,registered_at; solo SUPABASE_STAFF_V2 se registra/envía en el flujo nuevo. Cola única pedido/dispositivo, lease2min, backoff y10 intentos; delivered_at significa aceptación del proveedor. RPC staff privados, RLS y sin SELECT/EXECUTE anon/authenticated. Tokens rotados no se desactivan por un error tardío del token anterior.

SQL03 habilita cron/pg_net/Vault y helpers privados. CRON_SECRET viaja desde Vercel a Vault por RPC ADMIN/servidor, nunca desde frontend. Net guarda headers descifrados: schema/tablas/funciones quedan cerradas a PUBLIC/anon/authenticated. Otros cron se conservan; una falla de permisos aborta el instalador.

orders-v2/05_delivery_diagnosis.sql es una consulta READ ONLY de metadata sobre orders/order_push_jobs/push_devices/app_user_roles ya existentes. No es migración ni activación. Devuelve pedidos incluso sin job y excluye tokens, usuarios y datos personales. Privilegios/RLS/stock permanecen. accepted_by_fcm_at es aceptación FCM, no confirmación Android.

## Lecturas Drachas18octubre: sin migración

Se reutilizan orders(id/public_code/customer_id/status/payment_method/payment_status/currency_code/total_cents/created_at/updated_at/completed_at/cancelled_at/delivery_location), order_items y order_events. Filtro propietario siempre en servidor, activos e histórico separados y paginados; datos no-store. Detalle ya no selecciona actor_type/note, solo estados/fechas. No cambia RLS, grants, transacciones, tablas, registros o códigos DR-. INVALID_PRODUCT_VARIANT/INVALID_ITEMS de SQL se traducen a rechazos400 conocidos sin imprimir mensajes internos.
