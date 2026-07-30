import { PrismaClient, TargetGroup } from "@prisma/client";

const prisma = new PrismaClient();

interface SubcategorySeed {
  name: string;
  slug: string;
  targetGroups: TargetGroup[];
}

interface ParentCategorySeed {
  name: string;
  slug: string;
  targetGroups: TargetGroup[];
  subcategories: SubcategorySeed[];
}

const categoryTree: ParentCategorySeed[] = [
  {
    name: "Footwear",
    slug: "footwear",
    targetGroups: ["MEN", "WOMEN", "KIDS", "UNISEX"],
    subcategories: [
      { name: "Formal Shoes", slug: "formal-shoes", targetGroups: ["MEN"] },
      { name: "Casual Shoes", slug: "casual-shoes", targetGroups: ["MEN", "WOMEN", "UNISEX"] },
      { name: "Boots", slug: "boots", targetGroups: ["MEN", "WOMEN"] },
      { name: "Canvas", slug: "canvas", targetGroups: ["MEN", "WOMEN", "UNISEX"] },
      { name: "Sports Shoes", slug: "sports-shoes", targetGroups: ["MEN", "WOMEN", "KIDS", "UNISEX"] },
      { name: "Sandals", slug: "sandals", targetGroups: ["MEN", "WOMEN", "UNISEX"] },
      { name: "Sports Sandals", slug: "sports-sandals", targetGroups: ["MEN", "WOMEN", "UNISEX"] },
      { name: "Heels", slug: "heels", targetGroups: ["WOMEN"] },
      { name: "Flats", slug: "flats", targetGroups: ["WOMEN"] },
      { name: "Wedges", slug: "wedges", targetGroups: ["WOMEN"] },
      { name: "School Shoes", slug: "school-shoes", targetGroups: ["SCHOOL", "KIDS", "UNISEX"] },
    ],
  },
  {
    name: "Clothing",
    slug: "clothing",
    targetGroups: ["MEN", "WOMEN", "KIDS", "UNISEX"],
    subcategories: [
      { name: "T-Shirts", slug: "t-shirts", targetGroups: ["MEN", "WOMEN", "KIDS", "UNISEX"] },
      { name: "Casual Shirts", slug: "casual-shirts", targetGroups: ["MEN"] },
      { name: "Polo Shirts", slug: "polo-shirts", targetGroups: ["MEN"] },
      { name: "Chinos", slug: "chinos", targetGroups: ["MEN"] },
      { name: "Denim (Jeans)", slug: "denim-jeans", targetGroups: ["MEN", "WOMEN", "UNISEX"] },
      { name: "Formal Pants", slug: "formal-pants", targetGroups: ["MEN"] },
      { name: "Tops & Tees", slug: "tops-tees", targetGroups: ["WOMEN"] },
      { name: "Dresses", slug: "dresses", targetGroups: ["WOMEN"] },
      { name: "Kurtas & Kurtis", slug: "kurtas-kurtis", targetGroups: ["WOMEN"] },
      { name: "Pants & Leggings", slug: "pants-leggings", targetGroups: ["WOMEN"] },
      { name: "Activewear", slug: "activewear", targetGroups: ["MEN", "WOMEN", "UNISEX"] },
    ],
  },
  {
    name: "Accessories",
    slug: "accessories",
    targetGroups: ["MEN", "WOMEN", "KIDS", "UNISEX", "OTHERS"],
    subcategories: [
      { name: "Bags", slug: "bags", targetGroups: ["MEN", "UNISEX", "OTHERS"] },
      { name: "Handbags", slug: "handbags", targetGroups: ["WOMEN", "OTHERS"] },
      { name: "Essentials", slug: "essentials", targetGroups: ["MEN", "WOMEN", "UNISEX", "OTHERS"] },
      { name: "Luggage", slug: "luggage", targetGroups: ["MEN", "WOMEN", "UNISEX", "OTHERS"] },
      { name: "Belts", slug: "belts", targetGroups: ["MEN", "WOMEN", "UNISEX", "OTHERS"] },
      { name: "Wallets", slug: "wallets", targetGroups: ["MEN", "WOMEN", "UNISEX", "OTHERS"] },
      { name: "Watches", slug: "watches", targetGroups: ["MEN", "WOMEN", "UNISEX", "OTHERS"] },
      { name: "Perfumes", slug: "perfumes", targetGroups: ["MEN", "WOMEN", "UNISEX", "OTHERS"] },
      { name: "Sunglasses", slug: "sunglasses", targetGroups: ["MEN", "WOMEN", "UNISEX", "OTHERS"] },
      { name: "Jewelry", slug: "jewelry", targetGroups: ["WOMEN", "OTHERS"] },
      { name: "School Bags", slug: "school-bags", targetGroups: ["SCHOOL", "KIDS", "UNISEX"] },
    ],
  },
];

async function main() {
  console.log("Starting category seeding with target groups...");

  for (const parent of categoryTree) {
    const parentCategory = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, targetGroups: parent.targetGroups },
      create: {
        name: parent.name,
        slug: parent.slug,
        targetGroups: parent.targetGroups,
      },
    });

    console.log(`Seeded parent category: ${parentCategory.name}`);

    for (const sub of parent.subcategories) {
      const subCategory = await prisma.category.upsert({
        where: { slug: sub.slug },
        update: {
          name: sub.name,
          parentId: parentCategory.id,
          targetGroups: sub.targetGroups,
        },
        create: {
          name: sub.name,
          slug: sub.slug,
          parentId: parentCategory.id,
          targetGroups: sub.targetGroups,
        },
      });
      console.log(`  Seeded subcategory: ${subCategory.name} [${sub.targetGroups.join(", ")}]`);
    }
  }

  console.log("Database seeding finished!");
}

main()
  .catch((e) => {
    console.error("Error seeding categories:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
