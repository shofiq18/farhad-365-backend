"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// SSLCommerz Credentials
const SSL_STORE_ID = process.env.SSL_STORE_ID || "testbox";
const SSL_STORE_PASSWORD = process.env.SSL_STORE_PASSWORD || "testbox_passwd";
const SSL_IS_LIVE = process.env.SSL_IS_LIVE === "true"; // false for sandbox
// bKash Sandbox Default Public Test Credentials (if not set in .env)
const BKASH_USERNAME = process.env.BKASH_USERNAME || "sandboxTokenizedUser02";
const BKASH_PASSWORD = process.env.BKASH_PASSWORD || "sandboxTokenizedUser02@12345";
const BKASH_APP_KEY = process.env.BKASH_APP_KEY || "4f6o0cjiki2rfm34kfdadl1eqq";
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET || "2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b";
const BKASH_IS_LIVE = process.env.BKASH_IS_LIVE === "true"; // false for sandbox
const SSL_API_URL = SSL_IS_LIVE
    ? "https://header.pay.sslcommerz.com/gwprocess/v4/api.php"
    : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";
const BKASH_API_URL = BKASH_IS_LIVE
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout";
class PaymentService {
    /**
     * Initialize SSLCommerz Payment Session
     */
    async initiateSSLCommerzPayment(orderId, amount, customer) {
        const params = new URLSearchParams();
        params.append("store_id", SSL_STORE_ID);
        params.append("store_passwd", SSL_STORE_PASSWORD);
        params.append("total_amount", amount.toString());
        params.append("currency", "BDT");
        params.append("tran_id", orderId);
        // Callbacks
        params.append("success_url", `http://localhost:5000/api/v1/payment/ssl-success?orderId=${orderId}`);
        params.append("fail_url", `http://localhost:5000/api/v1/payment/ssl-fail?orderId=${orderId}`);
        params.append("cancel_url", `http://localhost:5000/api/v1/payment/ssl-cancel?orderId=${orderId}`);
        params.append("ipn_url", `http://localhost:5000/api/v1/payment/ssl-ipn?orderId=${orderId}`);
        // Customer info
        params.append("cus_name", customer.name);
        params.append("cus_email", customer.email || "customer@example.com");
        params.append("cus_phone", customer.phone);
        params.append("cus_add1", customer.street);
        params.append("cus_city", customer.city);
        params.append("cus_state", customer.state);
        params.append("cus_postcode", customer.zipCode);
        params.append("cus_country", "Bangladesh");
        // Product info (Required)
        params.append("shipping_method", "NO");
        params.append("num_of_item", "1");
        params.append("product_name", "Shoes Purchase");
        params.append("product_category", "Shoes");
        params.append("product_profile", "physical-goods");
        const response = await fetch(SSL_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        });
        if (!response.ok) {
            throw new Error(`SSLCommerz init failed with HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.status === "SUCCESS" && data.GatewayPageURL) {
            return data.GatewayPageURL;
        }
        else {
            throw new Error(data.failedreason || "Failed to initiate SSLCommerz payment session");
        }
    }
    /**
     * Get bKash Auth Token
     */
    async getBKashToken() {
        const response = await fetch(`${BKASH_API_URL}/token/grant`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                username: BKASH_USERNAME,
                password: BKASH_PASSWORD,
            },
            body: JSON.stringify({
                app_key: BKASH_APP_KEY,
                app_secret: BKASH_APP_SECRET,
            }),
        });
        if (!response.ok) {
            throw new Error(`bKash Token Grant failed with HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.id_token) {
            return data.id_token;
        }
        else {
            throw new Error(data.errorMessage || "Failed to get bKash token");
        }
    }
    /**
     * Create bKash Payment
     */
    async createBKashPayment(orderId, amount) {
        const token = await this.getBKashToken();
        const response = await fetch(`${BKASH_API_URL}/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: token,
                "X-APP-Key": BKASH_APP_KEY,
            },
            body: JSON.stringify({
                mode: "0011",
                payerReference: "1",
                callbackURL: `http://localhost:5000/api/v1/payment/bkash-callback?orderId=${orderId}`,
                amount: amount.toString(),
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: orderId,
            }),
        });
        if (!response.ok) {
            throw new Error(`bKash Create Payment failed with HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.bkashURL && data.paymentID) {
            return { bkashURL: data.bkashURL, paymentID: data.paymentID };
        }
        else {
            throw new Error(data.errorMessage || "Failed to create bKash payment");
        }
    }
    /**
     * Execute bKash Payment
     */
    async executeBKashPayment(paymentID) {
        const token = await this.getBKashToken();
        const response = await fetch(`${BKASH_API_URL}/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: token,
                "X-APP-Key": BKASH_APP_KEY,
            },
            body: JSON.stringify({
                paymentID,
            }),
        });
        if (!response.ok) {
            throw new Error(`bKash Execute Payment failed with HTTP ${response.status}`);
        }
        return response.json();
    }
}
exports.default = new PaymentService();
