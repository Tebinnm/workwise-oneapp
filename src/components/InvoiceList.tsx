import { useState } from "react";
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

interface InvoiceListProps {
  invoices: InvoiceWithItems[];
  projectId: string;
  onRefresh: () => void;
}

export function InvoiceList({
  invoices,
  projectId,
  onRefresh,
}: InvoiceListProps) {
  const { canCreateProjects } = usePermissions();
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithItems | null>(
    null
  );

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
    // For now, we'll just show a toast. In the future, this could open a detailed view
    toast.info(`Invoice ${invoice.invoice_number} details`);
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
          {canCreateProjects() && (
            <InvoiceDialog projectId={projectId} onSuccess={onRefresh}>
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
        {canCreateProjects() && (
          <InvoiceDialog projectId={projectId} onSuccess={onRefresh}>
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
                <TableRow key={invoice.id}>
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
                    {formatCurrency(invoice.subtotal)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.tax_amount || 0)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.amount_paid || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        invoice.balance_due > 0
                          ? "text-red-600 font-medium"
                          : "text-green-600 font-medium"
                      }
                    >
                      {formatCurrency(invoice.balance_due)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {canCreateProjects() && (
                          <>
                            <DropdownMenuItem
                              onClick={() => setEditingInvoice(invoice)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteInvoiceId(invoice.id)}
                              className="text-red-600"
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
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
