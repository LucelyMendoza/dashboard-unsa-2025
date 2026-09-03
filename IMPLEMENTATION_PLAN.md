# Diagnóstico y Plan de Implementación — Importación Excel con D1

## Estado Actual (Before)

### Fuente de datos
- **Ubicación**: `public/data/initialData.json` (estático, versionado en el repo)
- **Carácter**: Monolítico, binario (difícil de cambiar sin rebuild+redeploy)
- **Persistencia**: Archivo del filesystem; cambios requieren reemplazar manualmente el JSON

### Estructura de datos
- **Formato**: `DashboardDataset` (tipos en `src/types/dashboard.ts`)
  - Catálogos paralelos: `fs` (facultades), `es` (escuelas), `an` (asignaturas), `dn` (docentes), `ps` (períodos)
  - Filas indexadas: `sa` (SubjectRow), `dc` (TeacherRow) — referencias a índices de catálogos
  - Derivadas: `ag` (AggregatedRow), `sc` (ScorecardRow) — recalculadas en `recompute.ts`
- **Jerarquía**: Facultad → Escuela → Asignatura(+Grupo) → Período
  - **No existe "Programa"** en el código (tu spec lo mencionaba, pero los datos reales no lo traen)

### Frontend
- **Tech**: Next.js 14 (App Router), React 18, TypeScript, Tailwind, Chart.js, Firebase Auth (cliente)
- **Roles**: Hardcodeados en `src/lib/roles.ts`, validados **solo en cliente** vía `localStorage`
  - ADMIN: todo + carga de Excel
  - DECANO: facultad fija + escuelas
  - DIRECTOR: facultad + escuela fija
  - AUTORIDAD/VICERRECTOR: acceso total lectura
- **Filtros**: Facultad, Escuela, Año, Período, Agrupación (semestre/año), Indicador
- **Tablas/Gráficos**: KPI Grid, Trend Chart, Grouped Bar, Scorecard, Subject Heatmap, Teacher Search

### Backend/Base de datos
- **Backend**: NINGUNO. El proyecto está en `@opennextjs/cloudflare` (listo para deploy a Cloudflare Workers) pero sin rutas API implementadas.
- **Base de datos**: NINGUNA. Cloudflare D1 está disponible en el stack, pero no configurado.
- **Auth**: Firebase Auth (Google OAuth) solo en cliente; sin verificación server-side del rol.

### Carga de Excel actual (`AdminUploadModal.tsx` + `excelParser.ts`)
- **Localización**: Modal en cliente, parseo con `xlsx` library
- **Validación**: Detecta cabeceras, valida formato (requiere `DOCENTE`, `FACULTAD`, etc. específicos)
- **Deduplicación**: NO existe — cargar dos veces el mismo Excel duplica todas las filas
- **Persistencia**: Muta el estado en memoria (`setDataset`); para publicar, hay que descargar el JSON y reemplazarlo a mano en `public/data/`
- **Preview**: NO existe — no ves qué pasará antes de confirmar
- **Resumen**: NO existe — no sabes cuántos registros son nuevos vs. duplicados

### Datos reales (SISACAD)
- **Cabeceras**: `PERIODO, ESCUELA, NRO, CODIGO, ASIGNATURA, GRUPOS, MATRICULADOS, APROBADOS, DESAPROBADOS, ABANDONOS, RETIROS, [bandas], PROMEDIO`
- **Faltantes**: Columnas `FACULTAD` y `DOCENTE` NO vienen del Excel — deben resolverse/defaultearse
- **Llave de dedup**: `ESCUELA + PERIODO + CODIGO + GRUPO` (única en la BD actual)
- **Alcance MVP**: Solo **EDUCACIÓN desde 2021+** (puede expandirse después)

---

## Propuesta de Arquitectura

### Fuente nueva de datos
**D1 (Cloudflare SQLite)** con tabla `academic_records` + log de importaciones.
- **Por qué D1**: Ya está en el stack (`@opennextjs/cloudflare`), sin costo extra en Cloudflare Pages/Workers
- **Alternativa**: Firebase Firestore (más $$, pero también viable)

