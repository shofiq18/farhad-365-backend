"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const router = (0, express_1.Router)();
// SSLCommerz redirects via POST
router.post("/ssl-success", payment_controller_1.sslSuccess);
router.post("/ssl-fail", payment_controller_1.sslFail);
router.post("/ssl-cancel", payment_controller_1.sslCancel);
// bKash redirects via GET
router.get("/bkash-callback", payment_controller_1.bkashCallback);
exports.default = router;
