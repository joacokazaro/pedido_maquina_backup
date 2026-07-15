// Marca visual para pedidos originados desde un eventual (pedido complementario)
export default function EventualBadge({ className = "" }) {
  return (
    <span
      title="Pedido originado desde un eventual"
      className={`inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold leading-none text-white shadow-sm ${className}`}
    >
      E
    </span>
  );
}
