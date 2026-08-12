import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

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

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new AppError("Email address is already in use.", 400);
  }

  const hashedPassword = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
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

export const login = catchAsync(async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user || !(await bcrypt.compare(data.password, user.password))) {
    throw new AppError("Incorrect email or password.", 401);
  }

  if (user.isDeleted) {
    throw new AppError("This account has been suspended. Please contact support.", 401);
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
