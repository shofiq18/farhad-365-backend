"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Secure all order endpoints with authentication
router.use(auth_middleware_1.authenticate);
router.post("/", order_controller_1.createOrder);
router.get("/my-orders", order_controller_1.getMyOrders);
router.get("/", (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), order_controller_1.getAllOrders);
router.get("/:id", order_controller_1.getOrderById);
router.post("/:id/re-initiate-payment", order_controller_1.reInitiatePayment);
router.patch("/:id/status", (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), order_controller_1.updateOrderStatus);
exports.default = router;
