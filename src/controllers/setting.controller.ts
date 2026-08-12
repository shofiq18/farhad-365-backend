import { Request, Response } from "express";
import prisma from "../config/db";
import catchAsync from "../utils/catchAsync";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Default settings to seed if none exist
const DEFAULT_SETTINGS: Record<string, string> = {
  support_email: "support@pristto.com",
  support_phone: "+880 1700-000000",
  support_address: "Dhaka, Bangladesh",
  hero_title: "Dress to Impress",
  hero_subtitle: "Explore our premium collection of fashion for every occasion.",
  footer_about: "Pristto is your go-to destination for premium fashion.",
  free_shipping_threshold: "1000",
};

// GET /settings — all settings (public)
export const getAllSettings = catchAsync(async (_req: Request, res: Response) => {
  let settings = await prisma.contentSetting.findMany();

  // Seed defaults if empty
  if (settings.length === 0) {
    const created = await Promise.all(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) =>
        prisma.contentSetting.create({ data: { key, value } })
      )
    );
    settings = created;
  }

  // Convert array to key-value map for convenience
  const map: Record<string, string> = {};
  settings.forEach((s) => { map[s.key] = s.value; });

  res.status(200).json({ status: "success", data: { list: settings, map } });
});

// PATCH /settings/:key — update a setting (Admin/Manager only)
export const updateSetting = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!value || typeof value !== "string") {
    res.status(400).json({ status: "fail", message: "Value is required." });
    return;
  }

  const setting = await prisma.contentSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  res.status(200).json({ status: "success", data: setting });
});
