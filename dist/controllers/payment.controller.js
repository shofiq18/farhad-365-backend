"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bkashCallback = exports.sslCancel = exports.sslFail = exports.sslSuccess = void 0;
const db_1 = __importDefault(require("../config/db"));
const payment_service_1 = __importDefault(require("../services/payment.service"));
const sendEmail_1 = __importDefault(require("../utils/sendEmail"));
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const handleGiftCardActivation = async (orderId) => {
    try {
        const giftCard = await db_1.default.giftCard.findUnique({
            where: { orderId }
        });
        if (giftCard) {
            await db_1.default.giftCard.update({
                where: { id: giftCard.id },
                data: { isActive: true }
            });
            // Digital gift card order is electronically delivered via email upon payment
            await db_1.default.order.update({
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
            await (0, sendEmail_1.default)({
                to: giftCard.recipientEmail,
                subject: emailSubject,
                html: emailHtml
            });
        }
    }
    catch (err) {
        console.error("Failed to activate gift card:", err);
    }
};
const sslSuccess = async (req, res) => {
    const { orderId } = req.query;
    if (!orderId) {
        return res.redirect(`${FRONTEND_URL}/checkout?status=fail&reason=no_order_id`);
    }
    try {
        // Update order status to PROCESSING
        await db_1.default.order.update({
            where: { id: orderId },
            data: { status: "PROCESSING" },
        });
        await handleGiftCardActivation(orderId);
        // Redirect to frontend checkout success screen
        res.redirect(`${FRONTEND_URL}/checkout?status=success&orderId=${orderId}`);
    }
    catch (error) {
        console.error("SSLCommerz success callback error:", error);
        res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}&reason=${encodeURIComponent(error.message)}`);
    }
};
exports.sslSuccess = sslSuccess;
const sslFail = async (req, res) => {
    const { orderId } = req.query;
    try {
        if (orderId) {
            // Set status to CANCELLED
            await db_1.default.order.update({
                where: { id: orderId },
                data: { status: "CANCELLED" },
            });
        }
    }
    catch (err) {
        console.error("Failed to cancel order on payment fail:", err);
    }
    res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}`);
};
exports.sslFail = sslFail;
const sslCancel = async (req, res) => {
    const { orderId } = req.query;
    try {
        if (orderId) {
            // Set status to CANCELLED
            await db_1.default.order.update({
                where: { id: orderId },
                data: { status: "CANCELLED" },
            });
        }
    }
    catch (err) {
        console.error("Failed to cancel order on payment cancel:", err);
    }
    res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}`);
};
exports.sslCancel = sslCancel;
const bkashCallback = async (req, res) => {
    const { orderId, paymentID, status } = req.query;
    if (!orderId) {
        return res.redirect(`${FRONTEND_URL}/checkout?status=fail&reason=no_order_id`);
    }
    if (status === "success" && paymentID) {
        try {
            const executeResponse = await payment_service_1.default.executeBKashPayment(paymentID);
            if (executeResponse.transactionStatus === "Completed" ||
                executeResponse.statusCode === "0000") {
                // Update order status to PROCESSING
                await db_1.default.order.update({
                    where: { id: orderId },
                    data: { status: "PROCESSING" },
                });
                await handleGiftCardActivation(orderId);
                return res.redirect(`${FRONTEND_URL}/checkout?status=success&orderId=${orderId}`);
            }
            else {
                console.error("bKash execute failed response:", executeResponse);
                return res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}&reason=${encodeURIComponent(executeResponse.statusMessage || "bKash execution failed")}`);
            }
        }
        catch (error) {
            console.error("bKash execute error:", error);
            return res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}&reason=${encodeURIComponent(error.message)}`);
        }
    }
    // Handle failure/cancel
    try {
        await db_1.default.order.update({
            where: { id: orderId },
            data: { status: "CANCELLED" },
        });
    }
    catch (err) {
        console.error("Failed to cancel order on bKash failure callback:", err);
    }
    res.redirect(`${FRONTEND_URL}/checkout?status=fail&orderId=${orderId}`);
};
exports.bkashCallback = bkashCallback;
