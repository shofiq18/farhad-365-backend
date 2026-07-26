"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const targetGroups = ["MEN", "WOMEN", "KIDS", "UNISEX", "OTHERS"];
const categoryTree = [
    {
        name: "Footwear",
        slug: "footwear",
        subcategories: [
            { name: "Formal Shoes", slug: "formal-shoes" },
            { name: "Casual Shoes", slug: "casual-shoes" },
            { name: "Canvas", slug: "canvas" },
            { name: "Sports Shoes", slug: "sports-shoes" },
            { name: "Sandals", slug: "sandals" },
            { name: "Sports Sandals", slug: "sports-sandals" },
        ],
    },
    {
        name: "Clothing",
        slug: "clothing",
        subcategories: [
            { name: "T-Shirts", slug: "t-shirts" },
            { name: "Casual Shirts", slug: "casual-shirts" },
            { name: "Polo Shirts", slug: "polo-shirts" },
            { name: "Denim (Jeans)", slug: "denim-jeans" },
            { name: "Formal Pants", slug: "formal-pants" },
        ],
    },
    {
        name: "Accessories",
        slug: "accessories",
        subcategories: [
            { name: "Bags", slug: "bags" },
            { name: "Essentials", slug: "essentials" },
            { name: "Luggage", slug: "luggage" },
            { name: "Belts", slug: "belts" },
            { name: "Wallets", slug: "wallets" },
            { name: "Watches", slug: "watches" },
            { name: "Perfumes", slug: "perfumes" },
            { name: "Sunglasses", slug: "sunglasses" },
        ],
    },
];
async function main() {
    console.log("Starting category seeding...");
    for (const parent of categoryTree) {
        const parentCategory = await prisma.category.upsert({
            where: { slug: parent.slug },
            update: { name: parent.name, targetGroups },
            create: {
                name: parent.name,
                slug: parent.slug,
                targetGroups,
            },
        });
        console.log(`Seeded parent category: ${parentCategory.name}`);
        for (const sub of parent.subcategories) {
            const subCategory = await prisma.category.upsert({
                where: { slug: sub.slug },
                update: {
                    name: sub.name,
                    parentId: parentCategory.id,
                    targetGroups,
                },
                create: {
                    name: sub.name,
                    slug: sub.slug,
                    parentId: parentCategory.id,
                    targetGroups,
                },
            });
            console.log(`  Seeded subcategory: ${subCategory.name}`);
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
