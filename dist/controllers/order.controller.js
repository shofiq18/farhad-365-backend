"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reInitiatePayment = exports.getAllOrders = exports.updateOrderStatus = exports.getOrderById = exports.getMyOrders = exports.createOrder = void 0;
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const coupon_service_1 = __importDefault(require("../services/coupon.service"));
const payment_service_1 = __importDefault(require("../services/payment.service"));
const orderItemSchema = zod_1.z.object({
    variantId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Variant ID format"),
    quantity: zod_1.z.number().int().positive("Quantity must be greater than 0"),
});
const shippingAddressSchema = zod_1.z.object({
    street: zod_1.z.string().min(2, "Street must be specified"),
    city: zod_1.z.string().min(2, "City must be specified"),
    state: zod_1.z.string().min(2, "State must be specified"),
    zipCode: zod_1.z.string().min(2, "Zip code must be specified"),
    country: zod_1.z.string().min(2, "Country must be specified"),
    phone: zod_1.z.string().min(6, "Valid contact phone number is required"),
});
const checkoutSchema = zod_1.z.object({
    items: zod_1.z.array(orderItemSchema).min(1, "Order must contain at least one item"),
    shippingAddress: shippingAddressSchema,
    paymentMethod: zod_1.z.enum(["COD", "DIGITAL"]).optional(),
    paymentGateway: zod_1.z.enum(["SSLCOMMERZ", "BKASH"]).optional(),
    couponCode: zod_1.z.string().optional(),
    giftCardCode: zod_1.z.string().optional(),
});
const orderStatusUpdateSchema = zod_1.z.object({
    status: zod_1.z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});
