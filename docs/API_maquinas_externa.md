# API externa de máquinas y vehículos — guía de consumo

APIs para consultar el parque de máquinas y vehículos, y para dar de alta y editar servicios (fijos o eventuales) desde un sistema externo. Pensadas para consumo externo (scripts, integraciones), no requieren cuenta de usuario en el sistema.

## Autenticación

Todas las requests, a cualquiera de los endpoints, deben incluir el header `X-API-Key` con el token asignado:

```
X-API-Key: <TU_TOKEN_AQUI>
```

El token real **no está en este documento** — se entrega por separado, por un canal seguro. Pedirlo a Joaquín si no lo tenés. Es el mismo token para todos los endpoints.

- Sin header, o con un valor incorrecto → `401 Unauthorized`.
- **El token es un secreto**: no lo pegues en repos públicos, chats no cifrados ni herramientas que lo indexen. Si se filtra, avisar para rotarlo (es una lista separada por comas en el servidor, se puede revocar sin afectar a otros consumidores).
- Límite de **60 requests cada 15 minutos por IP**, compartido entre todos los endpoints (no es 60 por endpoint).

---

## Máquinas

```
GET https://maquinas.kazaro.com.ar/api/external/maquinas
```

### Filtros (query params, todos opcionales)

| Param | Tipo | Descripción |
|---|---|---|
| `tipo` | string | Tipo de máquina, coincidencia exacta (ej. `APILADOR SEMIELECTRICO 1500 KG`). |
| `estado` | string | Uno de: `disponible`, `asignada`, `no_devuelta`, `fuera_servicio`, `taller`, `baja`. Valor inválido → `400`. |
| `servicioId` | string | **ID de Browix del servicio** (no el ID interno del sistema), ej. `?servicioId=K78`. No distingue mayúsculas/minúsculas. Si no matchea ningún servicio, devuelve `[]`. |

Sin filtros, devuelve **todo** el parque de máquinas.

### Ejemplo

```bash
curl -H "X-API-Key: <TU_TOKEN_AQUI>" \
  "https://maquinas.kazaro.com.ar/api/external/maquinas?estado=disponible"
```

### Respuesta

`200 OK` con un array JSON, un objeto por máquina:

```json
[
  {
    "codigo": "M-0123",
    "tipo": "APILADOR SEMIELECTRICO 1500 KG",
    "modelo": "...",
    "serie": "...",
    "estado": "asignada",
    "servicioOriginal": "APROSS",
    "servicioIdBrowix": "K78",
    "fechaCompra": "2021-07-01",
    "proveedorFactura": "",
    "valorCompra": "",
    "empresa": "Pulizia",
    "anio": 2018,
    "amortizacion": "",
    "estadoAmortizacion": "Sin datos",
    "antiguedad": 8,
    "valorUsadaUSD": "",
    "valorUsadaARS": "",
    "valorNuevaUSD": "",
    "valorNuevaARS": "",
    "origenInfo": "",
    "servicioAmortizacion": "",
    "comentarios": "",
    "pedidoActivo": "P-0456",
    "estadoPedidoActivo": "ENTREGADO",
    "destinoPedidoActivo": "DEPOSITO",
    "servicioPrestamo": "",
    "titular": "Juan Pérez",
    "solicitante": "María Gómez",
    "fechaPedido": "2026-08-01"
  }
]
```

### Campos

| Campo | Descripción |
|---|---|
| `codigo` | Identificador único de la máquina. |
| `tipo` | Tipo de máquina. |
| `modelo`, `serie` | Datos del equipo. |
| `estado` | `disponible` / `asignada` / `no_devuelta` / `fuera_servicio` / `taller` / `baja`. |
| `servicioOriginal` | Servicio dueño de la máquina. |
| `servicioIdBrowix` | ID de Browix del servicio dueño de la máquina (el mismo valor que se usa como filtro `servicioId`). Vacío si el servicio no tiene ID de Browix cargado. |
| `fechaCompra`, `proveedorFactura`, `valorCompra`, `empresa`, `anio` | Datos de compra. |
| `amortizacion`, `estadoAmortizacion`, `antiguedad` | Datos de amortización. |
| `valorUsadaUSD` / `valorUsadaARS` / `valorNuevaUSD` / `valorNuevaARS` | Valuaciones. |
| `origenInfo`, `servicioAmortizacion`, `comentarios` | Metadata adicional. |
| `pedidoActivo`, `estadoPedidoActivo`, `destinoPedidoActivo`, `servicioPrestamo` | Datos del pedido activo (vacío si la máquina no está afuera en este momento). |
| `titular` | Supervisor(es) del servicio dueño de la máquina. Si hay más de uno, aparecen separados por coma. |
| `solicitante` | Persona que solicitó el pedido activo (vacío si no hay pedido activo). |
| `fechaPedido` | Fecha de creación del pedido activo (vacío si no hay pedido activo). Es la fecha del pedido en general, no necesariamente el día exacto en que esta máquina puntual se sumó a él. |

