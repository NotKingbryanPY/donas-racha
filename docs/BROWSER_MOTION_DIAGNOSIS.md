# Animación estática en Brave — causa y corrección

## Causa reproducida

La pestaña real de Brave en producción comunicó `prefers-reduced-motion: reduce = true`. La aplicación había aplicado `motion-lite` y el estilo calculado de la pantalla era `animation-name: none`. El módulo de movimiento estaba cargado y no había errores JavaScript registrados. Vercel marcaba el despliegue como correcto.

El video de pruebas usaba explícitamente `reducedMotion: no-preference`. Esa diferencia explica que se moviera allí y quedara estático en el navegador del usuario. No se reprodujo un problema de velocidad de renderizado.

## Corrección

El acceso y el perfil incluyen **Animaciones**:

- **Automáticas**: respeta la preferencia del dispositivo y ahorro de datos (valor inicial).
- **Activadas**: elección explícita para esta web, incluso si el dispositivo solicita menos movimiento.
- **Reducidas**: omite el movimiento sin modificar ajustes del sistema.

La selección se guarda en `localStorage` como `donasMotionPreference`, se sincroniza entre pestañas y puede revertirse. Si el almacenamiento está bloqueado, sigue funcionando durante la página actual y se explica ese límite. No se guarda junto a un cliente ni se transmite al servidor.

CSS y JavaScript comparten la decisión efectiva. Las reglas `@media` no pueden volver a anular silenciosamente la elección «Activadas». No hay cambio global de Brave, Chrome o Windows.

## Verificación

`tests/motion-preference.cjs` prueba la preferencia predeterminada del navegador de pruebas, movimiento reducido, ahorro de datos, elección explícita, persistencia, círculo y dona realmente cambiando de transformación, retorno a Automáticas y almacenamiento bloqueado. La suite existente de regresión conserva los flujos funcionales.

Además se comprobó en el Brave real, con su preferencia de movimiento reducido aún activa: al elegir «Activadas», la raíz cambia a `motion-full` y vuelve la animación de pantalla. Durante una bienvenida de 1,1 s se midieron 11 muestras, 4 transformaciones distintas de la dona y 5 de la cortina. Esto verifica movimiento en ese navegador sin simular su media query.
