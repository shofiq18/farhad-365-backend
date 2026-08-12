import prisma from "../config/db";
import AppError from "../utils/appError";

export const couponService = {
  /**
   * Validates a coupon code against database conditions (isActive, expiry, minSpend)
   * and calculates the discount amount strictly on eligible (non-sale) items.
   */
  async validateAndCalculateDiscount(
    couponCode: string | undefined,
    subtotal: number,
    eligibleSubtotal: number
  ): Promise<{ discountAmount: number; discountValue: number; type: string }> {
    if (!couponCode || couponCode.trim() === "") {
      return { discountAmount: 0, discountValue: 0, type: "PERCENTAGE" };
    }

    const discount = await prisma.discount.findUnique({
      where: { code: couponCode.trim() },
    });

    if (!discount) {
      throw new AppError("Invalid coupon code.", 400);
    }

    if (!discount.isActive) {
      throw new AppError("This coupon code is no longer active.", 400);
    }

    if (discount.expiryDate && new Date() > discount.expiryDate) {
      throw new AppError("This coupon code has expired.", 400);
    }

    if (subtotal < discount.minSpend) {
      throw new AppError(
        `Minimum spend of ৳${discount.minSpend.toLocaleString()} is required to apply this coupon.`,
        400
      );
    }

    if (eligibleSubtotal <= 0) {
      throw new AppError(
        "This coupon can only be applied to full-priced (non-sale) items.",
        400
      );
    }

    let calculatedDiscount = 0;
    if (discount.type === "PERCENTAGE") {
      calculatedDiscount = eligibleSubtotal * (discount.discountValue / 100);
    } else {
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

export default couponService;
