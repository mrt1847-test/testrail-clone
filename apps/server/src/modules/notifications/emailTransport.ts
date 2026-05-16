import { env } from "../../config/env.js";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmailMessage(message: EmailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  if (env.emailDeliveryMode === "disabled") {
    return { ok: false, error: "email delivery disabled" };
  }

  if (env.emailDeliveryMode === "smtp" && env.smtpHost) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth:
          env.smtpUser && env.smtpPass
            ? {
                user: env.smtpUser,
                pass: env.smtpPass
              }
            : undefined
      });
      await transport.sendMail({
        from: env.emailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text
      });
      return { ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : "smtp send failed";
      return { ok: false, error };
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      type: "email_delivery",
      to: message.to,
      subject: message.subject,
      preview: message.text.slice(0, 500)
    })
  );
  return { ok: true };
}
