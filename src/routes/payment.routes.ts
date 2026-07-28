import { Router } from "express";
import { sslSuccess, sslFail, sslCancel, bkashCallback } from "../controllers/payment.controller";

const router = Router();

// SSLCommerz redirects via POST
router.post("/ssl-success", sslSuccess);
router.post("/ssl-fail", sslFail);
router.post("/ssl-cancel", sslCancel);

// bKash redirects via GET
router.get("/bkash-callback", bkashCallback);

export default router;
