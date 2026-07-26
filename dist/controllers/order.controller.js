"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOrders = exports.updateOrderStatus = exports.getOrderById = exports.getMyOrders = exports.createOrder = void 0;
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const coupon_service_1 = __importDefault(require("../services/coupon.service"));
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
    couponCode: zod_1.z.string().optional(),
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
        const discount = await coupon_service_1.default.validateAndCalculateDiscount(data.couponCode, subtotal);
        const finalAmount = Math.max(0, subtotal - discount);
        // Persist final order details
        return tx.order.create({
            data: {
                userId: req.user.id,
                items: orderItemsPayload,
                totalAmount: finalAmount,
                shippingAddress: data.shippingAddress,
                paymentMethod: data.paymentMethod || "COD",
                status: "PENDING",
            },
        });
    });
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
    res.status(200).json({
        status: "success",
        results: orders.length,
        data: orders,
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
        },
    });
    if (!order) {
        throw new appError_1.default("Order not found.", 404);
    }
    // Access validation: ADMIN and MANAGER can inspect any order. USERs are limited to their own orders.
    if (req.user.role === "USER" && order.userId !== req.user.id) {
        throw new appError_1.default("You do not have permission to view this order.", 403);
    }
    res.status(200).json({
        status: "success",
        data: order,
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
            }
        }
    });
    res.status(200).json({
        status: "success",
        results: orders.length,
        data: orders,
    });
});
