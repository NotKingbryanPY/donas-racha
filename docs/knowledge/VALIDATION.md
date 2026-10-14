# Verificación de Donas Control 2

[Contexto](AI_CONTEXT.md) · [Pendientes](OPEN_ISSUES.md)

Resultados se actualizan durante la entrega; no equivalen a pruebas en producción.

- PASS SQL PostgreSQL aislado: compra 4/4/2/2 y caja configurable de4, pago dividido, consumo, costo FIFO, costo desconocido/null utilidad, reservas, web fulfillment único sin otra salida, cierre/replay/conflicto de jornada, RLS y preservación del archivo móvil.
- PASS API simulado: sesión/roles, actor derivado servidor, validación de cantidades/pago, hash estable, falta SQL explícita.
- PASS compilación inicial compileDebugKotlin. Unit/lint/build oficial y navegador están en curso; consultar informe final antes de asumir resultado.
- Metadatos Firebase verificados: proyecto/app/paquete/certificado y Firestore Standard(us-east1) gratuito. No se escribió negocio ni se configuró un emisor nuevo.
- No SQL privado real ejecutado; Browser/Computer no inicia kernel. Sin teléfono ADB ni emulador local. No prueba física, push ni integración real afirmada.

Las verificaciones antiguas se atribuyen a sus informes/commits, no se renuevan por copiar documentación. Índices/hashes prueban vigencia textual, no exactitud de cada comportamiento remoto. Las capturas de concepto son ilustrativas.
