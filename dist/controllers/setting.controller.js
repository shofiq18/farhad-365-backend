"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSetting = exports.getAllSettings = void 0;
const db_1 = __importDefault(require("../config/db"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const DEFAULT_CAROUSEL_SLIDES = [
    {
        id: "slide-1",
        image: "/corousal3.webp",
        tag: "WOMEN'S COLLECTION",
        title: "ELEVATE YOUR WORKOUT",
        subtitle: "Premium performance sportswear designed for maximum flexibility, breathability, and comfort.",
        primaryBtnText: "Shop Men's",
        primaryLink: "/shop?targetGroup=MEN",
        secondaryBtnText: "View Collection",
        secondaryLink: "/shop"
    },
    {
        id: "slide-2",
        image: "/corousal4.webp",
        tag: "PRO PERFORMANCE",
        title: "DOMINATE THE STAGE",
        subtitle: "Unmatched speed meets elite comfort. Push your boundaries and exceed your goals daily.",
        primaryBtnText: "Shop Women's",
        primaryLink: "/shop?targetGroup=WOMEN",
        secondaryBtnText: "Shop All",
        secondaryLink: "/shop"
    },
    {
        id: "slide-3",
        image: "/corousal2.avif",
        tag: "JUST RELEASED",
        title: "WIN ON YOUR TERMS",
        subtitle: "Step into limitlessness with our brand new seasonal collections. Engineered with lightweight, premium fabrics designed for peak movement and performance.",
        primaryBtnText: "Shop Collection",
        primaryLink: "/shop",
        secondaryBtnText: "Shop Accessories",
        secondaryLink: "/shop?category=accessories"
    },
    {
        id: "slide-4",
        image: "/corousal1.webp",
        tag: "NEW ARRIVAL",
        title: "THE STANDARD IS SET",
        subtitle: "Experience next-level cushioning and support engineered for daily runners and active athletes.",
        primaryBtnText: "Shop Footwear",
        primaryLink: "/shop?category=shoes",
        secondaryBtnText: "Explore Running",
        secondaryLink: "/shop?targetGroup=SPORTS"
    },
    {
        id: "slide-5",
        image: "/corousal6.webp",
        tag: "LUXURY FRAGRANCE",
        title: "SIGNATURE SCENTS",
        subtitle: "Discover iconic fragrances crafted to complement your style with lasting elegance.",
        primaryBtnText: "Shop Perfumes",
        primaryLink: "/shop?category=accessories",
        secondaryBtnText: "Explore Shop",
        secondaryLink: "/shop"
    }
];
// Default settings to seed if none exist
const DEFAULT_SETTINGS = {
    support_email: "support@pristto.com",
    support_phone: "+880 1700-000000",
    support_address: "Dhaka, Bangladesh",
    hero_title: "Dress to Impress",
    hero_subtitle: "Explore our premium collection of fashion for every occasion.",
    footer_about: "Pristto is your go-to destination for premium fashion.",
    free_shipping_threshold: "1000",
    hero_mode: "CAROUSEL", // "CAROUSEL" | "VIDEO"
    hero_video_url: "/videos/gym.mp4",
    hero_video_title: "WIN ON YOUR TERMS",
    hero_video_subtitle: "Step into limitlessness with our brand new seasonal collections. Engineered with lightweight, premium fabrics designed for peak movement and performance.",
    hero_video_tag: "JUST RELEASED",
    hero_video_primary_btn_text: "Shop Collection",
    hero_video_primary_btn_link: "/shop",
    hero_video_secondary_btn_text: "Shop Men's",
    hero_video_secondary_btn_link: "/shop?targetGroup=MEN",
    hero_carousel_slides: JSON.stringify(DEFAULT_CAROUSEL_SLIDES),
};
// GET /settings — all settings (public)
exports.getAllSettings = (0, catchAsync_1.default)(async (_req, res) => {
    let settings = await db_1.default.contentSetting.findMany();
    // Seed defaults if empty
    if (settings.length === 0) {
        const created = await Promise.all(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => db_1.default.contentSetting.create({ data: { key, value } })));
        settings = created;
    }
    // Convert array to key-value map for convenience, filling missing defaults
    const map = { ...DEFAULT_SETTINGS };
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
