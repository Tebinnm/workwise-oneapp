import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type PaymentRecord = Database["public"]["Tables"]["payment_records"]["Row"];
type PaymentRecordInsert =
  Database["public"]["Tables"]["payment_records"]["Insert"];

export class PaymentService {
  /**
   * Record a payment against an invoice
   */
  static async recordPayment(
    invoiceId: string,
    paymentData: Omit<PaymentRecordInsert, "invoice_id" | "recorded_by">
  ): Promise<PaymentRecord> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("payment_records")
      .insert({
        ...paymentData,
        invoice_id: invoiceId,
        recorded_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    // The trigger will automatically update the invoice status
    return data;
  }

  /**
   * Get payments for an invoice
   */
  static async getPaymentsByInvoice(
    invoiceId: string
  ): Promise<PaymentRecord[]> {
    const { data, error } = await supabase
      .from("payment_records")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Calculate invoice balance
   */
  static async calculateInvoiceBalance(invoiceId: string): Promise<{
    total: number;
    paid: number;
    balance: number;
  }> {
    // Get invoice total
    const { data: invoice } = await supabase
      .from("invoices")
      .select("total, amount_paid, balance_due")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    return {
      total: Number(invoice.total),
      paid: Number(invoice.amount_paid),
      balance: Number(invoice.balance_due),
    };
  }

  /**
   * Update invoice payment status (called automatically by trigger, but can be used manually)
   */
  static async updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
    // Get all payments for this invoice
    const { data: payments } = await supabase
      .from("payment_records")
      .select("payment_amount")
      .eq("invoice_id", invoiceId);

    const totalPaid =
      payments?.reduce(
        (sum, payment) => sum + Number(payment.payment_amount),
        0
      ) || 0;

    // Get invoice total
    const { data: invoice } = await supabase
      .from("invoices")
      .select("total")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const total = Number(invoice.total);
    const balanceDue = total - totalPaid;

    // Determine status
    let status: "pending" | "partial" | "paid" = "pending";
    if (totalPaid >= total) {
      status = "paid";
    } else if (totalPaid > 0) {
      status = "partial";
    }

    // Update invoice
    const { error } = await supabase
      .from("invoices")
      .update({
        amount_paid: totalPaid,
        balance_due: balanceDue,
        status,
      })
      .eq("id", invoiceId);

    if (error) throw error;
  }

  /**
   * Delete a payment record
   */
  static async deletePayment(paymentId: string): Promise<void> {
    // Get the invoice ID first
    const { data: payment } = await supabase
      .from("payment_records")
      .select("invoice_id")
      .eq("id", paymentId)
      .single();

    const { error } = await supabase
      .from("payment_records")
      .delete()
      .eq("id", paymentId);

    if (error) throw error;

    // Update invoice status
    if (payment) {
      await this.updateInvoicePaymentStatus(payment.invoice_id);
    }
  }

  /**
   * Get payment history for a project
   */
  static async getProjectPaymentHistory(
    projectId: string
  ): Promise<PaymentRecord[]> {
    // Get milestones for the project
    const { data: milestones } = await supabase
      .from("milestones")
      .select("id")
      .eq("project_id", projectId);

    if (!milestones || milestones.length === 0) {
      return [];
    }

    // Get invoices for these milestones
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .in(
        "milestone_id",
        milestones.map((m) => m.id)
      );

    if (!invoices || invoices.length === 0) {
      return [];
    }

    // Get payments for these invoices
    const { data: payments, error } = await supabase
      .from("payment_records")
      .select("*")
      .in(
        "invoice_id",
        invoices.map((inv) => inv.id)
      )
      .order("payment_date", { ascending: false });

    if (error) throw error;
    return payments;
  }

  /**
   * Get total payments received for a project
   */
  static async getProjectTotalPayments(projectId: string): Promise<number> {
    const payments = await this.getProjectPaymentHistory(projectId);
    return payments.reduce(
      (sum, payment) => sum + Number(payment.payment_amount),
      0
    );
  }

  /**
   * Update a payment record
   */
  static async updatePayment(
    paymentId: string,
    updates: Partial<Omit<PaymentRecordInsert, "invoice_id" | "recorded_by">>
  ): Promise<PaymentRecord> {
    // Get the invoice ID first
    const { data: payment } = await supabase
      .from("payment_records")
      .select("invoice_id")
      .eq("id", paymentId)
      .single();

    const { data, error } = await supabase
      .from("payment_records")
      .update(updates)
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;

    // Update invoice status
    if (payment) {
      await this.updateInvoicePaymentStatus(payment.invoice_id);
    }

    return data;
  }
}


