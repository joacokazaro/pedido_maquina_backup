import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import FondoKazaro from "../components/FondoKazaro";
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
			{ label: "Máquinas (todas)", to: "/admin/maquinas" },
			{ label: "Vehículos (todos)", to: "/admin/vehiculos" },
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
					`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
						isActive
							? "bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white shadow-md shadow-kazaro-cyan/25"
							: "text-slate-300 hover:bg-white/10 hover:text-white"
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
				className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
					active
						? "bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white shadow-md shadow-kazaro-cyan/25"
						: "text-slate-300 hover:bg-white/10 hover:text-white"
				}`}
			>
				<span>{group.label}</span>
				<span className={`ml-2 inline-block text-xs opacity-70 transition ${isOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
			</button>

			<div className={`${isOpen ? "block kz-pop" : "hidden"} absolute left-0 top-full z-50 mt-3 min-w-64 overflow-hidden rounded-2xl border border-kazaro-ice bg-white shadow-2xl shadow-kazaro-navy/25`}>
				<div className="h-1 bg-gradient-to-r from-kazaro-blue via-kazaro-cyan to-kazaro-green" />
				<div className="p-2">
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
			<FondoKazaro className="z-0" />

			<header className="sticky top-0 z-40 bg-gradient-to-r from-[#0a2150] via-kazaro-navy to-[#081733] shadow-lg shadow-kazaro-navy/30">
				<div className="mx-auto flex min-h-20 max-w-[1600px] items-center justify-between gap-5 px-5">
					<div className="flex items-center gap-4">
						<button
							type="button"
							onClick={() => navigate(roleHomePath)}
							className="rounded-xl px-2.5 py-2 transition hover:bg-white/10"
							aria-label={`Ir al inicio de ${roleLabel.toLowerCase()}`}
							title="Ir al inicio"
						>
							<img
								src="/LogoHorizFull.png"
								alt="Kazaró"
								className="h-10 w-auto brightness-0 invert"
							/>
						</button>

						<nav className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1.5 lg:flex">
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

						<div className="hidden items-center gap-3 border-l border-white/10 pl-4 md:flex">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-kazaro-blue to-kazaro-cyan text-sm font-bold uppercase text-white shadow-md shadow-kazaro-cyan/20">
								{String(user?.username || "A").charAt(0)}
							</div>
							<div className="text-left">
								<p className="text-sm font-semibold leading-tight text-white">{user?.username || "admin"}</p>
								<p className="text-xs font-medium leading-tight text-kazaro-aqua">{roleLabel}</p>
							</div>
						</div>

						<button
							type="button"
							onClick={confirmLogout}
							className="group flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/15 hover:text-white"
						>
							<svg className="h-4 w-4 transition group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" />
							</svg>
							Salir
						</button>
					</div>
				</div>

				<div className="h-0.5 bg-gradient-to-r from-kazaro-blue via-kazaro-cyan to-kazaro-green opacity-80" />

				<div className="px-3 py-2 lg:hidden">
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
