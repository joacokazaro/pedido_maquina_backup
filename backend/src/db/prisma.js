// src/db/prisma.js
import pkg from "@prisma/client";

const {
  PrismaClient,
  EstadoMaquina,
  EstadoPedido,
  RolUsuario
} = pkg;

const prisma = new PrismaClient();

export {
  prisma,
  PrismaClient,
  EstadoMaquina,
  EstadoPedido,
  RolUsuario
};

export default prisma;
