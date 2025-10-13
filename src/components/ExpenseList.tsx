import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  FinancialService,
  type ProjectExpenseWithDetails,
} from "@/services/financialService";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Receipt,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { ExpenseDialog } from "./dialogs/ExpenseDialog";
import { formatCurrency } from "@/lib/utils";

interface ExpenseListProps {
  expenses: ProjectExpenseWithDetails[];
  projectId: string;
  onRefresh: () => void;
  currency?: string;
}

export function ExpenseList({
  expenses,
  projectId,
  onRefresh,
  currency = "USD",
}: ExpenseListProps) {
  const { canManageExpenses } = usePermissions();
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] =
    useState<ProjectExpenseWithDetails | null>(null);

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case "materials":
        return "bg-blue-100 text-blue-800";
      case "equipment":
        return "bg-purple-100 text-purple-800";
      case "labor":
        return "bg-green-100 text-green-800";
      case "transportation":
        return "bg-yellow-100 text-yellow-800";
      case "permits":
        return "bg-red-100 text-red-800";
      case "utilities":
        return "bg-cyan-100 text-cyan-800";
      case "other":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatPaymentMethod = (method: string | null) => {
    if (!method) return "N/A";
    return method
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await FinancialService.deleteExpense(expenseId);
      toast.success("Expense deleted successfully");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete expense");
    } finally {
      setDeleteExpenseId(null);
    }
  };

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No expenses yet</h3>
          <p className="text-muted-foreground mb-4 text-lg">
            Record your first expense to start tracking project costs
          </p>
          <ExpenseDialog
            projectId={projectId}
            onSuccess={onRefresh}
            currency={currency}
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Record Expense
            </Button>
          </ExpenseDialog>
        </CardContent>
      </Card>
    );
  }

  // Calculate total expenses
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">
            Expenses ({expenses.length})
          </h3>
          <p className="text-lg text-muted-foreground">
            Total: {formatCurrency(totalExpenses, currency)}
          </p>
        </div>
        <ExpenseDialog
          projectId={projectId}
          onSuccess={onRefresh}
          currency={currency}
        >
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Record Expense
          </Button>
        </ExpenseDialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">
                    {format(new Date(expense.expense_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="font-medium truncate">
                        {expense.description}
                      </p>
                      {expense.receipt_url && (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Receipt
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={getCategoryColor(expense.expense_category)}
                    >
                      {expense.expense_category || "other"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {expense.assigned_member?.full_name || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatPaymentMethod(expense.payment_method)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {expense.milestone?.name || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(expense.amount, currency)}
                  </TableCell>
                  <TableCell>
                    {canManageExpenses() && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingExpense(expense);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteExpenseId(expense.id);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Expense Dialog */}
      {editingExpense && (
        <ExpenseDialog
          projectId={projectId}
          expense={editingExpense}
          open={!!editingExpense}
          onOpenChange={(open) => !open && setEditingExpense(null)}
          onSuccess={() => {
            setEditingExpense(null);
            onRefresh();
          }}
          currency={currency}
        >
          <div style={{ display: "none" }} />
        </ExpenseDialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteExpenseId}
        onOpenChange={() => setDeleteExpenseId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteExpenseId && handleDeleteExpense(deleteExpenseId)
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
