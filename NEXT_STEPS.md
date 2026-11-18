# Próximos Pasos — MVP Educación 2021+

## Setup Local (prerrequisitos)

```bash
npm install
npx wrangler d1 migrations apply academic-db-produccion --local
npm run dev
```

El flag `--local` aplica las migraciones a la base local; no requiere iniciar
sesión ni crear o modificar una base D1 remota. El dashboard lee el JSON
estático, no D1.

## Verificar Compilación TypeScript

```bash
# Hacer tipo-check sin build
npx tsc --noEmit

# Si hay errores, revisarlos. Comunes:
# - "D1Database" no existe → falta instalación o d.ts de @opennextjs/cloudflare
# - "jose" no existe → npm install jose
```

## Actualizar el dataset publicado

1. Ejecuta la aplicación en desarrollo e importa el Excel en la D1 local.
2. Ejecuta `npm run data:build` para generar el JSON estático desde esa base.
3. Revisa el archivo JSON generado y `src/lib/generated-dataset.ts`.
4. Sube esos cambios a la rama `main`; Cloudflare Workers Builds debe desplegar
   el commit. No importes los datos a la D1 remota.

## Testing Manual

```bash
# Terminal 1: Correr dev server
npm run dev

# Terminal 2: Tests HTTP
# 1. Login en http://localhost:3000 → conseguir token Firebase en DevTools

# 2. Probar el JSON estático indicado en src/lib/generated-dataset.ts
curl "http://localhost:3000/data/ARCHIVO_VERSIONADO.json"

# 3. La importación web local requiere token + rol ADMIN
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
- [ ] **Dataset**: Dashboard carga el JSON versionado desde `/data/` (no consulta D1)
- [ ] **Modal de upload**:
  - [ ] Botón "Subir Excel" visible solo para ADMIN
  - [ ] Seleccionar un Excel → valida cabeceras → muestra preview
  - [ ] Resumen (nuevos/duplicados/errores) es correcto
  - [ ] Confirmar → se llama a `/api/admin/import?mode=commit`
- [ ] **Post-importación**: ejecutar `npm run data:build` y verificar el JSON generado antes de publicar
- [ ] **Dedup**: Cargar dos veces el mismo Excel → duplicados = 0 en segunda pasada
- [ ] **Filtros**: Filtro de facultad/escuela/año/período sigue funcionando
- [ ] **Gráficos/Tablas**: KPI, scorecard, heatmap reflejan correctamente los datos

## Troubleshooting

### "D1Database is not defined"
→ Asegúrate que `@opennextjs/cloudflare` está instalado y `opennextjs.config.ts` (si existe) tiene la configuración correcta.

### El dashboard no carga el dataset estático
→ Verifica que la URL de `src/lib/generated-dataset.ts` corresponda a un archivo
  existente en `public/data/`; luego ejecuta `npm run data:build`.

### "jose is not a module"
→ Instalar: `npm install jose`

### Token no se valida en servidor
→ Verifica que `FIREBASE_CONFIG.projectId` es correcto en `src/lib/firebase-config.ts`.

## Deploy a Cloudflare Workers

El proyecto usa OpenNext y la configuración `wrangler.jsonc`. No sigas las
instrucciones antiguas de Cloudflare Pages/D1 ni crees un `wrangler.toml`.

Para despliegues automáticos, conecta el Worker `dashboard-unsa-produccion`
al repositorio GitHub desde **Settings → Builds** y configura:

- Rama: `main`
- Directorio raíz: raíz del repositorio
- Build command: `npm run cf:build`
- Deploy command: `npx opennextjs-cloudflare deploy`

No uses `npm run build` como único comando de build: compila Next.js, pero no
genera el Worker de OpenNext que Cloudflare debe desplegar. La caché
incremental está configurada como Workers Static Assets de solo lectura y no
requiere crear un bucket R2.

Después de subir un commit, verifica en **Deployments / Build history** que el
build use el commit esperado y haya terminado correctamente. Para desplegar
manualmente desde un entorno autenticado con Wrangler, ejecuta
`npm run cf:deploy`.

## Expansión a toda UNSA (post-MVP)

Para publicar una cobertura mayor, importa el nuevo Excel en la D1 local,
regenera el JSON con `npm run data:build`, revisa los cambios y publícalos desde
GitHub. La D1 de producción no forma parte del flujo de publicación.

---

**Estado**: Implementación completada. Listo para setup local y testing.
