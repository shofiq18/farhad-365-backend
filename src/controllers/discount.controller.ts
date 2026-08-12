import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import couponService from "../services/coupon.service";

// Zod validation schemas
const createDiscountSchema = z.object({
  code: z.string().min(1, "Code is required").transform(val => val.trim().toUpperCase()),
  discountValue: z.number().positive("Value must be greater than 0"),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  isActive: z.boolean().optional().default(true),
  minSpend: z.number().nonnegative().optional().default(0),
  expiryDate: z.string().datetime().nullable().optional().transform(val => val ? new Date(val) : null),
});

const updateDiscountSchema = createDiscountSchema.partial();

const validateDiscountSchema = z.object({
  code: z.string().min(1, "Code is required"),
  items: z.array(
    z.object({
      variantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Variant ID"),
      quantity: z.number().int().positive(),
    })
  ).min(1, "Cart must contain at least one item"),
});

export const getAllDiscounts = catchAsync(async (req: Request, res: Response) => {
  const discounts = await prisma.discount.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    status: "success",
    results: discounts.length,
    data: discounts,
  });
});

export const createDiscount = catchAsync(async (req: Request, res: Response) => {
  const data = createDiscountSchema.parse(req.body);

  const existing = await prisma.discount.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    throw new AppError("A discount code with this name already exists.", 400);
  }

  const discount = await prisma.discount.create({
    data,
  });

  res.status(201).json({
    status: "success",
    data: discount,
  });
});

export const updateDiscount = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateDiscountSchema.parse(req.body);

  const existingDiscount = await prisma.discount.findUnique({
    where: { id },
  });

  if (!existingDiscount) {
    throw new AppError("Discount code not found.", 404);
  }

  if (data.code && data.code !== existingDiscount.code) {
    const codeConflict = await prisma.discount.findUnique({
      where: { code: data.code },
    });
    if (codeConflict) {
      throw new AppError("A discount code with this name already exists.", 400);
    }
  }

  const updated = await prisma.discount.update({
    where: { id },
    data,
  });

  res.status(200).json({
    status: "success",
    data: updated,
  });
});

export const deleteDiscount = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const discount = await prisma.discount.findUnique({
    where: { id },
  });

  if (!discount) {
    throw new AppError("Discount code not found.", 404);
  }

  await prisma.discount.delete({
    where: { id },
  });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

export const getActiveDiscount = catchAsync(async (req: Request, res: Response) => {
  const now = new Date();

  // Find the latest active discount that hasn't expired and matches general rules
  const discount = await prisma.discount.findFirst({
    where: {
      isActive: true,
      OR: [
        { expiryDate: null },
        { expiryDate: { gt: now } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    status: "success",
    data: discount,
  });
});

export const validateDiscountCode = catchAsync(async (req: Request, res: Response) => {
  const { code, items } = validateDiscountSchema.parse(req.body);

  let subtotal = 0;
  let eligibleSubtotal = 0;

  for (const item of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: true },
    });

    if (!variant) {
      throw new AppError(`Variant with ID ${item.variantId} not found.`, 404);
    }

    const basePrice = variant.price !== null ? variant.price : variant.product.price;
    const discountedPrice = basePrice * (1 - variant.product.discount / 100);
    const itemTotal = discountedPrice * item.quantity;

    subtotal += itemTotal;

    // Item is eligible only if it is NOT already discounted (product.discount === 0)
    if (variant.product.discount === 0) {
      eligibleSubtotal += itemTotal;
    }
  }

  const result = await couponService.validateAndCalculateDiscount(code, subtotal, eligibleSubtotal);

  res.status(200).json({
    status: "success",
    data: {
      code: code.trim().toUpperCase(),
      discountAmount: result.discountAmount,
      discountValue: result.discountValue,
      type: result.type,
      subtotal,
      eligibleSubtotal,
      finalAmount: Math.max(0, subtotal - result.discountAmount),
    },
  });
});
