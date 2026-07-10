import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Notificaciones from "../components/Notificaciones";
import { useAuth } from "../context/AuthContext";

const NAV_GROUPS_ADMIN = [
	{
		label: "Inicio",
		to: "/admin",
	},
	{
		label: "Inventario",
		items: [
			{ label: "Máquinas", to: "/admin/maquinas" },
			{ label: "Vehículos", to: "/admin/vehiculos" },
		],
	},
	{
		label: "Operaciones",
		items: [
			{ label: "Taller", to: "/admin/taller" },
			{ label: "Pedidos", to: "/admin/pedidos" },
			{ label: "Eventuales", to: "/admin/eventuales" },
			{ label: "Historial de eventuales", to: "/admin/eventuales/historial" },
		],
	},
	{
		label: "Configuración",
		items: [
			{ label: "Usuarios", to: "/admin/usuarios" },
			{ label: "Servicios", to: "/admin/servicios" },
			{ label: "Supervisores x Servicios", to: "/admin/supervisores-servicios" },
			{ label: "Seguros", to: "/admin/seguros" },
		],
	},
];

const NAV_GROUPS_COORDINADOR = [
	{
		label: "Inicio",
		to: "/admin",
	},
	{
		label: "Inventario",
		items: [
			{ label: "Máquinas", to: "/admin/maquinas" },
			{ label: "Vehículos", to: "/admin/vehiculos" },
		],
	},
	{
		label: "Operaciones",
		items: [
			{ label: "Taller", to: "/admin/taller" },
			{ label: "Eventuales", to: "/admin/eventuales" },
			{ label: "Historial de eventuales", to: "/admin/eventuales/historial" },
		],
	},
];

const NAV_GROUPS_CONSULTOR = [
	{
		label: "Inicio",
		to: "/admin",
	},
	{
		label: "Inventario",
		items: [
			{ label: "Máquinas", to: "/admin/maquinas" },
			{ label: "Vehículos", to: "/admin/vehiculos" },
		],
	},
	{
		label: "Operaciones",
		items: [
			{ label: "Taller", to: "/admin/taller" },
			{ label: "Eventuales", to: "/admin/eventuales" },
		],
	},
	{
		label: "Configuración",
		items: [
			{ label: "Servicios", to: "/admin/servicios" },
			{ label: "Supervisores x Servicios", to: "/admin/supervisores-servicios" },
		],
	},
];

const NAV_GROUPS_TALLER = [
	{
		label: "Inicio",
		to: "/admin",
	},
	{
		label: "Inventario",
		items: [
			{ label: "Maquinas", to: "/admin/maquinas" },
			{ label: "Vehiculos", to: "/admin/vehiculos" },
		],
	},
	{
		label: "Operaciones",
		items: [
			{ label: "Taller", to: "/admin/taller" },
		],
	},
];

const NAV_GROUPS_DEPOSITO = [
	{
		label: "Inicio",
		to: "/deposito",
	},
	{
		label: "Inventario",
		items: [
			{ label: "Máquinas", to: "/deposito/maquinas" },
		],
	},
	{
		label: "Operaciones",
		items: [
			{ label: "Pedidos a gestionar", to: "/deposito/pedidos" },
		],
	},
	{
		label: "Configuración",
		items: [
			{ label: "Máquinas en Servicio", to: "/deposito/servicios" },
			{ label: "Máquinas por Supervisor", to: "/deposito/supervisores" },
		],
	},
];

const NAV_GROUPS_DEPOSITO_TALLER = [
	{
		label: "Inicio",
		items: [
			{ label: "Panel Depósito", to: "/deposito" },
			{ label: "Panel Taller", to: "/admin" },
		],
	},
	{
		label: "Inventario",
		items: [
			{ label: "Máquinas (Depósito)", to: "/deposito/maquinas" },
			{ label: "Máquinas (Taller)", to: "/admin/maquinas" },
			{ label: "Vehículos (Taller)", to: "/admin/vehiculos" },
		],
	},
	{
		label: "Operaciones",
		items: [
			{ label: "Pedidos a gestionar", to: "/deposito/pedidos" },
			{ label: "Taller", to: "/admin/taller" },
		],
	},
	{
		label: "Configuración",
		items: [
			{ label: "Máquinas en Servicio", to: "/deposito/servicios" },
			{ label: "Máquinas por Supervisor", to: "/deposito/supervisores" },
		],
	},
];

