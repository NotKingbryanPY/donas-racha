# Verificación de Donas Control 2

[Contexto](AI_CONTEXT.md) · [Pendientes](OPEN_ISSUES.md)

Resultados se actualizan durante la entrega; no equivalen a pruebas en producción.

- PASS SQL PostgreSQL aislado: compra 4/4/2/2 y caja configurable de4, pago dividido, consumo, costo FIFO, costo desconocido/null utilidad, reservas, web fulfillment único sin otra salida, cierre/replay/conflicto de jornada, RLS y preservación del archivo móvil.
- PASS API simulado: sesión/roles, actor derivado servidor, validación de cantidades/pago, hash estable, falta SQL explícita.
- PASS final local: 113 pruebas Android sin fallos, lintDebug/lintOfficial estrictos, assembleOfficial/R8. Firma/paquete/versión/alineación y contenido del APK verificados en [informe de entrega](../DONAS_CONTROL_2_RESULTADOS.md). Native renders revisados; panel diario y regresiones web pasaron a360/768/1440. Ocho tests de tooling pasaron.
- PASS CI e0d0d14: compilación/lint, migraciones e inicio optimizado en emuladores API 23 y 35; web/contratos/browser/concurrencia PostgreSQL y conocimiento en success. En main, PR41/e2a7ff1, Vercel Production y HTTP público verificados: panel/JS/productos/inventario 200, diario anónimo 401, APK 200 con hash/tamaño idénticos y SQL completo. Enlaces y fecha en el informe.
- Metadatos Firebase verificados: proyecto/app/paquete/certificado y Firestore Standard(us-east1) gratuito. No se escribió negocio ni se configuró un emisor nuevo.
- No SQL privado real ejecutado; Browser/Computer no inicia kernel. Sin teléfono ADB ni emulador local. No prueba física, push ni integración real afirmada.
- Evidencia compartida por el usuario: instalación01 sin error informado y stock39 contado, sin reservas (15 chocolate,15 vainilla,8 chocolate-chispas,1 vainilla-chispas). Permisos/jornada/trigger aún no compartidos. 02_verify ahora devuelve una sola fila para completar verificación; no modifica stock ni reinstala funciones. Ver informe de entrega.
- PASS verificador de una fila en PostgreSQL aislado: instalación correcta da DAILY_V2_READY y un solo objeto order_inventory_revision; permiso snapshot abierto a authenticated, RLS desactivado o trigger diario deshabilitado dan REVIEW_REQUIRED. No se ejecutaron esas alteraciones en producción ni se cambió el APK.

Las verificaciones antiguas se atribuyen a sus informes/commits, no se renuevan por copiar documentación. Índices/hashes prueban vigencia textual, no exactitud de cada comportamiento remoto. Las capturas de concepto son ilustrativas.
