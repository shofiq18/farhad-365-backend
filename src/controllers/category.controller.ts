import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import cacheService from "../services/cache.service";

const categorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  slug: z.string().min(2, "Slug must be at least 2 characters long"),
  parentId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid Parent Category ID format")
    .optional()
    .nullable(),
  targetGroups: z
    .array(z.enum(["MEN", "WOMEN", "KIDS", "UNISEX", "OTHERS", "SCHOOL", "SPORTS"]))
    .optional(),
});

const buildCategoryTree = (categories: any[], parentId: string | null = null): any[] => {
  const branch: any[] = [];
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

export const getCategories = catchAsync(async (req: Request, res: Response) => {
  const cacheKey = "categories:tree";

  // Try fetching cached categories
  const cachedData = await cacheService.get(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      status: "success",
      source: "cache",
      data: JSON.parse(cachedData),
    });
  }

  // Load from MongoDB database
  const allCategories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  const categoryTree = buildCategoryTree(allCategories, null);

  // Cache tree for 24 hours
  await cacheService.set(cacheKey, JSON.stringify(categoryTree), 86400);

  res.status(200).json({
    status: "success",
    source: "db",
    data: categoryTree,
  });
});

export const createCategory = catchAsync(async (req: Request, res: Response) => {
  const data = categorySchema.parse(req.body);

  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId },
    });
    if (!parent) {
      throw new AppError("Parent category not found.", 404);
    }
  }

  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      parentId: data.parentId || null,
      targetGroups: data.targetGroups || ["UNISEX"],
    },
  });

  // Clear cached category structures
  await cacheService.del("categories:tree");

  res.status(201).json({
    status: "success",
    data: category,
  });
});

export const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = categorySchema.partial().parse(req.body);

  const categoryExists = await prisma.category.findUnique({
    where: { id },
  });

  if (!categoryExists) {
    throw new AppError("Category not found.", 404);
  }

  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId },
    });
    if (!parent) {
      throw new AppError("Parent category not found.", 404);
    }
  }

  const updatedCategory = await prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      parentId: data.parentId === undefined ? undefined : data.parentId,
      targetGroups: data.targetGroups,
    },
  });

  // Clear cached category structures
  await cacheService.del("categories:tree");

  res.status(200).json({
    status: "success",
    data: updatedCategory,
  });
});

export const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new AppError("Category not found.", 404);

  await prisma.category.delete({ where: { id } });

  // Clear cached category structures
  await cacheService.del("categories:tree");

  res.status(200).json({ status: "success", message: "Category deleted." });
});
