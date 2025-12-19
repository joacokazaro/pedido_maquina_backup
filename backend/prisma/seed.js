// prisma/seed.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

/* ===============================
   Helpers de path (ESM)
================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===============================
   Constantes
================================ */
const SERVICIO_FALLBACK = "SIN_ASIGNAR";

const ESTADOS_MAQUINA_VALIDOS = new Set([
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "reparacion",
  "baja",
]);

function normalizeEstadoMaquina(raw) {
  const v = String(raw || "").trim().toLowerCase();

  if (ESTADOS_MAQUINA_VALIDOS.has(v)) return v;

  const fixed = v.replaceAll(" ", "_");
  if (ESTADOS_MAQUINA_VALIDOS.has(fixed)) return fixed;

  return "disponible";
}

/* ===============================
   Seed principal
================================ */
async function main() {
  console.log("🌱 Seed iniciado...");

  /* ========= 1) Usuarios base ========= */
  const usuariosBase = [
    { username: "admin", rol: "admin" },
    { username: "deposito", rol: "deposito" },
  ];

  for (const u of usuariosBase) {
    await prisma.usuario.upsert({
      where: { username: u.username },
      update: { rol: u.rol },
      create: u,
    });
  }

  /* ========= 2) Leer JSON de máquinas ========= */
  const filePath = path.join(
    __dirname,
    "..",
    "data",
    "maqs_con_servicio_ok.json"
  );

  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  const maquinas = Array.isArray(parsed)
    ? parsed
    : parsed.maquinas || [];

  if (!Array.isArray(maquinas) || maquinas.length === 0) {
    throw new Error(
      "El archivo maqs_con_servicio_ok.json no contiene máquinas válidas"
    );
  }

  /* ========= 3) Servicios ========= */
  const serviciosDetectados = new Set(
    maquinas
      .map((m) =>
        String(m.servicio ?? m.servicioNombre ?? "").trim()
      )
      .filter(Boolean)
  );

  serviciosDetectados.add(SERVICIO_FALLBACK);

  console.log(`📌 Servicios detectados: ${serviciosDetectados.size}`);

  for (const nombre of serviciosDetectados) {
    await prisma.servicio.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  const serviciosDB = await prisma.servicio.findMany();
  const serviceMap = new Map(
    serviciosDB.map((s) => [s.nombre, s.id])
  );

  /* ========= 4) Máquinas ========= */
  let creadas = 0;
  let actualizadas = 0;
  let salteadas = 0;

  for (const m of maquinas) {
    const id = String(m.id ?? "").trim();
    const tipo = String(m.tipo ?? "").trim();
    const modelo = String(m.modelo ?? "").trim();
    const serie = m.serie ? String(m.serie).trim() : null;

    let servicioNombre = String(
      m.servicio ?? m.servicioNombre ?? ""
    ).trim();

    if (!servicioNombre) {
      servicioNombre = SERVICIO_FALLBACK;
    }

    const servicioId = serviceMap.get(servicioNombre);

    if (!id || !tipo || !modelo || !servicioId) {
      console.warn("⚠️ Máquina inválida (salteada):", {
        id,
        tipo,
        modelo,
        servicioNombre,
      });
      salteadas++;
      continue;
    }

    const estado = normalizeEstadoMaquina(m.estado);

    const existe = await prisma.maquina.findUnique({
      where: { id },
    });

    if (!existe) {
      await prisma.maquina.create({
        data: {
          id,
          tipo,
          modelo,
          serie,
          estado,
          servicioId,
        },
      });
      creadas++;
    } else {
      await prisma.maquina.update({
        where: { id },
        data: {
          tipo,
          modelo,
          serie,
          estado,
          servicioId,
        },
      });
      actualizadas++;
    }
  }

  /* ========= 5) Resumen ========= */
  console.log(`✅ Máquinas creadas: ${creadas}`);
  console.log(`🔁 Máquinas actualizadas: ${actualizadas}`);
  console.log(`⚠️ Máquinas salteadas: ${salteadas}`);
  console.log("🌱 Seed terminado OK");
}

/* ===============================
   Ejecución
================================ */
main()
  .catch((e) => {
    console.error("❌ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
