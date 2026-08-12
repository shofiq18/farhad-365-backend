"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const blog_controller_1 = require("../controllers/blog.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = __importDefault(require("../middlewares/upload.middleware"));
const router = (0, express_1.Router)();
// Public Routes
router.get("/", blog_controller_1.getBlogs);
router.get("/:slug", blog_controller_1.getBlogBySlug);
// Admin & Manager Only Routes
router.get("/admin/all", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), blog_controller_1.getAdminBlogs);
router.post("/", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), upload_middleware_1.default.single("file"), blog_controller_1.createBlog);
router.patch("/:id", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), upload_middleware_1.default.single("file"), blog_controller_1.updateBlog);
router.delete("/:id", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), blog_controller_1.deleteBlog);
exports.default = router;