### Endpoint/API
1. **`POST /api/admin/import`** — Importación (preview/commit)
   - Entrada: JSON con rows parseadas + modo ('preview' o 'commit')
   - Verificación: Token de Firebase Auth validado server-side (`jose/jwt`)
   - Salida: Resumen (nuevos/duplicados/errores) + preview de primeras N filas
   - En modo commit: escribe en D1, retorna resumen final

2. **`GET /api/dataset`** — Entrega del dataset completo
   - Entrada: (ninguna — público tras auth de sesión)
   - Salida: `DashboardDataset` igual al antiguo initialData.json
   - Nota: Construido dinámicamente desde D1 en cada solicitud (sin cache agresivo por ahora)

### Estructura de almacenamiento (D1)
```sql
CREATE TABLE academic_records (
  id INTEGER PRIMARY KEY,
  periodo TEXT,
  anio INTEGER,
  facultad TEXT,
  escuela TEXT,
  codigo TEXT,
  asignatura TEXT,
  grupo TEXT,
  docente TEXT,
  matriculados INTEGER,
  aprobados INTEGER,
  desaprobados INTEGER,
  abandonos INTEGER,
  retiros INTEGER,
  promedio REAL,
  source_file TEXT,
  imported_at TEXT,
  UNIQUE (escuela, periodo, codigo, grupo)
);

CREATE TABLE import_log (
  id INTEGER PRIMARY KEY,
  admin_email TEXT,
  source_file TEXT,
  total_filas INTEGER,
  nuevos INTEGER,
  duplicados INTEGER,
  errores INTEGER,
  imported_at TEXT
);
```

### Método de importación
1. **Cliente**: Lee Excel → `parseExcelFile()` → normaliza cabeceras (alias), valida formato, resuelve facultad (via `school-catalog.ts`)
2. **Backend**: Recibe POST con rows + modo → verifica token + rol → consulta D1 por períodos presentes → dedup contra UNIQUE key
3. **Preview**: Retorna `{ summary, preview: firstN }` sin tocar D1
4. **Commit**: Ejecuta batches de 50 INSERT OR IGNORE → log de auditoría → retorna resumen final

### Método de deduplicación
- **Llave compuesta**: `ESCUELA + PERIODO + CODIGO + GRUPO`
- **En cliente** (preview): Compara filas parseadas con set de llaves ya en DB (pequeño overhead)
- **En DB** (commit): `INSERT OR IGNORE` + `UNIQUE` constraint como fallback
- **No sobrescribe**: Registros duplicados se silencian (IGNORE), no se actualizan

### Componentes a modificar
| Componente | Cambio |
|---|---|
| `excelParser.ts` | Reescrito: retorna `ParseResult` (filas + errores), NO muta dataset |
| `dataset-builder.ts` | NUEVO: Arma `DashboardDataset` a partir de filas planas (usado por `/api/dataset` y preview) |
| `school-catalog.ts` | NUEVO: Mapeo estático Escuela→Facultad derivado de `roles.ts` |
| `AdminUploadModal.tsx` | Reescrito: 4 pasos (seleccionar → preview → confirmar → resultado), llamadas HTTP a `/api/admin/import` |
| `dashboard/page.tsx` | Cambio: `fetch('/api/dataset')` en vez de `fetch('/data/initialData.json')` |
| `/api/admin/import/route.ts` | NUEVO: POST con preview/commit, auth server-side, dedup, D1 writes |
| `/api/dataset/route.ts` | NUEVO: GET entrega dataset desde D1 |
| `auth-verify.ts` | NUEVO: Verificación JWT de Firebase en servidor, sin Admin SDK |
| `firebase.ts` | Agregado: `getIdToken()` para obtener token desde el cliente |

