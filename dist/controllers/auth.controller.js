"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const sendEmail_1 = __importDefault(require("../utils/sendEmail"));
const emailTemplates_1 = require("../utils/emailTemplates");
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
    name: zod_1.z.string().min(2, "Name must be at least 2 characters long"),
    role: zod_1.z.enum(["USER", "MANAGER", "ADMIN"]).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(1, "Password is required"),
});
const signToken = (id, email, role) => {
    return jsonwebtoken_1.default.sign({ id, email, role }, process.env.JWT_SECRET || "fallback-secret", {
        expiresIn: (process.env.JWT_EXPIRES_IN || "30d"),
    });
};
exports.register = (0, catchAsync_1.default)(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const cleanEmail = data.email.toLowerCase().trim();
    const existingUser = await db_1.default.user.findFirst({
        where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });
    if (existingUser) {
        throw new appError_1.default("Email address is already in use.", 400);
    }
    const hashedPassword = await bcryptjs_1.default.hash(data.password, 12);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    const user = await db_1.default.user.create({
        data: {
            email: cleanEmail,
            password: hashedPassword,
            name: data.name,
            role: data.role || "USER",
            otp,
            otpExpiresAt,
            isVerified: false,
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
        },
    });
    await (0, sendEmail_1.default)({
        to: user.email,
        subject: "Verify Your Email - Pristto",
        html: (0, emailTemplates_1.generateOtpEmailTemplate)({
            title: "Welcome to Pristto!",
            name: user.name,
            description: "Thank you for signing up. Please use the following One-Time Password (OTP) to verify your email address and activate your account:",
            otp,
            expiresMinutes: 10,
        }),
    });
    const token = signToken(user.id, user.email, user.role);
    res.status(201).json({
        status: "success",
        token,
        data: { user },
    });
});
exports.login = (0, catchAsync_1.default)(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const cleanEmail = data.email.toLowerCase().trim();
    const user = await db_1.default.user.findFirst({
        where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });
    if (!user || !(await bcryptjs_1.default.compare(data.password, user.password))) {
        throw new appError_1.default("Incorrect email or password.", 401);
    }
    if (user.isDeleted) {
        throw new appError_1.default("This account has been suspended. Please contact support.", 401);
    }
    if (user.isVerified === false && user.role !== "ADMIN" && user.role !== "MANAGER") {
        throw new appError_1.default("Please verify your email address before logging in.", 401);
    }
    const token = signToken(user.id, user.email, user.role);
    res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
        accessToken: token,
    });
});
exports.getMe = (0, catchAsync_1.default)(async (req, res) => {
    if (!req.user) {
        throw new appError_1.default("Authentication required.", 401);
    }
    res.status(200).json({
        success: true,
        message: "User fetched successfully",
        data: req.user,
    });
});
exports.forgotPassword = (0, catchAsync_1.default)(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new appError_1.default("Email is required.", 400);
    }
    const cleanEmail = email.toLowerCase().trim();
    const user = await db_1.default.user.findFirst({
        where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });
    if (!user) {
        throw new appError_1.default("No account found with this email address.", 404);
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const resetToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "reset-secret", { expiresIn: "15m" });
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            otp,
            otpExpiresAt,
            resetToken,
            resetExpires,
        },
    });
    await (0, sendEmail_1.default)({
        to: cleanEmail,
        subject: "Reset Your Password - Pristto",
        html: (0, emailTemplates_1.generateOtpEmailTemplate)({
            title: "Password Reset Request",
            name: user.name,
            description: "We received a request to reset your password. Please use the verification code below to proceed with setting up a new password:",
            otp,
            expiresMinutes: 10,
        }),
    });
    res.status(200).json({
        success: true,
        message: "Reset OTP sent to email.",
    });
});
exports.resetPassword = (0, catchAsync_1.default)(async (req, res) => {
    const { token } = req.query;
    const { password } = req.body;
    if (!token || !password) {
        throw new appError_1.default("Reset token and password are required.", 400);
    }
    const user = await db_1.default.user.findFirst({
        where: {
            resetToken: token,
            resetExpires: { gt: new Date() },
        },
    });
    if (!user) {
        throw new appError_1.default("Invalid or expired password reset token.", 400);
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    await db_1.default.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetExpires: null,
            isVerified: true,
        },
    });
    res.status(200).json({
        success: true,
        message: "Password reset successfully.",
    });
});
