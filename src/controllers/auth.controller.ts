import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import sendEmail from "../utils/sendEmail";
import { generateOtpEmailTemplate } from "../utils/emailTemplates";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  name: z.string().min(2, "Name must be at least 2 characters long"),
  role: z.enum(["USER", "MANAGER", "ADMIN"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const signToken = (id: string, email: string, role: string): string => {
  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET || "fallback-secret",
    {
      expiresIn: (process.env.JWT_EXPIRES_IN || "30d") as any,
    }
  );
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);
  const cleanEmail = data.email.toLowerCase().trim();

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: "insensitive" } },
  });

  if (existingUser) {
    throw new AppError("Email address is already in use.", 400);
  }

  const hashedPassword = await bcrypt.hash(data.password, 12);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  const user = await prisma.user.create({
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

  await sendEmail({
    to: user.email,
    subject: "Verify Your Email - Pristto",
    html: generateOtpEmailTemplate({
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

export const login = catchAsync(async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);
  const cleanEmail = data.email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: "insensitive" } },
  });

  if (!user || !(await bcrypt.compare(data.password, user.password))) {
    throw new AppError("Incorrect email or password.", 401);
  }

  if (user.isDeleted) {
    throw new AppError("This account has been suspended. Please contact support.", 401);
  }

  if (user.isVerified === false && user.role !== "ADMIN" && user.role !== "MANAGER") {
    throw new AppError("Please verify your email address before logging in.", 401);
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

export const getMe = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: req.user,
  });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError("Email is required.", 400);
  }
  const cleanEmail = email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: "insensitive" } },
  });
  if (!user) {
    throw new AppError("No account found with this email address.", 404);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const resetToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "reset-secret", { expiresIn: "15m" });
  const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp,
      otpExpiresAt,
      resetToken,
      resetExpires,
    },
  });

  await sendEmail({
    to: cleanEmail,
    subject: "Reset Your Password - Pristto",
    html: generateOtpEmailTemplate({
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

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query;
  const { password } = req.body;

  if (!token || !password) {
    throw new AppError("Reset token and password are required.", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token as string,
      resetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("Invalid or expired password reset token.", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.update({
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
