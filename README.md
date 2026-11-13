# Panel de Rendimiento Académico — UNSA

Dashboard de rendimiento académico de pregrado (2019–2024) con acceso por rol.

## Cómo correrlo en VS Code

```bash
npm install
npx wrangler d1 migrations apply academic-db-produccion --local
npm run dev
```

Abre `http://localhost:3000` → redirige a `/login`.
La migración prepara una base D1 local vacía y no modifica la base de producción.
Para ver datos en el dashboard, inicia sesión con una cuenta ADMIN y carga un Excel.

El acceso se realiza con Google. Solo pueden entrar los correos autorizados en
`src/lib/roles.ts`; la carga de datos está disponible únicamente para el rol
`ADMIN`.

## Dar de alta una cuenta/rol nuevo

Editar `src/lib/roles.ts` y agregar una entrada a `ROLE_MAP`. Los nombres de
`facultad`/`escuela` deben coincidir EXACTAMENTE con los que aparecen en
`public/data/initialData.json` (columnas `FACULTAD`/`ESCUELA` del Excel origen).

## Actualizar los datos (rol ADMIN)

Inicia sesión con un correo ADMIN y usa **"Subir Excel"** en la barra superior
(en móvil, abre el menú **Menú** para encontrar el botón). El importador reconoce
las cabeceras `PERIODO, FACULTAD, ESCUELA, CODIGO, ASIGNATURA, GRUPOS,
MATRICULADOS, APROBADOS, DESAPROBADOS, ABANDONOS, RETIROS, APROB 11-13,
APROB. 14-16, APROB. 17-20, PROMEDIO, DOCENTES` y `AÑO ESTUDIOS`.
Son obligatorias `PERIODO, ESCUELA, CODIGO, ASIGNATURA, MATRICULADOS, APROBADOS`
y `DESAPROBADOS`; las demás son opcionales.

Los indicadores del tablero usan los totales `APROBADOS`, `DESAPROBADOS`,
`ABANDONOS`, `RETIROS` y `MATRICULADOS`. Los tres rangos de aprobados se guardan
por separado como desglose y no se vuelven a sumar a `APROBADOS`. `AÑO ESTUDIOS`
también se conserva en D1 para consultas futuras.

La clave para detectar duplicados es `PERIODO + FACULTAD + ESCUELA + CODIGO +
GRUPOS`. Las filas nuevas se importan automáticamente; para cada clave duplicada
puedes elegir una fila del archivo para reemplazar/conservar, o dejar el grupo
omitido. Así no se duplican accidentalmente los conteos del tablero.

La importación se guarda en la base D1 configurada para el entorno en ejecución.
En local, la base empieza vacía; al importar desde `localhost`, los datos solo
se guardan en la D1 local y no alteran producción. Antes de desplegar una versión
que incluya una migración nueva, aplícala también a producción con
`npx wrangler d1 migrations apply academic-db-produccion --remote`.

## Estructura

- `src/lib/roles.ts` — cuentas y roles
- `src/lib/session.ts` — sesión + alcance de datos por rol
- `src/lib/data-utils.ts` — cálculos (tasas, semáforo, agrupaciones)
- `src/lib/excelParser.ts` + `src/lib/recompute.ts` — ingestión de Excel
- `src/components/` — piezas del dashboard (KPIs, gráficos, tablas, tabs)
- `src/app/login`, `src/app/dashboard` — páginas

## Despliegue

El proyecto ya incluye `@opennextjs/cloudflare` y `wrangler` en devDependencies,
para desplegar en Cloudflare Pages/Workers cuando quieras.
