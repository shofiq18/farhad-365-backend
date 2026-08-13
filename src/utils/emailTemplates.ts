interface OtpEmailOptions {
  title: string;
  name?: string;
  description: string;
  otp: string;
  expiresMinutes?: number;
}

export const generateOtpEmailTemplate = ({
  title,
  name,
  description,
  otp,
  expiresMinutes = 10,
}: OtpEmailOptions): string => {
  const greeting = name ? `Hello ${name},` : "Hello,";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Top Accent Bar -->
          <tr>
            <td style="background-color: #2563eb; height: 6px; width: 100%;"></td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background-color: #ffffff; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 2px; text-transform: uppercase;">
                PRISTTO
              </span>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 700; line-height: 1.3;">
                ${title}
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 28px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                ${description}
              </p>

              <!-- OTP Code Container -->
              <div style="background-color: #eff6ff; border: 2px dashed #2563eb; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="display: block; font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
                  Your Verification Code
                </span>
                <span style="display: inline-block; font-size: 36px; font-weight: 900; font-family: 'Courier New', Courier, monospace; color: #1e40af; letter-spacing: 10px; padding-left: 10px;">
                  ${otp}
                </span>
                <div style="margin-top: 14px; font-size: 13px; color: #64748b; font-weight: 500;">
                  ⏱️ Valid for <strong style="color: #0f172a;">${expiresMinutes} minutes</strong>
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-top: 28px;">
                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                  <strong>Security Note:</strong> Never share this code with anyone. Pristto staff will never ask for your verification code. If you did not request this email, you can safely ignore it.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;">
              <p style="margin: 0 0 6px 0;">&copy; ${new Date().getFullYear()} Pristto Inc. All rights reserved.</p>
              <p style="margin: 0;">Automated notification. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};