const ADMIN_BG_BEAMS = [
	{ top: "14%", width: 380, thickness: 2, duration: 11, delay: 0, core: "rgba(17, 114, 193, 0.45)", glow: "rgba(74, 164, 224, 0.3)", opacity: 0.55 },
	{ top: "38%", width: 260, thickness: 2, duration: 13, delay: 4.5, core: "rgba(43, 175, 198, 0.4)", glow: "rgba(43, 175, 198, 0.25)", opacity: 0.5 },
	{ top: "60%", width: 420, thickness: 2, duration: 12, delay: 8, core: "rgba(17, 114, 193, 0.4)", glow: "rgba(74, 164, 224, 0.25)", opacity: 0.5 },
	{ top: "82%", width: 300, thickness: 2, duration: 14, delay: 2.5, core: "rgba(101, 188, 123, 0.35)", glow: "rgba(101, 188, 123, 0.2)", opacity: 0.45 },
];

function isActivePath(pathname, to) {
	return pathname === to || pathname.startsWith(`${to}/`);
}

function getRoleLabel(rolUpper) {
	if (rolUpper === "TALLER") return "Taller";
	if (rolUpper === "CONSULTOR") return "Consultoría";
	if (rolUpper === "COORDINADOR") return "Coordinación";
	if (rolUpper === "DEPOSITO") return "Depósito";
	return "Administración";
}

function hasRole(user, role) {
	const target = String(role || "").toUpperCase();
	const roles = Array.isArray(user?.roles)
		? user.roles.map((r) => String(r || "").toUpperCase())
		: [];
	return roles.includes(target) || String(user?.rol || "").toUpperCase() === target;
}

