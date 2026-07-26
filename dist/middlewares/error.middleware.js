"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const appError_1 = __importDefault(require("../utils/appError"));
const zod_1 = require("zod");
const handleZodError = (err) => {
    const errors = err.errors.map((el) => ({
        field: el.path.join("."),
        message: el.message,
    }));
    return new appError_1.default("Validation failed", 400, errors);
};
const handlePrismaDuplicateKeyError = (err) => {
    // Prisma unique constraint violation code is usually P2002
    const target = err.meta?.target || "Field";
    return new appError_1.default(`${target} already exists. Please use another value!`, 400);
};
const handlePrismaValidationError = (err) => {
    return new appError_1.default(`Invalid database input: ${err.message}`, 400);
};
const handleJWTError = () => new appError_1.default("Invalid token. Please log in again!", 401);
const handleJWTExpiredError = () => new appError_1.default("Your token has expired! Please log in again.", 401);
const sendErrorDev = (err, res) => {
    res.status(err.statusCode || 500).json({
        status: err.status || "error",
        error: err,
        message: err.message,
        stack: err.stack,
    });
};
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
            errors: err.errors,
        });
    }
    else {
        // Programming or other unknown error: don't leak error details
        console.error("ERROR 💥", err);
        res.status(500).json({
            status: "error",
            message: "Something went wrong on the server!",
        });
    }
};
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";
    if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
        let error = { ...err };
        error.message = err.message;
        error.stack = err.stack;
        if (err instanceof zod_1.ZodError)
            error = handleZodError(err);
        if (err.code === "P2002")
            error = handlePrismaDuplicateKeyError(err);
        if (err.name === "PrismaClientValidationError")
            error = handlePrismaValidationError(err);
        if (err.name === "JsonWebTokenError")
            error = handleJWTError();
        if (err.name === "TokenExpiredError")
            error = handleJWTExpiredError();
        sendErrorDev(error, res);
    }
    else {
        let error = { ...err };
        error.message = err.message;
        if (err instanceof zod_1.ZodError)
            error = handleZodError(err);
        if (err.code === "P2002")
            error = handlePrismaDuplicateKeyError(err);
        if (err.name === "PrismaClientValidationError")
            error = handlePrismaValidationError(err);
        if (err.name === "JsonWebTokenError")
            error = handleJWTError();
        if (err.name === "TokenExpiredError")
            error = handleJWTExpiredError();
        sendErrorProd(error, res);
    }
};
exports.globalErrorHandler = globalErrorHandler;
exports.default = exports.globalErrorHandler;
