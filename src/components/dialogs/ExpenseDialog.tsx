import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FinancialService,
  type ProjectExpenseWithDetails,
} from "@/services/financialService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface ExpenseDialogProps {
  children: React.ReactNode;
  projectId: string;
  expense?: ProjectExpenseWithDetails;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  currency?: string;
}

const EXPENSE_CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "equipment", label: "Equipment" },
  { value: "labor", label: "Labor" },
  { value: "transportation", label: "Transportation" },
  { value: "permits", label: "Permits" },
  { value: "utilities", label: "Utilities" },
  { value: "other", label: "Other" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "online", label: "Online Payment" },
  { value: "other", label: "Other" },
];

export function ExpenseDialog({
  children,
  projectId,
  expense,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  currency = "USD",
}: ExpenseDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    amount: expense?.amount || 0,
    description: expense?.description || "",
    expense_date: expense?.expense_date
      ? new Date(expense.expense_date)
      : new Date(),
    expense_category: expense?.expense_category || "other",
    receipt_url: expense?.receipt_url || "",
    assigned_to: expense?.assigned_to || undefined,
    payment_method: expense?.payment_method || "cash",
    milestone_id: expense?.milestone_id || undefined,
  });

  useEffect(() => {
    if (open) {
      fetchMilestones();
      fetchProjectMembers();
      // Set default assigned member to current user if creating new expense
      if (!expense) {
        setDefaultAssignedMember();
      }
    }
  }, [open]);

  useEffect(() => {
    if (expense) {
      setFormData({
        amount: expense.amount || 0,
        description: expense.description || "",
        expense_date: expense.expense_date
          ? new Date(expense.expense_date)
          : new Date(),
        expense_category: expense.expense_category || "other",
        receipt_url: expense.receipt_url || "",
        assigned_to: expense.assigned_to || undefined,
        payment_method: expense.payment_method || "cash",
        milestone_id: expense.milestone_id || undefined,
      });
    }
  }, [expense]);

  const setDefaultAssignedMember = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setFormData((prev) => ({ ...prev, assigned_to: user.id }));
    }
  };

  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, name")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error("Error fetching milestones:", error);
    }
  };

  const fetchProjectMembers = async () => {
    try {
      // Get all unique members from all milestones of the project
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("milestones")
        .select("id")
        .eq("project_id", projectId);

      if (milestonesError) throw milestonesError;

      if (!milestonesData || milestonesData.length === 0) {
        // If no milestones, get all profiles as fallback
        const { data: allProfiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .order("full_name");

        if (profilesError) throw profilesError;
        setProjectMembers(allProfiles || []);
        return;
      }

      const milestoneIds = milestonesData.map((m) => m.id);

      const { data: membersData, error: membersError } = await supabase
        .from("project_members")
        .select(
          `
          user_id,
          profiles!inner (
            id,
            full_name
          )
        `
        )
        .in("milestone_id", milestoneIds);

      if (membersError) throw membersError;

      // Remove duplicates by user_id
      const uniqueMembers = Array.from(
        new Map(
          (membersData || []).map((m: any) => [
            m.profiles.id,
            {
              id: m.profiles.id,
              full_name: m.profiles.full_name,
            },
          ])
        ).values()
      );

      setProjectMembers(uniqueMembers);
    } catch (error) {
      console.error("Error fetching project members:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    try {
      setLoading(true);

      const expenseData: any = {
        amount: formData.amount,
        description: formData.description.trim(),
        expense_date: format(formData.expense_date, "yyyy-MM-dd"),
        expense_category: formData.expense_category || null,
        receipt_url: formData.receipt_url?.trim() || null,
        assigned_to: formData.assigned_to || null,
        payment_method: formData.payment_method || null,
        project_id: projectId, // Always set project_id
      };

      // Optionally add milestone_id if selected
      if (formData.milestone_id) {
        expenseData.milestone_id = formData.milestone_id;
      } else {
        expenseData.milestone_id = null;
      }

      if (expense) {
        // Update existing expense
        await FinancialService.updateExpense(expense.id, expenseData);
        toast.success("Expense updated successfully");
      } else {
        // Create new expense
        await FinancialService.recordExpense(expenseData);
        toast.success("Expense recorded successfully");
      }

      setOpen(false);
      if (onSuccess) onSuccess();

      // Reset form if creating new expense
      if (!expense) {
        setFormData({
          amount: 0,
          description: "",
          expense_date: new Date(),
          expense_category: "other",
          receipt_url: "",
          assigned_to: undefined,
          payment_method: "cash",
          milestone_id: undefined,
        });
        setDefaultAssignedMember();
      }
    } catch (error: any) {
      console.error("Error saving expense:", error);
      toast.error(error.message || "Failed to save expense");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !expense) {
      // Reset form when closing if creating new expense
      setFormData({
        amount: 0,
        description: "",
        expense_date: new Date(),
        expense_category: "other",
        receipt_url: "",
        assigned_to: undefined,
        payment_method: "cash",
        milestone_id: undefined,
      });
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {expense ? "Edit Expense" : "Record New Expense"}
          </DialogTitle>
          <DialogDescription className="text-lg">
            {expense
              ? "Update expense details below"
              : "Enter the expense details below"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount ({currency}) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                required
              />
            </div>

            {/* Expense Date */}
            <div className="space-y-2">
              <Label>
                Expense Date <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.expense_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expense_date ? (
                      format(formData.expense_date, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.expense_date}
                    onSelect={(date) =>
                      date && setFormData({ ...formData, expense_date: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Enter expense description..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.expense_category}
                onValueChange={(value) =>
                  setFormData({ ...formData, expense_category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) =>
                  setFormData({ ...formData, payment_method: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Assigned Member */}
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select
                value={formData.assigned_to || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, assigned_to: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select member (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {projectMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Milestone */}
            <div className="space-y-2">
              <Label htmlFor="milestone">Milestone (Optional)</Label>
              <Select
                value={formData.milestone_id || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, milestone_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select milestone (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {milestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {milestone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Receipt URL */}
          <div className="space-y-2">
            <Label htmlFor="receipt_url">Receipt URL (Optional)</Label>
            <Input
              id="receipt_url"
              type="url"
              placeholder="https://..."
              value={formData.receipt_url}
              onChange={(e) =>
                setFormData({ ...formData, receipt_url: e.target.value })
              }
            />
            <p className="text-lg text-muted-foreground">
              Link to receipt image or document
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {expense ? "Update Expense" : "Record Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
