import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import prisma from "./config/db";

const port = process.env.PORT || 5000;

const server = app.listen(port, async () => {
  console.log(`[Server] Running on port ${port} in ${process.env.NODE_ENV || "development"} mode.`);
  try {
    await prisma.$connect();
    console.log("🟢 [Database] MongoDB connected successfully via Prisma.");
  } catch (error: any) {
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
process.on("unhandledRejection", (err: any) => {
  console.error("UNHANDLED REJECTION! 💥 Shutting down...");
  console.error(err?.name, err?.message, err?.stack);
  server.close(() => {
    process.exit(1);
  });
});
export default server;
