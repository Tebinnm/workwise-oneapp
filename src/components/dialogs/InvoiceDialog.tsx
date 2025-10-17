import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  InvoiceService,
  type InvoiceWithItems,
} from "@/services/invoiceService";
import { usePermissions } from "@/hooks/usePermissions";
import {
  LeftDrawer,
  LeftDrawerContent,
  LeftDrawerDescription,
  LeftDrawerFooter,
  LeftDrawerHeader,
  LeftDrawerTitle,
  LeftDrawerTrigger,
} from "@/components/ui/left-drawer";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Loader2, Receipt } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  item_type: "wage" | "expense" | "custom";
}

interface InvoiceDialogProps {
  children: React.ReactNode;
  projectId: string;
  milestoneId?: string;
  invoice?: InvoiceWithItems;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  currency?: string;
}

export function InvoiceDialog({
  children,
  projectId,
  milestoneId,
  invoice,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  currency = "USD",
}: InvoiceDialogProps) {
  const { canManageInvoices } = usePermissions();
  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_address: "",
    issue_date: new Date(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    payment_terms: "Net 30",
    tax_rate: 0,
    status: "draft",
    notes: "",
    milestone_id: milestoneId || "",
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: "",
      quantity: 1,
      rate: 0,
      amount: 0,
      item_type: "custom",
    },
  ]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (formData.tax_rate / 100);
  const total = subtotal + taxAmount;

  useEffect(() => {
    if (open) {
      const initializeForm = async () => {
        await fetchMilestones();

        // Small delay to ensure milestones state is updated
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (invoice) {
          // Edit mode - populate form with existing data
          setFormData({
            client_name: invoice.client_name,
            client_email: invoice.client_email || "",
            client_address: invoice.client_address || "",
            issue_date: new Date(invoice.issue_date),
            due_date: new Date(invoice.due_date),
            payment_terms: invoice.payment_terms || "Net 30",
            tax_rate: invoice.tax_rate || 0,
            status: invoice.status || "draft",
            notes: invoice.notes || "",
            milestone_id: invoice.milestone_id,
          });
          setItems(
            invoice.invoice_items?.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity || 1,
              rate: item.rate,
              amount: item.amount,
              item_type: item.item_type as "wage" | "expense" | "custom",
            })) || [
              {
                description: "",
                quantity: 1,
                rate: 0,
                amount: 0,
                item_type: "custom",
              },
            ]
          );
        } else {
          // Create mode - reset form
          setFormData({
            client_name: "",
            client_email: "",
            client_address: "",
            issue_date: new Date(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            payment_terms: "Net 30",
            tax_rate: 0,
            status: "draft",
            notes: "",
            milestone_id: milestoneId || "",
          });
          setItems([
            {
              description: "",
              quantity: 1,
              rate: 0,
              amount: 0,
              item_type: "custom",
            },
          ]);
        }
      };

      initializeForm();
    }
  }, [open, invoice, milestoneId]);

  const fetchMilestones = async (): Promise<void> => {
    if (!projectId || projectId.trim() === "") {
      console.warn("No valid projectId provided for fetching milestones");
      setMilestones([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("milestones")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");

      if (error) throw error;
      setMilestones(data || []);
    } catch (error: any) {
      console.error("Error fetching milestones:", error);
      toast.error("Failed to fetch milestones");
      setMilestones([]);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-calculate amount
    if (field === "quantity" || field === "rate") {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        description: "",
        quantity: 1,
        rate: 0,
        amount: 0,
        item_type: "custom",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageInvoices()) {
      toast.error("You don't have permission to create invoices");
      return;
    }

    if (!formData.client_name.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (!formData.milestone_id) {
      toast.error("Please select a milestone");
      return;
    }

    const validItems = items.filter(
      (item) => item.description.trim() && item.quantity > 0 && item.rate > 0
    );

    if (validItems.length === 0) {
      toast.error("Please add at least one valid line item");
      return;
    }

    setLoading(true);

    try {
      if (invoice) {
        // Update existing invoice
        await InvoiceService.updateInvoice(invoice.id, {
          client_name: formData.client_name,
          client_email: formData.client_email || null,
          client_address: formData.client_address || null,
          issue_date: format(formData.issue_date, "yyyy-MM-dd"),
          due_date: format(formData.due_date, "yyyy-MM-dd"),
          payment_terms: formData.payment_terms,
          tax_rate: formData.tax_rate,
          status: formData.status as any,
          notes: formData.notes || null,
          subtotal,
          tax_amount: taxAmount,
          total,
          balance_due: total - (invoice.amount_paid || 0),
        });

        // Update invoice items
        for (const item of validItems) {
          if (item.id) {
            // Update existing item
            await supabase
              .from("invoice_items")
              .update({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.amount,
                item_type: item.item_type,
              })
              .eq("id", item.id);
          } else {
            // Add new item
            await supabase.from("invoice_items").insert({
              invoice_id: invoice.id,
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              item_type: item.item_type,
              reference_type: "none",
            });
          }
        }

        toast.success("Invoice updated successfully");
      } else {
        // Create new invoice
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const invoiceData = {
          milestone_id: formData.milestone_id,
          client_name: formData.client_name,
          client_email: formData.client_email || null,
          client_address: formData.client_address || null,
          issue_date: format(formData.issue_date, "yyyy-MM-dd"),
          due_date: format(formData.due_date, "yyyy-MM-dd"),
          payment_terms: formData.payment_terms,
          tax_rate: formData.tax_rate,
          status: formData.status as any,
          notes: formData.notes || null,
          subtotal,
          tax_amount: taxAmount,
          total,
          balance_due: total,
          created_by: user?.id,
        };

        const newInvoice = await InvoiceService.createInvoice(invoiceData);

        // Add invoice items
        for (const item of validItems) {
          await supabase.from("invoice_items").insert({
            invoice_id: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
            item_type: item.item_type,
            reference_type: "none",
          });
        }

        toast.success("Invoice created successfully");
      }

      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to save invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LeftDrawer open={open} onOpenChange={setOpen}>
      <LeftDrawerTrigger asChild>{children}</LeftDrawerTrigger>
      <LeftDrawerContent side="right" className="overflow-y-auto">
        <LeftDrawerHeader>
          <LeftDrawerTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {invoice ? "Edit Invoice" : "Create Invoice"}
          </LeftDrawerTitle>
          <LeftDrawerDescription>
            {invoice
              ? "Update invoice details and line items"
              : "Create a new invoice with custom line items"}
          </LeftDrawerDescription>
        </LeftDrawerHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Client Name *</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) =>
                      handleInputChange("client_name", e.target.value)
                    }
                    placeholder="Enter client name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_email">Client Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) =>
                      handleInputChange("client_email", e.target.value)
                    }
                    placeholder="client@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_address">Client Address</Label>
                <Textarea
                  id="client_address"
                  value={formData.client_address}
                  onChange={(e) =>
                    handleInputChange("client_address", e.target.value)
                  }
                  placeholder="Enter client address"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Milestone *</Label>
                  <Select
                    key={`milestone-select-${milestones.length}-${formData.milestone_id}`}
                    value={formData.milestone_id}
                    onValueChange={(value) =>
                      handleInputChange("milestone_id", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select milestone" />
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
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      handleInputChange("status", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.issue_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.issue_date ? (
                          format(formData.issue_date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.issue_date}
                        onSelect={(date) =>
                          date && handleInputChange("issue_date", date)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.due_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.due_date ? (
                          format(formData.due_date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.due_date}
                        onSelect={(date) =>
                          date && handleInputChange("due_date", date)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Input
                    id="payment_terms"
                    value={formData.payment_terms}
                    onChange={(e) =>
                      handleInputChange("payment_terms", e.target.value)
                    }
                    placeholder="Net 30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.tax_rate}
                    onChange={(e) =>
                      handleInputChange(
                        "tax_rate",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Line Items</CardTitle>
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label>Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, "description", e.target.value)
                      }
                      placeholder="Item description"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Type</Label>
                    <Select
                      value={item.item_type}
                      onValueChange={(value) =>
                        handleItemChange(index, "item_type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom</SelectItem>
                        <SelectItem value="wage">Wage</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Rate</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          "rate",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-right">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({formData.tax_rate}%):</span>
                  <span>{formatCurrency(taxAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <LeftDrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invoice ? "Update Invoice" : "Create Invoice"}
            </Button>
          </LeftDrawerFooter>
        </form>
      </LeftDrawerContent>
    </LeftDrawer>
  );
}
