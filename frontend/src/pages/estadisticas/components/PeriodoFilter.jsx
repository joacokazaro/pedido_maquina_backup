import { presetRange } from "../../../utils/date";

const PRESETS = [
  { kind: "7d", label: "7 días" },
  { kind: "30d", label: "30 días" },
  { kind: "90d", label: "90 días" },
  { kind: "mes-actual", label: "Mes actual" },
];

export default function PeriodoFilter({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.kind}
          type="button"
          onClick={() => onChange(presetRange(p.kind))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {p.label}
        </button>
      ))}

      <span className="mx-1 text-xs text-gray-400">o rango:</span>

      <input
        type="date"
        value={value.desde}
        max={value.hasta}
        onChange={(event) => onChange({ ...value, desde: event.target.value })}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      />
      <span className="text-xs text-gray-400">a</span>
      <input
        type="date"
        value={value.hasta}
        min={value.desde}
        onChange={(event) => onChange({ ...value, hasta: event.target.value })}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      />
    </div>
  );
}
