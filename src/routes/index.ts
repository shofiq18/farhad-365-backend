import { Router } from "express";
import authRoutes from "./auth.routes";
import categoryRoutes from "./category.routes";
import productRoutes from "./product.routes";
import orderRoutes from "./order.routes";
import paymentRoutes from "./payment.routes";
import blogRoutes from "./blog.routes";
import discountRoutes from "./discount.routes";
import userRoutes from "./user.routes";
import quotationRoutes from "./quotation.routes";
import settingRoutes from "./setting.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/payment", paymentRoutes);
router.use("/blogs", blogRoutes);
router.use("/discounts", discountRoutes);
router.use("/users", userRoutes);
router.use("/quotations", quotationRoutes);
router.use("/settings", settingRoutes);

export default router;
