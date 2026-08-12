# API externa de máquinas — guía de consumo

API de solo lectura para consultar el parque de máquinas. Pensada para consumo externo (scripts, integraciones), no requiere cuenta de usuario en el sistema.

## Autenticación

Todas las requests deben incluir el header `X-API-Key` con el token asignado:

```
X-API-Key: <TU_TOKEN_AQUI>
```

El token real **no está en este documento** — se entrega por separado, por un canal seguro. Pedirlo a Joaquín si no lo tenés.

- Sin header, o con un valor incorrecto → `401 Unauthorized`.
- **El token es un secreto**: no lo pegues en repos públicos, chats no cifrados ni herramientas que lo indexen. Si se filtra, avisar para rotarlo (es una lista separada por comas en el servidor, se puede revocar sin afectar a otros consumidores).

## Endpoint

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

## Respuesta

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
| `fechaCompra`, `proveedorFactura`, `valorCompra`, `empresa`, `anio` | Datos de compra. |
| `amortizacion`, `estadoAmortizacion`, `antiguedad` | Datos de amortización. |
| `valorUsadaUSD` / `valorUsadaARS` / `valorNuevaUSD` / `valorNuevaARS` | Valuaciones. |
| `origenInfo`, `servicioAmortizacion`, `comentarios` | Metadata adicional. |
| `pedidoActivo`, `estadoPedidoActivo`, `destinoPedidoActivo`, `servicioPrestamo` | Datos del pedido activo (vacío si la máquina no está afuera en este momento). |
| `titular` | Supervisor(es) del servicio dueño de la máquina. Si hay más de uno, aparecen separados por coma. |
| `solicitante` | Persona que solicitó el pedido activo (vacío si no hay pedido activo). |
| `fechaPedido` | Fecha de creación del pedido activo (vacío si no hay pedido activo). Es la fecha del pedido en general, no necesariamente el día exacto en que esta máquina puntual se sumó a él. |

Cualquier campo vacío se devuelve como `""` (no `null`).

## Errores

| HTTP | Motivo |
|---|---|
| `401` | Falta el header `X-API-Key` o el valor no es válido. |
| `400` | `estado` no es uno de los valores permitidos. |
| `429` | Se superó el límite de 60 requests cada 15 minutos por IP. |
| `500` | Error interno. |
