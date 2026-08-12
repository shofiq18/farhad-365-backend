import { Request, Response } from "express";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import uploadService from "../services/upload.service";

// Helper function to create SEO-friendly slugs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")           // Replace spaces with -
    .replace(/[^\w\-]+/g, "")       // Remove all non-word chars (except -)
    .replace(/\-\-+/g, "-");        // Replace multiple - with single -
}

/**
 * Get all published blog posts (Public)
 */
export const getBlogs = catchAsync(async (req: Request, res: Response) => {
  const blogs = await prisma.blogPost.findMany({
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
export const getAdminBlogs = catchAsync(async (req: Request, res: Response) => {
  const blogs = await prisma.blogPost.findMany({
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
export const getBlogBySlug = catchAsync(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const blog = await prisma.blogPost.findUnique({
    where: { slug },
  });

  if (!blog) {
    throw new AppError("Blog post not found.", 404);
  }

  res.status(200).json({
    status: "success",
    data: blog,
  });
});

/**
 * Create a new blog post (Admin/Manager only)
 */
export const createBlog = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { title, content, excerpt, coverImage, isPublished, author, readTime } = req.body;

  if (!title || !content || !excerpt) {
    throw new AppError("Title, content, and excerpt are required.", 400);
  }

  let finalCoverImage = coverImage;

  if (req.file) {
    const uploadResult = await uploadService.uploadSingleImage(req.file.buffer);
    finalCoverImage = uploadResult.secure_url;
  }

  if (!finalCoverImage) {
    throw new AppError("Cover image is required. Please upload an image.", 400);
  }

  let slug = slugify(title);
  
  // Ensure slug uniqueness
  const existingBlog = await prisma.blogPost.findUnique({
    where: { slug },
  });

  if (existingBlog) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const newBlog = await prisma.blogPost.create({
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
export const updateBlog = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { title, content, excerpt, coverImage, isPublished, author, readTime } = req.body;

  // Check if blog exists
  const existingBlog = await prisma.blogPost.findUnique({
    where: { id },
  });

  if (!existingBlog) {
    throw new AppError("Blog post not found.", 404);
  }

  const updateData: any = {};
  if (title !== undefined) {
    updateData.title = title;
    // Generate new slug if title changes
    let newSlug = slugify(title);
    if (newSlug !== existingBlog.slug) {
      const slugConflict = await prisma.blogPost.findUnique({ where: { slug: newSlug } });
      if (slugConflict) {
        newSlug = `${newSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      updateData.slug = newSlug;
    }
  }
  if (content !== undefined) updateData.content = content;
  if (excerpt !== undefined) updateData.excerpt = excerpt;
  
  // Handle cover image file upload
  if (req.file) {
    const uploadResult = await uploadService.uploadSingleImage(req.file.buffer);
    updateData.coverImage = uploadResult.secure_url;
  } else if (coverImage !== undefined) {
    updateData.coverImage = coverImage;
  }

  if (isPublished !== undefined) {
    updateData.isPublished = isPublished === "true" || isPublished === true;
  }
  if (author !== undefined) updateData.author = author;
  if (readTime !== undefined) updateData.readTime = readTime;

  const updatedBlog = await prisma.blogPost.update({
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
export const deleteBlog = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const existingBlog = await prisma.blogPost.findUnique({
    where: { id },
  });

  if (!existingBlog) {
    throw new AppError("Blog post not found.", 404);
  }

  await prisma.blogPost.delete({
    where: { id },
  });

  res.status(200).json({
    status: "success",
    message: "Blog post deleted successfully.",
  });
});
