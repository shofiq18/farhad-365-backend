import { Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import couponService from "../services/coupon.service";
import paymentService from "../services/payment.service";

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
  paymentMethod: z.enum(["COD", "DIGITAL", "BKASH"]).optional(),
  paymentGateway: z.enum(["SSLCOMMERZ", "BKASH"]).optional(),
  bkashNumber: z.string().optional(),
  bkashTrxId: z.string().optional(),
  couponCode: z.string().optional(),
  giftCardCode: z.string().optional(),
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
    let eligibleSubtotal = 0;
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
    const couponResult = await couponService.validateAndCalculateDiscount(
      data.couponCode,
      subtotal,
      eligibleSubtotal
    );

    // Fetch site content settings for dynamic shipping & free shipping threshold sync
    const allSettings = await tx.contentSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const settingItem of allSettings) {
      settingsMap[settingItem.key] = settingItem.value;
    }

    const freeShippingThreshold = settingsMap.free_shipping_threshold ? parseFloat(settingsMap.free_shipping_threshold) : 1000;
    const insideDhakaFee = settingsMap.inside_dhaka_shipping ? parseFloat(settingsMap.inside_dhaka_shipping) : 80;
    const outsideDhakaFee = settingsMap.outside_dhaka_shipping ? parseFloat(settingsMap.outside_dhaka_shipping) : 120;

    const isFreeShipping = subtotal >= freeShippingThreshold;
    const isDhaka = data.shippingAddress.state.toLowerCase() === "dhaka" || data.shippingAddress.city.toLowerCase() === "dhaka";
    const shippingFee = isFreeShipping ? 0.0 : (isDhaka ? insideDhakaFee : outsideDhakaFee);

    let finalAmount = Math.max(0, subtotal - couponResult.discountAmount) + shippingFee;

    let appliedGiftCardCode = null;
    let appliedGiftCardAmount = 0;

    if (data.giftCardCode && data.giftCardCode.trim() !== "") {
      const giftCard = await tx.giftCard.findUnique({
        where: { code: data.giftCardCode.trim().toUpperCase() }
      });
      if (!giftCard) {
        throw new AppError("Invalid gift card code.", 400);
      }
      if (!giftCard.isActive) {
        throw new AppError("This gift card is not active.", 400);
      }
      if (giftCard.balance <= 0) {
        throw new AppError("This gift card has no remaining balance.", 400);
      }
      if (giftCard.expiryDate && new Date() > giftCard.expiryDate) {
        throw new AppError("This gift card has expired.", 400);
      }

      appliedGiftCardAmount = Math.min(giftCard.balance, finalAmount);
      finalAmount = Math.max(0, finalAmount - appliedGiftCardAmount);
      appliedGiftCardCode = giftCard.code;

      await tx.giftCard.update({
        where: { id: giftCard.id },
        data: { balance: { decrement: appliedGiftCardAmount } }
      });
    }

    const selectedPaymentMethod = data.paymentMethod || "COD";
    if (selectedPaymentMethod === "BKASH") {
      if (!data.bkashNumber || !data.bkashNumber.trim()) {
        throw new AppError("bKash Sender Phone Number is required for bKash payment.", 400);
      }
      if (!data.bkashTrxId || !data.bkashTrxId.trim()) {
        throw new AppError("bKash Transaction ID (TrxID) is required for bKash payment.", 400);
      }
    }

    // Persist final order details
    return tx.order.create({
      data: {
        userId: req.user!.id,
        items: orderItemsPayload,
        totalAmount: finalAmount,
        shippingAddress: data.shippingAddress,
        paymentMethod: selectedPaymentMethod as any,
        bkashNumber: selectedPaymentMethod === "BKASH" ? (data.bkashNumber?.trim() || null) : null,
        bkashTrxId: selectedPaymentMethod === "BKASH" ? (data.bkashTrxId?.trim() || null) : null,
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
        paymentUrl = await paymentService.initiateSSLCommerzPayment(
          newOrder.id,
          newOrder.totalAmount,
          {
            name: (req.user as any).name || "Customer",
            email: req.user!.email || "customer@example.com",
            phone: newOrder.shippingAddress.phone,
            street: newOrder.shippingAddress.street,
            city: newOrder.shippingAddress.city,
            state: newOrder.shippingAddress.state,
            zipCode: newOrder.shippingAddress.zipCode,
          }
        );
      }
      /*
      // =========================================================================
      // AUTOMATED BKASH PAYMENT GATEWAY (SANDBOX / PRODUCTION API)
      // Currently commented out for manual bKash transfer mode.
      // Uncomment this block and set production credentials in .env when
      // live bKash Merchant account services are activated.
      // =========================================================================
      else if (gateway === "BKASH") {
        const bkashRes = await paymentService.createBKashPayment(newOrder.id, newOrder.totalAmount);
        paymentUrl = bkashRes.bkashURL;
      }
      */

      return res.status(201).json({
        status: "success",
        data: newOrder,
        paymentUrl,
      });
    } catch (err: any) {
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

export const getMyOrders = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  const allVariantIds = Array.from(
    new Set(orders.flatMap((order) => order.items.map((item) => item.variantId)))
  );

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: allVariantIds } },
    select: { id: true, productId: true },
  });
  const variantToProductMap = new Map(variants.map((v) => [v.id, v.productId]));

  const appliedGiftCardCodes = Array.from(
    new Set(orders.map((o) => o.giftCardCode).filter(Boolean) as string[])
  );
  const appliedGiftCards = await prisma.giftCard.findMany({
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
      giftCard: true,
    },
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  // Access validation: ADMIN and MANAGER can inspect any order. USERs are limited to their own orders.
  if (req.user.role === "USER" && order.userId !== req.user.id) {
    throw new AppError("You do not have permission to view this order.", 403);
  }

  const variantIds = order.items.map((item) => item.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, productId: true },
  });
  const variantToProductMap = new Map(variants.map((v) => [v.id, v.productId]));

  let appliedGiftCardDetails = null;
  if (order.giftCardCode) {
    appliedGiftCardDetails = await prisma.giftCard.findUnique({
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
      },
      giftCard: true,
    }
  });

  const appliedGiftCardCodes = Array.from(
    new Set(orders.map((o) => o.giftCardCode).filter(Boolean) as string[])
  );
  const appliedGiftCards = await prisma.giftCard.findMany({
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

export const reInitiatePayment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { paymentGateway } = req.body; // "SSLCOMMERZ" | "BKASH"

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  if (order.userId !== req.user!.id) {
    throw new AppError("You are not authorized to pay for this order.", 403);
  }

  // Only allow payment for PENDING or CANCELLED orders
  if (order.status !== "PENDING" && order.status !== "CANCELLED") {
    throw new AppError("Only pending or cancelled orders can be paid.", 400);
  }

  const gateway = paymentGateway || "SSLCOMMERZ";
  let paymentUrl = "";

  // Reset status to PENDING when starting payment process
  await prisma.order.update({
    where: { id },
    data: { status: "PENDING" },
  });

  if (gateway === "SSLCOMMERZ") {
    paymentUrl = await paymentService.initiateSSLCommerzPayment(
      order.id,
      order.totalAmount,
      {
        name: order.user.name || "Customer",
        email: order.user.email || "customer@example.com",
        phone: order.shippingAddress.phone,
        street: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zipCode: order.shippingAddress.zipCode,
      }
    );
  }
  /*
  // =========================================================================
  // AUTOMATED BKASH PAYMENT RE-INITIATION (SANDBOX / PRODUCTION API)
  // Currently commented out for manual bKash transfer mode.
  // Uncomment when automated bKash merchant gateway is live.
  // =========================================================================
  else if (gateway === "BKASH") {
    const bkashRes = await paymentService.createBKashPayment(order.id, order.totalAmount);
    paymentUrl = bkashRes.bkashURL;
  }
  */

  res.status(200).json({
    status: "success",
    paymentUrl,
  });
});