Cualquier campo vacío se devuelve como `""` (no `null`).

---

## Vehículos

```
GET https://maquinas.kazaro.com.ar/api/external/vehiculos
```

Expone exactamente los mismos datos que el Excel de "Exportar vehículos" del panel admin — es una ficha técnica por vehículo (seguro, vencimientos, conductor fijo asignado), **no incluye datos de pedidos/préstamos activos** (a diferencia de máquinas).

### Filtros (query params, todos opcionales)

Los tres aceptan uno o varios valores separados por coma.

| Param | Tipo | Descripción |
|---|---|---|
| `empresa` | string o lista | Coincidencia exacta contra `Vehiculo.empresa`. Ej. `?empresa=PULIZIA` o `?empresa=PULIZIA,PAZAR`. |
| `patente` | string o lista | Coincidencia exacta. Ej. `?patente=AD388IV,AD388IW`. |
| `conductorId` | integer o lista | ID interno del conductor actual asignado. Valor no numérico → `400`. Ej. `?conductorId=3,12`. |

Se pueden combinar los tres a la vez (AND entre filtros, OR entre los valores de un mismo filtro). Sin filtros, devuelve **todo** el parque de vehículos.

### Ejemplo

```bash
curl -H "X-API-Key: <TU_TOKEN_AQUI>" \
  "https://maquinas.kazaro.com.ar/api/external/vehiculos?empresa=PULIZIA,PAZAR"
```

### Respuesta

`200 OK` con un array JSON, un objeto por vehículo:

```json
[
  {
    "id": "1",
    "empresa": "PULIZIA",
    "estado": "activo",
    "vehiculo": "PEUGEOT 207",
    "patente": "MVD332",
    "modelo": "2013",
    "numeroPoliza": "",
    "motor": "F943MNB3294",
    "chasis": "MBUSAFSNAUFB21421",
    "tipoCobertura": "TOTAL CONTRA 3ROS",
    "seguro": "LA SEGUNDA",
    "vtoSeguro": "26/12/2026",
    "vtoSeguroAplica": "SI",
    "vtoMatafuego": "14/04/2026",
    "vtoMatafuegoAplica": "SI",
    "vtoItv": "",
    "vtoItvAplica": "NO",
    "obleaGnc": "",
    "obleaGncAplica": "NO",
    "pruebaHidraulicaGnc": "",
    "pruebaHidraulicaGncAplica": "NO",
    "tarjetaVerde": "TIENE",
    "conductorUsername": "cmoya",
    "conductorNombre": "CRISTINA MOYA"
  }
]
```

### Campos

| Campo | Descripción |
|---|---|
| `id` | Identificador único del vehículo. |
| `empresa` | Empresa a la que pertenece (`PULIZIA`, `PAZAR`, etc.). |
| `estado` | Tal cual está cargado en la base: `disponible` / `asignada` / `no_devuelta` / `fuera_servicio` / `taller` / `baja`, o el legacy `activo` (vehículos viejos aún no migrados al resto de los estados). |
| `vehiculo`, `patente`, `modelo`, `motor`, `chasis` | Datos del vehículo. |
| `numeroPoliza`, `tipoCobertura`, `seguro` | Datos de la póliza de seguro. |
| `vtoSeguro` / `vtoMatafuego` / `vtoItv` / `obleaGnc` / `pruebaHidraulicaGnc` | Fechas de vencimiento, formato `dd/mm/aaaa`. Vacío si no tiene fecha cargada. |
| `vtoSeguroAplica` / `vtoMatafuegoAplica` / `vtoItvAplica` / `obleaGncAplica` / `pruebaHidraulicaGncAplica` | `"SI"` / `"NO"` — si ese vencimiento aplica para este vehículo. |
| `tarjetaVerde` | `"TIENE"` / `"NO TIENE"`. |
| `conductorUsername`, `conductorNombre` | Conductor fijo asignado actualmente (vacíos si no tiene). |

