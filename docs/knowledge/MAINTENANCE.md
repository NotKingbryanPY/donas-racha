# Mantener y consultar el sistema

[Inicio](AI_CONTEXT.md) · [Historial](CHANGELOG.md) · [Modelo semántico](model.json) · [Herramienta](../../scripts/knowledge.py)

## Estructura y contrato

La capa humana son las guías Markdown y siete diagramas por nivel. `model.json` contiene nodos de funcionalidad/UI/sistema/evento/RPC/política, relaciones semánticas revisadas y reglas de impacto por área. La capa generada contiene inventario, grafo, índice de símbolos, catálogo SQL y estado/historial de revisión. No hay servicio cloud, embeddings, entrenamiento, chatbot ni nueva dependencia Python.

`graph.json` usa nodos `{id,type,label,status,refs}` y aristas `{source,target,type,status,refs}`. Tipos: DEPENDE_DE, LLAMA_A, LEE_DE, ESCRIBE_EN, SINCRONIZA_CON, NOTIFICA_A, IMPLEMENTA, CONTIENE, AFECTA_A. Refs son ruta/line/symbol opcional. IDs `file:ruta`, `rpc:nombre`, `table:nombre`, `feature:nombre`, `system:nombre`, `ui:nombre`; símbolos extraídos incluyen archivo/tipo/nombre/línea para evitar colisiones. Líneas pueden cambiar y deben regenerarse; IDs de feature/RPC/tabla son estables.

LLAMA_A de archivo a RPC significa una llamada literal presente en el archivo, no necesariamente un recorrido ejecutado. CONTIENE significa declaración local; DEPENDE_DE automático solo resuelve `require` relativo estático. No resuelve toda llamada dinámica/import Kotlin/Swift/inline DOM/SQL rename, overloads ni reachability. Las relaciones de negocio se editan en model con referencias y revisión, nunca se infieren como verdad desde una coincidencia de nombres.

## Ciclo incremental

Desde raíz, Python 3.10+ y Git disponibles; solo biblioteca estándar:

```sh
python scripts/knowledge.py report
python scripts/knowledge.py report --base HEAD~1
python scripts/knowledge.py query inventory
```

`report` es de solo lectura: compara hashes de revisión con archivos elegibles de Git, incluye cambios staged/unstaged, altas sin seguimiento no ignoradas y eliminaciones. `--base` añade diff de ese commit a HEAD; usar un ref válido. Propaga impacto por dependientes de require en el grafo y por globs de área (web/api/database/android/firebase/ios/legacy/operations). Devuelve áreas, documentos/diagramas potencialmente afectados y archivos sin regla. Esta propuesta es conservadora: una coincidencia no significa que todo documento necesite cambios. Revisar archivos nuevos sin regla y ampliar model antes de cerrar revisión.

1. Leer diff y contexto de funciones afectadas; usar CODE_INDEX/SQL_CATALOG/query para saltar a evidencia. Git status inicial puede incluir archivos del usuario; no incorporarlos sin relación arquitectónica ni leer exports/credenciales.
2. Corregir explicaciones verificables y referencias. Marcar INFERIDO/PENDIENTE donde falte prueba. Si cambian RPC/tablas/transiciones, revisar wrappers/triggers/consumidores y diagrama correspondiente.
3. Editar model.json: relaciones semánticas/refs/globs. Para diagramas, editar `.mmd` y el bloque Mermaid del `.md` compañero; describir fuente/alcance. La herramienta **no reescribe semántica de diagramas por heurísticas**.
4. Regenerar extracción. Compara hashes, reutiliza entradas sin cambios y reanaliza solo archivos modificados; cambiar versión del extractor invalida caché deliberadamente.

```sh
python scripts/knowledge.py generate
python scripts/knowledge.py check
```

5. Ver `git diff -- docs/knowledge scripts/knowledge.py`. Ejecutar pruebas funcionales pertinentes si cambió aplicación; una revisión documental no necesita recompilar todas las apps. Actualizar CHANGELOG con fecha/commit/áreas/hallazgos/pruebas/límites.
6. Registrar **solo después de revisar**. El comando comprueba índices/hash y exige cubrir todas las áreas detectadas; registra hashes, commit base y contenido de trabajo (incluyendo cambios aún sin commit). Usar los IDs de `report`, separados por coma:

