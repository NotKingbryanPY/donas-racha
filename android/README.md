# Android

`donas-control/` contiene el proyecto Android completo y compilable que se creó el 22 de septiembre de 2026. Es la fuente de la aplicación Donas Control desde la versión 1.2.0.

`phase9-overlay/` se conserva como referencia histórica de la fase 9; no debe aplicarse sobre la aplicación actual. Los cambios nuevos van directamente en `donas-control/`.

La parte contable sigue funcionando localmente. La pantalla de pedidos y la cola de sincronización requieren los endpoints de este repositorio, una cuenta con rol `ADMIN` y la migración SQL más reciente. La entrega final de un pedido aún requiere una operación atómica de inventario, venta, pago y puntos; la app no muestra el botón de completar hasta que esa operación exista.
