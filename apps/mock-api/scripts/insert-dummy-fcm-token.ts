import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const USER_ID = 'bb20b202-8060-48e6-bb9f-dab5f7de84a1';
const DUMMY_TOKEN = 'dummy-fcm-token-for-testing-firebase-admin-' + Date.now();

async function main() {
  const user = await prisma.user.findUnique({ where: { id: USER_ID }, select: { id: true, email: true } });
  if (!user) {
    console.error('User not found:', USER_ID);
    process.exit(1);
  }
  await prisma.user.update({ where: { id: USER_ID }, data: { fcmToken: DUMMY_TOKEN } });
  await prisma.userFCMToken.upsert({
    where: { token: DUMMY_TOKEN },
    create: { userId: USER_ID, token: DUMMY_TOKEN },
    update: { userId: USER_ID },
  });
  console.log('Inserted dummy FCM token for', user.email, ':', DUMMY_TOKEN.slice(0, 40) + '...');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
