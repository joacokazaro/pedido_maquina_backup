import { useCallback, useEffect, useState } from "react";
import BotonVolver from "../../components/BotonVolver";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../services/apiBase";
import { buildActorHeaders } from "../../utils/authHeaders";
import Carrusel from "./components/Carrusel";
import SlideGenerales from "./components/SlideGenerales";
import SlideRendimiento from "./components/SlideRendimiento";
import SlideDotacion from "./components/SlideDotacion";
import SlideCuadrillas from "./components/SlideCuadrillas";
import SlideEstacionalidad from "./components/SlideEstacionalidad";
import SlideParqueEquipos from "./components/SlideParqueEquipos";

const FUENTE_TRABAJOS = "Campo trabajosRealizados del eventual, cargado al cerrarlo.";

export default function AdminKpiEspaciosVerdes() {
  const { user } = useAuth();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/eventuales/kpis/espacios-verdes`, {
        headers: buildActorHeaders(user),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error obteniendo los KPIs");
      setDatos(data);
    } catch (e) {
      setError(e.message || "Error obteniendo los KPIs");
    } finally {
      setCargando(false);
    }
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10">
        <BotonVolver>Volver al panel</BotonVolver>
        <div className="mx-auto max-w-[1600px] animate-pulse space-y-4">
          <div className="h-32 rounded-3xl bg-white/80" />
          <div className="h-96 rounded-3xl bg-white/80" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10">
        <BotonVolver>Volver al panel</BotonVolver>
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-display text-lg font-bold text-red-800">No se pudieron cargar los indicadores</p>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={cargar}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { alcance, generales, rendimientos, dotacion, cuadrillas, estacionalidad, parqueEquipos } = datos;

  const slides = [
    {
      clave: "generales",
      titulo: "Generales",
      resumen:
        "Cuánto se produjo, con cuánta mano de obra y de qué calificación. Es la foto de la operación de Espacios Verdes sobre los eventuales ya cerrados.",
      contenido: <SlideGenerales alcance={alcance} generales={generales} />,
    },
    {
      clave: "desmalezado",
      titulo: "Desmalezado",
      resumen:
        "Cuántos metros cuadrados se desmalezan, en promedio, en un eventual que hace este trabajo.",
      contenido: (
        <SlideRendimiento
          bloque={rendimientos.desmalezado}
          formula="m² desmalezados totales ÷ eventuales con desmalezado"
          notas={[
            "Solo cuentan los eventuales finalizados que registraron el trabajo; los que no lo hicieron no entran en el promedio. Solo entran los trabajos de desmalezado cargados en m². Si alguno se cargó en otra unidad (por ejemplo en horas) queda afuera: no es una superficie mal etiquetada sino otra magnitud, y no hay forma de convertirla.",
          ]}
          fuente={FUENTE_TRABAJOS}
        />
      ),
    },
    {
      clave: "retiroPoda",
      titulo: "Retiro de poda",
      resumen:
        "Cuánto volumen de ramas se retira, en promedio, en un eventual que hace este trabajo. Se mide en metros cúbicos.",
      contenido: (
        <SlideRendimiento
          bloque={rendimientos.retiroPoda}
          formula="m³ retirados totales ÷ eventuales con retiro de poda"
          notas={[
            "Solo entran los retiros de poda cargados en m³, que es la unidad que corresponde al trabajo.",
          ]}
          fuente={FUENTE_TRABAJOS}
        />
      ),
    },
    {
      clave: "combustible",
      titulo: "Combustible",
      resumen:
        "Cuántos litros de combustible se consumen, en promedio, en un eventual que lo registra.",
      contenido: (
        <SlideRendimiento
          bloque={rendimientos.combustible}
          formula="Litros de combustible totales ÷ eventuales con combustible cargado"
          notas={[
            "Cuenta nafta preparada, nafta pura, gasoil premium y gasoil común cargados en litros. El aceite de cadena queda afuera porque se mide en cc y no es combustible.",
            "Son los litros que el supervisor cargó a mano en el eventual, no los que se importan de la plataforma de insumos.",
          ]}
          fuente="Campo insumosExtras del eventual."
        />
      ),
    },
    {
      clave: "dotacion",
      titulo: "Dotación",
      resumen:
        "Cuánta gente hubo por día y cuánto duró cada trabajo. Permite dimensionar la cuadrilla del próximo eventual sin adivinar.",
      contenido: <SlideDotacion dotacion={dotacion} />,
    },
    {
      clave: "cuadrillas",
      titulo: "Cuadrillas",
      resumen:
        "Cuántas personas participan en un eventual y cuánta gente se puso según el tamaño del trabajo. Sirve para dimensionar la cuadrilla del próximo.",
      contenido: <SlideCuadrillas cuadrillas={cuadrillas} />,
    },
    {
      clave: "estacionalidad",
      titulo: "Estacionalidad",
      resumen:
        "Cuántos eventuales, personas y horas hubo en cada mes. Sirve para anticipar cuándo hace falta más gente.",
      contenido: <SlideEstacionalidad estacionalidad={estacionalidad} />,
    },
    {
      clave: "parqueEquipos",
      titulo: "Parque de equipos",
      resumen:
        "Qué maquinaria sostiene realmente la operación y en qué cantidades. Orienta dónde invertir y qué reponer.",
      contenido: <SlideParqueEquipos parqueEquipos={parqueEquipos} />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <BotonVolver>Volver al panel</BotonVolver>

      <header className="mx-auto mb-7 max-w-[1600px] overflow-hidden rounded-3xl bg-gradient-to-br from-kazaro-navy via-kazaro-deep to-[#0a4a63] px-6 py-8 text-white shadow-xl sm:px-10 sm:py-11">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-kazaro-green">
          Servicios eventuales · Espacios Verdes
        </p>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-5xl">
          Indicadores de gestión
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">
          Producción y productividad de los eventuales de Espacios Verdes, sobre los datos que ya se
          cargan al cerrar cada trabajo. Todavía no hay indicadores de costo: falta la tarifa por
          categoría y el monto facturado.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/15 bg-white/15 sm:grid-cols-4">
          {[
            { valor: alcance.total, etiqueta: "Eventuales de EV" },
            { valor: alcance.finalizados, etiqueta: "Cerrados" },
            { valor: alcance.enCurso, etiqueta: "En curso" },
            { valor: alcance.conHoras, etiqueta: "Con horas importadas" },
          ].map((s) => (
            <div key={s.etiqueta} className="bg-kazaro-navy/60 px-4 py-4">
              <p className="font-display text-3xl font-extrabold tabular-nums">{s.valor}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                {s.etiqueta}
              </p>
            </div>
          ))}
        </div>
      </header>

      <Carrusel slides={slides} />

      <p className="mx-auto mt-8 max-w-[1600px] text-center text-xs text-slate-400">
        Calculado sobre {alcance.finalizados} eventual(es) finalizado(s) de {alcance.total} de Espacios
        Verdes.
      </p>
    </div>
  );
}
