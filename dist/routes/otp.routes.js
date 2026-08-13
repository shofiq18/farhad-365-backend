"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const otp_controller_1 = require("../controllers/otp.controller");
const router = (0, express_1.Router)();
router.post("/verify", otp_controller_1.verifyOtp);
router.post("/resend", otp_controller_1.resendOtp);
exports.default = router;
