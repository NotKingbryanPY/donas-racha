# Donas Control 1.3.0 oficial

APK Android firmado con la clave permanente del negocio. Paquete `com.bryan.donas.control`, versión 1.3.0/código 10, Android 6 o posterior. Usa `https://dracha.store` y cajas de 12: 4 chocolate, 4 vainilla, 2 chocolate con chispas y 2 vainilla con chispas.

## Instalación

1. Descargar **Donas-Control-1.3.0-oficial.apk** desde los archivos de esta publicación usando el teléfono Android.
2. Abrir el archivo descargado y permitir que el navegador o Archivos instale aplicaciones cuando Android lo solicite.
3. Instalar Donas Control.

**Conservar el piloto y sus datos.** La oficial se instala por separado: la firma original del piloto no está disponible. No desinstalarlo ni registrar ventas en ambas apps. El traslado necesita activar primero el servidor, sincronizar y exportar la copia del piloto, importarla en la oficial antes de iniciar sesión y conectar la misma cuenta ADMIN. Comparar saldos, inventario e historial antes de continuar.

[Guía completa de instalación, traslado y activación](https://github.com/NotKingbryanPY/donas-racha/blob/7cd501bf1055a45c9169d1aa798af68bea852867/docs/ANDROID_OFICIAL_1.3.0.md).

## Validación y activación pendiente

89 pruebas Android, lint y 3 pruebas de base de datos por emulador Android 6/15, con arranque comprobado. Pruebas PostgreSQL con solicitudes simultáneas verifican reservas, revisión de conteos y cobros/entregas sin duplicación. Firma y alineación de 16 KB verificadas. El archivo JSON adjunto detalla los resultados; no garantiza cero errores en todos los teléfonos físicos.

El inventario compartido requiere aplicar las cuatro migraciones y publicar la API. Firebase/FCM para avisos inmediatos con la app cerrada sigue sin configurar. Esos cambios no están activados en producción. Las ventas offline aparecen en otros equipos después de sincronizar; cada instalación conserva su propio libro de dinero.

SHA-256 del APK: `427562f9cd71710c9036b2d4fee647b13c24676d25ae6c1e1a79e7b697e1233d`.

Las futuras actualizaciones oficiales conservarán el mismo paquete y certificado. Esta publicación no contiene claves privadas.
