import { Router } from "express";
import { getAllSettings, updateSetting } from "../controllers/setting.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Public
router.get("/", getAllSettings);

// Admin/Manager only
router.patch("/:key", authenticate, authorize("ADMIN", "MANAGER"), updateSetting);

export default router;
