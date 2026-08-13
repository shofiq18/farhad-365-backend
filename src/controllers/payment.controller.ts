import { Request, Response } from "express";
import prisma from "../config/db";
import paymentService from "../services/payment.service";
import sendEmail from "../utils/sendEmail";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const handleGiftCardActivation = async (orderId: string) => {
  try {
    const giftCard = await prisma.giftCard.findUnique({
      where: { orderId }
    });
    if (giftCard) {
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { isActive: true }
      });

      // Digital gift card order is electronically delivered via email upon payment
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "DELIVERED" }
      });

      const emailSubject = `You received a ৳${giftCard.initialBalance.toLocaleString()} Pristto E-Gift Card from ${giftCard.senderName}!`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 30px; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; font-weight: 900; text-align: center;">PRISTTO E-GIFT CARD</h2>
          <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">Hello,</p>
          <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
            <strong>${giftCard.senderName}</strong> has sent you a Pristto E-Gift Card!
          </p>
          
          <div style="background-color: #09090b; color: #ffffff; border-radius: 10px; padding: 25px; margin: 25px 0; text-align: center; border: 1px solid #27272a;">
            <span style="font-size: 12px; color: #10b981; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 10px;">Gift Voucher Code</span>
            <span style="font-size: 24px; font-family: monospace; font-weight: 900; letter-spacing: 3px; display: block; margin-bottom: 15px;">${giftCard.code}</span>
            <span style="font-size: 28px; font-weight: 900; color: #10b981; display: block;">৳${giftCard.initialBalance.toLocaleString()}</span>
          </div>

          ${giftCard.message ? `
          <div style="background-color: #f4f4f5; border-left: 4px solid #09090b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <strong style="font-size: 14px; color: #18181b; display: block; margin-bottom: 5px;">Personal Note:</strong>
            <p style="font-size: 14px; color: #4b5563; margin: 0; font-style: italic;">"${giftCard.message}"</p>
          </div>
          ` : ''}

          <p style="font-size: 14px; color: #71717a; line-height: 1.5; margin-top: 30px;">
            To redeem your gift card, go to checkout when purchasing items on Farhad365 and apply this code.
          </p>
          <p style="font-size: 14px; color: #71717a; line-height: 1.5;">
            * Valid for online purchases and never expires.
          </p>
          <div style="border-top: 1px solid #e4e4e7; margin-top: 30px; padding-top: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
            &copy; ${new Date().getFullYear()} Pristto. All rights reserved.
          </div>
        </div>
      `;

      await sendEmail({
        to: giftCard.recipientEmail,
        subject: emailSubject,
        html: emailHtml
      });
    }
  } catch (err) {
    console.error("Failed to activate gift card:", err);
  }
};

export const sslSuccess = async (req: Request, res: Response) => {
  const { orderId } = req.query;

  if (!orderId) {
    return res.redirect(`${FRONTEND_URL}/checkout?status=fail&reason=no_order_id`);
  }

  try {
    // Update order status to PROCESSING
    await prisma.order.update({
      where: { id: orderId as string },
      data: { status: "PROCESSING" },
    });

    await handleGiftCardActivation(orderId as string);

    // Redirect to frontend checkout success screen
    res.redirect(`${FRONTEND_URL}/checkout?status=success&orderId=${orderId}`);
  } catch (error: any) {
    console.error("SSLCommerz success callback error:", error);
    res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}&reason=${encodeURIComponent(error.message)}`);
  }
};

export const sslFail = async (req: Request, res: Response) => {
  const { orderId } = req.query;

  try {
    if (orderId) {
      // Set status to CANCELLED
      await prisma.order.update({
        where: { id: orderId as string },
        data: { status: "CANCELLED" },
      });
    }
  } catch (err) {
    console.error("Failed to cancel order on payment fail:", err);
  }

  res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}`);
};

export const sslCancel = async (req: Request, res: Response) => {
  const { orderId } = req.query;

  try {
    if (orderId) {
      // Set status to CANCELLED
      await prisma.order.update({
        where: { id: orderId as string },
        data: { status: "CANCELLED" },
      });
    }
  } catch (err) {
    console.error("Failed to cancel order on payment cancel:", err);
  }

  res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}`);
};

export const bkashCallback = async (req: Request, res: Response) => {
  const { orderId, paymentID, status } = req.query;

  if (!orderId) {
    return res.redirect(`${FRONTEND_URL}/checkout?status=fail&reason=no_order_id`);
  }

  if (status === "success" && paymentID) {
    try {
      const executeResponse = await paymentService.executeBKashPayment(paymentID as string);

      if (
        executeResponse.transactionStatus === "Completed" || 
        executeResponse.statusCode === "0000"
      ) {
        // Update order status to PROCESSING
        await prisma.order.update({
          where: { id: orderId as string },
          data: { status: "PROCESSING" },
        });

        await handleGiftCardActivation(orderId as string);

        return res.redirect(`${FRONTEND_URL}/checkout?status=success&orderId=${orderId}`);
      } else {
        console.error("bKash execute failed response:", executeResponse);
        return res.redirect(
          `${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}&reason=${encodeURIComponent(
            executeResponse.statusMessage || "bKash execution failed"
          )}`
        );
      }
    } catch (error: any) {
      console.error("bKash execute error:", error);
      return res.redirect(
        `${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}&reason=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Handle failure/cancel
  try {
    await prisma.order.update({
      where: { id: orderId as string },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    console.error("Failed to cancel order on bKash failure callback:", err);
  }

  res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}`);
};
