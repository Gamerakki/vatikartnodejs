const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No users found");
    return;
  }
  
  const payload = {
    Authorized: true,
    user_id: Number(user.userId),
    first_name: user.firstName,
    last_name: user.lastName,
    username: user.username,
  };
  
  const token = jwt.sign(payload, 'changeme_super_secret_key', {
    algorithm: 'HS256',
    expiresIn: '24h',
  });
  
  console.log("TOKEN=" + token);
}

main().catch(console.error).finally(() => prisma.$disconnect());
