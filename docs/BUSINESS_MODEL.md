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

Solo un cliente activo vinculado a una cuenta de Supabase Auth puede hacer delivery desde `customer.html`. El formulario toma el nombre de su perfil y «Mis pedidos» muestra solo los suyos. Un ID o QR heredado de Apps Script no basta para pedir. El cliente crea su acceso por correo, confirma el correo si Supabase lo exige y entra; el vendedor verifica su identidad en persona y genera desde `admin.html` un código de vinculación que caduca en 30 minutos. El cliente lo introduce en «Mi cuenta». El código anterior queda invalidado y un perfil solo puede vincularse a una cuenta.

En el código pendiente de despliegue, la API administrativa completa el pedido con `api_complete_order`: verifica el cobro confirmado, consume la reserva de cada sabor, registra una venta única y acredita puntos, racha, hitos e insignias en una transacción. Crear o aceptar un pedido no acredita nada. Confirmar el cobro por sí solo tampoco: el vendedor debe confirmar después que la entrega se completó. Solo la primera entrega calificada de cada día en `America/Bogota` suma puntos y racha; los demás pedidos del día se cobran y completan sin otra recompensa. Los pedidos completados antes de esta migración requieren conciliación manual; el cambio no reescribe datos históricos.

## Pago

El cliente paga al recibir el pedido mediante:

- efectivo;
- Yappy al número `6015-0927`.

La página puede mostrar ese número. El QR se incorporará cuando el propietario entregue el recurso oficial; no se genera uno a partir del número porque el QR de Yappy puede contener información adicional. El administrador confirma el pago recibido antes de completar el pedido.
