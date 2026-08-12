"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.deleteUser = exports.updateUserRole = exports.getAllUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const upload_service_1 = __importDefault(require("../services/upload.service"));
// GET /users — all non-deleted users (Admin/Manager only)
exports.getAllUsers = (0, catchAsync_1.default)(async (_req, res) => {
    const users = await db_1.default.user.findMany({
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
exports.updateUserRole = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!["USER", "MANAGER", "ADMIN"].includes(role)) {
        throw new appError_1.default("Invalid role. Must be USER, MANAGER, or ADMIN.", 400);
    }
    const user = await db_1.default.user.findUnique({ where: { id } });
    if (!user || user.isDeleted)
        throw new appError_1.default("User not found.", 404);
    const updated = await db_1.default.user.update({
        where: { id },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
    });
    res.status(200).json({ status: "success", data: updated });
});
// DELETE /users/:id — soft delete (Admin only)
exports.deleteUser = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const user = await db_1.default.user.findUnique({ where: { id } });
    if (!user || user.isDeleted)
        throw new appError_1.default("User not found.", 404);
    await db_1.default.user.update({ where: { id }, data: { isDeleted: true } });
    res.status(200).json({ status: "success", message: "User has been suspended successfully." });
});
// PATCH /users/update-profile — update profile details (Any logged-in user)
exports.updateProfile = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new appError_1.default("You are not logged in. Please log in to get access.", 401);
    }
    const { name, email, phone, currentPassword, newPassword } = req.body;
    // Find current user
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!user) {
        throw new appError_1.default("User not found.", 404);
    }
    const updateData = {};
    if (name)
        updateData.name = name;
    if (phone !== undefined)
        updateData.phone = phone;
    if (email && email !== user.email) {
        // Check if email already in use
        const existingUser = await db_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new appError_1.default("Email is already in use by another user.", 400);
        }
        updateData.email = email;
    }
    // Handle profile image upload to Cloudinary
    if (req.file) {
        const uploadResult = await upload_service_1.default.uploadSingleImage(req.file.buffer, "user-profiles");
        updateData.profileImage = uploadResult.secure_url;
    }
    // Handle password change if requested
    if (newPassword) {
        if (!currentPassword) {
            throw new appError_1.default("Please provide your current password to update the password.", 400);
        }
        const isPasswordCorrect = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isPasswordCorrect) {
            throw new appError_1.default("Incorrect current password.", 401);
        }
        updateData.password = await bcryptjs_1.default.hash(newPassword, 12);
    }
    const updatedUser = await db_1.default.user.update({
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
