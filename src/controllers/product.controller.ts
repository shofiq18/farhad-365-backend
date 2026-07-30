import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import cacheService from "../services/cache.service";
import uploadService from "../services/upload.service";

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
};

const createProductSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters long"),
  slug: z.string().optional(),
  description: z.string().min(5, "Description must be at least 5 characters long"),
  price: z.preprocess((val) => parseFloat(val as string), z.number().positive("Price must be positive")),
  costPrice: z.preprocess((val) => parseFloat(val as string), z.number().nonnegative("Cost price cannot be negative")),
  discount: z.preprocess((val) => parseFloat(val as string), z.number().min(0).max(100)).optional(),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Category ID"),
  targetGroup: z.enum(["MEN", "WOMEN", "KIDS", "UNISEX", "OTHERS", "SCHOOL", "SPORTS"]).optional(),
  images: z.union([z.string(), z.array(z.string())]).optional(), // handles stringified array or single string from forms
  metadata: z.any().optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(3, "SKU must be at least 3 characters long"),
        size: z.string().optional().nullable(),
        color: z.string().optional().nullable(),
        stock: z.number().int().min(0, "Stock cannot be negative"),
        price: z.number().positive("Variant price override must be positive").optional(),
      })
    )
    .min(1, "Product must have at least one variant"),
});

export const getProducts = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, category, targetGroup, minPrice, maxPrice, sort, search } = req.query;

  // Use JSON stringified request query as cache key
  const cacheKey = `products:list:${JSON.stringify(req.query)}`;
  const cachedData = await cacheService.get(cacheKey);

  if (cachedData) {
    return res.status(200).json({
      status: "success",
      source: "cache",
      ...JSON.parse(cachedData),
    });
  }

  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 12;
  const skip = (pageNum - 1) * limitNum;

  const where: any = { isPublished: true };

  // Expand categories to include subcategories if querying a parent category
  if (category) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(category as string);
    const targetCategory = await prisma.category.findFirst({
      where: isObjectId ? { id: category as string } : { slug: category as string },
      include: { children: true },
    });

    if (targetCategory) {
      const categoryIds = [targetCategory.id, ...targetCategory.children.map((c) => c.id)];
      where.categoryId = { in: categoryIds };
    } else {
      // Return empty if category parameter does not exist
      where.categoryId = "non-existent-id";
    }
  }

  if (targetGroup) {
    if (targetGroup === "MEN") {
      where.targetGroup = { in: ["MEN", "UNISEX"] };
    } else if (targetGroup === "WOMEN") {
      where.targetGroup = { in: ["WOMEN", "UNISEX"] };
    } else if (targetGroup === "KIDS") {
      where.targetGroup = { in: ["KIDS", "UNISEX"] };
    } else {
      where.targetGroup = targetGroup;
    }
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = parseFloat(minPrice as string);
    if (maxPrice !== undefined) where.price.lte = parseFloat(maxPrice as string);
  }

  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: "insensitive" } },
      { description: { contains: search as string, mode: "insensitive" } },
    ];
  }

  // Sort logic
  let orderBy: any = { createdAt: "desc" };
  if (sort === "price_asc") {
    orderBy = { price: "asc" };
  } else if (sort === "price_desc") {
    orderBy = { price: "desc" };
  }

  const [products, totalCount] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  const responsePayload = {
    results: products.length,
    totalCount,
    totalPages: Math.ceil(totalCount / limitNum),
    currentPage: pageNum,
    data: products,
  };

  // Cache list payload for 5 minutes
  await cacheService.set(cacheKey, JSON.stringify(responsePayload), 300);

  res.status(200).json({
    status: "success",
    source: "db",
    ...responsePayload,
  });
});

export const getProductBySlug = catchAsync(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: true,
    },
  });

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  res.status(200).json({
    status: "success",
    data: product,
  });
});

