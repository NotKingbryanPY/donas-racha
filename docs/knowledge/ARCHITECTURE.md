# Arquitectura nueva y fronteras

La sincronización procesa lotes de hasta 50. Las consultas de proyección solo leen pendientes/conflictos y ACK posteriores al snapshot, con índice propietario/estado/secuencia. La interfaz limita el histórico local confirmado/descartado a 200 entradas y pagina el remoto; conservar historia no obliga a cargarla completa en RAM.

[Contexto](AI_CONTEXT.md) · [Diagrama](diagrams/01-system.md)

Android lee Room, escribe un payload inmutable con UUID y programa WorkManager. La API verifica Supabase Auth y app_user_roles antes de llamar RPC de service_role. PostgreSQL serializa operaciones con el mismo bloqueo de inventario usado por pedidos/conteos, valida saldo libre de reservas y aplica recibo + items + movimiento + costos en una transacción. No existe escritura directa desde el APK a tablas privilegiadas.

| Dato | Autoridad | Copia |
|---|---|---|
| catálogo, disponibilidad comercial | product_variants Supabase | web y snapshot Android |
| unidades/reservas | inventario compartido Supabase | daily_cache y proyección de pendientes |
| compra/venta/consumo/corrección | daily_operations + items Supabase | daily_outbox/recibos locales |
| costos FIFO | daily_cost_lots Supabase | resumen confirmado, sin libro independiente |
| jornadas/cierres | daily_sessions Supabase | snapshot de las 30 jornadas recientes |
| pedidos/pagos/puntos | tablas/RPC existentes Supabase | web; apertura del Dashboard desde Android |
| libro anterior | Room v5 conservado | no se reenvía ni se fusiona automáticamente |

DonasApp deja de programar OrderSync/PushRegistration y cancela trabajo histórico. El widget antiguo y el servicio FCM dejan de estar registrados en el manifest nuevo. El código histórico conserva pruebas/datos para recuperación; no describe el runtime nuevo. /api/sync y provisionamiento/Firebase/devices siguen retirados con 410.

Views nativas y Material evitan una WebView o framework nuevo. HTTP usa el cliente existente con redirecciones restringidas, timeouts y refresh cifrado; la API reutiliza el router existente para no añadir funciones Vercel innecesarias. Firebase/Firestore no reciben datos de negocio. Sus proyectos y SDK históricos no se eliminan.

Diseño inspirado en el perfil web: oscuro/lavanda/rosa, acciones rápidas y cifras claras. Sin servicio permanente, sin permisos de batería adicionales. Actualización web del resumen cada 60 s solo visible/online; inventario/catálogo mantienen sus mecanismos actuales. Trabajo Android de respaldo oportunista cada 30 min, no reloj exacto ni push.
