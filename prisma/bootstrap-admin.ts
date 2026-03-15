import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("ChangeMe123!", 12);
  const testPasswordHash = await bcrypt.hash("Test1234!", 12);

  const mongoliaCountry = await prisma.country.upsert({
    where: { country_code: "MN" },
    update: {
      country_name: "Mongolia",
      is_active: true,
    },
    create: {
      country_code: "MN",
      country_name: "Mongolia",
      is_active: true,
    },
    select: { id: true },
  });

  const defaultCountry =
    (await prisma.country.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    })) ??
    (await prisma.country.create({
      data: {
        country_code: "MN",
        country_name: "Mongolia",
        is_active: true,
      },
      select: { id: true },
    }));

  const defaultSupplier =
    (await prisma.supplier.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    })) ??
    (await prisma.supplier.create({
      data: {
        company_name: "Test Supplier Company",
        supplier_name: "Test Supplier",
        order_email: "supplier@test.local",
        is_active: true,
      },
      select: { id: true },
    }));

  await prisma.user.upsert({
    where: { login_id: "superadmin" },
    update: {
      password_hash: adminPasswordHash,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      is_active: true,
    },
    create: {
      login_id: "superadmin",
      password_hash: adminPasswordHash,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "admin01" },
    update: {
      password_hash: adminPasswordHash,
      name: "Admin One",
      role: Role.ADMIN,
      is_active: true,
    },
    create: {
      login_id: "admin01",
      password_hash: adminPasswordHash,
      name: "Admin One",
      role: Role.ADMIN,
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "korea.supply.admin" },
    update: {
      password_hash: adminPasswordHash,
      name: "Korea Supply Admin",
      role: Role.KOREA_SUPPLY_ADMIN,
      country_id: null,
      supplier_id: null,
      is_active: true,
    },
    create: {
      login_id: "korea.supply.admin",
      password_hash: adminPasswordHash,
      name: "Korea Supply Admin",
      role: Role.KOREA_SUPPLY_ADMIN,
      country_id: null,
      supplier_id: null,
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "country.mn.admin" },
    update: {
      password_hash: adminPasswordHash,
      name: "Mongolia Country Admin",
      role: Role.COUNTRY_ADMIN,
      country_id: mongoliaCountry.id,
      supplier_id: null,
      is_active: true,
    },
    create: {
      login_id: "country.mn.admin",
      password_hash: adminPasswordHash,
      name: "Mongolia Country Admin",
      role: Role.COUNTRY_ADMIN,
      country_id: mongoliaCountry.id,
      supplier_id: null,
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "buyer.test.01" },
    update: {
      password_hash: testPasswordHash,
      name: "Test Buyer",
      role: Role.BUYER,
      country_id: defaultCountry.id,
      supplier_id: null,
      is_active: true,
    },
    create: {
      login_id: "buyer.test.01",
      password_hash: testPasswordHash,
      name: "Test Buyer",
      role: Role.BUYER,
      country_id: defaultCountry.id,
      is_active: true,
    },
  });

  await prisma.user.upsert({
    where: { login_id: "supplier.test.01" },
    update: {
      password_hash: testPasswordHash,
      name: "Test Supplier",
      role: Role.SUPPLIER,
      supplier_id: defaultSupplier.id,
      country_id: null,
      is_active: true,
    },
    create: {
      login_id: "supplier.test.01",
      password_hash: testPasswordHash,
      name: "Test Supplier",
      role: Role.SUPPLIER,
      supplier_id: defaultSupplier.id,
      is_active: true,
    },
  });

  console.log("Bootstrap completed:");
  console.log("- SUPER_ADMIN: superadmin / ChangeMe123!");
  console.log("- ADMIN: admin01 / ChangeMe123!");
  console.log("- KOREA_SUPPLY_ADMIN: korea.supply.admin / ChangeMe123!");
  console.log("- COUNTRY_ADMIN(MN): country.mn.admin / ChangeMe123!");
  console.log("- BUYER(test): buyer.test.01 / Test1234!");
  console.log("- SUPPLIER(test): supplier.test.01 / Test1234!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