exports.createOrder = (0, catchAsync_1.default)(async (req, res) => {
    if (!req.user) {
        throw new appError_1.default("Authentication required.", 401);
    }
    const data = checkoutSchema.parse(req.body);
    // Execute checkout validation and inventory deduction inside a Prisma transaction
    const newOrder = await db_1.default.$transaction(async (tx) => {
        let subtotal = 0;
        let eligibleSubtotal = 0;
        const orderItemsPayload = [];
        for (const item of data.items) {
            // Fetch variant and parent product details
            const variant = await tx.productVariant.findUnique({
                where: { id: item.variantId },
                include: { product: true },
            });
            if (!variant) {
                throw new appError_1.default(`Variant ID ${item.variantId} not found.`, 404);
            }
            // Check stock level
            if (variant.stock < item.quantity) {
                throw new appError_1.default(`Insufficient stock for ${variant.product.title} (SKU: ${variant.sku}). Available: ${variant.stock}, Requested: ${item.quantity}`, 400);
            }
            // Calculate unit price (use variant price override if available, else base product price)
            const basePrice = variant.price !== null ? variant.price : variant.product.price;
            const discountedPrice = basePrice * (1 - variant.product.discount / 100);
            const itemTotal = discountedPrice * item.quantity;
            subtotal += itemTotal;
            // Only items that do not have already existing discounts are eligible for coupon discount
            if (variant.product.discount === 0) {
                eligibleSubtotal += itemTotal;
            }
            // Decrement variant stock
            await tx.productVariant.update({
                where: { id: variant.id },
                data: { stock: { decrement: item.quantity } },
            });
            // Assemble embedded OrderItem document payload
            orderItemsPayload.push({
                variantId: variant.id,
                sku: variant.sku,
                title: variant.product.title,
                size: variant.size,
                color: variant.color,
                price: discountedPrice,
                quantity: item.quantity,
            });
        }
        // Call expandable coupon validation service
        const couponResult = await coupon_service_1.default.validateAndCalculateDiscount(data.couponCode, subtotal, eligibleSubtotal);
        const shippingFee = data.shippingAddress.state.toLowerCase() === "dhaka" ? 80.0 : 120.0;
        let finalAmount = Math.max(0, subtotal - couponResult.discountAmount) + shippingFee;
        let appliedGiftCardCode = null;
        let appliedGiftCardAmount = 0;
        if (data.giftCardCode && data.giftCardCode.trim() !== "") {
            const giftCard = await tx.giftCard.findUnique({
                where: { code: data.giftCardCode.trim().toUpperCase() }
            });
            if (!giftCard) {
                throw new appError_1.default("Invalid gift card code.", 400);
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
            appliedGiftCardAmount = Math.min(giftCard.balance, finalAmount);
            finalAmount = Math.max(0, finalAmount - appliedGiftCardAmount);
            appliedGiftCardCode = giftCard.code;
            await tx.giftCard.update({
                where: { id: giftCard.id },
                data: { balance: { decrement: appliedGiftCardAmount } }
            });
        }
        // Persist final order details
        return tx.order.create({
            data: {
                userId: req.user.id,
                items: orderItemsPayload,
                totalAmount: finalAmount,
                shippingAddress: data.shippingAddress,
                paymentMethod: data.paymentMethod || "COD",
                status: finalAmount === 0 ? "PROCESSING" : "PENDING",
                couponCode: data.couponCode || null,
                discountAmount: couponResult.discountAmount,
                giftCardCode: appliedGiftCardCode,
                giftCardAmount: appliedGiftCardAmount,
            },
        });
    });
    // Handle Payment Gateway Initiation if paymentMethod is DIGITAL
    if (newOrder.paymentMethod === "DIGITAL" && newOrder.totalAmount > 0) {
        try {
            const gateway = data.paymentGateway || "SSLCOMMERZ";
            let paymentUrl = "";
            if (gateway === "SSLCOMMERZ") {
                paymentUrl = await payment_service_1.default.initiateSSLCommerzPayment(newOrder.id, newOrder.totalAmount, {
                    name: req.user.name || "Customer",
                    email: req.user.email || "customer@example.com",
                    phone: newOrder.shippingAddress.phone,
                    street: newOrder.shippingAddress.street,
                    city: newOrder.shippingAddress.city,
                    state: newOrder.shippingAddress.state,
                    zipCode: newOrder.shippingAddress.zipCode,
                });
            }
            else if (gateway === "BKASH") {
                const bkashRes = await payment_service_1.default.createBKashPayment(newOrder.id, newOrder.totalAmount);
                paymentUrl = bkashRes.bkashURL;
            }
            return res.status(201).json({
                status: "success",
                data: newOrder,
                paymentUrl,
            });
        }
        catch (err) {
            // Return order but indicate payment initiation failure
            return res.status(201).json({
                status: "success",
                data: newOrder,
                paymentError: err.message || "Failed to initiate payment gateway",
            });
        }
    }
    res.status(201).json({
        status: "success",
        data: newOrder,
    });
});
exports.getMyOrders = (0, catchAsync_1.default)(async (req, res) => {
    if (!req.user) {
        throw new appError_1.default("Authentication required.", 401);
    }
    const orders = await db_1.default.order.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
    });
    const allVariantIds = Array.from(new Set(orders.flatMap((order) => order.items.map((item) => item.variantId))));
    const variants = await db_1.default.productVariant.findMany({
        where: { id: { in: allVariantIds } },
        select: { id: true, productId: true },
    });
    const variantToProductMap = new Map(variants.map((v) => [v.id, v.productId]));
    const appliedGiftCardCodes = Array.from(new Set(orders.map((o) => o.giftCardCode).filter(Boolean)));
    const appliedGiftCards = await db_1.default.giftCard.findMany({
        where: { code: { in: appliedGiftCardCodes } },
    });
    const appliedGiftCardMap = new Map(appliedGiftCards.map((gc) => [gc.code, gc]));
    const ordersWithProductId = orders.map((order) => ({
        ...order,
        appliedGiftCardDetails: order.giftCardCode ? appliedGiftCardMap.get(order.giftCardCode) || null : null,
        items: order.items.map((item) => ({
            ...item,
            productId: variantToProductMap.get(item.variantId) || null,
        })),
    }));
    res.status(200).json({
        status: "success",
        results: orders.length,
        data: ordersWithProductId,
    });
});
exports.getOrderById = (0, catchAsync_1.default)(async (req, res) => {
    if (!req.user) {
        throw new appError_1.default("Authentication required.", 401);
    }
    const { id } = req.params;
    const order = await db_1.default.order.findUnique({
        where: { id },
        include: {
            user: {
                select: { id: true, name: true, email: true, role: true },
            },
            giftCard: true,
        },
    });
    if (!order) {
        throw new appError_1.default("Order not found.", 404);
    }
    // Access validation: ADMIN and MANAGER can inspect any order. USERs are limited to their own orders.
    if (req.user.role === "USER" && order.userId !== req.user.id) {
        throw new appError_1.default("You do not have permission to view this order.", 403);
    }
    const variantIds = order.items.map((item) => item.variantId);
    const variants = await db_1.default.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true },
    });
    const variantToProductMap = new Map(variants.map((v) => [v.id, v.productId]));
    let appliedGiftCardDetails = null;
    if (order.giftCardCode) {
        appliedGiftCardDetails = await db_1.default.giftCard.findUnique({
            where: { code: order.giftCardCode },
        });
    }
    const orderWithProductId = {
        ...order,
        appliedGiftCardDetails,
        items: order.items.map((item) => ({
            ...item,
            productId: variantToProductMap.get(item.variantId) || null,
        })),
    };
    res.status(200).json({
        status: "success",
        data: orderWithProductId,
    });
});
exports.updateOrderStatus = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const { status } = orderStatusUpdateSchema.parse(req.body);
    const order = await db_1.default.order.findUnique({
        where: { id },
    });
    if (!order) {
        throw new appError_1.default("Order not found.", 404);
    }
    const updatedOrder = await db_1.default.order.update({
        where: { id },
        data: { status },
    });
    res.status(200).json({
        status: "success",
        data: updatedOrder,
    });
});
exports.getAllOrders = (0, catchAsync_1.default)(async (req, res) => {
    const orders = await db_1.default.order.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            user: {
                select: { id: true, name: true, email: true }
            },
            giftCard: true,
        }
    });
    const appliedGiftCardCodes = Array.from(new Set(orders.map((o) => o.giftCardCode).filter(Boolean)));
    const appliedGiftCards = await db_1.default.giftCard.findMany({
        where: { code: { in: appliedGiftCardCodes } },
    });
    const appliedGiftCardMap = new Map(appliedGiftCards.map((gc) => [gc.code, gc]));
    const ordersWithGiftCards = orders.map((order) => ({
        ...order,
        appliedGiftCardDetails: order.giftCardCode ? appliedGiftCardMap.get(order.giftCardCode) || null : null,
    }));
    res.status(200).json({
        status: "success",
        results: orders.length,
        data: ordersWithGiftCards,
    });
});
exports.reInitiatePayment = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const { paymentGateway } = req.body; // "SSLCOMMERZ" | "BKASH"
    const order = await db_1.default.order.findUnique({
        where: { id },
        include: { user: true },
    });
    if (!order) {
        throw new appError_1.default("Order not found.", 404);
    }
    if (order.userId !== req.user.id) {
        throw new appError_1.default("You are not authorized to pay for this order.", 403);
    }
    // Only allow payment for PENDING or CANCELLED orders
    if (order.status !== "PENDING" && order.status !== "CANCELLED") {
        throw new appError_1.default("Only pending or cancelled orders can be paid.", 400);
    }
    const gateway = paymentGateway || "SSLCOMMERZ";
    let paymentUrl = "";
    // Reset status to PENDING when starting payment process
    await db_1.default.order.update({
        where: { id },
        data: { status: "PENDING" },
    });
    if (gateway === "SSLCOMMERZ") {
        paymentUrl = await payment_service_1.default.initiateSSLCommerzPayment(order.id, order.totalAmount, {
            name: order.user.name || "Customer",
            email: order.user.email || "customer@example.com",
            phone: order.shippingAddress.phone,
            street: order.shippingAddress.street,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            zipCode: order.shippingAddress.zipCode,
        });
    }
    else if (gateway === "BKASH") {
        const bkashRes = await payment_service_1.default.createBKashPayment(order.id, order.totalAmount);
        paymentUrl = bkashRes.bkashURL;
    }
    res.status(200).json({
        status: "success",
        paymentUrl,
    });
});
