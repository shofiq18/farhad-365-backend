import { Response } from "express";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Auto-generate quotation number like QT-10001
async function generateQuotationNo(): Promise<string> {
  const count = await prisma.quotation.count();
  return `QT-${10001 + count}`;
}

// POST /quotations — submit quotation (public)
export const submitQuotation = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { companyName, contactPerson, mobile, email, billingAddress, shippingAddress, items, comment } = req.body;

  if (!companyName || !contactPerson || !mobile || !email || !items?.length) {
    throw new AppError("Required fields: companyName, contactPerson, mobile, email, items.", 400);
  }

  const quotationNo = await generateQuotationNo();

  const quotation = await prisma.quotation.create({
    data: {
      quotationNo,
      companyName,
      contactPerson,
      mobile,
      email,
      billingAddress: billingAddress || "",
      shippingAddress: shippingAddress || "",
      items,
      comment: comment || null,
      status: "Submit",
    },
  });

  res.status(201).json({ status: "success", data: quotation });
});

// GET /quotations — all quotations (Admin/Manager only)
export const getAllQuotations = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const quotations = await prisma.quotation.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({ status: "success", results: quotations.length, data: quotations });
});

// PATCH /quotations/:id/status — approve or cancel (Admin/Manager only)
export const updateQuotationStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["Submit", "Approve", "Cancel"].includes(status)) {
    throw new AppError("Status must be Submit, Approve, or Cancel.", 400);
  }

  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new AppError("Quotation not found.", 404);

  const updated = await prisma.quotation.update({ where: { id }, data: { status } });

  res.status(200).json({ status: "success", data: updated });
});
