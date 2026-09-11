import { ESTADOS_MAQUINA_VALIDOS } from "../services/inventarioEstados.service.js";
import {
  getMaquinasParaExport,
  buildMaquinaExportRecord,
} from "../services/maquinasExport.service.js";
import {
  getVehiculosParaExport,
  buildVehiculoExportRecord,
} from "../services/vehiculosExport.service.js";
import {
  crearServicioFijoExternal,
  crearEventualExternal,
  editarServicioFijoExternal,
  editarEventualExternal,
} from "../services/externalAlta.service.js";

function parseListParam(raw) {
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function getMaquinasExternal(req, res) {
  try {
    const { tipo, estado, servicioId } = req.query;
    const where = {};

    if (tipo) where.tipo = String(tipo);

    if (estado) {
      const estadoNormalizado = String(estado).trim().toLowerCase();
      if (!ESTADOS_MAQUINA_VALIDOS.includes(estadoNormalizado)) {
        return res.status(400).json({
          error: `Estado inválido. Valores permitidos: ${ESTADOS_MAQUINA_VALIDOS.join(", ")}`,
        });
      }
      where.estado = estadoNormalizado;
    }

    if (servicioId) {
      const idBrowix = String(servicioId).trim().toUpperCase();
      where.servicio = { idBrowix };
    }

    const { maquinas, asignacionPorMaquina } = await getMaquinasParaExport({ where });

    const data = maquinas.map((maquina) =>
      buildMaquinaExportRecord(maquina, asignacionPorMaquina.get(maquina.id) || null)
    );

    res.json(data);
  } catch (e) {
    console.error("getMaquinasExternal:", e);
    res.status(500).json({ error: "Error obteniendo máquinas" });
  }
}

export async function getVehiculosExternal(req, res) {
  try {
    const { empresa, patente, conductorId } = req.query;
    const where = {};

    if (empresa) where.empresa = { in: parseListParam(empresa) };

    if (patente) where.patente = { in: parseListParam(patente) };

    if (conductorId) {
      const ids = parseListParam(conductorId).map(Number);
      if (ids.some((id) => !Number.isInteger(id))) {
        return res.status(400).json({ error: "conductorId debe ser un entero o una lista de enteros separados por coma" });
      }
      where.conductorActualId = { in: ids };
    }

    const { vehiculos } = await getVehiculosParaExport({ where });
    const data = vehiculos.map((vehiculo) => buildVehiculoExportRecord(vehiculo));

    res.json(data);
  } catch (e) {
    console.error("getVehiculosExternal:", e);
    res.status(500).json({ error: "Error obteniendo vehículos" });
  }
}

/* ========================================================
   POST /external/servicios
   Alta de un servicio, fijo o eventual, disparada desde
   Kazaró 360. El campo "tipo" ("FIJO" | "EVENTUAL") decide
   sobre qué entidad impacta.
======================================================== */
export async function postServicioExternal(req, res) {
  try {
    const tipo = String(req.body?.tipo || "").trim().toUpperCase();

    if (!["FIJO", "EVENTUAL"].includes(tipo)) {
      return res.status(400).json({ error: 'El campo "tipo" debe ser "FIJO" o "EVENTUAL"' });
    }

    const { nombre, tipoServicio, idBrowix, fechaInicio, fechaFin, legajoSupervisor, dniSupervisor } =
      req.body || {};

    if (tipo === "FIJO") {
      const { servicio, supervisor } = await crearServicioFijoExternal({
        nombre,
        tipoServicio,
        idBrowix,
        legajo: legajoSupervisor,
        dni: dniSupervisor,
      });

      return res.status(201).json({
        message: "Servicio creado correctamente",
        servicio,
        supervisor,
      });
    }

    const { eventual, supervisor } = await crearEventualExternal({
      nombre,
      tipoServicio,
      fechaInicio,
      fechaFin,
      legajo: legajoSupervisor,
      dni: dniSupervisor,
    });

    return res.status(201).json({
      message: "Eventual creado correctamente",
      eventual,
      supervisor,
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    console.error("postServicioExternal:", e);
    res.status(500).json({ error: "Error creando el servicio" });
  }
}

/* ========================================================
   PATCH /external/servicios/:id
   Edición de un servicio dado de alta desde Kazaró 360.
   :id es el id interno que devolvió el alta; como Servicio
   y Eventual tienen ids independientes, "tipo" solo sirve
   para ubicar el registro (no se puede cambiar).
======================================================== */
export async function patchServicioExternal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "El id del servicio debe ser un entero positivo" });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const tipo = String(body.tipo || "").trim().toUpperCase();

    if (!["FIJO", "EVENTUAL"].includes(tipo)) {
      return res.status(400).json({ error: 'El campo "tipo" debe ser "FIJO" o "EVENTUAL"' });
    }

    if (tipo === "FIJO") {
      const resultado = await editarServicioFijoExternal(id, body);
      return res.json({
        message: resultado.cambios.length ? "Servicio actualizado correctamente" : "Sin cambios",
        ...resultado,
      });
    }

    const resultado = await editarEventualExternal(id, body);
    return res.json({
      message: resultado.cambios.length ? "Eventual actualizado correctamente" : "Sin cambios",
      ...resultado,
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    console.error("patchServicioExternal:", e);
    res.status(500).json({ error: "Error actualizando el servicio" });
  }
}