function NavGroup({ group, pathname, isOpen, onToggle, onClose }) {
	const panelRef = useRef(null);

	useEffect(() => {
		if (!isOpen) return undefined;

		function handlePointerDown(event) {
			if (!panelRef.current?.contains(event.target)) {
				onClose();
			}
		}

		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [isOpen, onClose]);

	if (group.to) {
		return (
			<NavLink
				to={group.to}
				className={({ isActive }) =>
					`rounded-xl px-4 py-3 text-sm font-semibold transition ${
						isActive
							? "bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white shadow-sm"
							: "text-slate-200 hover:bg-white/10 hover:text-white"
					}`
				}
			>
				{group.label}
			</NavLink>
		);
	}

	const active = group.items.some((item) => isActivePath(pathname, item.to));

	return (
		<div className="relative" ref={panelRef}>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={isOpen}
				aria-haspopup="menu"
				className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
					active
						? "bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white shadow-sm"
						: "text-slate-200 hover:bg-white/10 hover:text-white"
				}`}
			>
				<span>{group.label}</span>
				<span className={`ml-2 inline-block text-xs transition ${isOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
			</button>

			<div className={`${isOpen ? "block" : "hidden"} absolute left-0 top-full z-50 mt-2 min-w-64 rounded-2xl border border-kazaro-ice bg-white p-2 shadow-2xl shadow-kazaro-navy/20`}>
				{group.items.map((item) => (
					<Link
						key={item.to}
						to={item.to}
						onClick={onClose}
						className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
							isActivePath(pathname, item.to)
								? "bg-kazaro-ice text-kazaro-deep"
								: "text-slate-700 hover:bg-kazaro-mist hover:text-kazaro-deep"
						}`}
					>
						{item.label}
					</Link>
				))}
			</div>
		</div>
	);
}

export default function AdminLayout({ children }) {
	const { user, confirmLogout } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const [openGroup, setOpenGroup] = useState("");
	const rolUpper = String(user?.rol || "").toUpperCase();
	const isCoordinador = hasRole(user, "COORDINADOR");
	const isConsultor = hasRole(user, "CONSULTOR");
	const isTaller = hasRole(user, "TALLER");
	const isDeposito = hasRole(user, "DEPOSITO");
	const isDepositoTaller = isDeposito && isTaller;
	const inDepositoPath = location.pathname.startsWith("/deposito");
	const navGroups = isDepositoTaller
		? NAV_GROUPS_DEPOSITO_TALLER
		: inDepositoPath && isDeposito
		? NAV_GROUPS_DEPOSITO
		: isTaller
		? NAV_GROUPS_TALLER
		: isDeposito
			? NAV_GROUPS_DEPOSITO
			: isConsultor
				? NAV_GROUPS_CONSULTOR
				: isCoordinador
					? NAV_GROUPS_COORDINADOR
					: NAV_GROUPS_ADMIN;
	const roleHomePath = isDepositoTaller
		? inDepositoPath
			? "/deposito"
			: "/admin"
		: isDeposito
			? "/deposito"
			: "/admin";
	const roleLabel = isDepositoTaller
		? "Depósito + Taller"
		: isDeposito
		? getRoleLabel("DEPOSITO")
		: isTaller
			? getRoleLabel("TALLER")
			: isConsultor
				? getRoleLabel("CONSULTOR")
				: isCoordinador
					? getRoleLabel("COORDINADOR")
					: getRoleLabel(rolUpper);

	useEffect(() => {
		const id = window.setTimeout(() => setOpenGroup(""), 0);
		return () => window.clearTimeout(id);
	}, [location.pathname]);

	return (
		<div className="relative min-h-screen bg-kazaro-mist font-sans">
			<div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
				<div className="absolute inset-0 bg-gradient-to-br from-[#f4f9fd] via-[#edf5fb] to-[#e4f0f6]" />

				<div className="kz-blob-a absolute -left-44 -top-44 h-[540px] w-[540px] rounded-full bg-[#4aa4e0]/20 blur-3xl" />
				<div className="kz-blob-b absolute -right-52 top-1/3 h-[580px] w-[580px] rounded-full bg-[#2bafc6]/15 blur-3xl" />
				<div className="kz-blob-c absolute -bottom-56 left-1/3 h-[540px] w-[540px] rounded-full bg-[#65bc7b]/15 blur-3xl" />

				<div className="absolute inset-[-25%] -rotate-[24deg]">
					{ADMIN_BG_BEAMS.map((beam, i) => (
						<span
							key={i}
							className="kz-beam"
							style={{
								top: beam.top,
								left: 0,
								width: `${beam.width}px`,
								height: `${beam.thickness}px`,
								background: `linear-gradient(90deg, transparent, ${beam.core}, transparent)`,
								boxShadow: `0 0 12px 1px ${beam.glow}`,
								animationDuration: `${beam.duration}s`,
								animationDelay: `${beam.delay}s`,
								"--kz-beam-opacity": beam.opacity,
							}}
						/>
					))}
				</div>
			</div>

			<header className="sticky top-0 z-40 border-b border-white/10 bg-kazaro-navy/95 shadow-lg shadow-kazaro-navy/25 backdrop-blur">
				<div className="mx-auto flex min-h-20 max-w-[1600px] items-center justify-between gap-5 px-5">
					<div className="flex items-center gap-4">
						<button
							type="button"
							onClick={() => navigate(roleHomePath)}
							className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/10"
							aria-label={`Ir al inicio de ${roleLabel.toLowerCase()}`}
							title={roleLabel}
						>
							<img
								src="/LogoHorizFull.png"
								alt="Kazaró"
								className="h-9 w-auto brightness-0 invert"
							/>
							<span className="hidden rounded-full border border-kazaro-aqua/40 bg-kazaro-aqua/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-kazaro-aqua xl:inline-block">
								{roleLabel}
							</span>
						</button>

						<nav className="hidden items-center gap-1 lg:flex">
							{navGroups.map((group) => (
								<NavGroup
									key={group.label}
									group={group}
									pathname={location.pathname}
									isOpen={openGroup === group.label}
									onToggle={() => setOpenGroup((current) => (current === group.label ? "" : group.label))}
									onClose={() => setOpenGroup("")}
								/>
							))}
						</nav>
					</div>

					<div className="flex items-center gap-3">
						<Notificaciones embedded />

						<div className="hidden text-right md:block">
							<p className="text-sm font-semibold text-white">{user?.username || "admin"}</p>
							<p className="text-xs font-medium text-kazaro-aqua">{roleLabel}</p>
						</div>

						<button
							type="button"
							onClick={confirmLogout}
							className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
						>
							Salir
						</button>
					</div>
				</div>

				<div className="border-t border-white/10 px-3 py-2 lg:hidden">
					<div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
						{navGroups.flatMap((group) => (group.to ? [{ label: group.label, to: group.to }] : group.items)).map((item) => (
							<Link
								key={item.to}
								to={item.to}
								className={`rounded-xl px-3 py-2 text-xs font-semibold ${
									isActivePath(location.pathname, item.to)
										? "bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white"
										: "bg-white/10 text-slate-200"
								}`}
							>
								{item.label}
							</Link>
						))}
					</div>
				</div>
			</header>

			<main className="relative z-10 mx-auto max-w-[1600px] px-0 py-0 [&>*]:!bg-transparent">{children}</main>
		</div>
	);
}
