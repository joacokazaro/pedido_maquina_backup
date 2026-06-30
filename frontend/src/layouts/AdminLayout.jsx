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
						isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-blue-50 hover:text-blue-800"
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
					active ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-blue-50 hover:text-blue-800"
				}`}
			>
				<span>{group.label}</span>
				<span className={`ml-2 inline-block text-xs transition ${isOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
			</button>

			<div className={`${isOpen ? "block" : "hidden"} absolute left-0 top-full z-50 mt-2 min-w-64 rounded-2xl border border-blue-100 bg-white p-2 shadow-xl`}>
				{group.items.map((item) => (
					<Link
						key={item.to}
						to={item.to}
						onClick={onClose}
						className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
							isActivePath(pathname, item.to)
								? "bg-blue-50 text-blue-800"
								: "text-slate-700 hover:bg-slate-50 hover:text-blue-800"
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
	const isCoordinador = rolUpper === "COORDINADOR";
	const isConsultor = rolUpper === "CONSULTOR";
	const isTaller = rolUpper === "TALLER";
	const isDeposito = rolUpper === "DEPOSITO";
	const navGroups = isTaller
		? NAV_GROUPS_TALLER
		: isDeposito
			? NAV_GROUPS_DEPOSITO
			: isConsultor
				? NAV_GROUPS_CONSULTOR
				: isCoordinador
					? NAV_GROUPS_COORDINADOR
					: NAV_GROUPS_ADMIN;
	const roleHomePath = isDeposito ? "/deposito" : "/admin";
	const roleLabel = getRoleLabel(rolUpper);

	useEffect(() => {
		const id = window.setTimeout(() => setOpenGroup(""), 0);
		return () => window.clearTimeout(id);
	}, [location.pathname]);

	return (
		<div className="min-h-screen bg-gray-100">
			<header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur">
				<div className="mx-auto flex min-h-20 max-w-[1600px] items-center justify-between gap-5 px-5">
					<div className="flex items-center gap-4">
						<button
							type="button"
							onClick={() => navigate(roleHomePath)}
							className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
							aria-label={`Ir al inicio de ${roleLabel.toLowerCase()}`}
							title={roleLabel}
						>
							{roleLabel}
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
							<p className="text-sm font-semibold text-slate-800">{user?.username || "admin"}</p>
							<p className="text-xs text-blue-700">{roleLabel}</p>
						</div>

						<button
							type="button"
							onClick={confirmLogout}
							className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
						>
							Salir
						</button>
					</div>
				</div>

				<div className="border-t border-slate-100 px-3 py-2 lg:hidden">
					<div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
						{navGroups.flatMap((group) => (group.to ? [{ label: group.label, to: group.to }] : group.items)).map((item) => (
							<Link
								key={item.to}
								to={item.to}
								className={`rounded-xl px-3 py-2 text-xs font-semibold ${
									isActivePath(location.pathname, item.to)
										? "bg-blue-600 text-white"
										: "bg-slate-100 text-slate-700"
								}`}
							>
								{item.label}
							</Link>
						))}
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-[1600px] px-0 py-0">{children}</main>
		</div>
	);
}
