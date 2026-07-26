"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductSuggestions = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductBySlug = exports.getProducts = void 0;
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const cache_service_1 = __importDefault(require("../services/cache.service"));
const upload_service_1 = __importDefault(require("../services/upload.service"));
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars
        .replace(/\-\-+/g, "-"); // Replace multiple - with single -
};
const createProductSchema = zod_1.z.object({
    title: zod_1.z.string().min(2, "Title must be at least 2 characters long"),
    slug: zod_1.z.string().optional(),
    description: zod_1.z.string().min(5, "Description must be at least 5 characters long"),
    price: zod_1.z.preprocess((val) => parseFloat(val), zod_1.z.number().positive("Price must be positive")),
    costPrice: zod_1.z.preprocess((val) => parseFloat(val), zod_1.z.number().nonnegative("Cost price cannot be negative")),
    discount: zod_1.z.preprocess((val) => parseFloat(val), zod_1.z.number().min(0).max(100)).optional(),
    categoryId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Category ID"),
    targetGroup: zod_1.z.enum(["MEN", "WOMEN", "KIDS", "UNISEX", "OTHERS"]).optional(),
    images: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(), // handles stringified array or single string from forms
    metadata: zod_1.z.any().optional(),
    variants: zod_1.z
        .array(zod_1.z.object({
        sku: zod_1.z.string().min(3, "SKU must be at least 3 characters long"),
        size: zod_1.z.string().optional().nullable(),
        color: zod_1.z.string().optional().nullable(),
        stock: zod_1.z.number().int().min(0, "Stock cannot be negative"),
        price: zod_1.z.number().positive("Variant price override must be positive").optional(),
    }))
        .min(1, "Product must have at least one variant"),
});
exports.getProducts = (0, catchAsync_1.default)(async (req, res) => {
    const { page, limit, category, targetGroup, minPrice, maxPrice, sort, search } = req.query;
    // Use JSON stringified request query as cache key
    const cacheKey = `products:list:${JSON.stringify(req.query)}`;
    const cachedData = await cache_service_1.default.get(cacheKey);
    if (cachedData) {
        return res.status(200).json({
            status: "success",
            source: "cache",
            ...JSON.parse(cachedData),
        });
    }
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;
    const where = { isPublished: true };
    // Expand categories to include subcategories if querying a parent category
    if (category) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(category);
        const targetCategory = await db_1.default.category.findFirst({
            where: isObjectId ? { id: category } : { slug: category },
            include: { children: true },
        });
        if (targetCategory) {
            const categoryIds = [targetCategory.id, ...targetCategory.children.map((c) => c.id)];
            where.categoryId = { in: categoryIds };
        }
        else {
            // Return empty if category parameter does not exist
            where.categoryId = "non-existent-id";
        }
    }
    if (targetGroup) {
        if (targetGroup === "MEN") {
            where.targetGroup = { in: ["MEN", "UNISEX"] };
        }
        else if (targetGroup === "WOMEN") {
            where.targetGroup = { in: ["WOMEN", "UNISEX"] };
        }
        else if (targetGroup === "KIDS") {
            where.targetGroup = { in: ["KIDS", "UNISEX"] };
        }
        else {
            where.targetGroup = targetGroup;
        }
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined)
            where.price.gte = parseFloat(minPrice);
        if (maxPrice !== undefined)
            where.price.lte = parseFloat(maxPrice);
    }
    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ];
    }
    // Sort logic
    let orderBy = { createdAt: "desc" };
    if (sort === "price_asc") {
        orderBy = { price: "asc" };
    }
    else if (sort === "price_desc") {
        orderBy = { price: "desc" };
    }
    const [products, totalCount] = await db_1.default.$transaction([
        db_1.default.product.findMany({
            where,
            orderBy,
            skip,
            take: limitNum,
            include: {
                category: { select: { id: true, name: true, slug: true } },
                variants: true,
            },
        }),
        db_1.default.product.count({ where }),
    ]);
    const responsePayload = {
        results: products.length,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        currentPage: pageNum,
        data: products,
    };
    // Cache list payload for 5 minutes
    await cache_service_1.default.set(cacheKey, JSON.stringify(responsePayload), 300);
    res.status(200).json({
        status: "success",
        source: "db",
        ...responsePayload,
    });
});
exports.getProductBySlug = (0, catchAsync_1.default)(async (req, res) => {
    const { slug } = req.params;
    const product = await db_1.default.product.findUnique({
        where: { slug },
        include: {
            category: { select: { id: true, name: true, slug: true } },
            variants: true,
        },
    });
    if (!product) {
        throw new appError_1.default("Product not found.", 404);
    }
    res.status(200).json({
        status: "success",
        data: product,
    });
});
exports.createProduct = (0, catchAsync_1.default)(async (req, res) => {
    // Parse variants if they are passed as a JSON string from multipart/form-data
    if (typeof req.body.variants === "string") {
        req.body.variants = JSON.parse(req.body.variants);
    }
    if (typeof req.body.metadata === "string") {
        req.body.metadata = JSON.parse(req.body.metadata);
    }
    const data = createProductSchema.parse(req.body);
    // Validate category
    const categoryExists = await db_1.default.category.findUnique({
        where: { id: data.categoryId },
    });
    if (!categoryExists) {
        throw new appError_1.default("Target category does not exist.", 404);
    }
    // Handle images uploaded to Cloudinary
    const imageUrls = [];
    // Parse static image URLs if passed
    if (data.images) {
        if (Array.isArray(data.images)) {
            imageUrls.push(...data.images);
        }
        else {
            imageUrls.push(data.images);
        }
    }
    // Upload memory file buffers if multer populated files
    if (req.files && Array.isArray(req.files)) {
        const uploadPromises = req.files.map((file) => upload_service_1.default.uploadSingleImage(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);
        imageUrls.push(...uploadResults.map((res) => res.secure_url));
    }
    if (imageUrls.length === 0) {
        throw new appError_1.default("Product must have at least one image.", 400);
    }
    const productSlug = data.slug || slugify(data.title);
    // Ensure unique slug
    const duplicate = await db_1.default.product.findUnique({ where: { slug: productSlug } });
    if (duplicate) {
        throw new appError_1.default("Product slug already exists. Use a custom slug or different title.", 400);
    }
    // Database atomic creation of product + variants
    const newProduct = await db_1.default.$transaction(async (tx) => {
        const product = await tx.product.create({
            data: {
                title: data.title,
                slug: productSlug,
                description: data.description,
                price: data.price,
                costPrice: data.costPrice,
                discount: data.discount || 0,
                categoryId: data.categoryId,
                targetGroup: data.targetGroup || "UNISEX",
                images: imageUrls,
                metadata: data.metadata || {},
            },
        });
        await Promise.all(data.variants.map((v) => tx.productVariant.create({
            data: {
                sku: v.sku,
                size: v.size || null,
                color: v.color || null,
                stock: v.stock,
                price: v.price || null,
                productId: product.id,
            },
        })));
        return tx.product.findUnique({
            where: { id: product.id },
            include: { variants: true },
        });
    });
    // Clear query cache matching product listings
    await cache_service_1.default.delPattern("products:list:*");
    await cache_service_1.default.delPattern("products:suggestions:*");
    res.status(201).json({
        status: "success",
        data: newProduct,
    });
});
exports.updateProduct = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    if (typeof req.body.variants === "string") {
        req.body.variants = JSON.parse(req.body.variants);
    }
    if (typeof req.body.metadata === "string") {
        req.body.metadata = JSON.parse(req.body.metadata);
    }
    const updateSchema = createProductSchema.partial();
    const data = updateSchema.parse(req.body);
    const existingProduct = await db_1.default.product.findUnique({
        where: { id },
    });
    if (!existingProduct) {
        throw new appError_1.default("Product not found.", 404);
    }
    if (data.categoryId) {
        const categoryExists = await db_1.default.category.findUnique({
            where: { id: data.categoryId },
        });
        if (!categoryExists) {
            throw new appError_1.default("Target category does not exist.", 404);
        }
    }
    const imageUrls = [...(existingProduct.images || [])];
    // Append new uploads if files exist
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const uploadPromises = req.files.map((file) => upload_service_1.default.uploadSingleImage(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);
        imageUrls.push(...uploadResults.map((res) => res.secure_url));
    }
    if (data.images) {
        if (Array.isArray(data.images)) {
            imageUrls.push(...data.images);
        }
        else {
            imageUrls.push(data.images);
        }
    }
    const productSlug = data.slug || (data.title ? slugify(data.title) : undefined);
    if (productSlug && productSlug !== existingProduct.slug) {
        const duplicate = await db_1.default.product.findUnique({ where: { slug: productSlug } });
        if (duplicate) {
            throw new appError_1.default("Product slug already exists.", 400);
        }
    }
    const updatedProduct = await db_1.default.$transaction(async (tx) => {
        // Update variants if passed
        if (data.variants) {
            // Validate SKU duplicates in incoming body
            const skus = data.variants.map(v => v.sku);
            if (new Set(skus).size !== skus.length) {
                throw new appError_1.default("Duplicate SKU entries in variants payload.", 400);
            }
            // Check if SKUs exist on OTHER products
            for (const v of data.variants) {
                const skuConflict = await tx.productVariant.findFirst({
                    where: {
                        sku: v.sku,
                        productId: { not: id },
                    },
                });
                if (skuConflict) {
                    throw new appError_1.default(`SKU ${v.sku} is already assigned to another product.`, 400);
                }
            }
            // Overwrite variants (hard replace)
            await tx.productVariant.deleteMany({
                where: { productId: id },
            });
            await Promise.all(data.variants.map((v) => tx.productVariant.create({
                data: {
                    sku: v.sku,
                    size: v.size || null,
                    color: v.color || null,
                    stock: v.stock,
                    price: v.price || null,
                    productId: id,
                },
            })));
        }
        return tx.product.update({
            where: { id },
            data: {
                title: data.title,
                slug: productSlug,
                description: data.description,
                price: data.price,
                costPrice: data.costPrice,
                discount: data.discount,
                categoryId: data.categoryId,
                targetGroup: data.targetGroup,
                images: imageUrls,
                metadata: data.metadata,
            },
            include: { variants: true },
        });
    });
    // Clear query cache
    await cache_service_1.default.delPattern("products:list:*");
    await cache_service_1.default.delPattern("products:suggestions:*");
    res.status(200).json({
        status: "success",
        data: updatedProduct,
    });
});
exports.deleteProduct = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const existingProduct = await db_1.default.product.findUnique({
        where: { id },
    });
    if (!existingProduct) {
        throw new appError_1.default("Product not found.", 404);
    }
    // Hard delete (Prisma Cascade rule handles deleting variants)
    await db_1.default.product.delete({
        where: { id },
    });
    // Clear listing cache
    await cache_service_1.default.delPattern("products:list:*");
    await cache_service_1.default.delPattern("products:suggestions:*");
    res.status(200).json({
        status: "success",
        message: "Product deleted successfully.",
    });
});
exports.getProductSuggestions = (0, catchAsync_1.default)(async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== "string" || !q.trim()) {
        return res.status(200).json({
            status: "success",
            data: {
                suggestions: [],
                products: [],
            },
        });
    }
    const queryStr = q.trim();
    const cacheKey = `products:suggestions:${queryStr.toLowerCase()}`;
    const cachedData = await cache_service_1.default.get(cacheKey);
    if (cachedData) {
        return res.status(200).json({
            status: "success",
            source: "cache",
            data: JSON.parse(cachedData),
        });
    }
    // Get matching products (limit to 8)
    const products = await db_1.default.product.findMany({
        where: {
            isPublished: true,
            OR: [
                { title: { contains: queryStr, mode: "insensitive" } },
                { description: { contains: queryStr, mode: "insensitive" } },
            ],
        },
        take: 8,
        select: {
            id: true,
            title: true,
            slug: true,
            price: true,
            discount: true,
            images: true,
        },
    });
    // Extract unique titles for query suggestions
    const suggestions = Array.from(new Set(products.map((p) => p.title)));
    const resultData = {
        suggestions,
        products,
    };
    // Cache suggestions for 1 minute (60 seconds)
    await cache_service_1.default.set(cacheKey, JSON.stringify(resultData), 60);
    res.status(200).json({
        status: "success",
        source: "db",
        data: resultData,
    });
});
