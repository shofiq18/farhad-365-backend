"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const discount_controller_1 = require("../controllers/discount.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (no auth needed)
router.get("/active", discount_controller_1.getActiveDiscount);
// Authenticated routes
router.post("/validate", auth_middleware_1.authenticate, discount_controller_1.validateDiscountCode);
// Admin / Manager only routes
router.use(auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"));
router.get("/", discount_controller_1.getAllDiscounts);
router.post("/", discount_controller_1.createDiscount);
router.patch("/:id", discount_controller_1.updateDiscount);
router.delete("/:id", discount_controller_1.deleteDiscount);
exports.default = router;
