import bcrypt from 'bcryptjs';
import { prisma } from './config/database';

async function seedAdmin() {
  const email = 'admin@vatikart.com';
  const password = 'admin123';
  const firstName = 'System';
  const lastName = 'Admin';

  console.log(`Checking if admin user exists: ${email}...`);

  const existingUser = await prisma.user.findFirst({
    where: {
      emailId: email,
    },
  });

  if (existingUser) {
    console.log(`Admin user already exists! ID: ${existingUser.userId}`);
    return;
  }

  console.log('Hashing password...');
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('Inserting admin user into database...');
  const newUser = await prisma.user.create({
    data: {
      firstName,
      lastName,
      emailId: email,
      password: passwordHash,
      profilePicPath: '',
    },
  });

  console.log(`Admin user successfully seeded! ID: ${newUser.userId}`);
}

seedAdmin()
  .catch((err) => {
    console.error('Failed to seed admin user:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
