"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBlog = exports.updateBlog = exports.createBlog = exports.getBlogBySlug = exports.getAdminBlogs = exports.getBlogs = void 0;
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
const upload_service_1 = __importDefault(require("../services/upload.service"));
// Helper function to create SEO-friendly slugs
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars (except -)
        .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}
/**
 * Get all published blog posts (Public)
 */
exports.getBlogs = (0, catchAsync_1.default)(async (req, res) => {
    const blogs = await db_1.default.blogPost.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
        status: "success",
        results: blogs.length,
        data: blogs,
    });
});
/**
 * Get all blog posts (Admin/Manager only)
 */
exports.getAdminBlogs = (0, catchAsync_1.default)(async (req, res) => {
    const blogs = await db_1.default.blogPost.findMany({
        orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
        status: "success",
        results: blogs.length,
        data: blogs,
    });
});
/**
 * Get a single blog post by its slug (Public)
 */
exports.getBlogBySlug = (0, catchAsync_1.default)(async (req, res) => {
    const { slug } = req.params;
    const blog = await db_1.default.blogPost.findUnique({
        where: { slug },
    });
    if (!blog) {
        throw new appError_1.default("Blog post not found.", 404);
    }
    res.status(200).json({
        status: "success",
        data: blog,
    });
});
/**
 * Create a new blog post (Admin/Manager only)
 */
exports.createBlog = (0, catchAsync_1.default)(async (req, res) => {
    const { title, content, excerpt, coverImage, isPublished, author, readTime } = req.body;
    if (!title || !content || !excerpt) {
        throw new appError_1.default("Title, content, and excerpt are required.", 400);
    }
    let finalCoverImage = coverImage;
    if (req.file) {
        const uploadResult = await upload_service_1.default.uploadSingleImage(req.file.buffer);
        finalCoverImage = uploadResult.secure_url;
    }
    if (!finalCoverImage) {
        throw new appError_1.default("Cover image is required. Please upload an image.", 400);
    }
    let slug = slugify(title);
    // Ensure slug uniqueness
    const existingBlog = await db_1.default.blogPost.findUnique({
        where: { slug },
    });
    if (existingBlog) {
        slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const newBlog = await db_1.default.blogPost.create({
        data: {
            title,
            slug,
            content,
            excerpt,
            coverImage: finalCoverImage,
            isPublished: isPublished === "true" || isPublished === true,
            author: author || "Pristto Team",
            readTime: readTime || "5 min read",
        },
    });
    res.status(201).json({
        status: "success",
        data: newBlog,
    });
});
/**
 * Update an existing blog post (Admin/Manager only)
 */
exports.updateBlog = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const { title, content, excerpt, coverImage, isPublished, author, readTime } = req.body;
    // Check if blog exists
    const existingBlog = await db_1.default.blogPost.findUnique({
        where: { id },
    });
    if (!existingBlog) {
        throw new appError_1.default("Blog post not found.", 404);
    }
    const updateData = {};
    if (title !== undefined) {
        updateData.title = title;
        // Generate new slug if title changes
        let newSlug = slugify(title);
        if (newSlug !== existingBlog.slug) {
            const slugConflict = await db_1.default.blogPost.findUnique({ where: { slug: newSlug } });
            if (slugConflict) {
                newSlug = `${newSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
            }
            updateData.slug = newSlug;
        }
    }
    if (content !== undefined)
        updateData.content = content;
    if (excerpt !== undefined)
        updateData.excerpt = excerpt;
    // Handle cover image file upload
    if (req.file) {
        const uploadResult = await upload_service_1.default.uploadSingleImage(req.file.buffer);
        updateData.coverImage = uploadResult.secure_url;
    }
    else if (coverImage !== undefined) {
        updateData.coverImage = coverImage;
    }
    if (isPublished !== undefined) {
        updateData.isPublished = isPublished === "true" || isPublished === true;
    }
    if (author !== undefined)
        updateData.author = author;
    if (readTime !== undefined)
        updateData.readTime = readTime;
    const updatedBlog = await db_1.default.blogPost.update({
        where: { id },
        data: updateData,
    });
    res.status(200).json({
        status: "success",
        data: updatedBlog,
    });
});
/**
 * Delete a blog post (Admin/Manager only)
 */
exports.deleteBlog = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const existingBlog = await db_1.default.blogPost.findUnique({
        where: { id },
    });
    if (!existingBlog) {
        throw new appError_1.default("Blog post not found.", 404);
    }
    await db_1.default.blogPost.delete({
        where: { id },
    });
    res.status(200).json({
        status: "success",
        message: "Blog post deleted successfully.",
    });
});
