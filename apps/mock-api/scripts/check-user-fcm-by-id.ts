#!/usr/bin/env npx tsx
/** Check UserFCMToken (and User) by userId. Usage: npx tsx scripts/check-user-fcm-by-id.ts <userId> */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: npx tsx scripts/check-user-fcm-by-id.ts <userId>');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, tenantId: true, fcmToken: true },
  });
  if (!user) {
    console.log('User not found:', userId);
    process.exit(1);
  }
  console.log('User:', JSON.stringify(user, null, 2));
  const tokens = await prisma.userFCMToken.findMany({
    where: { userId },
    select: { id: true, token: true, createdAt: true },
  });
  console.log('UserFCMToken rows:', tokens.length);
  tokens.forEach((t, i) => console.log(`  [${i}]`, t.token.slice(0, 40) + '...', t.createdAt));
  const hasAny = !!user.fcmToken || tokens.length > 0;
  console.log('Has any FCM token (User.fcmToken or UserFCMToken):', hasAny);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
