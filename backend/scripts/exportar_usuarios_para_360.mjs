// Genera el SQL para cargar en Kazaró 360 (identidad.accesos, proyecto app_maquinas) el rol de cada
// usuario ACTIVO de esta app, así nadie queda afuera cuando el login pase a depender de 360.
//
// Uso (contra una COPIA de la base de producción, solo lectura):
//   DATABASE_URL="file:/ruta/a/copia_pedido.db" node scripts/exportar_usuarios_para_360.mjs > accesos_360.sql
//
// El SQL sale por stdout; el resumen y los usuarios que NO se pueden migrar salen por stderr.
// Pegar el resultado en el SQL Editor de Supabase DESPUÉS de correr app_maquinas/roles_360.sql
// (repo de Kazaró 360). El último SELECT lista los mails que no existen como cuenta en 360.
import prisma from "../src/db/prisma.js";
import { ROLES_VALIDOS, ROLE_LABELS, rolesFromUser } from "../src/services/roles.service.js";

function rol360(roles) {
  if (roles.length === 2 && roles.includes("deposito") && roles.includes("taller")) return "Depósito y Taller";
  if (roles.length !== 1) return null;
  return roles[0] === "admin" ? "Administrador" : ROLE_LABELS[roles[0]];
}

const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

const usuarios = await prisma.usuario.findMany({
  where: { activo: true },
  select: { username: true, nombre: true, email: true, legajo: true, rol: true, roles: { select: { rol: true } } },
  orderBy: { username: "asc" },
});

// Censo de roles TAL CUAL están en la base (incluye strings viejos o inválidos que la app
// ya no reconoce: esos usuarios hoy no tienen rol utilizable y no pueden migrarse solos).
const censo = new Map();
for (const u of await prisma.usuario.findMany({ select: { rol: true, activo: true, roles: { select: { rol: true } } } })) {
  const crudos = new Set([u.rol, ...u.roles.map((r) => r.rol)].filter(Boolean));
  for (const r of crudos) {
    const c = censo.get(r) || { activos: 0, inactivos: 0 };
    c[u.activo ? "activos" : "inactivos"]++;
    censo.set(r, c);
  }
}

const filas = [];
const sinMail = [];
const sinRol = [];

for (const u of usuarios) {
  const rol = rol360(rolesFromUser(u));
  if (!rol) {
    sinRol.push(u);
    continue;
  }
  if (!u.email) {
    sinMail.push(u);
    continue;
  }
  filas.push({ mail: u.email.trim().toLowerCase(), rol });
}

if (filas.length === 0) {
  console.error("No hay usuarios activos con email y rol válido para migrar.");
  process.exit(1);
}

const valores = filas.map((f) => `  (${sqlStr(f.mail)}, ${sqlStr(f.rol)})`).join(",\n");

console.log(`-- Accesos de la app de máquinas -> Kazaró 360 (generado ${new Date().toISOString().slice(0, 10)})
-- Requiere haber corrido antes app_maquinas/roles_360.sql (catálogo de roles).
-- Solo AGREGA accesos: si una cuenta ya tiene acceso a app_maquinas en 360, no se toca.
with origen(mail, rol) as (
values
${valores}
)
insert into identidad.accesos (usuario_id, proyecto_id, rol)
select pf.id, 'app_maquinas', o.rol
from origen o
join identidad.perfiles pf on lower(pf.mail) = o.mail
on conflict (usuario_id, proyecto_id) do nothing;  -- no pisa accesos que ya existan

-- Mails de la app que NO tienen cuenta en 360 (hay que crearlas en el Panel Administrador):
with origen(mail, rol) as (
values
${valores}
)
select o.mail, o.rol
from origen o
left join identidad.perfiles pf on lower(pf.mail) = o.mail
where pf.id is null
order by o.mail;`);

console.error("Roles en la base (activos / inactivos):");
for (const [r, c] of [...censo].sort()) {
  const marca = ROLES_VALIDOS.includes(r) ? "" : "   <-- NO es un rol válido de la app";
  console.error(`  ${r.padEnd(22)} ${c.activos} / ${c.inactivos}${marca}`);
}
console.error("");
console.error(`Usuarios activos: ${usuarios.length}`);
console.error(`  Listos para migrar: ${filas.length}`);
if (sinMail.length) {
  console.error(`  SIN email cargado (${sinMail.length}) -> no entran por 360 hasta vincularlos:`);
  console.error("    (se vinculan solos por LEGAJO si su cuenta de 360 tiene el mismo legajo en identidad.perfiles;");
  console.error("     si no, cargarles el email en la app o el legajo en 360)");
  for (const u of sinMail) console.error(`    - ${u.username} (${u.nombre || "sin nombre"}) legajo=${u.legajo || "-"} rol=${rolesFromUser(u).join("+")}`);
}
if (sinRol.length) {
  console.error(`  Sin rol válido o con combinación no permitida (${sinRol.length}) -> definir su rol a mano:`);
  for (const u of sinRol) {
    console.error(`    - ${u.username} (${u.email || "sin email"}): rol="${u.rol}" roles=[${u.roles.map((r) => r.rol).join(", ")}]`);
  }
}

await prisma.$disconnect();
