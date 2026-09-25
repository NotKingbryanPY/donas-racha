# Perfil por ID y pedidos

La entrada de clientes usa el ID que el vendedor entrega por WhatsApp o QR. **No pide correo ni contraseña por defecto.** El perfil conserva el diseño, puntos, racha, ranking y tienda de la página principal; la pestaña «Pedir» permite elegir sabores, ubicación y pago al recibir. Los pedidos toman nombre y WhatsApp del registro central, nunca del formulario.

## Contraseña opcional

El cliente puede dejar su perfil solo con ID. Si activa contraseña, cada nueva entrada pide primero el ID y después la contraseña. Para impedir que otra persona que conozca el ID active una contraseña ajena, el vendedor verifica la identidad y entrega un código temporal desde `/admin-claims.html`. El mismo código permite restablecer una contraseña olvidada. Dura 30 minutos, se usa una sola vez y no debe publicarse. Activar o restablecer contraseña invalida las sesiones anteriores.

**Límite consciente del acceso por ID:** quien conoce un ID sin contraseña puede abrir ese perfil y pedir en nombre de ese cliente. No se debe presentar el ID como secreto ni como prueba fuerte de identidad. La comprobación de pago y entrega sigue en manos del vendedor. El endpoint antiguo de Apps Script que muestra datos del perfil por ID sigue existiendo; la contraseña opcional protege el acceso web nuevo y sus pedidos, pero no convierte ese endpoint antiguo en privado.

## Despliegue

1. Ejecutar `supabase/migrations/202609250002_customer_id_access.sql` antes de desplegar la web y la API. Conserva los 21 clientes y los pedidos existentes. Agrega sesiones de cliente por ID, contraseña opcional y creación de pedidos asociados al cliente central.
2. Comprobar que los IDs del registro por WhatsApp/Apps Script coinciden con `public.customers.public_id` y que cada cliente tiene `display_name` y `whatsapp_e164`. Si alguno falta, corregir la migración de ese cliente antes de ofrecer pedidos.
3. Desplegar la web y la API juntas. Probar con un ID de cliente real sin contraseña: entrar, ver el perfil existente y abrir «Pedir». Probar un pedido solo con datos de prueba o coordinado con el vendedor; confirmar que `orders.customer_id` apunta al cliente y que el nombre y WhatsApp del pedido son los registrados.
4. Probar activación de contraseña con código temporal, entrada posterior con ID + contraseña y rechazo de una sesión anterior. Probar recuperación con un segundo código temporal.

El correo de Supabase Auth queda exclusivamente para vendedores y administradores. Las rutas de registro y vinculación por correo de clientes dejan de estar disponibles. Los puntos no se acreditan al crear un pedido; el cierre automático de pago, entrega y puntos de fase 10 aún no está publicado en `main`.
