import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const superAdmin = await prisma.user.findUnique({
    where: { login_id: "superadmin" },
    select: { id: true },
  });
  if (!superAdmin) {
    await prisma.user.create({
      data: {
        login_id: "superadmin",
        password_hash: passwordHash,
        name: "Super Admin",
        role: Role.SUPER_ADMIN,
        is_active: true,
      },
    });
  }

  const admin = await prisma.user.findUnique({
    where: { login_id: "admin01" },
    select: { id: true },
  });
  if (!admin) {
    await prisma.user.create({
      data: {
        login_id: "admin01",
        password_hash: passwordHash,
        name: "Admin One",
        role: Role.ADMIN,
        is_active: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
