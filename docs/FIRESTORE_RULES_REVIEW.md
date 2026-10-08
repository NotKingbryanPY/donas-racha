# Revisión de reglas Firestore — 8 octubre 2026

Reglas prototipo para revisión antes de una distribución amplia. Validación sintáctica por herramienta oficial Firebase, 36 comprobaciones contra Firestore Emulator 1.22.0 (Standard) y despliegue `firestore:rules` completado en `donascontrol-1f5df`. No son una garantía exhaustiva de seguridad.

```json
{
  "score": 5,
  "summary": "El modelo acotado de preferencias exige propietario verificado, valida create/update y bloquea datos de negocio y roles. No se identificó un bypass en los escenarios probados.",
  "findings": []
}
```

| Intento | Resultado |
|---|---|
| Lectura/listado público; escritura sin sesión | Denegado en emulador. |
| Cuenta autenticada sin correo verificado | Escritura denegada. |
| Otro usuario get/set/delete sobre el documento de Alice | Denegado. No hay correos/teléfonos en el documento. |
| Listar toda la colección con cuenta válida | Denegado. Android usa get por UID, no consultas de colección. |
| Crear bajo otro UID o cambiar el UID existente | Denegado por path, identidad y propiedad inmutable. |
| Esquema válido al crear y luego corromperlo al actualizar | Denegado: el mismo validador se aplica en create/update. |
| Omitir/borrar uid, schemaVersion, theme o updatedAt | Denegado. |
| Tipo incorrecto, valor fuera de enum, número decimal, UID largo | Denegado. El único string está limitado a 128 caracteres. |
| Campo extra, isAdmin, payload largo | Denegado; hasOnly limita el documento a cuatro campos. |
| Timestamp falsificado | Denegado. Solo serverTimestamp coincide con request.time. |
| Subcolección huérfana o ruta orders/inventory/staffRoles | Denegado por cierre general. |
| Mismas preferencias de tema válidas -1,1,2 | Permitido para el propietario; delete también permitido. |
| Estados de pedido, contadores, relaciones, URLs, listas | No existen en este modelo ni tienen rutas autorizadas. Escribirlos es denegado; sus transacciones siguen en Supabase. |
| Sobrescribir otro dispositivo de la misma cuenta | Es una preferencia personal compartida: prevalece la última escritura confirmada. No afecta stock/pagos/puntos. |

Las reglas no conceden roles ni validan dispositivos administrativos: el acceso al backend de pedidos requiere además el vínculo individual y roles de Supabase. Las cuentas verificadas pueden modificar su propio tema aunque no sean personal del negocio. No hay ACL en documentos que pueda autoelevarlas.

Límites: cuotas Spark compartidas, revocación Firebase de ID tokens sujeta a expiración, SDK Admin omite Security Rules por diseño. Conservar cuentas de servicio/IAM exclusivamente en servidores autorizados. Revisar estas reglas al agregar cualquier colección o consulta nueva; no agregar un `allow read/write` global para resolver un error de permisos.

Prueba reproducible: Node 22, Java 21, Firebase CLI 15.33.0, firebase JS 13.0.0, @firebase/rules-unit-testing 6.0.0, `firebase emulators:exec --only firestore --project demo-donas-rules "node tests/firestore-rules.cjs"`. El workflow `firestore-rules.yml` usa un proyecto demo y no escribe en producción.
