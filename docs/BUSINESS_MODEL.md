# Donas Racha — modelo operativo

## Producto

Donas Racha revende en la UTP donas surtidas ya preparadas de PriceSmart. La referencia comercial indicada por el propietario es [Member's Selection Donas Surtidas, 12 unidades](https://www.pricesmart.com/es-pa/producto/members-selection-donas-surtidas-recien-preparadas-12-unidades-227994/227994).

Sabores confirmados hasta ahora:

- glaseado de chocolate;
- glaseado de vainilla;
- glaseado de vainilla con chispas;
- glaseado de chocolate con chispas.

Los cuatro sabores fueron confirmados por el propietario y se venden a B/.1.00 por unidad.

## Disponibilidad

La disponibilidad se publica por sabor en tiempo real como `available`. Un sabor agotado sigue existiendo en el catálogo, pero la interfaz debe impedir seleccionarlo y el servidor debe rechazar cualquier intento de pedirlo. El conteo exacto por unidades se añadirá en la fase de inventario.

## Entrega y estados

El cliente escribe la ubicación donde recibirá el pedido. Las donas ya están preparadas, así que el pedido no pasa por estados de preparación.

```text
PENDING -> ACCEPTED -> OUT_FOR_DELIVERY -> COMPLETED
    |          |                |
    +----------+----------------+-> CANCELLED
```

`COMPLETED` significa que la entrega y el cobro ya ocurrieron. La ubicación exacta no se muestra en el seguimiento público del pedido.

La API administrativa bloquea temporalmente la transición a `COMPLETED` con `ACCOUNTING_NOT_READY` (HTTP 409). Confirmar el cobro no crea por sí solo la venta ni descuenta el inventario. La transición se habilitará cuando una operación idempotente registre venta, existencias y puntos de forma atómica. Los pedidos ya completados antes de este bloqueo requieren conciliación manual; el cambio no reescribe datos históricos.

## Pago

El cliente paga al recibir el pedido mediante:

- efectivo;
- Yappy al número `6015-0927`.

La página puede mostrar ese número. El QR se incorporará cuando el propietario entregue el recurso oficial; no se genera uno a partir del número porque el QR de Yappy puede contener información adicional. El administrador confirma el pago recibido antes de completar el pedido.
