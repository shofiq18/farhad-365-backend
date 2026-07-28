"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductReviews = exports.createReview = void 0;
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
/**
 * Create a new review for a product (Only if purchased and delivered)
 */
exports.createReview = (0, catchAsync_1.default)(async (req, res) => {
    if (!req.user) {
        throw new appError_1.default("Authentication required.", 401);
    }
    const { id: productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || "Customer";
    // Validate rating
    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
        throw new appError_1.default("Rating must be a number between 1 and 5.", 400);
    }
    if (!comment || typeof comment !== "string" || !comment.trim()) {
        throw new appError_1.default("Comment text is required.", 400);
    }
    // Verify product exists
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product) {
        throw new appError_1.default("Product not found.", 404);
    }
    // 1. Verify User has a DELIVERED order for this product
    const orders = await db_1.default.order.findMany({
        where: {
            userId,
            status: "DELIVERED",
        },
        include: {
            user: true,
        },
    });
    // Get all variants for this product
    const variants = await db_1.default.productVariant.findMany({
        where: { productId },
        select: { id: true },
    });
    const variantIds = variants.map((v) => v.id);
    // Check if any order items match the variants of this product
    const hasPurchased = orders.some((order) => order.items.some((item) => variantIds.includes(item.variantId)));
    if (!hasPurchased) {
        throw new appError_1.default("You can only review products that have been delivered to you.", 400);
    }
    // 2. Prevent duplicate reviews by the same user on the same product
    const existingReview = await db_1.default.review.findFirst({
        where: {
            productId,
            userId,
        },
    });
    if (existingReview) {
        throw new appError_1.default("You have already reviewed this product.", 400);
    }
    // 3. Create the review
    const newReview = await db_1.default.review.create({
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
exports.getProductReviews = (0, catchAsync_1.default)(async (req, res) => {
    const { id: productId } = req.params;
    // Verify product exists
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product) {
        throw new appError_1.default("Product not found.", 404);
    }
    // Get reviews
    const reviews = await db_1.default.review.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
    });
    // Calculate aggregates
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
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
