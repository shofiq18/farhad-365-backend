import { Response } from "express";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Create a new review for a product (Only if purchased and delivered)
 */
export const createReview = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const { id: productId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user.id;
  const userName = (req.user as any).name || "Customer";

  // Validate rating
  const numericRating = Number(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new AppError("Rating must be a number between 1 and 5.", 400);
  }

  if (!comment || typeof comment !== "string" || !comment.trim()) {
    throw new AppError("Comment text is required.", 400);
  }

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  // 1. Verify User has a DELIVERED order for this product
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: "DELIVERED",
    },
    include: {
      user: true,
    },
  });

  // Get all variants for this product
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    select: { id: true },
  });
  const variantIds = variants.map((v) => v.id);

  // Check if any order items match the variants of this product
  const hasPurchased = orders.some((order) =>
    order.items.some((item) => variantIds.includes(item.variantId))
  );

  if (!hasPurchased) {
    throw new AppError("You can only review products that have been delivered to you.", 400);
  }

  // 2. Prevent duplicate reviews by the same user on the same product
  const existingReview = await prisma.review.findFirst({
    where: {
      productId,
      userId,
    },
  });

  if (existingReview) {
    throw new AppError("You have already reviewed this product.", 400);
  }

  // 3. Create the review
  const newReview = await prisma.review.create({
    data: {
      productId,
      userId,
      userName,
      rating: numericRating,
      comment: comment.trim(),
    },
  });

  res.status(201).json({
    status: "success",
    message: "Review submitted successfully.",
    data: newReview,
  });
});

/**
 * Get all reviews and aggregates for a product
 */
export const getProductReviews = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id: productId } = req.params;

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  // Get reviews
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });

  // Calculate aggregates
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
      : 0;

  res.status(200).json({
    status: "success",
    data: {
      reviews,
      meta: {
        totalReviews,
        averageRating,
      },
    },
  });
});
