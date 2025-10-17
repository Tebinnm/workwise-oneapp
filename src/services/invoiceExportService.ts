import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { InvoiceService } from "./invoiceService";
import type { Database } from "@/integrations/supabase/types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];

export interface InvoiceForExport extends Invoice {
  invoice_items?: InvoiceItem[];
  milestones?: {
    name: string;
    projects?: {
      name: string;
      site_location: string | null;
    };
  };
}

export class InvoiceExportService {
  /**
   * Generate PDF from invoice
   */
  static async generateInvoicePDF(invoiceId: string): Promise<Blob> {
    // Get invoice data
    const invoice = await InvoiceService.getInvoiceById(invoiceId);

    // Create a temporary div with the invoice HTML
    const element = this.createPrintableElement(invoice);
    document.body.appendChild(element);

    try {
      // Convert to canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Create PDF
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? "portrait" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

      // Return as blob
      return pdf.output("blob");
    } finally {
      // Clean up
      document.body.removeChild(element);
    }
  }

  /**
   * Download invoice as PDF
   */
  static async downloadInvoicePDF(
    invoiceId: string,
    filename?: string
  ): Promise<void> {
    const invoice = await InvoiceService.getInvoiceById(invoiceId);
    const blob = await this.generateInvoicePDF(invoiceId);

    const name =
      filename ||
      `Invoice-${invoice.invoice_number}-${
        new Date().toISOString().split("T")[0]
      }.pdf`;

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate printable HTML
   */
  static generatePrintableHTML(invoice: InvoiceForExport): string {
    const items = invoice.invoice_items || [];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
          .header h1 { color: #2563eb; font-size: 32px; margin-bottom: 5px; }
          .header .invoice-number { font-size: 14px; color: #666; }
          .company-info { margin-bottom: 30px; }
          .company-info h2 { font-size: 18px; margin-bottom: 10px; color: #2563eb; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-section h3 { font-size: 14px; color: #666; margin-bottom: 10px; text-transform: uppercase; }
          .info-section p { margin-bottom: 5px; line-height: 1.6; }
          .invoice-details { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
          .invoice-details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .detail-item strong { display: block; color: #666; font-size: 12px; margin-bottom: 5px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-partial { background: #dbeafe; color: #1e40af; }
          .status-overdue { background: #fee2e2; color: #991b1b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          thead { background: #2563eb; color: white; }
          th { padding: 12px; text-align: left; font-size: 14px; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          tbody tr:hover { background: #f9fafb; }
          .text-right { text-align: right; }
          .totals { margin-left: auto; width: 300px; }
          .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .totals-row.total { font-size: 18px; font-weight: bold; color: #2563eb; border-top: 3px solid #2563eb; border-bottom: none; margin-top: 10px; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #666; font-size: 12px; }
          .notes { margin-top: 30px; padding: 15px; background: #f9fafb; border-left: 4px solid #2563eb; }
          .notes h4 { margin-bottom: 10px; color: #2563eb; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INVOICE</h1>
          <div class="invoice-number">${invoice.invoice_number}</div>
        </div>

        <div class="company-info">
          <h2>WorkWise OneApp</h2>
          <p>Project Management Solutions</p>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <h3>Bill To</h3>
            <p><strong>${invoice.client_name}</strong></p>
            ${invoice.client_email ? `<p>${invoice.client_email}</p>` : ""}
            ${invoice.client_address ? `<p>${invoice.client_address}</p>` : ""}
          </div>

          <div class="info-section">
            <h3>Project Details</h3>
            <p><strong>Project:</strong> ${
              invoice.milestones?.projects?.name || "N/A"
            }</p>
            <p><strong>Milestone:</strong> ${
              invoice.milestones?.name || "N/A"
            }</p>
            ${
              invoice.milestones?.projects?.site_location
                ? `<p><strong>Location:</strong> ${invoice.milestones.projects.site_location}</p>`
                : ""
            }
          </div>
        </div>

        <div class="invoice-details">
          <div class="invoice-details-grid">
            <div class="detail-item">
              <strong>Issue Date</strong>
              <div>${new Date(invoice.issue_date).toLocaleDateString()}</div>
            </div>
            <div class="detail-item">
              <strong>Due Date</strong>
              <div>${new Date(invoice.due_date).toLocaleDateString()}</div>
            </div>
            <div class="detail-item">
              <strong>Status</strong>
              <div>
                <span class="status-badge status-${invoice.status}">
                  ${invoice.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Quantity</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td>${item.description}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">$${Number(item.rate).toFixed(2)}</td>
                <td class="text-right">$${Number(item.amount).toFixed(2)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>$${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          ${
            invoice.tax_rate && Number(invoice.tax_rate) > 0
              ? `
          <div class="totals-row">
            <span>Tax (${invoice.tax_rate}%):</span>
            <span>$${Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          `
              : ""
          }
          <div class="totals-row total">
            <span>Total:</span>
            <span>$${Number(invoice.total).toFixed(2)}</span>
          </div>
          ${
            Number(invoice.amount_paid) > 0
              ? `
          <div class="totals-row">
            <span>Amount Paid:</span>
            <span>$${Number(invoice.amount_paid).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Balance Due:</span>
            <span>$${Number(invoice.balance_due).toFixed(2)}</span>
          </div>
          `
              : ""
          }
        </div>

        ${
          invoice.notes
            ? `
        <div class="notes">
          <h4>Notes</h4>
          <p>${invoice.notes}</p>
        </div>
        `
            : ""
        }

        ${
          invoice.payment_terms
            ? `
        <div class="notes">
          <h4>Payment Terms</h4>
          <p>${invoice.payment_terms}</p>
        </div>
        `
            : ""
        }

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create printable element (for PDF generation)
   */
  private static createPrintableElement(
    invoice: InvoiceForExport
  ): HTMLElement {
    const div = document.createElement("div");
    div.innerHTML = this.generatePrintableHTML(invoice);
    div.style.position = "absolute";
    div.style.left = "-9999px";
    div.style.width = "210mm"; // A4 width
    div.style.background = "white";
    return div;
  }

  /**
   * Print invoice
   */
  static async printInvoice(invoice: InvoiceForExport): Promise<void> {
    const html = this.generatePrintableHTML(invoice);
    const printWindow = window.open("", "_blank");

    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  /**
   * Export invoice to CSV (items list)
   */
  static exportToCSV(invoice: InvoiceForExport): void {
    const items = invoice.invoice_items || [];

    const headers = ["Description", "Quantity", "Rate", "Amount"];
    const rows = items.map((item) => [
      `"${item.description}"`,
      item.quantity,
      item.rate,
      item.amount,
    ]);

    // Add summary rows
    rows.push([]);
    rows.push(["Subtotal", "", "", invoice.subtotal]);
    if (invoice.tax_rate && Number(invoice.tax_rate) > 0) {
      rows.push([`Tax (${invoice.tax_rate}%)`, "", "", invoice.tax_amount]);
    }
    rows.push(["Total", "", "", invoice.total]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice-${invoice.invoice_number}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
