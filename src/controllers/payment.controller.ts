import { Request, Response } from "express";
import prisma from "../config/db";
import paymentService from "../services/payment.service";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

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