Cualquier campo vacío se devuelve como `""` (no `null`).

---

## Servicios (alta)

Da de alta un servicio, **fijo o eventual**, en el sistema de pedido de máquinas. Pensado para dispararse desde Kazaró 360 al crear un servicio ahí, así el alta se replica automáticamente acá.

```
POST https://maquinas.kazaro.com.ar/api/external/servicios
```

Si el `nombre` que mandás ya existe, devuelve `409` y no toca nada. Para modificar un servicio/eventual ya creado usá el endpoint de [edición](#servicios-edición): guardá el `id` que devuelve el alta (`servicio.id` si es `FIJO`, `eventual.id` si es `EVENTUAL`), porque es lo que identifica al registro en la edición.

### Body — común a los dos tipos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `tipo` | `"FIJO"` \| `"EVENTUAL"` | Sí | Decide si se crea un servicio fijo o un eventual. |
| `nombre` | string | Sí | Tiene que ser único (no puede repetir el nombre de un servicio/eventual ya existente). |
| `tipoServicio` | `"LIMPIEZA"` \| `"ESPACIOS_VERDES"` | Sí | Clasificación por área. |
| `legajoSupervisor` | string | No | Para matchear al supervisor por legajo. |
| `dniSupervisor` | string | No | Para matchear al supervisor por DNI. Si mandás los dos, se usa `legajoSupervisor`. |

### Body — solo si `tipo` es `"FIJO"`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `idBrowix` | string | **Sí** | ID del servicio en Browix. |

### Body — solo si `tipo` es `"EVENTUAL"`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `fechaInicio` | string (fecha) | No | Fecha de inicio, si ya se conoce. |
| `fechaFin` | string (fecha) | No | Fecha de fin, si ya se conoce. |

### Match de supervisor

Si mandás `legajoSupervisor` o `dniSupervisor` y matchea contra un usuario activo del sistema, ese usuario queda asignado como supervisor del servicio/eventual. **Si no matchea a nadie (o no mandás ninguno de los dos), el servicio/eventual se crea igual, sin supervisor** — no es un error, la respuesta simplemente lo indica.

### Ejemplos

Servicio fijo:

```bash
curl -X POST "https://maquinas.kazaro.com.ar/api/external/servicios" \
  -H "X-API-Key: <TU_TOKEN_AQUI>" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "FIJO",
    "nombre": "Servicio Barrio X",
    "tipoServicio": "LIMPIEZA",
    "idBrowix": "K99",
    "legajoSupervisor": "4521"
  }'
```

Eventual:

```bash
curl -X POST "https://maquinas.kazaro.com.ar/api/external/servicios" \
  -H "X-API-Key: <TU_TOKEN_AQUI>" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "EVENTUAL",
    "nombre": "SE - Nuevo Eventual",
    "tipoServicio": "ESPACIOS_VERDES",
    "fechaInicio": "2026-09-15",
    "dniSupervisor": "30111222"
  }'
```

### Respuesta

`201 Created`. Para `FIJO`:

```json
{
  "message": "Servicio creado correctamente",
  "servicio": {
    "id": 4,
    "nombre": "Servicio Barrio X",
    "idBrowix": "K99",
    "tipo": "LIMPIEZA",
    "activo": true,
    "createdAt": "2026-09-10T17:26:24.882Z"
  },
  "supervisor": { "matched": true, "usuarioId": 2, "username": "encargado.ev" }
}
```

Para `EVENTUAL`, la clave es `"eventual"` en vez de `"servicio"`, con el objeto completo del eventual creado.

Si no matcheó ningún supervisor, el bloque `supervisor` se ve así:

```json
"supervisor": { "matched": false, "motivo": "sin_dato" }
```

`motivo` es `"sin_dato"` (no mandaste `legajoSupervisor` ni `dniSupervisor`) o `"no_encontrado"` (mandaste uno de los dos, pero no matcheó a nadie).

---

## Servicios (edición)

Modifica un servicio fijo o un eventual que ya existe. Pensado para dispararse desde Kazaró 360 cuando se edita un servicio ahí.

```
PATCH https://maquinas.kazaro.com.ar/api/external/servicios/:id
```

- `:id` es el id interno que devolvió el alta: `servicio.id` si es `FIJO`, `eventual.id` si es `EVENTUAL`.
- **Solo se modifican los campos que vienen en el body.** Un campo ausente no se toca; no hace falta mandar el objeto completo.
- **Es idempotente**: repetir el mismo PATCH es seguro. Si todo ya estaba igual responde `200` con `cambios: []` y no escribe nada.
- `tipo` e `idBrowix` **no se editan** (ver tabla).

### Body

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `tipo` | `"FIJO"` \| `"EVENTUAL"` | **Sí** | Solo sirve para ubicar el registro (servicios y eventuales tienen ids independientes: el servicio `4` y el eventual `4` son dos registros distintos). **No cambia el tipo.** Si el `id` no existe para ese `tipo` → `404`. |
| `nombre` | string | No | Renombra. No puede quedar vacío. Tiene que ser único entre **servicios y eventuales** (sin contar al propio registro) → si otro ya lo usa, `409`. |
| `tipoServicio` | `"LIMPIEZA"` \| `"ESPACIOS_VERDES"` | No | Reclasifica por área. |
| `legajoSupervisor` | string | No | Supervisor nuevo, mismo match que el alta. |
| `dniSupervisor` | string | No | Ídem por DNI. Si mandás los dos, se usa `legajoSupervisor`. |
| `legajoSupervisorAnterior` | string | No | Solo `FIJO`: supervisor a desvincular (ver abajo). En un `EVENTUAL` se ignora. |
| `dniSupervisorAnterior` | string | No | Ídem por DNI. Si mandás los dos, se usa el legajo. |
| `fechaInicio` | string (`AAAA-MM-DD`) \| `null` | No | Solo `EVENTUAL`. `null` (o `""`) borra la fecha. En un `FIJO` → `400`. |
| `fechaFin` | string (`AAAA-MM-DD`) \| `null` | No | Solo `EVENTUAL`. `null` (o `""`) borra la fecha. En un `FIJO` → `400`. |
| `idBrowix` | string | No | **No se edita.** En un `FIJO` se acepta solo si es igual al actual (para que mandar el objeto completo no falle); si es distinto → `400`. En un `EVENTUAL` se ignora. |

Validaciones de fechas (`EVENTUAL`): `fechaFin` no puede quedar antes que `fechaInicio` (tomando la que ya estaba cargada si mandás solo una), y a un eventual **finalizado** no se le puede borrar la `fechaFin`. Cualquiera de las dos → `400`.

### Supervisor

- **`EVENTUAL`** (un solo supervisor): el que matchea **reemplaza** al actual. Excepción: si el eventual ya tiene pedidos complementarios disparados, el supervisor quedó fijado por esos pedidos y **no se cambia** (misma regla que en la app); la respuesta lo informa con `motivo: "supervisor_fijado_por_pedidos"` y el resto de los campos del PATCH sí se aplican.
- **`FIJO`** (puede tener varios supervisores): el que matchea **se agrega**, sin tocar a los demás supervisores cargados a mano en esta app. Si además mandás `legajoSupervisorAnterior` / `dniSupervisorAnterior` y ese usuario está vinculado al servicio, se lo desvincula. El anterior se busca sin filtrar por rol ni por activo, para poder desvincular a alguien que ya no es supervisor.
- **Si el supervisor nuevo no matchea a nadie, no se toca ningún supervisor** (tampoco se desvincula al anterior) y la respuesta lo informa. No es un error: el resto del PATCH se aplica igual.
- Si no mandás `legajoSupervisor` ni `dniSupervisor`, los supervisores no se tocan.

### Ejemplos

Renombrar un servicio fijo y cambiar su supervisor:

```bash
curl -X PATCH "https://maquinas.kazaro.com.ar/api/external/servicios/4" \
  -H "X-API-Key: <TU_TOKEN_AQUI>" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "FIJO",
    "nombre": "Servicio Barrio X - Sector Norte",
    "legajoSupervisor": "4600",
    "legajoSupervisorAnterior": "4521"
  }'
```

Mover las fechas de un eventual y borrar la fecha de fin:

```bash
curl -X PATCH "https://maquinas.kazaro.com.ar/api/external/servicios/18" \
  -H "X-API-Key: <TU_TOKEN_AQUI>" \
  -H "Content-Type: application/json" \
  -d '{ "tipo": "EVENTUAL", "fechaInicio": "2026-09-20", "fechaFin": null }'
```

### Respuesta

`200 OK`. Para `FIJO`:

```json
{
  "message": "Servicio actualizado correctamente",
  "servicio": {
    "id": 4,
    "nombre": "Servicio Barrio X - Sector Norte",
    "idBrowix": "K99",
    "tipo": "LIMPIEZA",
    "activo": true,
    "createdAt": "2026-09-10T17:26:24.882Z"
  },
  "cambios": ["nombre", "supervisor"],
  "supervisor": { "matched": true, "aplicado": true, "usuarioId": 7, "username": "jperez" },
  "supervisorAnterior": { "encontrado": true, "desvinculado": true, "username": "encargado.ev" }
}
```

Para `EVENTUAL`, la clave es `"eventual"` en vez de `"servicio"`, con el objeto completo del eventual ya actualizado (misma forma que en el alta), y nunca trae `supervisorAnterior`.

Si no cambió nada, `message` es `"Sin cambios"` y `cambios` es `[]`.

| Campo | Descripción |
|---|---|
| `cambios` | Lista de campos que efectivamente cambiaron: `"nombre"`, `"tipoServicio"`, `"supervisor"`, `"fechaInicio"`, `"fechaFin"`. `[]` si todo ya estaba igual. |
| `supervisor.matched` | Si `legajoSupervisor`/`dniSupervisor` matcheó a un supervisor activo. |
| `supervisor.aplicado` | Si ese usuario queda como supervisor después del PATCH (haya cambiado algo o ya lo fuera). |
| `supervisor.motivo` | Aparece cuando no se aplicó: `"sin_dato"` (no mandaste supervisor), `"no_encontrado"` (no matcheó a nadie), `"supervisor_fijado_por_pedidos"` (solo eventual: matcheó, pero el supervisor está fijado por pedidos complementarios). |
| `supervisorAnterior` | Solo `FIJO` y solo si mandaste `legajoSupervisorAnterior`/`dniSupervisorAnterior`. `desvinculado: true` si se lo desvinculó. Si no, `motivo`: `"sin_supervisor_nuevo"` (el supervisor nuevo no matcheó, así que no se desvinculó a nadie), `"no_encontrado"` (no existe un usuario con ese legajo/DNI), `"es_el_supervisor_nuevo"` (anterior y nuevo son la misma persona), `"no_vinculado"` (existe, pero no estaba vinculado a este servicio). |

### Qué pasa al renombrar

Máquinas, pedidos, préstamos, amortización e historial de servicios apuntan al servicio por id, no por nombre: después de un renombre todo muestra el nombre nuevo, sin perder nada. En particular:

- **Eventual con pedidos complementarios**: al disparar un pedido desde un eventual, el sistema crea un servicio con el mismo nombre del eventual y le cuelga los pedidos. Al renombrar el eventual, ese servicio se renombra en la misma operación, así los pedidos siguientes siguen cayendo en el mismo servicio.
- **Importación de horas de Browix e insumos de un eventual**: esas integraciones buscan por el nombre exacto del eventual (la ubicación en Browix y el servicio en la plataforma de insumos). Si renombrás un eventual acá pero no allá, las reimportaciones siguientes no van a encontrar nada. Los datos que ya se habían importado se conservan.
- **Importación de máquinas por Excel**: la columna de servicio se matchea por nombre al momento de importar, así que los Excel nuevos tienen que usar el nombre nuevo.
- Los servicios fijos se vinculan con Browix por `idBrowix`, que no cambia con un renombre.

---

## Errores

| HTTP | Motivo |
|---|---|
| `401` | Falta el header `X-API-Key` o el valor no es válido. |
| `400` | `estado` inválido (máquinas), `conductorId` no numérico (vehículos), falta un campo obligatorio / `tipo` inválido (alta de servicios), o en la edición: `id` no numérico, `tipo` faltante/inválido, `nombre` vacío, `tipoServicio` inválido, fecha inválida o fuera de orden, fechas en un `FIJO`, `idBrowix` distinto al actual. El mensaje indica el campo. |
| `404` | Solo en `PATCH /servicios/:id`: no existe un registro con ese `id` para ese `tipo`. |
| `409` | En `POST /servicios`: ya existe un servicio o eventual con ese `nombre`. En `PATCH /servicios/:id`: otro servicio o eventual ya usa el `nombre` nuevo. |
| `429` | Se superó el límite de 60 requests cada 15 minutos por IP. |
| `500` | Error interno. |
