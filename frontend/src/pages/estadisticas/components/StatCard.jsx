const TONE_CLASSES = {
  neutral: "text-gray-900",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  critical: "text-red-700",
  accent: "text-indigo-700",
};

// Mismo markup que las cards de AdminAmortizacionesPanel.jsx, parametrizado
// por tone porque esta página repite el patrón muchas más veces.
export default function StatCard({ label, value, tone = "neutral" }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow">
      <p className="text-gray-500">{label}</p>
      <p className={`text-base font-bold ${TONE_CLASSES[tone] || TONE_CLASSES.neutral}`}>{value}</p>
    </div>
  );
}
