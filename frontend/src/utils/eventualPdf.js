import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function safeText(value, fallback = "No informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return "No informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No informado";
  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "No informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No informado";
  return date.toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function drawSectionTitle(doc, text, y) {
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(12, y, 186, 8, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(text, 14, y + 5.4);
}

function buildMaquinariaRows(eventual) {
  const maquinas = Array.isArray(eventual?.componentesActuales?.maquinasUtilizadas)
    ? eventual.componentesActuales.maquinasUtilizadas
    : [];

  const vehiculos = Array.isArray(eventual?.componentesActuales?.vehiculos)
    ? eventual.componentesActuales.vehiculos
    : [];

  const rows = [];

  for (const maquina of maquinas) {
    const ids = Array.isArray(maquina?.maquinaIds) ? maquina.maquinaIds : [];
    rows.push([
      `MAQUINA · ${safeText(maquina?.tipo)}`,
      `Cantidad: ${safeText(maquina?.cantidad, "0")}${ids.length > 0 ? ` (${ids.join(", ")})` : ""}`,
    ]);
  }

  const maquinasDePedidos = Array.isArray(eventual?.maquinasDePedidos) ? eventual.maquinasDePedidos : [];
  for (const maquina of maquinasDePedidos) {
    const ids = Array.isArray(maquina?.maquinaIds) ? maquina.maquinaIds : [];
    rows.push([
      `MAQUINA (PEDIDO COMPL.) · ${safeText(maquina?.tipo)}`,
      `Cantidad: ${safeText(maquina?.cantidad, "0")}${ids.length > 0 ? ` (${ids.join(", ")})` : ""}`,
    ]);
  }

  for (const vehiculo of vehiculos) {
    rows.push([
      `VEHICULO · ${safeText(vehiculo?.vehiculo)}`,
      `ID ${safeText(vehiculo?.id)} · ${safeText(vehiculo?.modelo, "Sin modelo")} · ${safeText(vehiculo?.patente, "Sin patente")}`,
    ]);
  }

  return rows;
}

function buildTrabajosRows(eventual) {
  const trabajos = Array.isArray(eventual?.trabajosRealizados) ? eventual.trabajosRealizados : [];

  const rows = [];

  for (const trabajo of trabajos) {
    rows.push([
      safeText(trabajo?.label || trabajo?.tipo),
      String(trabajo?.cantidad ?? "-"),
      safeText(trabajo?.unidadLabel || trabajo?.unidadMedida, "-"),
    ]);
  }

  return rows;
}

function buildServiciosExtrasRows(eventual) {
  const serviciosExtras = Array.isArray(eventual?.serviciosExtrasSubcontratados)
    ? eventual.serviciosExtrasSubcontratados
    : [];

  const rows = [];

  for (const servicio of serviciosExtras) {
    rows.push([
      safeText(servicio?.descripcion),
      String(servicio?.cantidad ?? "-"),
      safeText(servicio?.unidadLabel || servicio?.unidadMedida, "-"),
      servicio?.precio !== null && servicio?.precio !== undefined && servicio?.precio !== ""
        ? `$ ${Number(servicio.precio).toLocaleString("es-AR")}`
        : "-",
    ]);
  }

  return rows;
}

function formatActionLabel(action) {
  const labels = {
    EVENTUAL_CREADO: "Eventual creado",
    EVENTUAL_CORREGIDO: "Datos del eventual completados",
    EVENTUAL_BAJA_LOGICA: "Eventual eliminado",
    SUPERVISOR_OBSERVACION: "Observacion del supervisor",
    SUPERVISOR_FINALIZO_EVENTUAL: "Supervisor finalizo eventual",
    ADMIN_OBSERVACION_POSTERIOR: "Observacion posterior del admin",
    COORDINADOR_OBSERVACION_POSTERIOR: "Observacion posterior del coordinador",
    PEDIDO_COMPLEMENTARIO_CREADO: "Pedido complementario creado",
  };
  const normalized = String(action || "").trim();
  return labels[normalized] || normalized.replaceAll("_", " ");
}

function extractObservationRows(eventual) {
  const historial = Array.isArray(eventual?.historial) ? eventual.historial : [];
  const rows = [];

  for (const entry of historial) {
    const detalle = typeof entry?.detalle === "string"
      ? (() => {
          try {
            return JSON.parse(entry.detalle);
          } catch {
            return {};
          }
        })()
      : (entry?.detalle || {});

    const autor = safeText(entry?.usuario?.nombre || entry?.usuario?.username, "-");
    const etapa = formatActionLabel(entry?.accion);
    const fecha = formatDateTime(entry?.fecha);

    if (entry?.accion === "EVENTUAL_CREADO") {
      const mensaje = String(detalle?.inicial?.observacionesPrevias || detalle?.inicial?.observaciones || "").trim();
      if (mensaje) rows.push(["PREVIA", etapa, autor, fecha, mensaje]);
      continue;
    }

    if (entry?.accion === "EVENTUAL_CORREGIDO") {
      const anterior = String(detalle?.anterior?.observacionesPrevias || detalle?.anterior?.observaciones || "").trim();
      const actual = String(detalle?.actual?.observacionesPrevias || detalle?.actual?.observaciones || "").trim();
      if (actual && actual !== anterior) rows.push(["PREVIA", etapa, autor, fecha, actual]);
      continue;
    }

    if (entry?.accion === "SUPERVISOR_OBSERVACION" && detalle?.observacion) {
      rows.push(["POSTERIOR", etapa, autor, fecha, String(detalle.observacion).trim()]);
      continue;
    }

    if (entry?.accion === "ADMIN_OBSERVACION_POSTERIOR" && detalle?.observacion) {
      rows.push(["POSTERIOR", etapa, autor, fecha, String(detalle.observacion).trim()]);
      continue;
    }

    if (entry?.accion === "COORDINADOR_OBSERVACION_POSTERIOR" && detalle?.observacion) {
      rows.push(["POSTERIOR", etapa, autor, fecha, String(detalle.observacion).trim()]);
    }
  }

  return rows;
}

export function downloadEventualResumenPdf(eventual) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text("RESUMEN DE SERVICIO EVENTUAL", 105, 16, { align: "center" });

  const generatedAt = formatDateTime(new Date());

  let cursorY = 24;

  drawSectionTitle(doc, "1. DATOS DEL EVENTO", cursorY);
  cursorY += 10;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: 12, right: 12 },
    tableWidth: 186,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [31, 41, 55] },
    body: [
      ["Nombre del eventual", safeText(eventual?.nombre)],
      ["Periodo", `${formatDate(eventual?.fechaInicio)} al ${formatDate(eventual?.fechaFin)}`],
      ["Supervisor responsable", safeText(eventual?.supervisor?.nombre || eventual?.supervisor?.username, "Sin asignar")],
      ["Observaciones generales", safeText(eventual?.observaciones)],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [31, 41, 55] },
      1: { cellWidth: 131 },
    },
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8;
  drawSectionTitle(doc, "2. MAQUINARIA UTILIZADA", cursorY);
  cursorY += 10;

  const maquinariaRows = buildMaquinariaRows(eventual);
  if (!maquinariaRows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);
    doc.text("No se registran maquinarias o vehiculos utilizados.", 14, cursorY);
    cursorY += 8;
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: 12, right: 12 },
      tableWidth: 186,
      styles: { font: "helvetica", fontSize: 8.7, cellPadding: 1.8 },
      headStyles: { fillColor: [240, 240, 240], textColor: [31, 41, 55] },
      head: [["Tipo de componente", "Descripcion"]],
      body: maquinariaRows,
      columnStyles: {
        0: { cellWidth: 84, fontStyle: "bold" },
        1: { cellWidth: 102 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8;
  }

  drawSectionTitle(doc, "3. TRABAJOS REALIZADOS", cursorY);
  cursorY += 10;

  const trabajosRows = buildTrabajosRows(eventual);
  if (!trabajosRows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);
    doc.text("No se registran trabajos realizados.", 14, cursorY);
    cursorY += 8;
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: 12, right: 12 },
      tableWidth: 186,
      styles: { font: "helvetica", fontSize: 8.7, cellPadding: 1.8 },
      headStyles: { fillColor: [240, 240, 240], textColor: [31, 41, 55] },
      head: [["Trabajo / servicio", "Cantidad", "Unidad"]],
      body: trabajosRows,
      columnStyles: {
        0: { cellWidth: 138, fontStyle: "bold" },
        1: { cellWidth: 20, halign: "right" },
        2: { cellWidth: 28 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8;
  }

  drawSectionTitle(doc, "4. SERVICIOS EXTRAS SUBCONTRATADOS", cursorY);
  cursorY += 10;

  const serviciosExtrasRows = buildServiciosExtrasRows(eventual);
  if (!serviciosExtrasRows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);
    doc.text("No se registran servicios extras subcontratados.", 14, cursorY);
    cursorY += 8;
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: 12, right: 12 },
      tableWidth: 186,
      styles: { font: "helvetica", fontSize: 8.7, cellPadding: 1.8 },
      headStyles: { fillColor: [240, 240, 240], textColor: [31, 41, 55] },
      head: [["Servicio extra", "Cantidad", "Unidad", "Precio (ARS)"]],
      body: serviciosExtrasRows,
      columnStyles: {
        0: { cellWidth: 106, fontStyle: "bold" },
        1: { cellWidth: 20, halign: "right" },
        2: { cellWidth: 28 },
        3: { cellWidth: 32, halign: "right" },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8;
  }

  drawSectionTitle(doc, "5. OBSERVACIONES REGISTRADAS", cursorY);
  cursorY += 10;

  const observationsRows = extractObservationRows(eventual);
  if (!observationsRows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);
    doc.text("No se registran observaciones.", 14, cursorY);
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: 12, right: 12 },
      tableWidth: 186,
      styles: { font: "helvetica", fontSize: 8.2, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: [240, 240, 240], textColor: [31, 41, 55] },
      head: [["Tipo", "Etapa", "Autor", "Fecha", "Observacion"]],
      body: observationsRows,
      columnStyles: {
        0: { cellWidth: 24, fontStyle: "bold" },
        1: { cellWidth: 40 },
        2: { cellWidth: 22 },
        3: { cellWidth: 26 },
        4: { cellWidth: 74 },
      },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Referencia eventual: #${safeText(eventual?.id, "-")}`, 12, 288);
    doc.text(`Fecha de generacion: ${generatedAt}`, 12, 292);
    doc.text(`Pagina ${page} de ${pageCount}`, 198, 292, { align: "right" });
  }

  const fileSuffix = slugify(eventual?.nombre) || safeText(eventual?.id, "eventual");
  doc.save(`resumen-eventual-${fileSuffix}.pdf`);
}
