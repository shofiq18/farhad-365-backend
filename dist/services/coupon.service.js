"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponService = void 0;
const db_1 = __importDefault(require("../config/db"));
const appError_1 = __importDefault(require("../utils/appError"));
exports.couponService = {
    /**
     * Validates a coupon code against database conditions (isActive, expiry, minSpend)
     * and calculates the discount amount strictly on eligible (non-sale) items.
     */
    async validateAndCalculateDiscount(couponCode, subtotal, eligibleSubtotal) {
        if (!couponCode || couponCode.trim() === "") {
            return { discountAmount: 0, discountValue: 0, type: "PERCENTAGE" };
        }
        const discount = await db_1.default.discount.findUnique({
            where: { code: couponCode.trim() },
        });
        if (!discount) {
            throw new appError_1.default("Invalid coupon code.", 400);
        }
        if (!discount.isActive) {
            throw new appError_1.default("This coupon code is no longer active.", 400);
        }
        if (discount.expiryDate && new Date() > discount.expiryDate) {
            throw new appError_1.default("This coupon code has expired.", 400);
        }
        if (subtotal < discount.minSpend) {
            throw new appError_1.default(`Minimum spend of ৳${discount.minSpend.toLocaleString()} is required to apply this coupon.`, 400);
        }
        if (eligibleSubtotal <= 0) {
            throw new appError_1.default("This coupon can only be applied to full-priced (non-sale) items.", 400);
        }
        let calculatedDiscount = 0;
        if (discount.type === "PERCENTAGE") {
            calculatedDiscount = eligibleSubtotal * (discount.discountValue / 100);
        }
        else {
            calculatedDiscount = Math.min(discount.discountValue, eligibleSubtotal);
        }
        // Round to 2 decimal places
        calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;
        return {
            discountAmount: calculatedDiscount,
            discountValue: discount.discountValue,
            type: discount.type,
        };
    },
};
exports.default = exports.couponService;
