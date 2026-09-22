# Fase 7 — Catálogo público

La portada muestra los sabores publicados en Supabase, su precio y disponibilidad actual. El catálogo es informativo y funciona bien en teléfonos y computadoras.

## Comportamiento

- Los productos se consultan en `/api/products` al abrir la página.
- Cada sabor muestra `Disponible` o `Agotada` según Supabase.
- Si la consulta falla, la portada conserva el acceso al perfil y explica que la disponibilidad no se pudo consultar.
- La página informa que el pago se realiza al recibir, en efectivo o por Yappy.
- No se muestra el proceso `PREPARING`: el catálogo representa donas ya preparadas.

## Operación

La disponibilidad se controla con `product_variants.available`. Cambiar ese campo en Supabase actualiza la portada sin publicar código nuevo.
