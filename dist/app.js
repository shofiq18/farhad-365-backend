"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("express-async-errors");
const routes_1 = __importDefault(require("./routes"));
const appError_1 = __importDefault(require("./utils/appError"));
const error_middleware_1 = __importDefault(require("./middlewares/error.middleware"));
const app = (0, express_1.default)();
// Configure CORS to support requests from the Next.js client
app.use((0, cors_1.default)({
    origin: true, // Matches all origins or custom configurations
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const db_1 = __importDefault(require("./config/db"));
// Welcome API
app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to FARHAD365 API server!",
        timestamp: new Date(),
    });
});
// Health Check API
app.get("/health", async (req, res) => {
    try {
        // Perform a quick ping / database connection check
        await db_1.default.$runCommandRaw({ ping: 1 });
        res.status(200).json({
            status: "success",
            message: "Server is healthy and MongoDB is connected successfully.",
            timestamp: new Date(),
        });
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            message: "Server is running but MongoDB connection is down.",
            error: error.message,
            timestamp: new Date(),
        });
    }
});
// API Routes
app.use("/api/v1", routes_1.default);
// Handle undefined routes
app.all("*", (req, res, next) => {
    next(new appError_1.default(`Can't find ${req.originalUrl} on this server!`, 404));
});
// Mount global error handler
app.use(error_middleware_1.default);
exports.default = app;
