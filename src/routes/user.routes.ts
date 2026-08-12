import { Router } from "express";
import { getAllUsers, updateUserRole, deleteUser, updateProfile } from "../controllers/user.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.use(authenticate);
router.patch("/update-profile", upload.single("file"), updateProfile);
router.get("/", authorize("ADMIN", "MANAGER"), getAllUsers);
router.patch("/:id/role", authorize("ADMIN"), updateUserRole);
router.delete("/:id", authorize("ADMIN"), deleteUser);

export default router;
