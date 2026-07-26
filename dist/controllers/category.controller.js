"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = void 0;
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const cache_service_1 = __importDefault(require("../services/cache.service"));
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters long"),
    slug: zod_1.z.string().min(2, "Slug must be at least 2 characters long"),
    parentId: zod_1.z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid Parent Category ID format")
        .optional()
        .nullable(),
    targetGroups: zod_1.z
        .array(zod_1.z.enum(["MEN", "WOMEN", "KIDS", "UNISEX", "OTHERS"]))
        .optional(),
});
const buildCategoryTree = (categories, parentId = null) => {
    const branch = [];
    for (const cat of categories) {
        if (cat.parentId === parentId) {
            const children = buildCategoryTree(categories, cat.id);
            const node = {
                ...cat,
                children: children.length > 0 ? children : [],
            };
            branch.push(node);
        }
    }
    return branch;
};
exports.getCategories = (0, catchAsync_1.default)(async (req, res) => {
    const cacheKey = "categories:tree";
    // Try fetching cached categories
    const cachedData = await cache_service_1.default.get(cacheKey);
    if (cachedData) {
        return res.status(200).json({
            status: "success",
            source: "cache",
            data: JSON.parse(cachedData),
        });
    }
    // Load from MongoDB database
    const allCategories = await db_1.default.category.findMany({
        orderBy: { name: "asc" },
    });
    const categoryTree = buildCategoryTree(allCategories, null);
    // Cache tree for 24 hours
    await cache_service_1.default.set(cacheKey, JSON.stringify(categoryTree), 86400);
    res.status(200).json({
        status: "success",
        source: "db",
        data: categoryTree,
    });
});
exports.createCategory = (0, catchAsync_1.default)(async (req, res) => {
    const data = categorySchema.parse(req.body);
    if (data.parentId) {
        const parent = await db_1.default.category.findUnique({
            where: { id: data.parentId },
        });
        if (!parent) {
            throw new appError_1.default("Parent category not found.", 404);
        }
    }
    const category = await db_1.default.category.create({
        data: {
            name: data.name,
            slug: data.slug,
            parentId: data.parentId || null,
            targetGroups: data.targetGroups || ["UNISEX"],
        },
    });
    // Clear cached category structures
    await cache_service_1.default.del("categories:tree");
    res.status(201).json({
        status: "success",
        data: category,
    });
});
exports.updateCategory = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const data = categorySchema.partial().parse(req.body);
    const categoryExists = await db_1.default.category.findUnique({
        where: { id },
    });
    if (!categoryExists) {
        throw new appError_1.default("Category not found.", 404);
    }
    if (data.parentId) {
        const parent = await db_1.default.category.findUnique({
            where: { id: data.parentId },
        });
        if (!parent) {
            throw new appError_1.default("Parent category not found.", 404);
        }
    }
    const updatedCategory = await db_1.default.category.update({
        where: { id },
        data: {
            name: data.name,
            slug: data.slug,
            parentId: data.parentId === undefined ? undefined : data.parentId,
            targetGroups: data.targetGroups,
        },
    });
    // Clear cached category structures
    await cache_service_1.default.del("categories:tree");
    res.status(200).json({
        status: "success",
        data: updatedCategory,
    });
});
exports.deleteCategory = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const category = await db_1.default.category.findUnique({ where: { id } });
    if (!category)
        throw new appError_1.default("Category not found.", 404);
    await db_1.default.category.delete({ where: { id } });
    // Clear cached category structures
    await cache_service_1.default.del("categories:tree");
    res.status(200).json({ status: "success", message: "Category deleted." });
});
