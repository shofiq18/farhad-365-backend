import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import paymentService from "../services/payment.service";

// Zod schemas
const purchaseGiftCardSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  recipientEmail: z.string().email("Invalid email format"),
  senderName: z.string().min(1, "Sender name is required"),
  message: z.string().optional(),
});

const validateGiftCardSchema = z.object({
  code: z.string().min(1, "Gift card code is required"),
});

// Helper to generate a unique gift card code
const generateGiftCardCode = async (): Promise<string> => {
  let attempts = 0;
  while (attempts < 10) {
    const randomPart1 = Math.random().toString(36).substring(2, 8).toUpperCase();
    const randomPart2 = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `GC-${randomPart1}-${randomPart2}`;
    
    const existing = await prisma.giftCard.findUnique({ where: { code } });
    if (!existing) return code;
    attempts++;
  }
  throw new AppError("Failed to generate unique gift card code.", 500);
};

export const purchaseGiftCard = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const data = purchaseGiftCardSchema.parse(req.body);
  const code = await generateGiftCardCode();

  // Create Order and GiftCard within a transaction
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: req.user!.id,
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
          phone: req.user!.phone || "00000000000",
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
    const bkashRes = await paymentService.createBKashPayment(result.order.id, data.amount);
    res.status(201).json({
      status: "success",
      data: {
        order: result.order,
        giftCard: result.giftCard,
      },
      paymentUrl: bkashRes.bkashURL,
    });
  } catch (error: any) {
    console.error("Failed to initiate bKash payment for gift card:", error);
    throw new AppError(error.message || "Failed to initiate payment gateway.", 500);
  }
});

export const validateGiftCardCode = catchAsync(async (req: Request, res: Response) => {
  const { code } = validateGiftCardSchema.parse(req.body);
  const cleanCode = code.trim().toUpperCase();

  const giftCard = await prisma.giftCard.findUnique({
    where: { code: cleanCode },
  });

  if (!giftCard) {
    throw new AppError("Invalid gift card code.", 404);
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

  res.status(200).json({
    status: "success",
    data: {
      code: giftCard.code,
      balance: giftCard.balance,
    },
  });
});
