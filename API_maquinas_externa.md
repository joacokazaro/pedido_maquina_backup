# 🔌 API externa (`/api/external`)

Endpoints pensados para integraciones de sistema a sistema (Kazaró 360,
etc.), separados de la API interna que usa el frontend. No usan el header
`x-auth-username` ni `requireActor`: se autentican con una API key fija.

## 🔐 Autenticación

Todas las rutas de este documento requieren el header:

```
x-api-key: <token>
```

Los tokens válidos se configuran en `backend/.env` con
`EXTERNAL_API_TOKENS` (uno o varios, separados por coma). Sin ese header,
o con un valor que no esté en la lista, la respuesta es:

```json
// 401
{ "error": "API key inválida o faltante" }
```

**Rate limit:** 60 requests cada 15 minutos por IP, compartido entre
todas las rutas de `/api/external`. Al superarlo:

```json
// 429
{ "error": "Demasiadas solicitudes. Probá de nuevo en unos minutos." }
```

Implementación: `backend/src/middlewares/apiKeyAuth.js`,
`backend/src/routes/external.routes.js`.

---

## `GET /api/external/maquinas`

Devuelve el listado de máquinas con su servicio, asignación activa y
titular.

### Query params (todos opcionales)

| Param | Tipo | Descripción |
|---|---|---|
| `tipo` | string | Filtra por `Maquina.tipo` exacto |
| `estado` | string | Uno de los estados válidos (`disponible`, `asignada`, `no_devuelta`, `fuera_servicio`, `taller`, `baja`); case-insensitive |
| `servicioId` | string | Filtra por el `idBrowix` del servicio (no por el id interno) |

Si `estado` no es uno de los valores válidos, responde `400`.

### Respuesta — `200`

Array de objetos, uno por máquina:

| Campo | Descripción |
|---|---|
| `codigo` | Id de la máquina (`Maquina.id`) |
| `tipo` | Tipo de máquina |
| `modelo` | Modelo |
| `serie` | Número de serie |
| `estado` | Estado actual |
| `servicioOriginal` | Nombre del servicio al que está asignada de forma fija |
| `servicioIdBrowix` | `idBrowix` de ese servicio |
| `fechaCompra` | `YYYY-MM-DD` o `""` |
| `proveedorFactura`, `valorCompra`, `empresa`, `anio`, `amortizacion`, `antiguedad` | Datos de compra/amortización |
| `estadoAmortizacion` | `"Amortizada"` / `"No amortizada"` / `"Sin datos"` |
| `valorUsadaUSD`, `valorUsadaARS`, `valorNuevaUSD`, `valorNuevaARS` | Valuaciones |
| `origenInfo` | Origen del dato de valuación |
| `servicioAmortizacion` | Servicio usado para el cálculo de amortización (puede diferir del servicio actual) |
| `comentarios` | Libre |
| `pedidoActivo`, `estadoPedidoActivo`, `destinoPedidoActivo` | Si la máquina está afectada a un pedido activo (préstamo o pedido a depósito) |
| `servicioPrestamo` | Servicio del pedido activo, si aplica |
| `titular` | Supervisor(es) activos del servicio original, concatenados por coma |
| `solicitante` | Quién generó el pedido activo, si hay uno |
| `fechaPedido` | Fecha del pedido activo, `YYYY-MM-DD` |

Implementación: `backend/src/services/maquinasExport.service.js`,
`backend/src/controllers/external.controller.js` (`getMaquinasExternal`).

---

## `GET /api/external/vehiculos`

### Query params (todos opcionales, aceptan listas separadas por coma)

| Param | Tipo | Descripción |
|---|---|---|
| `empresa` | string o lista | Filtra por empresa |
| `patente` | string o lista | Filtra por patente |
| `conductorId` | int o lista de int | Filtra por `Usuario.id` del conductor actual; `400` si algún valor no es entero |

### Respuesta — `200`

Array de objetos, uno por vehículo:

| Campo | Descripción |
|---|---|
| `id`, `empresa`, `estado`, `vehiculo`, `patente`, `modelo` | Datos básicos |
| `numeroPoliza`, `motor`, `chasis`, `tipoCobertura`, `seguro` | Datos de seguro |
| `vtoSeguro`, `vtoMatafuego`, `vtoItv`, `obleaGnc`, `pruebaHidraulicaGnc` | Vencimientos, `DD/MM/YYYY` o `""` |
| `vtoSeguroAplica`, `vtoMatafuegoAplica`, `vtoItvAplica`, `obleaGncAplica`, `pruebaHidraulicaGncAplica` | `"SI"` / `"NO"` — si ese vencimiento aplica a este vehículo |
| `tarjetaVerde` | `"TIENE"` / `"NO TIENE"` |
| `conductorUsername`, `conductorNombre` | Conductor actual asignado, si hay uno |

Implementación: `backend/src/services/vehiculosExport.service.js`,
`backend/src/controllers/external.controller.js` (`getVehiculosExternal`).

---

## `POST /api/external/servicios`

Alta de un servicio, **fijo o eventual**, típicamente disparada desde
Kazaró 360 al crear un servicio ahí. Un único endpoint: el campo `tipo`
decide sobre qué entidad impacta (`Servicio` o `Eventual`). Solo
creación — no hace upsert ni actualiza servicios/eventuales existentes.

