# API externa de máquinas y vehículos — guía de consumo

APIs de solo lectura para consultar el parque de máquinas y vehículos. Pensadas para consumo externo (scripts, integraciones), no requieren cuenta de usuario en el sistema.

## Autenticación

Todas las requests, a cualquiera de los dos endpoints, deben incluir el header `X-API-Key` con el token asignado:

```
X-API-Key: <TU_TOKEN_AQUI>
```

El token real **no está en este documento** — se entrega por separado, por un canal seguro. Pedirlo a Joaquín si no lo tenés. Es el mismo token para máquinas y para vehículos.

- Sin header, o con un valor incorrecto → `401 Unauthorized`.
- **El token es un secreto**: no lo pegues en repos públicos, chats no cifrados ni herramientas que lo indexen. Si se filtra, avisar para rotarlo (es una lista separada por comas en el servidor, se puede revocar sin afectar a otros consumidores).
- Límite de **60 requests cada 15 minutos por IP**, compartido entre ambos endpoints (no es 60+60).

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

## Errores

Aplica a ambos endpoints.

| HTTP | Motivo |
|---|---|
| `401` | Falta el header `X-API-Key` o el valor no es válido. |
| `400` | `estado` inválido (máquinas), o `conductorId` no numérico (vehículos). |
| `429` | Se superó el límite de 60 requests cada 15 minutos por IP. |
| `500` | Error interno. |
