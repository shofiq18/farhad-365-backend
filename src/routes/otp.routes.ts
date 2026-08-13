import { Router } from "express";
import { verifyOtp, resendOtp } from "../controllers/otp.controller";

const router = Router();

router.post("/verify", verifyOtp);
router.post("/resend", resendOtp);

export default router;
