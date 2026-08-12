import { Router } from "express";
import {
  getBlogs,
  getAdminBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../controllers/blog.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import upload from "../middlewares/upload.middleware";

const router = Router();

// Public Routes
router.get("/", getBlogs);
router.get("/:slug", getBlogBySlug);

// Admin & Manager Only Routes
router.get("/admin/all", authenticate, authorize("ADMIN", "MANAGER"), getAdminBlogs);
router.post("/", authenticate, authorize("ADMIN", "MANAGER"), upload.single("file"), createBlog);
router.patch("/:id", authenticate, authorize("ADMIN", "MANAGER"), upload.single("file"), updateBlog);
router.delete("/:id", authenticate, authorize("ADMIN", "MANAGER"), deleteBlog);

export default router;
