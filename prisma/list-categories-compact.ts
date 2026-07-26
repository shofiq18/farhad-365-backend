import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allCategories = await prisma.category.findMany();
  for (const cat of allCategories) {
    if (cat.parentId) {
      console.log(`Subcategory: ${cat.name} (${cat.slug}) -> targetGroups: ${JSON.stringify(cat.targetGroups)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
