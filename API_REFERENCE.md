# Referencia del dataset estático

## Dataset del dashboard

El dashboard carga un archivo JSON precomputado desde `public/data/`. El nombre
incluye el hash del contenido, por ejemplo:

```text
/data/dashboard-<hash>.json
```

El archivo se sirve como recurso estático de Cloudflare. La visita al dashboard
no consulta D1 ni reconstruye los datos en el servidor.

El JSON conserva el contrato `DashboardDataset`: catálogos (`fe`, `ep`, `ps`,
`fs`, `es`, `pr`, `an`, `ac`, `dn`), agregados (`ag`, `sc`) y filas compactas
para asignaturas y docentes (`sa`, `dc`).

## Importar y publicar datos

La importación web está habilitada únicamente en desarrollo y escribe en la D1
local. En producción, `POST /api/admin/import` responde `410 Gone`; la página
oficial no permite subir ni guardar datos en D1.

1. Inicia el sitio en desarrollo, inicia sesión como ADMIN e importa el Excel.
2. Ejecuta `npm run data:build`. El generador exporta `academic_records` de la
   D1 local, usa `buildDataset` y actualiza el archivo JSON versionado y
   `src/lib/generated-dataset.ts`.
3. Revisa los cambios, sube ambos archivos a GitHub y despliega.

El generador requiere Node.js con `node:sqlite` (Node 22.13 o posterior) y las
dependencias instaladas con `npm install`. Wrangler debe tener aplicadas las
migraciones locales antes de importar el Excel.

## Contrato de importación local

`POST /api/admin/import` recibe lotes de hasta 250 filas y admite `preview` y
`commit`. En desarrollo requiere un token de Firebase válido y un correo ADMIN.
Una petición de producción no escribe en ninguna base y responde con estado 410.

La clave para deduplicar filas es `PERIODO + FACULTAD + ESCUELA + CODIGO +
GRUPOS`. Los registros ya importados localmente se pueden omitir o reemplazar
desde la vista previa antes de regenerar el JSON.
