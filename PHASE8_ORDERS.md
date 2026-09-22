# Fase 8 — Pedidos y seguimiento

La portada permite armar un pedido con los sabores disponibles y enviarlo al backend transaccional de Supabase a través de Vercel.

## Experiencia del cliente

- Carrito con cantidades y total calculado para orientar al cliente; el servidor vuelve a calcular el precio real.
- Nombre, WhatsApp y ubicación de entrega requeridos.
- Pago presencial en efectivo o por Yappy al `6015-0927`.
- Código público guardado en el dispositivo para consultar el estado.
- Estados visibles: pendiente, aceptado, en camino, entregado o cancelado.
- Los valores heredados `PREPARING` y `READY` se presentan como “Pedido aceptado”; el negocio no muestra preparación porque las donas ya están hechas.

## Seguridad y fiabilidad

- Cada intento utiliza una clave idempotente. Si la red tarda demasiado, repetir el envío consulta o devuelve el mismo pedido sin duplicarlo.
- El navegador nunca envía precios aceptados por el servidor.
- La consulta pública no devuelve teléfono, ubicación exacta ni datos privados de pago.
- No se cobra dentro de la página.
