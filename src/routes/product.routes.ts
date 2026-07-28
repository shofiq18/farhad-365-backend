import { Router } from "express";
import {
  getProducts,
  getProductBySlug,
  getProductSuggestions,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";
import { createReview, getProductReviews } from "../controllers/review.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import upload from "../middlewares/upload.middleware";

const router = Router();

router.get("/", getProducts);
router.get("/search/suggestions", getProductSuggestions);
router.get("/:slug", getProductBySlug);

router.post(
  "/",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  upload.array("files", 10),
  createProduct
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  upload.array("files", 10),
  updateProduct
);

router.delete("/:id", authenticate, authorize("ADMIN", "MANAGER"), deleteProduct);

// Product reviews routing
router.post("/:id/reviews", authenticate, createReview);
router.get("/:id/reviews", getProductReviews);

export default router;
