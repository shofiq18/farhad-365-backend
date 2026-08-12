"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSetting = exports.getAllSettings = void 0;
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
// Default settings to seed if none exist
const DEFAULT_SETTINGS = {
    support_email: "support@pristto.com",
    support_phone: "+880 1700-000000",
    support_address: "Dhaka, Bangladesh",
    hero_title: "Dress to Impress",
    hero_subtitle: "Explore our premium collection of fashion for every occasion.",
    footer_about: "Pristto is your go-to destination for premium fashion.",
    free_shipping_threshold: "1000",
};
// GET /settings — all settings (public)
exports.getAllSettings = (0, catchAsync_1.default)(async (_req, res) => {
    let settings = await db_1.default.contentSetting.findMany();
    // Seed defaults if empty
    if (settings.length === 0) {
        const created = await Promise.all(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => db_1.default.contentSetting.create({ data: { key, value } })));
        settings = created;
    }
    // Convert array to key-value map for convenience
    const map = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.status(200).json({ status: "success", data: { list: settings, map } });
});
// PATCH /settings/:key — update a setting (Admin/Manager only)
exports.updateSetting = (0, catchAsync_1.default)(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    if (!value || typeof value !== "string") {
        res.status(400).json({ status: "fail", message: "Value is required." });
        return;
    }
    const setting = await db_1.default.contentSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
    });
    res.status(200).json({ status: "success", data: setting });
});
