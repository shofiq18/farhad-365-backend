"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_controller_1 = require("../controllers/product.controller");
const review_controller_1 = require("../controllers/review.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = __importDefault(require("../middlewares/upload.middleware"));
const router = (0, express_1.Router)();
router.get("/", product_controller_1.getProducts);
router.get("/search/suggestions", product_controller_1.getProductSuggestions);
router.get("/:slug", product_controller_1.getProductBySlug);
router.post("/", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), upload_middleware_1.default.array("files", 10), product_controller_1.createProduct);
router.patch("/:id", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), upload_middleware_1.default.array("files", 10), product_controller_1.updateProduct);
router.delete("/:id", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), product_controller_1.deleteProduct);
// Product reviews routing
router.post("/:id/reviews", auth_middleware_1.authenticate, review_controller_1.createReview);
router.get("/:id/reviews", review_controller_1.getProductReviews);
exports.default = router;