```sh
python scripts/knowledge.py review --areas web,api,database,android,firebase,ios,legacy,operations --note revision-completa
python scripts/knowledge.py check --fresh
```

`review` no analiza ni aprueba código automáticamente; la persona/agente certifica que hizo la revisión declarada. No ejecutarlo para silenciar una alerta. Para cambios pequeños indicar solo áreas afectadas; report puede incluir operations por script/test/documento. El registro puede llevar `--date` ISO explícita; defecto America/Bogota (UTC−5 si no hay tzdata). Los informes usan fecha cliente 2026-10-08 como revisión inicial, no calendario del host.

## Detección de obsolescencia y CI

La revisión v2 filtra objetivos de imports retirados aun cuando el archivo importador no cambió y se reutilizó su extracción. Esto evita aristas colgantes tras una retirada; no certifica que un test histórico con require a un módulo eliminado siga ejecutable. El HTML local independiente ruleta-donas-racha.html se conserva fuera del índice del runtime y de esta entrega, al igual que exports; no se incorpora a Git automáticamente.

`check` verifica IDs, tipos, referencias/líneas/símbolos, enlaces Markdown, bloques, concordancia del modelo con el grafo y equivalencia `.mmd`/bloque Mermaid compañero; `--fresh` también exige concordancia de fuentes, índice y documentos con revisión, incluidas eliminaciones. `report` distingue cambios de fuentes y de documentos. Nuevos archivos, cambios, bajas y desplazamientos de símbolos no se convierten automáticamente en “documentación confirmada”. Diagrama Mermaid se revisa contra código; la validación léxica por script no es render de Mermaid ni prueba de estados reales.

SHA-256 normaliza CRLF a LF en texto; binarios y recursos vendor mantienen bytes literales (coherente con `.gitattributes`). `bytes` del inventario cuenta bytes canónicos. Así, un checkout Windows/Linux no produce deriva por finales de línea. Los hashes no certifican semántica: detectan contenido diferente. `python tests/knowledge-system.py` verifica este contrato y el ciclo incremental en repositorios Git temporales, sin importar la aplicación ni tocar servicios.

[knowledge.yml](../../.github/workflows/knowledge.yml) ejecuta report/check en PR/push main, con Python, checkout completo y solo permiso de lectura. No genera commits ni llama a proveedores. `check --fresh` falla si cambió una fuente sin nueva revisión; ver salida para reparar, no llamar review ciegamente. Las guías futuras deben mantenerse en el mismo PR que cambia funcionalidad. No activa tareas recurrentes en Codex ni añade servicios de pago.

## Conversaciones con ChatGPT/Codex

Codex con acceso al repo: “Lee `AGENTS.md` y `docs/knowledge/AI_CONTEXT.md`, ejecuta report, revisa [funcionalidad] contra su código y actualiza guías/modelo/diagramas con evidencia. No cambies producción.” Para diagnosticar una incidencia, añadir reproducción esperada/observada y pedir que distinga código, inferencia y verificación externa.

ChatGPT sin checkout: adjuntar AI_CONTEXT, el documento del tema y los archivos/diffs relevantes sin datos privados; opcional model/fragmento de graph. Un enlace a repo privado no concede acceso por sí mismo. Las sesiones no actualizan memoria por publicar un Markdown: estos archivos versionados son la fuente durable; indicar commit/hashes y pedir lectura al empezar. No hace falta pegar todo el grafo o el índice en cada conversación.

Consultas típicas: `query api_complete_paid_order`, `query feature:sync`, `query FirebasePreferences`, `query inventory_by_flavor`. La respuesta JSON devuelve nodos coincidentes/aristas incidentes; para una investigación grande filtrar por IDs/tipos/refs. Graph no contiene datos de clientes ni resultados de consultas. Si se necesita estado real remoto, pedir evidencia de solo lectura sanitizada y fecharla separadamente.
