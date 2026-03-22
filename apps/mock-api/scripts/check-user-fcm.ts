import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'pizzaashrf@nmd.com';
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, tenantId: true, fcmToken: true },
  });
  if (!user) {
    console.log('User not found:', email);
    process.exit(1);
  }
  console.log('User:', JSON.stringify(user, null, 2));
  const tokens = await prisma.userFCMToken.findMany({
    where: { userId: user.id },
    select: { id: true, token: true, createdAt: true },
  });
  console.log('UserFCMToken rows:', tokens.length);
  tokens.forEach((t, i) => console.log(`  [${i}]`, t.token.slice(0, 30) + '...', t.createdAt));
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
