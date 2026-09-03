# Próximos Pasos — MVP Educación 2021+

## Setup Local (prerrequisitos)

```bash
# 1. Instalar dependencias (si no está hecho)
npm install

# 2. Instalar wrangler CLI
npm install -g wrangler

# 3. Autenticarse en Cloudflare
wrangler login

# 4. Crear la BD D1 local para desarrollo
wrangler d1 create academic-db-local

# 5. Aplicar la migración
wrangler d1 execute academic-db-local --file=./migrations/0001_init.sql

# 6. Seedear BD con datos de Educación 2021+ (ver sección "Seedeo" más abajo)

# 7. Correr en desarrollo
npm run dev
# Visita http://localhost:3000 → login → dashboard
```

## Verificar Compilación TypeScript

```bash
# Hacer tipo-check sin build
npx tsc --noEmit

# Si hay errores, revisarlos. Comunes:
# - "D1Database" no existe → falta instalación o d.ts de @opennextjs/cloudflare
# - "jose" no existe → npm install jose
```

## Seedeo de BD (Educación 2021+)

Actualmente, `academic_records` está vacía. Para validar, seedea con datos reales de los Excel:

### Opción A: Script Python (lo más rápido)
```python
# seed_education_2021.py
import openpyxl
import sqlite3

# Abrir el Excel "base_final_-_aprob_desaprob_ret_aband_2019-2024__1_.xlsx"
wb = openpyxl.load_workbook('/ruta/al/archivo.xlsx')
ws = wb['Hoja2']

# Conectar a la BD local
conn = sqlite3.connect('.wrangler/state/v3/d1/database_local.db')  # ruta varía
cur = conn.cursor()

# Iterar rows y filtrar escuela = "EDUCACIÓN" + year >= 2021
for row in ws.iter_rows(min_row=2, values_only=True):
    periodo, escuela, nro, codigo, asignatura, grupos, mat, apr, des, abn, ret, _, _, _, prom = row
    
    if not periodo or not escuela or escuela.upper() != 'EDUCACIÓN':
        continue
    
    year = int(str(periodo)[:4])
    if year < 2021:
        continue
    
    # Insertar
    cur.execute('''
        INSERT OR IGNORE INTO academic_records 
        (periodo, anio, facultad, escuela, codigo, asignatura, grupo, docente, 
         matriculados, aprobados, desaprobados, abandonos, retiros, promedio, source_file)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        periodo, year, 'CIENCIAS DE LA EDUCACIÓN', escuela, codigo, asignatura, grupos or '',
        '(sin especificar)', mat or 0, apr or 0, des or 0, abn or 0, ret or 0, prom or 0,
        'base_final_2019-2024.xlsx'
    ))

conn.commit()
conn.close()
print("Seedeo completado")
```

### Opción B: Usar la propia API
Una vez que el backend está up, cargar a través de la UI (`AdminUploadModal`):
1. Preparar un Excel filtrado (solo Educación 2021+)
2. Entrar como ADMIN
3. Click en "Subir Excel"
4. Ver preview → confirmar → done

**Nota**: Para esto necesita acceso a Firebase y Google Auth, más complejo en local.

## Testing Manual

```bash
# Terminal 1: Correr dev server
npm run dev

# Terminal 2: Tests HTTP
# 1. Login en http://localhost:3000 → conseguir token Firebase en DevTools

# 2. Probar GET /api/dataset (públicо, sin auth)
curl http://localhost:3000/api/dataset | jq .

# 3. Probar POST /api/admin/import (requiere token + ADMIN role)
curl -X POST http://localhost:3000/api/admin/import \
  -H "Authorization: Bearer <TU_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "rows": [...],  # array de ImportRow
    "sourceFile": "test.xlsx",
    "mode": "preview"
  }' | jq .
```

## Verificaciones de Funcionalidad

- [ ] **Login**: Google Auth funciona, rol ADMIN se asigna correctamente
- [ ] **Dataset inicial**: Dashboard carga datos desde `/api/dataset` (no JSON estático)
- [ ] **Modal de upload**:
  - [ ] Botón "Subir Excel" visible solo para ADMIN
  - [ ] Seleccionar un Excel → valida cabeceras → muestra preview
  - [ ] Resumen (nuevos/duplicados/errores) es correcto
  - [ ] Confirmar → se llama a `/api/admin/import?mode=commit`
- [ ] **Post-importación**: Dashboard muestra datos nuevos sin recargar (o recarga la página y trae cambios)
- [ ] **Dedup**: Cargar dos veces el mismo Excel → duplicados = 0 en segunda pasada
- [ ] **Filtros**: Filtro de facultad/escuela/año/período sigue funcionando
- [ ] **Gráficos/Tablas**: KPI, scorecard, heatmap reflejan correctamente los datos

## Troubleshooting

### "D1Database is not defined"
→ Asegúrate que `@opennextjs/cloudflare` está instalado y `opennextjs.config.ts` (si existe) tiene la configuración correcta.

### "/api/dataset" devuelve 404
→ Las rutas en Next.js App Router están bajo `src/app/api/`. Verifica que existen:
  - `src/app/api/dataset/route.ts`
  - `src/app/api/admin/import/route.ts`

### "jose is not a module"
→ Instalar: `npm install jose`

### Token no se valida en servidor
→ Verifica que `FIREBASE_CONFIG.projectId` es correcto en `src/lib/firebase-config.ts`.

## Deploy a Cloudflare (después de validar en local)

```bash
# 1. Crear la BD en Cloudflare Pages
wrangler d1 create academic-db

# 2. Anotar el ID devuelto y actualizar wrangler.toml

# 3. Ejecutar migración en prod
wrangler d1 execute academic-db --file=./migrations/0001_init.sql

# 4. Seedear (con Script Python o upload manual)

# 5. Deploy
npm run build && wrangler pages deploy out/

# 6. Verificar en https://tu-proyecto.pages.dev
```

## Expansión a toda UNSA (post-MVP)

Una vez que el MVP de Educación 2021+ esté validado, expandir es trivial:

1. Cambiar filtro en seed script: `if escuela.upper() == 'EDUCACIÓN'` → quitar (acepta toda)
2. Cambiar rango de años: `if year < 2021` → `if year < 2019` (o lo que sea)
3. Re-seedear BD o dejar que admins vayan cargando incrementalmente vía UI

El código no requiere cambios — el sistema ya es genérico.

---

**Estado**: Implementación completada. Listo para setup local y testing.
