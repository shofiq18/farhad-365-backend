"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
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
    const existingUser = await db_1.default.user.findUnique({
        where: { email: data.email },
    });
    if (existingUser) {
        throw new appError_1.default("Email address is already in use.", 400);
    }
    const hashedPassword = await bcryptjs_1.default.hash(data.password, 12);
    const user = await db_1.default.user.create({
        data: {
            email: data.email,
            password: hashedPassword,
            name: data.name,
            role: data.role || "USER",
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
        },
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
    const user = await db_1.default.user.findUnique({
        where: { email: data.email },
    });
    if (!user || !(await bcryptjs_1.default.compare(data.password, user.password))) {
        throw new appError_1.default("Incorrect email or password.", 401);
    }
    const token = signToken(user.id, user.email, user.role);
    res.status(200).json({
        status: "success",
        token,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        },
    });
});
exports.getMe = (0, catchAsync_1.default)(async (req, res) => {
    if (!req.user) {
        throw new appError_1.default("Authentication required.", 401);
    }
    res.status(200).json({
        status: "success",
        data: { user: req.user },
    });
});
