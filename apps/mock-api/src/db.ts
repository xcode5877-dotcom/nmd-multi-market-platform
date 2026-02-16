import { PrismaClient } from '@prisma/client';

/** Prisma client for SQLite. Not yet connected to API routes - JSON storage remains active. */
export const prisma = new PrismaClient();
