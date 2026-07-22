import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

const COLUMNAS = ["ID", "NOMBRE", "ID_BROWIX", "ACTIVO"];

export default function AdminServiciosImport() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  function downloadTemplate() {
    window.location.href = `${API_BASE}/admin/servicios/import/template`;
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError("");
  }

  async function handleImport() {
    if (!selectedFile) return;

    try {
      setImporting(true);
      setError("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(`${API_BASE}/admin/servicios/import`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detalles = Array.isArray(data.detalles) ? `: ${data.detalles.join(" | ")}` : "";
        throw new Error((data.error || "Error importando servicios") + detalles);
      }

      navigate("/admin/servicios");
    } catch (e) {
      console.error(e);
      setError(e.message || "Error importando servicios");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
      setSelectedFile(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-gray-900">Importar servicios desde Excel</h1>
          <p className="mt-2 text-sm text-gray-600">
            Usá una planilla con encabezados en la primera fila. El <b>ID</b> es obligatorio y debe corresponder a un
            servicio ya existente (los servicios no se crean desde acá). Una celda vacía o una columna que no incluiste
            significa "no cambiar ese dato", nunca lo vacía.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Descargar plantilla Excel
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={importing}
              className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:bg-amber-300"
            >
              Seleccionar archivo
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !selectedFile}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
            >
              {importing ? "Importando..." : "Comenzar importación"}
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            Archivo seleccionado: <b>{selectedFile?.name || "Ninguno"}</b>
          </p>
        </header>

        {error && (
          <div className="rounded-2xl bg-red-100 p-4 text-sm text-red-700 shadow">
            {error}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Columnas</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {COLUMNAS.map((column) => (
              <li key={column} className="rounded-lg bg-gray-50 px-3 py-2 font-medium">
                {column}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Reglas de carga</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p><b>ID:</b> obligatorio en cada fila; el servicio debe existir.</p>
            <p><b>NOMBRE:</b> opcional. Si se informa, no puede coincidir con el nombre de otro servicio.</p>
            <p><b>ID_BROWIX:</b> opcional, código de ubicación en Browix (ej. K12).</p>
            <p><b>ACTIVO:</b> opcional, usar <b>SI</b> o <b>NO</b>. No se puede dar de baja (NO) un servicio que tiene máquinas asignadas.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
