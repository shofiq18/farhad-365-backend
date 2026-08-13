"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const giftcard_controller_1 = require("../controllers/giftcard.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Purchase requires authentication
router.post("/purchase", auth_middleware_1.authenticate, giftcard_controller_1.purchaseGiftCard);
// Validation is public so checkout page can check codes
router.post("/validate", giftcard_controller_1.validateGiftCardCode);
exports.default = router;
