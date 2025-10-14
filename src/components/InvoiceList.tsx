import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  InvoiceService,
  type InvoiceWithItems,
} from "@/services/invoiceService";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Receipt, MoreHorizontal, Edit, Trash2, Eye, Plus } from "lucide-react";
import { InvoiceDialog } from "./dialogs/InvoiceDialog";
import { formatCurrency } from "@/lib/utils";

interface InvoiceListProps {
  invoices: InvoiceWithItems[];
  projectId: string;
  onRefresh: () => void;
  currency?: string;
}

export function InvoiceList({
  invoices,
  projectId,
  onRefresh,
  currency = "USD",
}: InvoiceListProps) {
  const navigate = useNavigate();
  const { canManageInvoices } = usePermissions();
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithItems | null>(
    null
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-invoice-draft text-invoice-draft-foreground";
      case "pending":
        return "bg-invoice-pending text-invoice-pending-foreground";
      case "paid":
        return "bg-invoice-paid text-invoice-paid-foreground";
      case "partial":
        return "bg-invoice-partially-paid text-invoice-partially-paid-foreground";
      case "overdue":
        return "bg-invoice-overdue text-invoice-overdue-foreground";
      case "cancelled":
        return "bg-invoice-cancelled text-invoice-cancelled-foreground";
      default:
        return "bg-invoice-default text-invoice-default-foreground";
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await InvoiceService.deleteInvoice(invoiceId);
      toast.success("Invoice deleted successfully");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete invoice");
    } finally {
      setDeleteInvoiceId(null);
    }
  };

  const handleViewInvoice = (invoice: InvoiceWithItems) => {
    navigate(`/invoices/${invoice.id}`);
  };

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first invoice to start tracking payments
          </p>
          {canManageInvoices() && (
            <InvoiceDialog
              projectId={projectId}
              onSuccess={onRefresh}
              currency={currency}
            >
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </InvoiceDialog>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Invoices ({invoices.length})</h3>
        {canManageInvoices() && (
          <InvoiceDialog
            projectId={projectId}
            onSuccess={onRefresh}
            currency={currency}
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </InvoiceDialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewInvoice(invoice)}
                >
                  <TableCell className="font-medium">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.client_name}</div>
                      {invoice.client_email && (
                        <div className="text-sm text-muted-foreground">
                          {invoice.client_email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.issue_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.due_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={getStatusColor(invoice.status || "draft")}
                    >
                      {invoice.status?.replace("_", " ") || "draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.subtotal, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.tax_amount || 0, currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.total, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.amount_paid || 0, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        invoice.balance_due > 0
                          ? "text-destructive font-medium"
                          : "text-success font-medium"
                      }
                    >
                      {formatCurrency(invoice.balance_due, currency)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewInvoice(invoice);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {canManageInvoices() && (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInvoice(invoice);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteInvoiceId(invoice.id);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Invoice Dialog */}
      <InvoiceDialog
        projectId={projectId}
        invoice={editingInvoice}
        open={!!editingInvoice}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
        onSuccess={() => {
          setEditingInvoice(null);
          onRefresh();
        }}
        currency={currency}
      >
        <div style={{ display: "none" }} />
      </InvoiceDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteInvoiceId}
        onOpenChange={() => setDeleteInvoiceId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot
              be undone and will also delete all associated invoice items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteInvoiceId && handleDeleteInvoice(deleteInvoiceId)
              }
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
