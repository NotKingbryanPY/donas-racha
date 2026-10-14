# Android Donas Control 2

`donas-control/` contiene la app activa: compras configurables, ventas por sabor con pago dividido, consumo, inventario y cierre diario. Supabase es la autoridad compartida con la web; Room v6 conserva datos v5 y añade outbox/caché nuevas.

Leer `donas-control/README.md`, `../AGENTS.md` y `../docs/knowledge/AI_CONTEXT.md`. `phase9-overlay/`, el ledger contable antiguo y los flujos móviles retirados son historia; no aplicar el overlay ni restaurar /api/sync/push/provisión automáticamente. iOS queda para otra etapa.
