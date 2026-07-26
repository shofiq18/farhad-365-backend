import { Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import couponService from "../services/coupon.service";

const orderItemSchema = z.object({
  variantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Variant ID format"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
});

const shippingAddressSchema = z.object({
  street: z.string().min(2, "Street must be specified"),
  city: z.string().min(2, "City must be specified"),
  state: z.string().min(2, "State must be specified"),
  zipCode: z.string().min(2, "Zip code must be specified"),
  country: z.string().min(2, "Country must be specified"),
  phone: z.string().min(6, "Valid contact phone number is required"),
});

const checkoutSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Order must contain at least one item"),
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(["COD", "DIGITAL"]).optional(),
  couponCode: z.string().optional(),
});

const orderStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export const createOrder = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const data = checkoutSchema.parse(req.body);

  // Execute checkout validation and inventory deduction inside a Prisma transaction
  const newOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let subtotal = 0;
    const orderItemsPayload = [];

    for (const item of data.items) {
      // Fetch variant and parent product details
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });

      if (!variant) {
        throw new AppError(`Variant ID ${item.variantId} not found.`, 404);
      }

      // Check stock level
      if (variant.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${variant.product.title} (SKU: ${variant.sku}). Available: ${variant.stock}, Requested: ${item.quantity}`,
          400
        );
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
    const discount = await couponService.validateAndCalculateDiscount(data.couponCode, subtotal);
    const finalAmount = Math.max(0, subtotal - discount);

    // Persist final order details
    return tx.order.create({
      data: {
        userId: req.user!.id,
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

export const getMyOrders = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

export const getOrderById = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  // Access validation: ADMIN and MANAGER can inspect any order. USERs are limited to their own orders.
  if (req.user.role === "USER" && order.userId !== req.user.id) {
    throw new AppError("You do not have permission to view this order.", 403);
  }

  res.status(200).json({
    status: "success",
    data: order,
  });
});

export const updateOrderStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = orderStatusUpdateSchema.parse(req.body);

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { status },
  });

  res.status(200).json({
    status: "success",
    data: updatedOrder,
  });
});

export const getAllOrders = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const orders = await prisma.order.findMany({
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
