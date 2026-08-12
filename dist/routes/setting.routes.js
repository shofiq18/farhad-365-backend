"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const setting_controller_1 = require("../controllers/setting.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Public
router.get("/", setting_controller_1.getAllSettings);
// Admin/Manager only
router.patch("/:key", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("ADMIN", "MANAGER"), setting_controller_1.updateSetting);
exports.default = router;
