# Pendientes y evidencia

[Contexto](AI_CONTEXT.md) · [Activación](../DONAS_CONTROL_2_ACTIVACION.md)

| Tema | Estado / límite |
|---|---|
| Activación SQL v2 | PENDIENTE_VERIFICACION: navegador falla antes de abrir Studio; preflight/apply/verify necesitan ejecución real. Código local/SQL aislado no la certifican |
| Stock/costo inicial | Se preservan cantidades. Un sabor tenía reservas superiores al conteo en evidencia histórica; comprobar físico. El costo del stock anterior es desconocido hasta evidencia válida |
| Datos viejos | Room preservado; pendientes históricos no se reenvían. Necesitan conciliación de compras/ventas ya reflejadas en conteos centrales |
| Conflicto offline | No se garantiza disponibilidad global offline. El servidor puede rechazar stock/jornada; revisar, no generar otro UUID por timeout |
| Pedidos/notificaciones | Gestión web conservada; app abre Dashboard. Push antiguo retirado, no se promete aviso con app cerrada ni restauración de credenciales faltantes |
| Cierre remoto | No conoce las colas de teléfonos desconectados. Operación en jornada cerrada se conserva como conflicto, no se reasigna automáticamente |
| Historial/correcciones | No hay eliminación ni devolución monetaria/reversión de venta confirmada automática. Correcciones de unidades tienen motivo; precios/costos históricos no se editan retroactivamente |
| Seguridad web histórica | Activación inicial de cliente por username/contraseña sin segunda prueba y pago terminal FAILED son riesgos documentados anteriores; esta reconstrucción no los considera resueltos |
| Dispositivo físico | Sin teléfono ADB conectado ni emulador local; instalación/uso en Honor y sincronización real requieren prueba posterior |
| iOS | Pospuesto; no IPA ni paridad declarada |

Antes de dar por terminada integración real: aplicar SQL, comprobar permisos, cuenta ADMIN/SELLER, compra/venta/consumo/cierre desde APK firmado y lectura web/inventario. Distinguir confirmado por tests, deploy HTTP y recorrido físico.