export const createProduct = catchAsync(async (req: Request, res: Response) => {
  // Parse variants if they are passed as a JSON string from multipart/form-data
  if (typeof req.body.variants === "string") {
    req.body.variants = JSON.parse(req.body.variants);
  }
  if (typeof req.body.metadata === "string") {
    req.body.metadata = JSON.parse(req.body.metadata);
  }

  const data = createProductSchema.parse(req.body);

  // Validate category
  const categoryExists = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });

  if (!categoryExists) {
    throw new AppError("Target category does not exist.", 404);
  }

  // Handle images uploaded to Cloudinary
  const imageUrls: string[] = [];

  // Parse static image URLs if passed
  if (data.images) {
    if (Array.isArray(data.images)) {
      imageUrls.push(...data.images);
    } else {
      imageUrls.push(data.images);
    }
  }

  // Upload memory file buffers if multer populated files
  if (req.files && Array.isArray(req.files)) {
    const uploadPromises = req.files.map((file: Express.Multer.File) =>
      uploadService.uploadSingleImage(file.buffer)
    );
    const uploadResults = await Promise.all(uploadPromises);
    imageUrls.push(...uploadResults.map((res) => res.secure_url));
  }

  if (imageUrls.length === 0) {
    throw new AppError("Product must have at least one image.", 400);
  }

  const productSlug = data.slug || slugify(data.title);

  // Ensure unique slug
  const duplicate = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (duplicate) {
    throw new AppError("Product slug already exists. Use a custom slug or different title.", 400);
  }

  // Database atomic creation of product + variants
  const newProduct = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    await Promise.all(
      data.variants.map((v) =>
        tx.productVariant.create({
          data: {
            sku: v.sku,
            size: v.size || null,
            color: v.color || null,
            stock: v.stock,
            price: v.price || null,
            productId: product.id,
          },
        })
      )
    );

    return tx.product.findUnique({
      where: { id: product.id },
      include: { variants: true },
    });
  });

  // Clear query cache matching product listings
  await cacheService.delPattern("products:list:*");
  await cacheService.delPattern("products:suggestions:*");

  res.status(201).json({
    status: "success",
    data: newProduct,
  });
});

export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof req.body.variants === "string") {
    req.body.variants = JSON.parse(req.body.variants);
  }
  if (typeof req.body.metadata === "string") {
    req.body.metadata = JSON.parse(req.body.metadata);
  }

  const updateSchema = createProductSchema.partial();
  const data = updateSchema.parse(req.body);

  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new AppError("Product not found.", 404);
  }

  if (data.categoryId) {
    const categoryExists = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!categoryExists) {
      throw new AppError("Target category does not exist.", 404);
    }
  }

  let imageUrls: string[] = [];
  if (data.images !== undefined) {
    const rawImages = Array.isArray(data.images) ? data.images : [data.images];
    imageUrls = rawImages.map(img => img.trim()).filter(Boolean);
  } else {
    imageUrls = [...(existingProduct.images || [])];
  }

  // Append new uploads if files exist
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const uploadPromises = req.files.map((file: Express.Multer.File) =>
      uploadService.uploadSingleImage(file.buffer)
    );
    const uploadResults = await Promise.all(uploadPromises);
    imageUrls.push(...uploadResults.map((res) => res.secure_url));
  }

  const productSlug = data.slug || (data.title ? slugify(data.title) : undefined);

  if (productSlug && productSlug !== existingProduct.slug) {
    const duplicate = await prisma.product.findUnique({ where: { slug: productSlug } });
    if (duplicate) {
      throw new AppError("Product slug already exists.", 400);
    }
  }

  const updatedProduct = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update variants if passed
    if (data.variants) {
      // Validate SKU duplicates in incoming body
      const skus = data.variants.map(v => v.sku);
      if (new Set(skus).size !== skus.length) {
        throw new AppError("Duplicate SKU entries in variants payload.", 400);
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
          throw new AppError(`SKU ${v.sku} is already assigned to another product.`, 400);
        }
      }

      // Overwrite variants (hard replace)
      await tx.productVariant.deleteMany({
        where: { productId: id },
      });

      await Promise.all(
        data.variants.map((v) =>
          tx.productVariant.create({
            data: {
              sku: v.sku,
              size: v.size || null,
              color: v.color || null,
              stock: v.stock,
              price: v.price || null,
              productId: id,
            },
          })
        )
      );
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
  await cacheService.delPattern("products:list:*");
  await cacheService.delPattern("products:suggestions:*");

  res.status(200).json({
    status: "success",
    data: updatedProduct,
  });
});

export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new AppError("Product not found.", 404);
  }

  // Hard delete (Prisma Cascade rule handles deleting variants)
  await prisma.product.delete({
    where: { id },
  });

  // Clear listing cache
  await cacheService.delPattern("products:list:*");
  await cacheService.delPattern("products:suggestions:*");

  res.status(200).json({
    status: "success",
    message: "Product deleted successfully.",
  });
});

export const getProductSuggestions = catchAsync(async (req: Request, res: Response) => {
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
  const cachedData = await cacheService.get(cacheKey);

  if (cachedData) {
    return res.status(200).json({
      status: "success",
      source: "cache",
      data: JSON.parse(cachedData),
    });
  }

  // Get matching products (limit to 8)
  const products = await prisma.product.findMany({
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
  await cacheService.set(cacheKey, JSON.stringify(resultData), 60);

  res.status(200).json({
    status: "success",
    source: "db",
    data: resultData,
  });
});
