import { Request, Response } from "express";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import sendEmail from "../utils/sendEmail";
import { generateOtpEmailTemplate } from "../utils/emailTemplates";

export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError("Email and OTP are required.", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      otp,
      otpExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("Invalid or expired OTP code.", 400);
  }

  // Check if they are resetting password (resetToken exists and is valid)
  const isResetting = user.resetToken && user.resetExpires && user.resetExpires > new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: null,
      otpExpiresAt: null,
      isVerified: true,
    },
  });

  res.status(200).json({
    success: true,
    message: "OTP verified successfully.",
    data: isResetting ? { token: user.resetToken } : null,
  });
});

export const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError("Email is required.", 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp,
      otpExpiresAt,
    },
  });

  await sendEmail({
    to: email,
    subject: "Your OTP Verification Code - Pristto",
    html: generateOtpEmailTemplate({
      title: "Verification Code",
      name: user.name,
      description: "You requested a new One-Time Password (OTP). Please use the code below to complete your verification:",
      otp,
      expiresMinutes: 10,
    }),
  });

  res.status(200).json({
    success: true,
    message: "OTP resent successfully.",
  });
});
