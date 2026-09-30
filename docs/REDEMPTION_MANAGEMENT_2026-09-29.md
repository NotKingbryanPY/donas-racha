# Gestión de canjes

El panel de ventas muestra canjes pendientes, entregados y cancelados. Tanto SELLER como ADMIN pueden confirmar la entrega de un canje pendiente o cancelarlo. Cancelar devuelve automáticamente el costo original en puntos; un canje entregado no se puede revertir desde este flujo.

La migración `supabase/migrations/202609290001_redemption_management.sql` se aplicó manualmente en producción el 29 de septiembre de 2026, antes de publicar la web y la API. Añade el registro de quién y cuándo resolvió el canje, enlaza la transacción de devolución y crea una RPC accesible solo mediante la clave de servicio. No volver a ejecutarla; el proyecto no tenía historial de migraciones de Supabase CLI y ese historial deberá repararse antes de usar `supabase db push`.

La RPC bloquea la fila del canje y, al cancelar, la cuenta de puntos dentro de la misma transacción. Un segundo intento de la misma acción no vuelve a acreditar puntos. Si otra persona ya resolvió el canje en el estado opuesto, la API responde con conflicto y el panel actualiza la lista.

Si un canje heredado no tiene una transacción de gasto vinculada por el importe exacto, la cancelación automática se rechaza para evitar crear puntos. El administrador debe revisar ese caso manualmente.

Después de desplegar, verificar con un canje de prueba: pendiente → cancelado suma exactamente el costo original al saldo disponible y crea una transacción REVERSAL; pendiente → entregado registra la fecha y no altera puntos. Confirmar que SELLER y ADMIN pueden operar, mientras un cliente no puede usar estas acciones.
