"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const appError_1 = __importDefault(require("../utils/appError"));
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
exports.authenticate = (0, catchAsync_1.default)(async (req, res, next) => {
    let token;
    if (req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    }
    else if (req.headers.authorization) {
        token = req.headers.authorization;
    }
    if (!token) {
        return next(new appError_1.default("You are not logged in. Please log in to get access.", 401));
    }
    // Verify token
    const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "fallback-secret");
    // Check if user still exists
    const currentUser = await db_1.default.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true },
    });
    if (!currentUser) {
        return next(new appError_1.default("The user belonging to this token no longer exists.", 401));
    }
    // Attach user payload
    req.user = currentUser;
    next();
});
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new appError_1.default("You do not have permission to perform this action.", 403));
        }
        next();
    };
};
exports.authorize = authorize;
