import { Router } from "express";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../controllers/category.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", getCategories);
router.post("/", authenticate, authorize("ADMIN", "MANAGER"), createCategory);
router.patch("/:id", authenticate, authorize("ADMIN", "MANAGER"), updateCategory);
router.delete("/:id", authenticate, authorize("ADMIN", "MANAGER"), deleteCategory);

export default router;
