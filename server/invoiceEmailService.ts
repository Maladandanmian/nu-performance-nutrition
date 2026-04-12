import nodemailer from "nodemailer";
import { ENV } from "./_core/env";
import { Invoice, InvoiceLineItem } from "../drizzle/schema";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

function formatCurrency(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${currency} ${num.toFixed(2)}`;
}

function buildInvoiceHtml(
  invoice: Invoice,
  clientName: string,
  clientEmail: string,
  trainerName: string,
  packageType?: string
): string {
  const lineItems = (invoice.lineItems as InvoiceLineItem[]) || [];
  const currency = invoice.currency || "HKD";

  const lineItemRows = lineItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.description}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right;">${formatCurrency(item.unitPrice, currency)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right; font-weight: 500;">${formatCurrency(item.total, currency)}</td>
    </tr>`
    )
    .join("");

  const taxRate = parseFloat(String(invoice.taxRate || "0"));
  const taxRow =
    taxRate > 0
      ? `
    <tr>
      <td colspan="3" style="padding: 8px 12px; text-align: right; font-size: 14px; color: #666;">Tax (${taxRate}%)</td>
      <td style="padding: 8px 12px; text-align: right; font-size: 14px;">${formatCurrency(invoice.taxAmount || "0", currency)}</td>
    </tr>`
      : "";

  const dueDateRow = invoice.dueDate
    ? `<p style="margin: 4px 0; font-size: 14px; color: #666;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>`
    : "";

  const notesSection = invoice.notes
    ? `<div style="margin-top: 24px; padding: 16px; background: #f9f9f9; border-radius: 6px;">
        <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Notes</p>
        <p style="margin: 0; font-size: 14px; color: #444; white-space: pre-line;">${invoice.notes}</p>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 620px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background-color: #578DB3; padding: 28px 32px;">
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Nu Performance Nutrition</h1>
      <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Invoice</p>
    </div>

    <!-- Invoice Meta -->
    <div style="padding: 28px 32px 0; display: flex; justify-content: space-between;">
      <div>
        <p style="margin: 0 0 4px; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Invoice To</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${clientName}</p>
        <p style="margin: 2px 0 0; font-size: 14px; color: #666;">${clientEmail}</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Number</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${invoice.invoiceNumber}</p>
        <p style="margin: 2px 0 0; font-size: 14px; color: #666;">${new Date(invoice.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        ${dueDateRow}
      </div>
    </div>

    ${packageType ? `<div style="padding: 12px 32px 0;"><p style="margin: 0; font-size: 14px; color: #666;"><strong>Package:</strong> ${packageType}</p></div>` : ""}

    <!-- Line Items Table -->
    <div style="padding: 24px 32px 0;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e8e8e8; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Unit Price</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 10px 12px; text-align: right; font-size: 14px; color: #666; border-top: 2px solid #e8e8e8;">Subtotal</td>
            <td style="padding: 10px 12px; text-align: right; font-size: 14px; border-top: 2px solid #e8e8e8;">${formatCurrency(invoice.subtotal, currency)}</td>
          </tr>
          ${taxRow}
          <tr style="background: #f8f9fa;">
            <td colspan="3" style="padding: 12px; text-align: right; font-size: 16px; font-weight: 700; color: #1a1a1a;">Total</td>
            <td style="padding: 12px; text-align: right; font-size: 16px; font-weight: 700; color: #578DB3;">${formatCurrency(invoice.total, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${notesSection ? `<div style="padding: 0 32px;">${notesSection}</div>` : ""}

    <!-- Footer -->
    <div style="padding: 28px 32px; border-top: 1px solid #f0f0f0; margin-top: 28px;">
      <p style="margin: 0; font-size: 13px; color: #999; text-align: center;">
        Issued by ${trainerName} · Nu Performance Nutrition
      </p>
    </div>

  </div>
</body>
</html>`;
}

export async function sendInvoiceEmail(params: {
  invoice: Invoice;
  clientName: string;
  clientEmail: string;
  trainerName: string;
  packageType?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { invoice, clientName, clientEmail, trainerName, packageType } = params;

  try {
    const transporter = getTransporter();
    const html = buildInvoiceHtml(invoice, clientName, clientEmail, trainerName, packageType);

    await transporter.sendMail({
      from: `"Nu Performance Nutrition" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: `Invoice ${invoice.invoiceNumber} — Nu Performance Nutrition`,
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[InvoiceEmail] Failed to send invoice:", error);
    return { success: false, error: error.message };
  }
}