### Componentes que NO cambian
- Todos los gráficos, tablas, cálculos de KPI (lógica en `data-utils.ts`, `recompute.ts`)
- Filtros, pestañas, navegación
- Estilos, colores, tipografía
- Sistema de roles del lado del cliente (roles.ts queda igual, pero ahora verificado también en servidor)

---

## Plan de Implementación (Fases)

### Fase 1: Preparación (Backend + API)
1. ✅ Crear `migrations/0001_init.sql` (D1 schema)
2. ✅ Crear `src/lib/excelParser.ts` v2 (sin mutación de dataset)
3. ✅ Crear `src/lib/dataset-builder.ts` (reconstruye dataset desde filas)
4. ✅ Crear `src/lib/school-catalog.ts` (mapeo escuela→facultad)
5. ✅ Crear `src/lib/auth-verify.ts` (JWT sin Admin SDK)
6. ✅ Crear `/api/admin/import/route.ts` (POST con preview/commit)
7. ✅ Crear `/api/dataset/route.ts` (GET entrega dataset)
8. ✅ Actualizar `src/lib/firebase.ts` (agregar `getIdToken()`)

### Fase 2: Frontend (Modal + cambios menores)
9. ✅ Reescribir `AdminUploadModal.tsx` (preview → resumen → confirmar)
10. ✅ Actualizar `dashboard/page.tsx` (cargar desde API)
11. ✅ Remover importes innecesarios en dashboard/page.tsx

### Fase 3: Validación + Deploy
12. **Crear `wrangler.toml`** con binding de D1 (`binding = "DB"`)
13. **Seedear D1** con datos de EDUCACIÓN 2021+ (de los Excel proporcionados)
14. **Testing local** (npm run dev + D1 local via `wrangler`)
15. **Testing en Cloudflare** (deploy a staging)
16. **Verificar**: Preview → resumen → import → fetch(/api/dataset) devuelve datos nuevos
17. **Prod deploy**

---

## Alcance MVP (Educación 2021+)

Para simplificar validación, la solución se implementa primero solo para:
- **Escuela**: EDUCACIÓN
- **Años**: 2021, 2022, 2023, 2024, 2025
- **Todas las asignaturas/grupos** dentro de ese rango

**Ventajas**:
- Dataset manejable (~1000–2000 filas)
- Fácil de validar manualmente contra los Excel originales
- Arquitectura probada; expansión a toda UNSA es trivial (quitar filtro de escuela)

**Implementación futura (no MVP)**:
- Filtrar en `/api/dataset?escuela=EDUCACION&year_min=2021` (opcional, no necesario si se cachea todo)
- O dejar público y que el usuario vea todo — filtrado por roles (DIRECTOR solo ve su escuela, etc.)

---

## Notas de Seguridad

1. **Auth server-side**: Cada POST a `/api/admin/import` valida el JWT de Firebase contra Google JWKS. El rol se verifica nuevamente contra `isAdminEmail()` en el backend, no se confía en lo que dice el cliente.
2. **CORS**: No configurado aún; agregue permisivo en local, restrictivo en prod.
3. **Rate limits**: No implementado aún; considere agregarlo en Cloudflare Workers si se carga masivamente.
4. **SQL injection**: Sentencias parametrizadas en D1 (driver maneja binding).
5. **File size**: Máximo 20,000 filas por carga; tope configurable en `/api/admin/import`.

---

## Cambios Posteriores al MVP

- **UI**: Mostrar status de carga en tiempo real si el Excel es muy grande (Worker long-polling o WebSocket)
- **Persistencia**: Actualmente cada `GET /api/dataset` recalcula desde D1 — cachear en Cloudflare KV si es lento
- **Auditoría**: Log de importaciones está en D1; agregar endpoint `/api/admin/logs` para repasar histórico
- **Programas**: Si se necesita en el futuro, agregar columna a D1 + lógica de dedup + UI de selección
- **Rollback**: Guardar snapshot de `academic_records` antes de cada import; crear endpoint `/api/admin/import/{id}/rollback`
