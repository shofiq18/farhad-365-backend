import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@farhad365.com";
  const adminPassword = "adminpassword123";

  // Check if admin already exists
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existing) {
    console.log(`Admin user with email ${adminEmail} already exists.`);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Create admin
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: "Admin Farhad",
      role: "ADMIN"
    }
  });

  console.log("Admin user seeded successfully!");
  console.log(`Email: ${admin.email}`);
  console.log(`Password: ${adminPassword}`);
  console.log(`Role: ${admin.role}`);
}

main()
  .catch((e) => {
    console.error("Error seeding admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
