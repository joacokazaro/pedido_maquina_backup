# API externa de máquinas y vehículos — guía de consumo

APIs para consultar el parque de máquinas y vehículos, y para dar de alta servicios (fijos o eventuales) desde un sistema externo. Pensadas para consumo externo (scripts, integraciones), no requieren cuenta de usuario en el sistema.

## Autenticación

Todas las requests, a cualquiera de los dos endpoints, deben incluir el header `X-API-Key` con el token asignado:

```
X-API-Key: <TU_TOKEN_AQUI>
```

El token real **no está en este documento** — se entrega por separado, por un canal seguro. Pedirlo a Joaquín si no lo tenés. Es el mismo token para máquinas y para vehículos.

- Sin header, o con un valor incorrecto → `401 Unauthorized`.
- **El token es un secreto**: no lo pegues en repos públicos, chats no cifrados ni herramientas que lo indexen. Si se filtra, avisar para rotarlo (es una lista separada por comas en el servidor, se puede revocar sin afectar a otros consumidores).
- Límite de **60 requests cada 15 minutos por IP**, compartido entre los tres endpoints (no es 60+60+60).

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

Único endpoint de escritura de esta API: da de alta un servicio, **fijo o eventual**, en el sistema de pedido de máquinas. Pensado para dispararse desde Kazaró 360 al crear un servicio ahí, así el alta se replica automáticamente acá.

```
POST https://maquinas.kazaro.com.ar/api/external/servicios
```

Es **solo de creación**: no permite editar un servicio/eventual ya existente. Si el `nombre` que mandás ya existe, devuelve `409` y no toca nada.

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

## Errores

| HTTP | Motivo |
|---|---|
| `401` | Falta el header `X-API-Key` o el valor no es válido. |
| `400` | `estado` inválido (máquinas), `conductorId` no numérico (vehículos), o falta un campo obligatorio / `tipo` inválido (servicios). |
| `409` | Solo en `POST /servicios`: ya existe un servicio o eventual con ese `nombre`. |
| `429` | Se superó el límite de 60 requests cada 15 minutos por IP. |
| `500` | Error interno. |
