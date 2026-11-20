# Panel de Rendimiento Académico — UNSA

Dashboard de rendimiento académico de pregrado (2019–2026) con acceso por rol.

## Cómo correrlo en VS Code

```bash
npm install
npx wrangler d1 migrations apply academic-db-produccion --local
npm run dev
```

Después de actualizar el proyecto, vuelve a ejecutar el comando de migraciones
para aplicar los cambios pendientes a la D1 local.

Abre `http://localhost:3000` → redirige a `/login`.
El dashboard carga un dataset precomputado desde un archivo estático y no consulta
D1 al abrirse. Para hacer una importación local, aplica las migraciones locales,
inicia sesión con ADMIN y usa **"Subir Excel"** durante el desarrollo.

El acceso se realiza con Google. Solo pueden entrar los correos autorizados en
`src/lib/roles.ts`; la importación local está disponible únicamente para el rol
`ADMIN` durante el desarrollo.

## Dar de alta una cuenta/rol nuevo

Editar `src/lib/roles.ts` y agregar una entrada a `ROLE_MAP`. Los nombres de
`facultad`/`escuela` deben coincidir EXACTAMENTE con los que aparecen en
dataset estático en `public/data/` (columnas `FACULTAD`/`ESCUELA` del Excel origen).

## Actualizar los datos publicados

La importación web está habilitada solo en desarrollo y guarda en la D1 local.
No se muestra ni escribe en la base de producción. El importador reconoce
las cabeceras `PERIODO, FACULTAD, ESCUELA, CODIGO, ASIGNATURA, GRUPOS,
MATRICULADOS, APROBADOS, DESAPROBADOS, ABANDONOS, RETIROS, APROB 11-13,
APROB. 14-16, APROB. 17-20, PROMEDIO, DOCENTES` y `AÑO ESTUDIOS`.
Son obligatorias `PERIODO, ESCUELA, CODIGO, ASIGNATURA, MATRICULADOS, APROBADOS`
y `DESAPROBADOS`; las demás son opcionales.

Para publicar los cambios después de importar un Excel:

1. En desarrollo, importa el Excel. Los registros quedan en D1 local.
2. Ejecuta `npm run data:build`. El comando exporta solo la D1 local, usa el
   mismo constructor del dashboard y genera un JSON versionado en `public/data/`.
3. Revisa el dataset generado y el cambio en `src/lib/generated-dataset.ts`.
4. Incluye ambos archivos en un commit y súbelo a GitHub para desplegar.

La aplicación de producción sirve el JSON estático desde Cloudflare y no lee ni
escribe registros en D1. La URL del archivo incluye su hash; así, cada versión
usa una ruta nueva y el navegador puede reutilizar la copia en caché.

La importación compara todos los campos del registro; para `ASIGNATURA` ignora
mayúsculas y acentos vocálicos, pero conserva la diferencia entre N y Ñ. Las filas repetidas exactamente dentro del Excel se agrupan.
La migración local `0005_exact_row_deduplication.sql` elimina la llave antigua
que confundía registros diferentes con el mismo periodo, escuela, código y grupo.

## Estructura

- `src/lib/roles.ts` — cuentas y roles
- `src/lib/session.ts` — sesión + alcance de datos por rol
- `src/lib/data-utils.ts` — cálculos (tasas, semáforo, agrupaciones)
- `src/lib/excelParser.ts` + `src/lib/recompute.ts` — ingestión de Excel
- `scripts/generate-static-dataset.mjs` — genera el dataset estático desde D1 local
- `src/components/` — piezas del dashboard (KPIs, gráficos, tablas, tabs)
- `src/app/login`, `src/app/dashboard` — páginas

## Despliegue en Cloudflare Workers

La configuración única de Wrangler es `wrangler.jsonc`; no se debe crear otro
`wrangler.toml`. El Worker configurado se llama `dashboard-unsa-produccion`.

Para desplegar automáticamente desde GitHub, conecta el Worker existente al
repositorio `LucelyMendoza/dashboard-unsa-2025` desde **Workers & Pages →
dashboard-unsa-produccion → Settings → Builds**. Usa la rama `main`, la raíz
del repositorio, `npm run cf:build` como comando de build y
`npx opennextjs-cloudflare deploy` como comando de despliegue. Cada commit
nuevo en `main` debe crear un build; confirma en Deployments que el commit
publicado sea el más reciente.

Workers Builds debe ejecutar `npm run cf:build`, no solo `npm run build`, para
generar el Worker de OpenNext. La caché incremental usa Workers Static Assets
de solo lectura; este proyecto no requiere un bucket R2 para la caché.

Para desplegar manualmente desde un entorno autenticado con Wrangler, ejecuta
`npm run cf:deploy`.
