# API Reference — Excel Import & Dataset

## POST /api/admin/import

**Descripción**: Importa o previsualiza filas de académicas. Requiere autenticación (JWT Firebase) y rol ADMIN.

### Request

```typescript
POST /api/admin/import
Content-Type: application/json
Authorization: Bearer <idToken>

{
  "rows": [
    {
      "periodo": "2024-A",
      "anio": 2024,
      "facultad": "CIENCIAS DE LA EDUCACIÓN",
      "escuela": "EDUCACIÓN",
      "codigo": "0913272",
      "asignatura": "QUIMICA INORGANICA II",
      "grupo": "X",
      "docente": "DR. JUAN PÉREZ",
      "matriculados": 1,
      "aprobados": 1,
      "desaprobados": 0,
      "abandonos": 0,
      "retiros": 0,
      "promedio": 12,
      "_fila": 3
    }
    // ... más filas
  ],
  "sourceFile": "educacion_2024.xlsx",
  "mode": "preview"  // o "commit"
}
```

### Response (mode: preview)

```json
{
  "summary": {
    "totalFilas": 150,
    "nuevos": 140,
    "duplicados": 10,
    "errores": [
      {
        "fila": 45,
        "motivo": "Periodo con formato inválido: '2024' (esperado AAAA-X)"
      }
    ]
  },
  "preview": [
    {
      "periodo": "2024-A",
      "escuela": "EDUCACIÓN",
      "asignatura": "QUIMICA INORGANICA II",
      "matriculados": 1,
      "aprobados": 1,
      "desaprobados": 0
    }
    // ... primeras 50 filas
  ]
}
```

### Response (mode: commit)

```json
{
  "summary": {
    "totalFilas": 150,
    "nuevos": 140,
    "duplicados": 10,
    "errores": []
  }
}
```

### Códigos de error

| Status | Significado |
|---|---|
| 400 | JSON inválido, rows vacío, archivo muy grande |
| 401 | Token ausente o inválido |
| 403 | Correo no tiene rol ADMIN |
| 500 | Error en servidor (BD no disponible, etc.) |

---

## GET /api/dataset

**Descripción**: Entrega el dataset académico completo (equivalente al anterior `public/data/initialData.json`).

### Request

```
GET /api/dataset
```

### Response (200 OK)

```json
{
  "fe": {
    "CIENCIAS DE LA EDUCACIÓN": ["EDUCACIÓN"],
    "ADMINISTRACIÓN": ["ADMINISTRACIÓN", "BANCA Y SEGUROS", "GESTIÓN"]
    // ... mapeo Facultad → [Escuelas]
  },
  "ps": ["2021-A", "2021-B", "2022-A", ...],  // períodos únicos
  "fs": ["CIENCIAS DE LA EDUCACIÓN", "ADMINISTRACIÓN", ...],  // facultades
  "es": ["EDUCACIÓN", "ADMINISTRACIÓN", ...],  // escuelas
  "an": ["QUIMICA INORGANICA II", "MATEMÁTICAS I", ...],  // asignaturas
  "dn": ["DR. JUAN PÉREZ", "(sin especificar)", ...],  // docentes
  "ag": [
    {
      "PERIODO": "2021-A",
      "AÑO": 2021,
      "FACULTAD": "CIENCIAS DE LA EDUCACIÓN",
      "ESCUELA": "EDUCACIÓN",
      "m": 150,  // matriculados totales
      "a": 120,  // aprobados
      "d": 20,   // desaprobados
      "b": 5,    // abandonos
      "r": 5,    // retiros
      "n": 12,   // número de grupos/asignaturas agregadas
      "prom": 14.2  // promedio ponderado
    }
    // ... filas agregadas por periodo/facultad/escuela
  ],
  "sa": [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 12],  // [periodIdx, facultyIdx, schoolIdx, subjectIdx, m, a, d, b, r, prom]
    // ... filas por asignatura (SubjectRow)
  ],
  "dc": [
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0],  // [teacherIdx, periodIdx, facIdx, escIdx, subjIdx, m, a, d, b, r]
    // ... filas por docente (TeacherRow)
  ],
  "sc": [
    {
      "e": "EDUCACIÓN",
      "f": "CIENCIAS DE LA EDUCACIÓN",
      "tm": 5000,  // total matriculados
      "ta": 80.5,  // tasa aprobación %
      "td": 12.3,  // tasa desaprobación %
      "tr": 3.2,   // tasa retiro %
      "tb": 4.0,   // tasa abandono %
      "tn": 7.2,   // tasa "no culminación" (retiro + abandono) %
      "sl": 2.1,   // pendiente (regresión lineal de tasas anuales)
      "cv": 15.8,  // coeficiente de variación %
      "yr": {"2021": 78.5, "2022": 80.1, "2023": 81.2, "2024": 80.5},  // tasas por año
      "br": 2.7    // brecha (max - min de tasas anuales)
    }
    // ... scorecard por escuela
  ],
  "cd": []  // (vacío, por compatibilidad)
}
```