### Body — común a ambos tipos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `tipo` | `"FIJO"` \| `"EVENTUAL"` | Sí | Decide si impacta en `Servicio` o en `Eventual` |
| `nombre` | string | Sí | Debe ser único dentro de su tipo (`Servicio.nombre` o `Eventual.nombre`) |
| `tipoServicio` | `"LIMPIEZA"` \| `"ESPACIOS_VERDES"` | Sí | Clasificación por área (`Servicio.tipo` / `Eventual.tipo`) |
| `legajoSupervisor` | string | No | Matchea contra `Usuario.legajo` |
| `dniSupervisor` | string | No | Matchea contra `Usuario.dni`. Si vienen los dos, se prioriza `legajoSupervisor` |

### Body — solo `tipo: "FIJO"`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `idBrowix` | string | **Sí** | Id del servicio en Browix. Se guarda en mayúsculas |

### Body — solo `tipo: "EVENTUAL"`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `fechaInicio` | string (fecha) | No | Fecha de inicio planificada |
| `fechaFin` | string (fecha) | No | Fecha de fin, si ya se conoce |

### Match de supervisor

Se busca un `Usuario` **activo** cuyo rol esté en `ROLES_PEDIDO_TITULAR`
(`encargado_ev`, `supervisor_limpieza`, `coordinador`, `supervisor_ev`) y
cuyo `legajo` (o `dni`) coincida con el enviado.

- Si matchea: en `FIJO` se crea la relación `UsuarioServicio` (el
  supervisor queda asignado a ese servicio, sin tocar otras asignaciones
  que ya tuviera); en `EVENTUAL` se fija `Eventual.supervisorId`.
- Si **no** matchea (no vino el dato, o no hay nadie con ese
  legajo/DNI activo en ese grupo de roles): el servicio/eventual se crea
  **igual**, sin supervisor asignado. No es un error.

La respuesta siempre incluye un bloque `supervisor` indicando qué pasó.

### Ejemplos de request

**Servicio fijo:**
```json
POST /api/external/servicios
x-api-key: <token>
Content-Type: application/json

{
  "tipo": "FIJO",
  "nombre": "Servicio Barrio X",
  "tipoServicio": "LIMPIEZA",
  "idBrowix": "BR-123",
  "legajoSupervisor": "4521"
}
```

**Eventual:**
```json
POST /api/external/servicios
x-api-key: <token>
Content-Type: application/json

{
  "tipo": "EVENTUAL",
  "nombre": "SE - Nuevo Eventual",
  "tipoServicio": "ESPACIOS_VERDES",
  "fechaInicio": "2026-09-15",
  "dniSupervisor": "30111222"
}
```

### Respuestas

**`201` — Servicio fijo creado:**
```json
{
  "message": "Servicio creado correctamente",
  "servicio": {
    "id": 4,
    "nombre": "Servicio Barrio X",
    "idBrowix": "BR-123",
    "tipo": "LIMPIEZA",
    "activo": true,
    "createdAt": "2026-09-10T17:26:24.882Z"
  },
  "supervisor": { "matched": true, "usuarioId": 2, "username": "encargado.ev" }
}
```

**`201` — Eventual creado, sin match de supervisor:**
```json
{
  "message": "Eventual creado correctamente",
  "eventual": { "id": 17, "nombre": "SE - Nuevo Eventual", "...": "..." },
  "supervisor": { "matched": false, "motivo": "sin_dato" }
}
```
`motivo` es `"sin_dato"` si no vino `legajoSupervisor` ni `dniSupervisor`,
o `"no_encontrado"` si vino pero no matcheó a nadie elegible.

**`400`** — falta un campo obligatorio, `tipo` inválido, o (en eventual)
`fechaFin` anterior a `fechaInicio`:
```json
{ "error": "idBrowix obligatorio para un servicio fijo" }
```

**`409`** — ya existe un servicio/eventual con ese `nombre`:
```json
{ "error": "Ya existe un servicio con ese nombre" }
```

### Notas de implementación

- El alta de `Eventual` reutiliza `saveEventual()`
  (`backend/src/services/eventuales.service.js`), la misma función que
  usa el alta manual desde `/admin/eventuales` — hereda toda su
  validación y deja registro en `HistorialEventual`
  (`accion: "EVENTUAL_CREADO"`).
- Como esa función exige un usuario actor real (para el historial), las
  altas de eventual quedan firmadas por un usuario de sistema
  (`integracion-kazaro360`, `activo: false`, sin password ni email — no
  puede loguearse) que se autocrea la primera vez que se usa.
- El alta de `Servicio` no requiere actor: `Servicio` no tiene tabla de
  historial (igual que el alta manual vía `/admin/servicios`).
- Servicio nuevo: `backend/src/services/externalAlta.service.js`.
  Controller: `backend/src/controllers/external.controller.js`
  (`postServicioExternal`). Ruta: `backend/src/routes/external.routes.js`.

### Cómo cargar legajo/DNI de un usuario

`Usuario.legajo` y `Usuario.dni` son columnas nuevas
(migración `20260910141914_add_legajo_dni_usuario`) y hoy están vacías
para todos los usuarios existentes — hasta que no se carguen, ningún
match de supervisor va a encontrar a nadie (el servicio/eventual se
crea igual, pero sin supervisor asignado).

Se cargan como cualquier otro dato de usuario, desde `/admin/usuarios`
(alta o edición) o vía API:

```
PUT /api/admin-users/:username
Content-Type: application/json

{ "legajo": "4521", "dni": "30111222" }
```

Ambos son únicos: si el legajo o DNI ya está en uso por otro usuario, la
respuesta es `409`. Enviar `""` o no enviar el campo no lo modifica;
enviar `null` explícito lo borra.
