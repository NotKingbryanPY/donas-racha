# Pendientes y evidencia

[Contexto](AI_CONTEXT.md) · [Activación](../DONAS_CONTROL_2_ACTIVACION.md)

| Tema | Estado / límite |
|---|---|
| Confirmación/seguimiento web | IMPLEMENTADO18octubre: activos/avisos15s, estados/pago reales, error HTTP tipado, recuperación idempotente, detalle privado/paginación y recibo animado. Ver DRACHAS_WEB_2026-10-18.md para pruebas/CI/publicación. No equivale a Web Push ni resuelve FCM Android |
| Identidad Drachas | C elegida por el usuario y adaptada a maestro SVG trazado, PNG/iconos/social derivados y marca visible. Conservar colores/datos/paquete; estado de publicación y revisión en DRACHAS_WEB_2026-10-18.md |
| Activación SQL v2 | VALIDADA_POR_RESULTADO_USUARIO: DAILY_V2_READY con jornada, ambas RPC restringidas, RLS, trigger e integridad correctos. No repetir instalación. El agente no accedió a Studio; falta operación autenticada desde APK y lectura coincidente en web |
| Stock/costo inicial | Se preservan cantidades. Un sabor tenía reservas superiores al conteo en evidencia histórica; comprobar físico. El costo del stock anterior es desconocido hasta evidencia válida |
| Datos viejos | Room preservado; pendientes históricos no se reenvían. Necesitan conciliación de compras/ventas ya reflejadas en conteos centrales |
| Conflicto offline | No se garantiza disponibilidad global offline. El servidor puede rechazar stock/jornada; revisar, no generar otro UUID por timeout |
| Avisos fuera de app reportados | A23 no recibe pedido tras1min y avisa al abrir. Causa exacta pendiente: alta/cola/proveedor/Android. Reintento ahora espera resultado/logs seguros; CI0b86b8d y Production Ready verificados. SELECT05 y diagnóstico del teléfono necesarios. No declarar corregido por compilar o por aceptación FCM |
| Pedidos/notificaciones2.1 | SQL/emisor listos; usuario informó notificación de prueba real en Samsung A23 y recuperación programada desde ADMIN. Falta verificar pedido real, recepción bloqueado/segundo plano y tap/gestión; no copiar secretos al APK |
| Comprobación Android y renovación | Literal persistente corregido en2.1.1/WorkInfo;120 pruebas/lint/build/firma y CI API23/35 aprobados. Usuario instalado reportó FAILED. Logs/repro confirman rechazo de tokens Supabase de12 por mínimo20 en API. Corregido, CI86b0971 completo PASS y main/Production Ready; prueba sintética pública alcanza al proveedor, vacío sigue400. APK/hash2.1.1 publicado200. Falta comprobación autenticada exacta del A23 y pedido real fuera de app |
| Clave privada compartida | Usuario adjuntó cuenta de servicio al chat. Valores no se imprimieron ni incorporaron a Git/APK; se transfirieron protegidos a Vercel. Sustitución/revocación pendientes: gestión IAM no verificada. Nueva clave directamente al servidor, verificar/revocar anterior; no adjuntarla al chat |
| Cierre remoto | No conoce las colas de teléfonos desconectados. Operación en jornada cerrada se conserva como conflicto, no se reasigna automáticamente |
| Historial/correcciones | No hay eliminación ni devolución monetaria/reversión de venta confirmada automática. Correcciones de unidades tienen motivo; precios/costos históricos no se editan retroactivamente |
| Seguridad web histórica | Activación inicial de cliente por username/contraseña sin segunda prueba y pago terminal FAILED son riesgos documentados anteriores; esta reconstrucción no los considera resueltos |
| Dispositivo físico | Sin teléfono ADB conectado ni emulador local; evidencia del usuario desde A23 distingue prueba real recibida de casos bloqueado/segundo plano aún pendientes |
| iOS | Pospuesto; no IPA ni paridad declarada |

Antes de dar por terminada integración real: aplicar SQL, comprobar permisos, cuenta ADMIN/SELLER, compra/venta/consumo/cierre desde APK firmado y lectura web/inventario. Distinguir confirmado por tests, deploy HTTP y recorrido físico.


## Portada de recompensas — 18 octubre 2026

Espacio vacío de portada resuelto: el usuario autorizó después generar la pareja chocolate/vainilla e integrarla. Imagen ilustrativa identificada, optimizada y local. Una fotografía propia del negocio puede reemplazarla en el futuro; conservar la procedencia y las etiquetas correctas. Ver docs/DRACHAS_PORTADA_2026-10-18.md.
