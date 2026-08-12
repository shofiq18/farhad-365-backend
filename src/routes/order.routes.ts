import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  reInitiatePayment,
} from "../controllers/order.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Secure all order endpoints with authentication
router.use(authenticate);

router.post("/", createOrder);
router.get("/my-orders", getMyOrders);
router.get("/", authorize("ADMIN", "MANAGER"), getAllOrders);
router.get("/:id", getOrderById);
router.post("/:id/re-initiate-payment", reInitiatePayment);

router.patch("/:id/status", authorize("ADMIN", "MANAGER"), updateOrderStatus);

export default router;
