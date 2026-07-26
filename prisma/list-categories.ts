import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allCategories = await prisma.category.findMany({
    include: { parent: true }
  });
  console.log(JSON.stringify(allCategories, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
