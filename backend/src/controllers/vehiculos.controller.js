import prisma from "../db/prisma.js";

const ESTADOS_PEDIDO_INACTIVOS = ["CERRADO", "CANCELADO"];

const VEHICULO_RELATIONS = {
  seguro: true,
  conductorActual: { select: { id: true, username: true, nombre: true } },
  asignacionesPedido: {
    where: {
      pedido: {
        estado: {
          notIn: ESTADOS_PEDIDO_INACTIVOS,
        },
      },
    },
    orderBy: { id: "desc" },
    take: 1,
    include: {
      pedido: {
        include: {
          supervisor: { select: { username: true, nombre: true } },
        },
      },
    },
  },
};

function mapVehiculoResponse(v) {
  const asignacionActiva = v.asignacionesPedido?.[0] ?? null;
  const pedidoActivo = asignacionActiva?.pedido
    ? {
        id: asignacionActiva.pedido.id,
        estado: asignacionActiva.pedido.estado,
        destino: asignacionActiva.pedido.destino,
        supervisor: asignacionActiva.pedido.supervisor?.username ?? null,
        supervisorNombre:
          asignacionActiva.pedido.supervisor?.nombre ??
          asignacionActiva.pedido.supervisor?.username ??
          null,
        titular: asignacionActiva.pedido.supervisorDestinoUsername ?? null,
      }
    : null;

  let estadoUi;
  if (v.estado === "baja") estadoUi = "baja";
  else if (pedidoActivo) estadoUi = "asignada";
  else estadoUi = "disponible";

  return {
    id: v.id,
    tipo: (v.vehiculo || "VEHICULO").toString(),
    modelo: v.modelo || null,
    serie: v.patente || null,
    estado: estadoUi,
    servicioId: null,
    servicio: null,
    esVehiculo: true,
    pedidoActivo,
  };
}

export async function getVehiculos(req, res) {
  try {
    const { conductorUsername, conductorId } = req.query || {};
    const where = {};
    if (conductorUsername) {
      where.conductorActual = { is: { username: conductorUsername } };
    }
    if (conductorId) {
      const idNum = Number(conductorId);
      if (!Number.isNaN(idNum)) where.conductorActualId = idNum;
    }

    const vehiculos = await prisma.vehiculo.findMany({
      where,
      include: VEHICULO_RELATIONS,
      orderBy: { id: "asc" },
    });

    res.json(vehiculos.map(mapVehiculoResponse));
  } catch (e) {
    console.error("getVehiculos:", e);
    res.status(500).json({ error: "Error obteniendo vehículos" });
  }
}

export async function getVehiculoById(req, res) {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: req.params.id },
      include: VEHICULO_RELATIONS,
    });

    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });

    res.json(mapVehiculoResponse(vehiculo));
  } catch (e) {
    console.error("getVehiculoById:", e);
    res.status(500).json({ error: "Error obteniendo vehículo" });
  }
}