### Errores

| Status | Significado |
|---|---|
| 500 | D1 no configurada |

---

## Flujo Completo (Cliente → Backend)

### 1. Usuario selecciona Excel

```
excelParser.ts:parseExcelFile(buffer)
  ↓
ParseResult { filasValidas: ImportRow[], errores, totalFilas }
```

### 2. Envía preview al backend

```
POST /api/admin/import
Authorization: Bearer <idToken>
Body: { rows, sourceFile, mode: 'preview' }
  ↓
auth-verify.ts:requireAdmin(request)
  ✓ JWT válido
  ✓ Correo en ADMIN_EMAILS
  ↓
dataset-builder.ts: dedup contra claves en D1
  ↓
Response: { summary, preview }
```

### 3. Usuario ve resumen + previsualiza

```
AdminUploadModal.tsx: Muestra
  - Nuevos: X
  - Duplicados: Y
  - Errores: Z
  - Tabla de primeras 50 filas
```

### 4. Usuario confirma → commit

```
POST /api/admin/import
Authorization: Bearer <idToken>
Body: { rows, sourceFile, mode: 'commit' }
  ↓
D1: INSERT OR IGNORE academic_records (batch de 50 filas)
D1: INSERT import_log (registro de auditoría)
  ↓
Response: { summary } (con números finales)
```

### 5. Dashboard recarga

```
GET /api/dataset
  ↓
dataset-builder.ts: lee academic_records desde D1
  ↓
DashboardDataset: rebuild con datos nuevos
  ↓
dashboard/page.tsx: renderiza con nuevos datos
```

---

## Verificación Local (curl)

```bash
# 1. Obtener token (después de login en http://localhost:3000)
# En DevTools → Application → Local Storage → token o en IndexedDB de Firebase
TOKEN="<tu-idtoken-aqui>"

# 2. Probar dataset (público)
curl http://localhost:3000/api/dataset | jq '.ag[0]'

# 3. Probar preview de importación
curl -X POST http://localhost:3000/api/admin/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rows": [{
      "periodo": "2024-A",
      "anio": 2024,
      "facultad": "CIENCIAS DE LA EDUCACIÓN",
      "escuela": "EDUCACIÓN",
      "codigo": "0913272",
      "asignatura": "QUIMICA INORGANICA II",
      "grupo": "X",
      "docente": "DR. JUAN PÉREZ",
      "matriculados": 1,
      "aprobados": 1,
      "desaprobados": 0,
      "abandonos": 0,
      "retiros": 0,
      "promedio": 12,
      "_fila": 2
    }],
    "sourceFile": "test.xlsx",
    "mode": "preview"
  }' | jq .
```

---

## Migración de datos (crear BD vacía, luego seedear)

```sql
-- Archivo: migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS academic_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo TEXT NOT NULL,
  anio INTEGER NOT NULL,
  facultad TEXT NOT NULL,
  escuela TEXT NOT NULL,
  codigo TEXT NOT NULL,
  asignatura TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT '',
  docente TEXT NOT NULL DEFAULT '(sin especificar)',
  matriculados INTEGER NOT NULL DEFAULT 0,
  aprobados INTEGER NOT NULL DEFAULT 0,
  desaprobados INTEGER NOT NULL DEFAULT 0,
  abandonos INTEGER NOT NULL DEFAULT 0,
  retiros INTEGER NOT NULL DEFAULT 0,
  promedio REAL NOT NULL DEFAULT 0,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (escuela, periodo, codigo, grupo)
);

CREATE INDEX idx_ar_periodo ON academic_records(periodo);
CREATE INDEX idx_ar_facultad ON academic_records(facultad);
CREATE INDEX idx_ar_escuela ON academic_records(escuela);

CREATE TABLE IF NOT EXISTS import_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  source_file TEXT NOT NULL,
  total_filas INTEGER NOT NULL,
  nuevos INTEGER NOT NULL,
  duplicados INTEGER NOT NULL,
  errores INTEGER NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

**Actualización**: 2026-08-12 — Implementación completada, listo para setup local.
