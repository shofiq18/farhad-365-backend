import { Router } from "express";
import {
  getAllDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  getActiveDiscount,
  validateDiscountCode,
} from "../controllers/discount.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Public routes (no auth needed)
router.get("/active", getActiveDiscount);

// Authenticated routes
router.post("/validate", authenticate, validateDiscountCode);

// Admin / Manager only routes
router.use(authenticate, authorize("ADMIN", "MANAGER"));
router.get("/", getAllDiscounts);
router.post("/", createDiscount);
router.patch("/:id", updateDiscount);
router.delete("/:id", deleteDiscount);

export default router;
