# Fase 1: entrega por GitHub y copiar/pegar

Los cambios web están en el PR #3: https://github.com/NotKingbryanPY/donas-racha/pull/3. No se han fusionado a main ni publicado en producción.

La rama ya usa el despliegue `AKfycbxhLgU5ok2j8DwE8ehSKw63pMWSvTuS3_zoV898nx4K4eG1lGZ22ycjOOlZbGtpzMCS`, verificado con HTTP 200 y versión `2.1.1-performance`.

## Apps Script

1. Descarga DONAS_RACHA_FASE_1.txt y copia TODO su contenido en el archivo code.gs de tu proyecto. Sustituye el contenido anterior; no lo añadas al final. El archivo incluye runPhase1ReadOnlyCheck: no dupliques esa función en otro archivo.
   El manifiesto debe llamarse exactamente `appsscript.json`; `appsscript.jsonj` no es un nombre válido. El manifiesto versionado en esta carpeta coincide con el contenido indicado por el propietario.
2. En Configuración del proyecto → Propiedades de script, configura SPREADSHEET_ID con el ID de la hoja que quieras usar. Para pruebas usa la copia; para producción, la hoja original. El código no contiene un ID ni contraseña de respaldo.
3. Conserva una contraseña administrativa no vacía en Config, o usa ADMIN_PASSWORD en Propiedades de script. No necesitas escribirla en GitHub ni enviarla al chat. Mantén la zona horaria actual.
4. Guarda. En la copia de pruebas, selecciona runPhase1ReadOnlyCheck y pulsa Ejecutar. Esta función comprueba las cabeceras y lee tres perfiles, sin modificar hojas. No selecciones testAPI: llama a initSheets y escribe datos.
5. Tras validar la copia, para actualizar producción: Implementar → Gestionar implementaciones → selecciona la implementación cuya URL utiliza la web → Editar → Nueva versión → Implementar. Conserva la URL /exec actual y la versión anterior para revertir.

El archivo adjuntado más recientemente coincide exactamente con el código optimizado y la comprobación preparada. Si ya pegaste ese contenido, no hace falta volver a pegarlo.

## Resultado verificado

- Backend local: respuestas conservadas en perfil, ranking, búsqueda, compras, canjes y altas; pruebas de invalidación y errores aprobadas.
- Perfil de fixture: 4686 → 1325 celdas leídas (71,7 % menos).
- Recorrido web: 31 → 25 solicitudes, pruebas aprobadas en cinco tamaños.
- Pruebas de transporte: aprobadas; sin repetición automática de escrituras.
- El despliegue nuevo respondió HTTP 200 y reportó `2.1.1-performance`. Perfil real: 3756 / 5560 / 4225 ms, mediana 4225 ms. Mejora frente a la línea base de 5821 ms, pero la espera sigue siendo material.

Se creó una copia privada de Sheets y se respaldó el código original. El proyecto de pruebas contiene el código preparado y apunta a esa copia. No se cambiaron datos de producción ni se desplegó el backend.

## Pendiente

Fusionar/publicar la web solo después de revisar el PR. Siguen pendientes los riesgos legacy: acceso público a datos/WhatsApp, canjes sin identidad e idempotencia. La hoja original también mostró acceso para cualquiera con el enlace; revisar sus permisos. Esta entrega optimiza rendimiento y no declara resueltos esos riesgos.

No se ha iniciado fase 2. A partir de ahora se trabajará con GitHub y archivos de Apps Script, sin automatizar el navegador salvo solicitud explícita del propietario.
