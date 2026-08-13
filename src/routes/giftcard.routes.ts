import { Router } from "express";
import { purchaseGiftCard, validateGiftCardCode } from "../controllers/giftcard.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Purchase requires authentication
router.post("/purchase", authenticate, purchaseGiftCard);

// Validation is public so checkout page can check codes
router.post("/validate", validateGiftCardCode);

export default router;
