import { PrismaClient } from '@prisma/client';
import { installOrderPrismaProtection } from './order-protection.js';

/** Shared Prisma client with order deleteMany protection installed at startup. */
export const prisma = new PrismaClient();
installOrderPrismaProtection(prisma);
