import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  InvoiceService,
  type InvoiceWithItems,
} from "@/services/invoiceService";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Edit, Printer, Download, Loader2 } from "lucide-react";
import { InvoiceDialog } from "@/components/dialogs/InvoiceDialog";

export default function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { canCreateProjects } = usePermissions();
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithItems | null>(
    null
  );

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetails();
    }
  }, [invoiceId]);

  const fetchInvoiceDetails = async () => {
    if (!invoiceId) return;

    try {
      setLoading(true);
      const invoiceData = await InvoiceService.getInvoiceById(invoiceId);
      setInvoice(invoiceData);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch invoice details");
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "paid":
        return "bg-green-100 text-green-800";
      case "partial":
        return "bg-blue-100 text-blue-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEdit = () => {
    if (invoice) {
      setEditingInvoice(invoice);
    }
  };

  const handleEditSuccess = () => {
    setEditingInvoice(null);
    fetchInvoiceDetails();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading invoice...</span>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <h2 className="text-2xl font-bold mb-4">Invoice not found</h2>
        <Button onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  // Get project ID from milestone data
  const projectId =
    invoice?.milestones?.project_id || invoice?.milestones?.projects?.id || "";

  return (
    <div className="space-y-6">
      {/* Header - Hidden in print */}
      <div className="flex flex-col gap-4 print:hidden">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold">
              Invoice {invoice.invoice_number}
            </h1>
            <p className="text-muted-foreground">
              {invoice.milestones?.projects?.name} - {invoice.milestones?.name}
            </p>
          </div>
          <div className="flex gap-2">
            {canCreateProjects() && projectId && (
              <Button variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Invoice
              </Button>
            )}
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 print:p-6">
          {/* Company Header */}
          <div className="text-center mb-8 print:mb-6">
            <h1 className="text-4xl font-bold text-primary print:text-black">
              INVOICE
            </h1>
            <p className="text-lg text-muted-foreground print:text-gray-600 mt-2">
              WorkWise OneApp
            </p>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 print:mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">
                    Invoice #:
                  </span>
                  <span className="font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">
                    Issue Date:
                  </span>
                  <span>
                    {format(new Date(invoice.issue_date), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">
                    Due Date:
                  </span>
                  <span>
                    {format(new Date(invoice.due_date), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">
                    Status:
                  </span>
                  <Badge className={getStatusColor(invoice.status || "draft")}>
                    {invoice.status?.replace("_", " ") || "draft"}
                  </Badge>
                </div>
                {invoice.payment_terms && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground print:text-gray-600">
                      Payment Terms:
                    </span>
                    <span>{invoice.payment_terms}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Bill To</h3>
              <div className="space-y-1">
                <p className="font-medium">{invoice.client_name}</p>
                {invoice.client_email && (
                  <p className="text-muted-foreground print:text-gray-600">
                    {invoice.client_email}
                  </p>
                )}
                {invoice.client_address && (
                  <div className="text-muted-foreground print:text-gray-600 whitespace-pre-line">
                    {invoice.client_address}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8 print:mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-primary print:border-black">
                  <th className="text-left py-3 px-4 font-semibold">
                    Description
                  </th>
                  <th className="text-center py-3 px-4 font-semibold">Type</th>
                  <th className="text-center py-3 px-4 font-semibold">Qty</th>
                  <th className="text-right py-3 px-4 font-semibold">Rate</th>
                  <th className="text-right py-3 px-4 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_items?.map((item, index) => (
                  <tr
                    key={item.id || index}
                    className="border-b border-gray-200 print:border-gray-400"
                  >
                    <td className="py-3 px-4">{item.description}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="text-xs">
                        {item.item_type || "custom"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.quantity || 1}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8 print:mb-6">
            <div className="w-80 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground print:text-gray-600">
                  Subtotal:
                </span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax_rate && invoice.tax_rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground print:text-gray-600">
                    Tax ({invoice.tax_rate}%):
                  </span>
                  <span>{formatCurrency(invoice.tax_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold border-t pt-2 print:border-black">
                <span>Total:</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.amount_paid && invoice.amount_paid > 0 && (
                <div className="flex justify-between text-green-600 print:text-green-800">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(invoice.amount_paid)}</span>
                </div>
              )}
              {invoice.balance_due > 0 && (
                <div className="flex justify-between text-red-600 print:text-red-800 font-semibold">
                  <span>Balance Due:</span>
                  <span>{formatCurrency(invoice.balance_due)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-6 print:mb-4">
              <h3 className="text-lg font-semibold mb-2">Notes</h3>
              <p className="text-muted-foreground print:text-gray-600 whitespace-pre-line">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground print:text-gray-600 border-t pt-4 print:border-black">
            <p>Thank you for your business!</p>
            <p className="mt-1">
              Generated on {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Invoice Dialog */}
      {editingInvoice && projectId && (
        <InvoiceDialog
          projectId={projectId}
          invoice={editingInvoice}
          open={!!editingInvoice}
          onOpenChange={(open) => !open && setEditingInvoice(null)}
          onSuccess={handleEditSuccess}
        >
          <div style={{ display: "none" }} />
        </InvoiceDialog>
      )}
    </div>
  );
}
