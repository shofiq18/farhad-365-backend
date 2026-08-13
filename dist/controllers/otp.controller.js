"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendOtp = exports.verifyOtp = void 0;
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const sendEmail_1 = __importDefault(require("../utils/sendEmail"));
const emailTemplates_1 = require("../utils/emailTemplates");
exports.verifyOtp = (0, catchAsync_1.default)(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        throw new appError_1.default("Email and OTP are required.", 400);
    }
    const user = await db_1.default.user.findFirst({
        where: {
            email,
            otp,
            otpExpiresAt: { gt: new Date() },
        },
    });
    if (!user) {
        throw new appError_1.default("Invalid or expired OTP code.", 400);
    }
    // Check if they are resetting password (resetToken exists and is valid)
    const isResetting = user.resetToken && user.resetExpires && user.resetExpires > new Date();
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            otp: null,
            otpExpiresAt: null,
            isVerified: true,
        },
    });
    res.status(200).json({
        success: true,
        message: "OTP verified successfully.",
        data: isResetting ? { token: user.resetToken } : null,
    });
});
exports.resendOtp = (0, catchAsync_1.default)(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new appError_1.default("Email is required.", 400);
    }
    const user = await db_1.default.user.findUnique({ where: { email } });
    if (!user) {
        throw new appError_1.default("User not found.", 404);
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            otp,
            otpExpiresAt,
        },
    });
    await (0, sendEmail_1.default)({
        to: email,
        subject: "Your OTP Verification Code - Pristto",
        html: (0, emailTemplates_1.generateOtpEmailTemplate)({
            title: "Verification Code",
            name: user.name,
            description: "You requested a new One-Time Password (OTP). Please use the code below to complete your verification:",
            otp,
            expiresMinutes: 10,
        }),
    });
    res.status(200).json({
        success: true,
        message: "OTP resent successfully.",
    });
});
