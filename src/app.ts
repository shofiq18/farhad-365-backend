import express from "express";
import cors from "cors";
import "express-async-errors";
import routes from "./routes";
import AppError from "./utils/appError";
import globalErrorHandler from "./middlewares/error.middleware";

const app = express();

// Configure CORS to support requests from the Next.js client
app.use(
  cors({
    origin: true, // Matches all origins or custom configurations
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import prisma from "./config/db";

// Welcome API
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to Pristto API server!",
    timestamp: new Date(),
  });
});

// Health Check API
app.get("/health", async (req, res) => {
  try {
    // Perform a quick ping / database connection check
    await prisma.$runCommandRaw({ ping: 1 });
    res.status(200).json({
      status: "success",
      message: "Server is healthy and MongoDB is connected successfully.",
      timestamp: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: "Server is running but MongoDB connection is down.",
      error: error.message,
      timestamp: new Date(),
    });
  }
});

// API Routes
app.use("/api/v1", routes);

// Handle undefined routes
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Mount global error handler
app.use(globalErrorHandler);

export default app;
