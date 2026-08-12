"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQuotationStatus = exports.getAllQuotations = exports.submitQuotation = void 0;
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
// Auto-generate quotation number like QT-10001
async function generateQuotationNo() {
    const count = await db_1.default.quotation.count();
    return `QT-${10001 + count}`;
}
// POST /quotations — submit quotation (public)
exports.submitQuotation = (0, catchAsync_1.default)(async (req, res) => {
    const { companyName, contactPerson, mobile, email, billingAddress, shippingAddress, items, comment } = req.body;
    if (!companyName || !contactPerson || !mobile || !email || !items?.length) {
        throw new appError_1.default("Required fields: companyName, contactPerson, mobile, email, items.", 400);
    }
    const quotationNo = await generateQuotationNo();
    const quotation = await db_1.default.quotation.create({
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
exports.getAllQuotations = (0, catchAsync_1.default)(async (_req, res) => {
    const quotations = await db_1.default.quotation.findMany({
        orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ status: "success", results: quotations.length, data: quotations });
});
// PATCH /quotations/:id/status — approve or cancel (Admin/Manager only)
exports.updateQuotationStatus = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!["Submit", "Approve", "Cancel"].includes(status)) {
        throw new appError_1.default("Status must be Submit, Approve, or Cancel.", 400);
    }
    const quotation = await db_1.default.quotation.findUnique({ where: { id } });
    if (!quotation)
        throw new appError_1.default("Quotation not found.", 404);
    const updated = await db_1.default.quotation.update({ where: { id }, data: { status } });
    res.status(200).json({ status: "success", data: updated });
});
