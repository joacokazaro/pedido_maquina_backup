// src/db/prisma.js
import "dotenv/config";

import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL || "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

export default prisma;
