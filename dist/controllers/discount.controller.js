"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDiscountCode = exports.getActiveDiscount = exports.deleteDiscount = exports.updateDiscount = exports.createDiscount = exports.getAllDiscounts = void 0;
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const coupon_service_1 = __importDefault(require("../services/coupon.service"));
// Zod validation schemas
const createDiscountSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Code is required").transform(val => val.trim().toUpperCase()),
    discountValue: zod_1.z.number().positive("Value must be greater than 0"),
    type: zod_1.z.enum(["PERCENTAGE", "FIXED"]),
    isActive: zod_1.z.boolean().optional().default(true),
    minSpend: zod_1.z.number().nonnegative().optional().default(0),
    expiryDate: zod_1.z.string().datetime().nullable().optional().transform(val => val ? new Date(val) : null),
});
const updateDiscountSchema = createDiscountSchema.partial();
const validateDiscountSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Code is required"),
    items: zod_1.z.array(zod_1.z.object({
        variantId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Variant ID"),
        quantity: zod_1.z.number().int().positive(),
    })).min(1, "Cart must contain at least one item"),
});
exports.getAllDiscounts = (0, catchAsync_1.default)(async (req, res) => {
    const discounts = await db_1.default.discount.findMany({
        orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
        status: "success",
        results: discounts.length,
        data: discounts,
    });
});
exports.createDiscount = (0, catchAsync_1.default)(async (req, res) => {
    const data = createDiscountSchema.parse(req.body);
    const existing = await db_1.default.discount.findUnique({
        where: { code: data.code },
    });
    if (existing) {
        throw new appError_1.default("A discount code with this name already exists.", 400);
    }
    const discount = await db_1.default.discount.create({
        data,
    });
    res.status(201).json({
        status: "success",
        data: discount,
    });
});
exports.updateDiscount = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const data = updateDiscountSchema.parse(req.body);
    const existingDiscount = await db_1.default.discount.findUnique({
        where: { id },
    });
    if (!existingDiscount) {
        throw new appError_1.default("Discount code not found.", 404);
    }
    if (data.code && data.code !== existingDiscount.code) {
        const codeConflict = await db_1.default.discount.findUnique({
            where: { code: data.code },
        });
        if (codeConflict) {
            throw new appError_1.default("A discount code with this name already exists.", 400);
        }
    }
    const updated = await db_1.default.discount.update({
        where: { id },
        data,
    });
    res.status(200).json({
        status: "success",
        data: updated,
    });
});
exports.deleteDiscount = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const discount = await db_1.default.discount.findUnique({
        where: { id },
    });
    if (!discount) {
        throw new appError_1.default("Discount code not found.", 404);
    }
    await db_1.default.discount.delete({
        where: { id },
    });
    res.status(204).json({
        status: "success",
        data: null,
    });
});
exports.getActiveDiscount = (0, catchAsync_1.default)(async (req, res) => {
    const now = new Date();
    // Find the latest active discount that hasn't expired and matches general rules
    const discount = await db_1.default.discount.findFirst({
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
exports.validateDiscountCode = (0, catchAsync_1.default)(async (req, res) => {
    const { code, items } = validateDiscountSchema.parse(req.body);
    let subtotal = 0;
    let eligibleSubtotal = 0;
    for (const item of items) {
        const variant = await db_1.default.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true },
        });
        if (!variant) {
            throw new appError_1.default(`Variant with ID ${item.variantId} not found.`, 404);
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
    const result = await coupon_service_1.default.validateAndCalculateDiscount(code, subtotal, eligibleSubtotal);
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
