import { Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import uploadService from "../services/upload.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// GET /users — all non-deleted users (Admin/Manager only)
export const getAllUsers = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      isDeleted: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({ status: "success", results: users.length, data: users });
});

// PATCH /users/:id/role — update role (Admin only)
export const updateUserRole = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["USER", "MANAGER", "ADMIN"].includes(role)) {
    throw new AppError("Invalid role. Must be USER, MANAGER, or ADMIN.", 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) throw new AppError("User not found.", 404);

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  res.status(200).json({ status: "success", data: updated });
});

// DELETE /users/:id — soft delete (Admin only)
export const deleteUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) throw new AppError("User not found.", 404);

  await prisma.user.update({ where: { id }, data: { isDeleted: true } });

  res.status(200).json({ status: "success", message: "User has been suspended successfully." });
});

// PATCH /users/update-profile — update profile details (Any logged-in user)
export const updateProfile = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("You are not logged in. Please log in to get access.", 401);
  }

  const { name, email, phone, currentPassword, newPassword } = req.body;

  // Find current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const updateData: any = {};

  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;

  if (email && email !== user.email) {
    // Check if email already in use
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError("Email is already in use by another user.", 400);
    }
    updateData.email = email;
  }

  // Handle profile image upload to Cloudinary
  if (req.file) {
    const uploadResult = await uploadService.uploadSingleImage(req.file.buffer, "user-profiles");
    updateData.profileImage = uploadResult.secure_url;
  }

  // Handle password change if requested
  if (newPassword) {
    if (!currentPassword) {
      throw new AppError("Please provide your current password to update the password.", 400);
    }
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      throw new AppError("Incorrect current password.", 401);
    }
    updateData.password = await bcrypt.hash(newPassword, 12);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      profileImage: true,
      createdAt: true,
    },
  });

  res.status(200).json({
    status: "success",
    message: "Profile updated successfully.",
    data: updatedUser,
  });
});

