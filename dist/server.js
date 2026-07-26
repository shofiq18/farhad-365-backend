"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const db_1 = __importDefault(require("./config/db"));
const port = process.env.PORT || 5000;
const server = app_1.default.listen(port, async () => {
    console.log(`[Server] Running on port ${port} in ${process.env.NODE_ENV || "development"} mode.`);
    try {
        await db_1.default.$connect();
        console.log("🟢 [Database] MongoDB connected successfully via Prisma.");
    }
    catch (error) {
        console.error("🔴 [Database] MongoDB connection failed:", error.message);
    }
});
// Capture uncaught exceptions
process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});
// Capture unhandled promise rejections
process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION! 💥 Shutting down...");
    console.error(err?.name, err?.message, err?.stack);
    server.close(() => {
        process.exit(1);
    });
});
exports.default = server;
