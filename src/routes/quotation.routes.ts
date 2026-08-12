import { Router } from "express";
import { submitQuotation, getAllQuotations, updateQuotationStatus } from "../controllers/quotation.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Public route — anyone can submit a quotation
router.post("/", submitQuotation);

// Admin/Manager routes
router.get("/", authenticate, authorize("ADMIN", "MANAGER"), getAllQuotations);
router.patch("/:id/status", authenticate, authorize("ADMIN", "MANAGER"), updateQuotationStatus);

export default router;
