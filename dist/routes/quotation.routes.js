"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const quotation_controller_1 = require("../controllers/quotation.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Public route — anyone can submit a quotation
router.post("/", quotation_controller_1.submitQuotation);
// Admin/Manager routes
router.get("/", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), quotation_controller_1.getAllQuotations);
router.patch("/:id/status", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), quotation_controller_1.updateQuotationStatus);
exports.default = router;
