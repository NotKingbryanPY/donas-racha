# Preparación y actualización reversible

Esta rama no actualiza automáticamente Apps Script. Code.gs debe probarse primero en un proyecto de copia. No fusionar pensando que el backend se despliega desde Vercel.

1. Guardar versión actual del código Apps Script, propiedades, configuración de despliegue y copia íntegra de Sheets. La fixture redaccionada de tests no sustituye ese respaldo.
2. Crear copia de prueba y configurar SPREADSHEET_ID con el ID de la copia. Configurar ADMIN_PASSWORD como propiedad del script, o conservar una credencial no vacía en la hoja Config. No pegar valores en GitHub. Mantener zona horaria del proyecto y de la hoja original.
3. Sustituir código por Code.gs en la copia. No inventar manifiesto ni permisos: revisar y conservar los del proyecto real. Comprobar las siete hojas operativas y cabeceras. Si están incompletas, revisar la copia y ejecutar initSheets explícitamente; esa acción puede sembrar/actualizar datos y formato.
4. Desplegar una versión de prueba. Activar PERF_LOG=true para comparar llamadas agregadas. Validar perfil, ranking, búsqueda, compra y canje con clientes de prueba, incluidas repetición, saldo insuficiente y configuración. Revisar saldos y eventos directamente en Sheets.
5. Tomar varias muestras antes/después con el mismo conjunto de datos y entorno; documentar latencia de red y logs por separado. Validar también la web nueva contra backend viejo y nuevo. La suite simulada cubre el contrato, no reemplaza esa prueba.
6. Solo tras verificar copia y backup, actualizar la versión del despliegue existente conservando su URL /exec; no reemplazar IDs/QR. Publicar la web de la rama cuando se apruebe la revisión. Los contratos GET/POST no cambian.

Rollback web: revertir commit de fase 1 o volver al despliegue anterior en Vercel. Backend: seleccionar la versión anterior del despliegue Apps Script. No hay migración de estructura ni cambio de reglas que revertir; conservar las operaciones legítimas realizadas. Si se detecta inconsistencia de datos, pausar escrituras y conciliar con el backup y Registros/Canjes; no restaurar una copia antigua ciegamente.

Para medir una consulta, usar un cliente de prueba y registrar solo duración/estado/tamaño, nunca contraseña, teléfono o cuerpo del perfil. Evitar usar getTodosClientes con detalles en producción como benchmark de carga.

