"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bkashCallback = exports.sslCancel = exports.sslFail = exports.sslSuccess = void 0;
const db_1 = __importDefault(require("../config/db"));
const payment_service_1 = __importDefault(require("../services/payment.service"));
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
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
