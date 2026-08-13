"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGiftCardCode = exports.purchaseGiftCard = void 0;
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const payment_service_1 = __importDefault(require("../services/payment.service"));
// Zod schemas
const purchaseGiftCardSchema = zod_1.z.object({
    amount: zod_1.z.number().positive("Amount must be greater than 0"),
    recipientEmail: zod_1.z.string().email("Invalid email format"),
    senderName: zod_1.z.string().min(1, "Sender name is required"),
    message: zod_1.z.string().optional(),
});
const validateGiftCardSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Gift card code is required"),
});
// Helper to generate a unique gift card code
const generateGiftCardCode = async () => {
    let attempts = 0;
    while (attempts < 10) {
        const randomPart1 = Math.random().toString(36).substring(2, 8).toUpperCase();
        const randomPart2 = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `GC-${randomPart1}-${randomPart2}`;
        const existing = await db_1.default.giftCard.findUnique({ where: { code } });
        if (!existing)
            return code;
        attempts++;
    }
    throw new appError_1.default("Failed to generate unique gift card code.", 500);
};
exports.purchaseGiftCard = (0, catchAsync_1.default)(async (req, res) => {
    if (!req.user) {
        throw new appError_1.default("Authentication required.", 401);
    }
    const data = purchaseGiftCardSchema.parse(req.body);
    const code = await generateGiftCardCode();
    // Create Order and GiftCard within a transaction
    const result = await db_1.default.$transaction(async (tx) => {
        const order = await tx.order.create({
            data: {
                userId: req.user.id,
                items: [
                    {
                        variantId: "000000000000000000000000", // Dummy variant ID for digital gift card
                        sku: "E-GIFT-CARD",
                        title: `Pristto E-Gift Card (৳${data.amount})`,
                        price: data.amount,
                        quantity: 1,
                        size: null,
                        color: null,
                    },
                ],
                totalAmount: data.amount,
                shippingAddress: {
                    street: "Digital Delivery",
                    city: "E-Mail",
                    state: "Dhaka",
                    zipCode: "0000",
                    country: "Bangladesh",
                    phone: req.user.phone || "00000000000",
                },
                paymentMethod: "DIGITAL",
                status: "PENDING",
                couponCode: null,
                discountAmount: 0,
            },
        });
        const giftCard = await tx.giftCard.create({
            data: {
                code,
                initialBalance: data.amount,
                balance: data.amount,
                recipientEmail: data.recipientEmail,
                senderName: data.senderName,
                message: data.message || null,
                isActive: false, // Inactive until paid
                orderId: order.id,
            },
        });
        return { order, giftCard };
    });
    // Initiate bKash payment
    try {
        const bkashRes = await payment_service_1.default.createBKashPayment(result.order.id, data.amount);
        res.status(201).json({
            status: "success",
            data: {
                order: result.order,
                giftCard: result.giftCard,
            },
            paymentUrl: bkashRes.bkashURL,
        });
    }
    catch (error) {
        console.error("Failed to initiate bKash payment for gift card:", error);
        throw new appError_1.default(error.message || "Failed to initiate payment gateway.", 500);
    }
});
exports.validateGiftCardCode = (0, catchAsync_1.default)(async (req, res) => {
    const { code } = validateGiftCardSchema.parse(req.body);
    const cleanCode = code.trim().toUpperCase();
    const giftCard = await db_1.default.giftCard.findUnique({
        where: { code: cleanCode },
    });
    if (!giftCard) {
        throw new appError_1.default("Invalid gift card code.", 404);
    }
    if (!giftCard.isActive) {
        throw new appError_1.default("This gift card is not active.", 400);
    }
    if (giftCard.balance <= 0) {
        throw new appError_1.default("This gift card has no remaining balance.", 400);
    }
    if (giftCard.expiryDate && new Date() > giftCard.expiryDate) {
        throw new appError_1.default("This gift card has expired.", 400);
    }
    res.status(200).json({
        status: "success",
        data: {
            code: giftCard.code,
            balance: giftCard.balance,
        },
    });
});
