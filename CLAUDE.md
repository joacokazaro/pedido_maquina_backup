# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

### Backend (`backend/`)
```
npm run dev                    # nodemon, puerto 3000
npm start                      # producción
npm run prisma:generate        # regenerar cliente Prisma tras cambiar schema.prisma
npm run prisma:migrate:deploy  # aplicar migraciones
npm run prisma:seed            # seed (prisma/seed.js)
```

### Frontend (`frontend/`)
```
npm run dev      # Vite en 5173; proxya /api → http://localhost:3000 (vite.config.js)
npm run build    # build de producción
npm run lint     # ESLint
```

No hay suite de tests en el proyecto.

En producción el backend sirve el build del frontend desde `backend/public/` (SPA fallback en `server.js`); el deploy corre por GitHub Actions (`.github/workflows/deploy.yml`) hacia EC2 con PM2. El frontend siempre habla con la API por mismo origen (`VITE_API_URL=/api`).

## Arquitectura

Monorepo con dos apps independientes (cada una con su propio `package.json`):

- **backend/**: Express 4 + Prisma 4 sobre SQLite + Socket.IO. Flujo `routes/ → controllers/ → services/`; el cliente Prisma se importa desde `src/db/prisma.js`. Todo cuelga de `/api`; las rutas admin se montan como varios routers sobre el mismo prefijo `/api/admin` (más `/api/admin-users`) en `server.js`.
- **frontend/**: React 19 + Vite 7 + Tailwind 3 + React Router 7. Sin librería de estado: Context API (`context/AuthContext.jsx`).

### Identidad y autorización (crítico para entender el código)

No hay tokens verificados: el frontend manda el header `x-auth-username` en cada request (`frontend/src/utils/authHeaders.js`) y el backend resuelve el actor con `requireActor(req, res, allowedRoles)` de `src/services/requestActor.service.js`, que busca ese username en la base y valida rol. **Cada controller debe llamar `requireActor` explícitamente** — no hay middleware a nivel router, y la mayoría de los controllers admin todavía no lo llama (deuda conocida). `taller.controller.js` es el patrón de referencia: roles de lectura y de edición diferenciados por endpoint.

Un usuario puede tener varios roles: `Usuario.rol` (legacy, string) convive con la relación `roles`; la lógica de resolución está en `src/services/roles.service.js` (`userHasAnyRole`, `buildUserRoleResponse`). Roles válidos: `admin`, `coordinador`, `consultor`, `taller`, `deposito`, `encargado_ev`, `supervisor_limpieza`, `supervisor_ev`. `isAllowedRoleCombination` solo admite un rol único o el par `deposito` + `taller`.

**No nombrar roles de supervisión sueltos en el código**: usar los grupos de `roles.service.js` (espejados en `frontend/src/constants/roles.js`).

- `ROLES_SUPERVISION` = `encargado_ev` + `supervisor_limpieza`. `encargado_ev` es el rename del ex-rol `supervisor` (migración `20260723120000_rename_supervisor_a_encargado_ev`); `supervisor_limpieza` hereda todo. `supervisor_ev` **no** integra este grupo a propósito (ver debajo).
- `ROLES_PEDIDO_TITULAR` = `ROLES_SUPERVISION` + `coordinador` + `supervisor_ev`. Es el conjunto que puede ser **titular de un pedido** (recibe las máquinas a su nombre), ser **supervisor asignado de un eventual** y crear pedidos para los eventuales propios. El coordinador entra acá porque opera como "un supervisor más" además de su rol de backoffice; por eso `GET /supervisores/catalogo`, `/supervisores/:id/maquinas` y `/supervisores/:id/vehiculos` resuelven sobre este grupo y devuelven coordinadores.
- **`supervisor_ev`** ("Supervisor Espacios Verdes") es transversal: a diferencia de `encargado_ev`/`supervisor_limpieza`, que solo operan sobre el eventual que tienen asignado, `supervisor_ev` opera sobre **cualquier eventual del sistema** sin volverse su titular ni fijarse como supervisor al disparar un pedido complementario. Por eso está en `ROLES_PEDIDO_TITULAR` pero no en `ROLES_SUPERVISION`; los bypasses puntuales (`esSupervisorEvGlobal` / `esSupervisorEv`) viven en `eventuales.service.js` (`updateEventualComponentesBySupervisor`, `addSupervisorObservation`) y `pedidos.controller.js` (`crearPedido`), no en el grupo de roles.
- **Única diferencia entre `encargado_ev` y `supervisor_limpieza`**: solo `supervisor_limpieza` (y `supervisor_ev`, sobre cualquier eventual) puede cargar las máquinas y vehículos utilizados de un eventual desde la pantalla del supervisor (`updateEventualComponentesBySupervisor` / `PUT /api/eventuales/:id/componentes`; `puedeCargarComponentes` en `SupervisorEventualDetalle.jsx`). Para todo lo demás, `encargado_ev` y `supervisor_limpieza` son idénticos. Si aparece un tercer chequeo puntual de `supervisor_limpieza` en el código, probablemente sea un bug.
- **`Servicio` y `Eventual` se categorizan por área con el campo `tipo`** (`LIMPIEZA` / `ESPACIOS_VERDES`), agregado en `20260824190035_add_tipo_servicio_eventual` y backfilleado a mano (`backend/scripts/backfill-tipo-servicio-eventual.sql`, corrida única contra producción). El catálogo vive en `src/services/tipoServicio.service.js`, espejado en `frontend/src/constants/tipoServicio.js`; `normalizeTipoServicio` devuelve `null` ante un valor inválido. `Eventual.tipo` es **obligatorio al guardar** (`saveEventual` rechaza vacío); `Servicio.tipo` es nullable y solo se hereda del eventual cuando `crearPedido` crea el servicio homónimo (si el servicio ya existía **no** se pisa, para no deshacer una reclasificación manual). El tipo **no** restringe quién puede ser supervisor: cualquier rol de `ROLES_PEDIDO_TITULAR` puede serlo de cualquier eventual.
- **`encargado_ev` tiene alcance por tipo**, distinto del alcance global de `supervisor_ev`: ve y puede pedir para cualquier eventual o servicio de tipo `ESPACIOS_VERDES` sin estar asignado (`tipoAlcance` en `listEventuales`, `esEncargadoEvDeTipo` en `eventuales.controller.js`, `esRolEspaciosVerdesTransversal` en `crearPedido`). A diferencia de `supervisor_ev`, **sí** queda fijado como titular del eventual si este no tenía supervisor.

En el frontend, `AuthContext` persiste usuario/roles en `localStorage` y `components/ProtectedRoute.jsx` corta la navegación por rol.

### Dominio

- **Servicios** son la entidad central: condicionan qué pedidos puede crear un supervisor y qué máquinas puede operar (asignación en "Supervisores x Servicios").
- **Pedidos** siguen el flujo `PENDIENTE_PREPARACION → PREPARADO → ENTREGADO → PENDIENTE_CONFIRMACION → CERRADO`, con variantes `PENDIENTE_CONFIRMACION_FALTANTES`, `PENDIENTE_CANCELACION` y `CANCELADO`. Destino puede ser depósito o otro supervisor (préstamos).
- **Dirección de los préstamos (trampa habitual):** `Pedido.destino` es *a quién se le hace* el pedido (quien entrega las máquinas); el solicitante (`Pedido.supervisorId`) es quien las **recibe**. En `GET /supervisores/:id/maquinas` (`admin_supervisores.controller.js`), las `maquinasTemporales` traen `pedido.tipo: "PRESTAMO"` cuando el supervisor consultado es el **prestamista** (le pidieron a él; ídem "Mis Préstamos" en el frontend, que son pedidos que otros le hicieron). Las máquinas que un supervisor tiene temporalmente en su poder son las de `pedido.tipo: "PEDIDO"` con `estado: "ENTREGADO"` — el campo `pedido.destino` de la respuesta distingue si vienen del depósito o de otro supervisor.
- **Máquinas** tienen estados `disponible / asignada / no_devuelta / fuera_servicio / taller / baja`, más estado de amortización (`AMORTIZADA / NO_AMORTIZADA / SIN_DATOS`) calculado por tipo de máquina y plazo.
- **Taller** registra ingresos/egresos individuales y masivos con auditoría en `TallerMovimiento`; estados legacy `reparacion` se normalizan a `taller`.
- **Eventuales** (`activo / finalizado / cancelado`) registran componentes, vehículos, trabajos y servicios extras; baja lógica, PDF solo al finalizar. El supervisor asignado puede ser cualquier rol de `ROLES_PEDIDO_TITULAR` y dispara **pedidos complementarios** desde `/supervisor/pedido/nuevo` o desde el detalle del eventual; admin y coordinador pueden dispararlos como backoffice a nombre del supervisor asignado (`crearPedido` distingue backoffice de auto-servicio comparando el actor con el titular). Ese pedido hace `upsert` de un `Servicio` homónimo al eventual y se lo autoasigna al supervisor. Desde `/admin/eventuales/:id/completar` se pueden importar las horas fichadas en **Browix** (sistema de marcación externo, `src/services/browix.service.js`): suma `minutos_teoricos_de_jornada` de los fichajes cuya `ubicacion` matchea *exacto* el nombre del eventual, dentro de `fechaInicio`–`fechaFin` (ambas obligatorias para habilitar la importación). Solo cuentan los fichajes con `minutos_teoricos_de_jornada > 0` (`filtrarFichajesDeJornada`): los días de franco rotativo (ROT), licencia (ENF) o sin turno vienen con 0 y aparecen en la planificación del eventual aunque la persona no haya ido — si no se filtraran inflarían `cantidadFichajes` y `cantidadPersonas` por categoría con 0 hs. El resultado pisa `Eventual.horasBrowix` (JSON) en cada reimportación; cada intento exitoso además queda en el historial (`HORAS_BROWIX_IMPORTADAS`). Config vía `BROWIX_BASE_URL` / `BROWIX_WORKGROUP_UUID` / `BROWIX_GRUPO_IDS` (lista separada por comas — varios grupos de Browix pueden alimentar eventuales; se consultan todos y se combinan los fichajes) / `BROWIX_AUTH_TOKEN` (opcional, se manda como header `X-AUTH-TOKEN` solo si está seteado) en `backend/.env`. Desde la misma pantalla se importan los **insumos** consumidos (`src/services/insumos.service.js`, API de `insumos.kazaro.com.ar`): matchea por `Servicio` de nombre exacto al eventual, sin acotar por fecha, probando todos los tokens de `INSUMOS_API_TOKENS` porque esa API separa por empresa y acá `Servicio`/`Eventual` no tienen campo empresa. Tanto los insumos como las horas de Browix y las horas de supervisor exigen el eventual **finalizado**, y cada reimportación pisa el resultado anterior. Browix responde por momentos con errores transitorios; ante un fallo alcanza con reintentar desde el botón. Además, Browix limita las consultas por uuid (informado en el body del 400): `getWorkgroupschedulePlan` exige 10s entre consultas y `getUsers` exige 1s — por eso las consultas a grupos y a categorías por legajo se hacen secuenciales con espaciado (`BROWIX_MIN_MS_ENTRE_CONSULTAS_GRUPOS` default 10500ms, `BROWIX_MIN_MS_ENTRE_CONSULTAS_LEGAJOS` default 1100ms) en vez de en paralelo, con un reintento ante rate-limit antes de abortar.

Los estados y roles son `String` en `schema.prisma` — Prisma no soporta enums sobre SQLite. Los conjuntos válidos se definen en los services (p. ej. `ESTADOS_EVENTUAL_VALIDOS` en `eventuales.service.js`); al agregar estados, validar ahí y no confiar en la base. `eventuales.service.js` también tiene el patrón preferido de errores de negocio: `buildError(message, status)` con status HTTP adjunto, que el controller devuelve tal cual.

### Eventuales — unidades de medida y estado real de los datos

Relevado contra producción el 2026-09-02 (37 eventuales: 21 `ESPACIOS_VERDES`, 16 `LIMPIEZA`, 0 sin tipo).

**El tipo de trabajo no fija la unidad.** `TIPOS_TRABAJO_VALIDOS` y `UNIDADES_MEDIDA_VALIDAS` son dos listas independientes: el formulario deja elegir cualquier combinación, y en la práctica el mismo trabajo se cargó con unidades distintas. La unidad canónica **por convención** (no hay nada en el código que la imponga todavía) es:

| Trabajo | Unidad canónica |
|---|---|
| `DESMALEZADO`, `DESMONTE` | `M2` |
| `RETIRO_PODA` | `M3` (volumen retirado, no superficie) |
| `PODA_ALTURA`, `PODA_MENOR_2M`, `LIMPIEZA_INTEGRAL` | `UNIDAD` |
| `CORTE_BARRIDO`, `CORTE_CESPED` | sin uso real todavía |

`CORTE_CESPED` y `DESMONTE` tienen **0 usos** en toda la base: conviene confirmar con el supervisor de EV si el corte de césped se está cargando como `DESMALEZADO` antes de tratarlos como trabajos distintos en un indicador.

**Correcciones de unidad ya aplicadas a mano** (no hay migración; se hizo por SQL directo):
- `RETIRO_PODA` estaba 6 veces en `M3` y 3 en `M2`; el 2026-09-02 se unificó todo en `M3` (9 registros, 126 m³) actualizando `unidadMedida` y `unidadLabel`. Backup: `pedido.db.bak_20260902_125445_pre_unidad_retiro_poda`. Quedó asentado en el historial con la acción **`CORRECCION_UNIDAD_RETIRO_PODA`**, que no existe en el código — ningún mapa de labels del frontend la conoce y cae en el fallback genérico.
- **Pendiente:** el eventual 21 (`SE - LAGUNA AZUL LA CALERA`) tiene `DESMALEZADO` cargado en `HORAS` (9). No se convirtió a propósito: "9 horas" es una medición de esfuerzo, no una superficie mal etiquetada, y no hay dato para deducir los m². Requiere preguntarle al supervisor (`hlucero`).

**Cobertura real de los campos de cierre** — importa antes de proponer cualquier métrica, porque varios campos están vacíos en toda la base:

| Campo | Cobertura (sobre 12 EV finalizados) |
|---|---|
| `horasBrowix`, `trabajosRealizados` | 12/12 |
| `maquinasUtilizadas` | 10/12 |
| `insumosExtras` | 8/12 |
| `insumosImportados` | 3/12, y **solo 1 con monto > $0** |
| `horasSupervisor` | **0 de 21** |
| `serviciosExtrasSubcontratados` | **0 de 21** |

La importación de insumos está **estructuralmente limitada**: matchea por `Servicio` homónimo, y ese servicio solo nace cuando se dispara un pedido complementario, así que solo 6 de los 21 eventuales EV tienen con qué matchear. Los otros 15 nunca van a traer nada.

Consecuencia práctica: hoy **no se puede calcular ningún costo** de un eventual (no hay costo laboral —falta tarifa por categoría—, ni subcontratados, ni insumos en la mayoría). Los indicadores que sí funcionan son los de producción y productividad: horas-hombre por categoría, m²/hora-hombre en desmalezado, m³/hora-hombre en retiro de poda y litros de combustible por hora-hombre. `totalHorasReal` se importa desde el día uno pero **no discrimina**: es igual al teórico en 11 de 12 casos.

`src/services/estadisticas.service.js` (secciones *tiempo real* / *avisos* / *período*, solo rol `admin`) **no mide nada de eventuales** — la palabra no aparece en el archivo.

**Código muerto del módulo, para no perder tiempo persiguiéndolo:** `finalizeSupervisorEventual()` en `eventuales.service.js` (nadie lo importa), `POST /api/eventuales/:id/finalizar` (devuelve un `403` fijo), la ruta frontend `/admin/eventuales/:id/finalizar` (ninguna pantalla enlaza a ella) y `frontend/src/components/HistorialEventual.jsx` (sin un solo import, aunque el README lo cita como si estuviera en uso).

**Deuda de autorización concreta:** en `adminEventuales.controller.js`, el alta (`POST`), la edición (`PUT`) y la baja (`DELETE`) **no llaman `requireActor`** — el actor sale de `req.body.usuario` y solo se verifica que ese username exista, sin chequear rol. Los otros cuatro endpoints del mismo controller sí lo llaman. En `eventuales.controller.js`, `getEventualSupervisor` solo valida autorización si viene el query param `username`, y `getMisEventuales` deja pasar `tipoAlcance` desde el query string para roles que no son `encargado_ev`.

### Tiempo real

Socket.IO se expone vía `app.set("io", ...)`; los controllers emiten con `req.app.get("io")`. Rooms: `DEPOSITO` y `USER:<username>` (el frontend se une desde `AuthContext` al conectar). Las notificaciones persisten en la tabla de notificaciones además de emitirse.

### Excel

Importación con multer en `memoryStorage` (validación de MIME, límite de filas y tamaño); exportación conviven `exceljs` y `xlsx` (se busca consolidar en `exceljs`).

### Base de datos SQLite en producción — operaciones manuales

El archivo real en el servidor es `/var/lib/pedido-maquina/db/pedido.db` (`DATABASE_URL` en `backend/.env`). **No confundir con `backend/dev.db`**, que existe en el server pero está vacío/sin uso — y ojo que el `backend/.env` **local** apunta justamente a `file:./dev.db`, así que una query corrida en la máquina de desarrollo no ve datos de producción.

Al servidor se entra por SSH como `ubuntu@<host>` con la key `.pem` del proyecto, que vive fuera del repo en la máquina del operador; el host y el usuario son los secrets `SERVER_HOST` / `SERVER_USER` de `.github/workflows/deploy.yml` y el host quedó registrado en el `~/.ssh/known_hosts` local. Para inspeccionar sin riesgo, `sqlite3 -readonly`. Los campos `DateTime` los guarda Prisma como **enteros en milisegundos**, no como texto: en SQL hay que hacer `date(fecha/1000,'unixepoch')`, si no `date()` devuelve vacío. Cuidado también con los alias en `GROUP BY`: `Eventual.tipo` existe como columna, así que un `GROUP BY tipo` sobre un `json_extract(...) AS tipo` agrupa por la columna de la tabla y devuelve un solo grupo.

La mayoría de los modelos (incluido `Eventual`) usan `@id @default(autoincrement())`, que Prisma resuelve como `INTEGER PRIMARY KEY AUTOINCREMENT` nativo de SQLite: el contador vive en `sqlite_sequence` y nunca reutiliza un ID borrado, sin importar cuántas filas se eliminen. **Excepción:** `Pedido.id` es `TEXT` con formato `P-0001`, generado a mano en `getNextPedidoCode()` (`pedidos.controller.js`) vía `MAX(SUBSTR(id,3))+1` sobre las filas existentes. Borrar el pedido con el número más alto hace que el próximo insert reutilice un ID ya usado — esto ya rompió el sistema una vez. Antes de borrar filas de `Pedido` a mano, evaluar el impacto en `getNextPedidoCode()`; los modelos con autoincrement real no tienen este riesgo.

Si se opera directo con `sqlite3` (bypaseando Prisma), `PRAGMA foreign_keys` viene en `OFF` por defecto en esa sesión — a diferencia del cliente de Prisma, que sí lo activa. Sin `PRAGMA foreign_keys = ON;` explícito, los `ON DELETE RESTRICT`/`ON DELETE SET NULL` definidos en el schema (p. ej. `HistorialEventual → Eventual` es `RESTRICT`, `Pedido.eventualId → Eventual` es `SET NULL`) no se aplican y pueden quedar filas huérfanas. Siempre: activar el pragma, envolver en `BEGIN TRANSACTION`/`COMMIT`, y sacar un backup antes de cualquier escritura manual. La convención de nombre que se viene usando en ese directorio es `pedido.db.bak_<YYYYmmdd_HHMMSS>_<motivo>` (p. ej. `pedido.db.bak_20260902_125445_pre_unidad_retiro_poda`), y conviene cerrar con `PRAGMA integrity_check;`.

Una escritura manual **no pasa por Prisma y por lo tanto no escribe historial**. Si el cambio toca un `Eventual`, agregar a mano la fila en `HistorialEventual` (con `fecha` en milisegundos) explicando en el `detalle` que fue una corrección manual y con qué backup, o el cambio queda sin rastro para quien lo mire después.

## Convenciones

- Todo en español: UI, comentarios, mensajes de commit (`feat:` / `fix:` en español).
- La guía visual del frontend está en `KAZARO_FRONTEND_STYLE_TRANSFER.md` (paleta `kazaro-*`, tipografías Barlow/Raleway); las pantallas nuevas deberían usarla en lugar de los colores genéricos de Tailwind.
- `README.md` documenta roles, módulos y endpoints; `Instructivo.md` es el manual funcional de usuario final — actualizarlo si cambia un flujo operativo.
- Operaciones multi-paso sobre inventario deben ir en `prisma.$transaction` (los movimientos masivos son transaccionales por requisito).
