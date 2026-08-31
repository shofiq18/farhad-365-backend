import nodemailer from "nodemailer";
import AppError from "./appError";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: SendEmailOptions) => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || "587");
  const secure = (process.env.EMAIL_SECURE || process.env.SMTP_SECURE) === "true";

  if (!user || !pass) {
    console.warn("=========================================");
    console.warn("WARNING: SMTP credentials (EMAIL_USER/EMAIL_PASS) are not configured in .env!");
    console.warn("Simulating Email delivery in console logs:");
    console.warn(`To: ${options.to}`);
    console.warn(`Subject: ${options.subject}`);
    console.warn(`Body: ${options.html.replace(/<[^>]*>/g, ' ')}`);
    console.warn("=========================================");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const fromName = process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || "Pristto";
    const fromEmail = process.env.EMAIL_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || user;

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${options.to} (MessageId: ${info.messageId})`);
    return info;
  } catch (error: any) {
    console.error(`Failed to send email to ${options.to}:`, error);
    throw new AppError(
      `Email delivery failed: ${error?.message || "Internal Mail Server Error"}`,
      500
    );
  }
};

export default sendEmail;
