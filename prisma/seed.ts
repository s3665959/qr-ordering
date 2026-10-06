import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const permissions = [
  "TABLE_VIEW",
  "TABLE_OPEN",
  "TABLE_START",
  "TABLE_EXTEND",
  "TABLE_CLOSE",
  "PAYMENT_CREATE",
  "QR_PRINT",
  "QR_REPRINT",
  "ORDER_VIEW",
  "ORDER_STATUS_UPDATE",
  "MENU_MANAGE",
  "STAFF_MANAGE",
  "ROLE_MANAGE",
  "PACKAGE_MANAGE",
  "SETTINGS_MANAGE",
] as const;

const rolePermissions: Record<string, readonly string[]> = {
  OWNER: permissions,
  MANAGER: permissions,
  MENU_EDITOR: ["MENU_MANAGE"],
  CASHIER: [
    "TABLE_VIEW",
    "TABLE_OPEN",
    "TABLE_START",
    "TABLE_CLOSE",
    "PAYMENT_CREATE",
    "QR_PRINT",
    "QR_REPRINT",
  ],
  KITCHEN: ["ORDER_VIEW", "ORDER_STATUS_UPDATE"],
  SERVER: ["TABLE_VIEW", "ORDER_VIEW", "ORDER_STATUS_UPDATE"],
};

async function main() {
  const store = await prisma.store.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      code: "MAIN",
      name: "สาขาหลัก",
      timezone: "Asia/Bangkok",
      defaultDurationMinutes: 120,
      alertBeforeMinutes: 15,
    },
  });

  await Promise.all([
    prisma.buffetPackage.upsert({
      where: { storeId_code: { storeId: store.id, code: "PORK" } },
      update: {},
      create: {
        storeId: store.id,
        code: "PORK",
        name: "บุฟเฟต์หมู",
        pricePerPerson: 299,
        durationMinutes: 120,
        allowsBeefOrdering: false,
        sortOrder: 10,
      },
    }),
    prisma.buffetPackage.upsert({
      where: { storeId_code: { storeId: store.id, code: "PORK_BEEF" } },
      update: {},
      create: {
        storeId: store.id,
        code: "PORK_BEEF",
        name: "บุฟเฟต์หมูและเนื้อวัว",
        pricePerPerson: 349,
        durationMinutes: 120,
        allowsBeefOrdering: true,
        sortOrder: 20,
      },
    }),
  ]);

  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code },
    });
  }

  for (const [roleCode, grantedPermissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {},
      create: { code: roleCode, name: roleCode, isSystem: true },
    });

    for (const permissionCode of grantedPermissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: permissionCode },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
