import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BudgetService, WageType } from "@/services/budgetService";
import { Settings } from "lucide-react";

interface MemberWageConfigDialogProps {
  userId: string;
  userName: string;
  projectId?: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function MemberWageConfigDialog({
  userId,
  userName,
  projectId,
  children,
  onSuccess,
}: MemberWageConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wageType, setWageType] = useState<WageType>("daily");
  const [dailyRate, setDailyRate] = useState<string>("");
  const [monthlySalary, setMonthlySalary] = useState<string>("");
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState<string>("26");

  useEffect(() => {
    if (open) {
      loadWageConfig();
    }
  }, [open, userId, projectId]);

  const loadWageConfig = async () => {
    try {
      const config = await BudgetService.getMemberWageConfig(userId, projectId);
      if (config) {
        setWageType(config.wage_type);
        setDailyRate(config.daily_rate?.toString() || "");
        setMonthlySalary(config.monthly_salary?.toString() || "");
        setWorkingDaysPerMonth(
          config.default_working_days_per_month?.toString() || "26"
        );
      }
    } catch (error) {
      console.error("Error loading wage config:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await BudgetService.updateMemberWageConfig(
        userId,
        {
          wage_type: wageType,
          daily_rate: dailyRate ? parseFloat(dailyRate) : undefined,
          monthly_salary: monthlySalary ? parseFloat(monthlySalary) : undefined,
          default_working_days_per_month: workingDaysPerMonth
            ? parseInt(workingDaysPerMonth)
            : 26,
        },
        projectId
      );

      if (success) {
        toast.success("Wage configuration updated successfully");
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error("Failed to update wage configuration");
      }
    } catch (error) {
      toast.error("An error occurred");
      console.error("Error updating wage config:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure Wage
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Configure Wage Settings</DialogTitle>
            <DialogDescription className="text-lg">
              Set wage configuration for {userName}
              {projectId && " (Project-specific)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Wage Type */}
            <div className="space-y-2">
              <Label htmlFor="wage-type">Wage Type</Label>
              <Select
                value={wageType}
                onValueChange={(value) => setWageType(value as WageType)}
              >
                <SelectTrigger id="wage-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Wage</SelectItem>
                  <SelectItem value="monthly">Monthly Wage</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-lg text-muted-foreground">
                Select whether this member is paid daily or monthly
              </p>
            </div>

            {/* Daily Rate (shown for both types) */}
            {wageType === "daily" && (
              <div className="space-y-2">
                <Label htmlFor="daily-rate">Daily Rate ($)</Label>
                <Input
                  id="daily-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter daily rate"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  required
                />
                <p className="text-lg text-muted-foreground">
                  Amount paid per full day of work
                </p>
              </div>
            )}

            {/* Monthly Salary */}
            {wageType === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="monthly-salary">Monthly Salary ($)</Label>
                <Input
                  id="monthly-salary"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter monthly salary"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  required
                />
                <p className="text-lg text-muted-foreground">
                  Fixed monthly salary amount
                </p>
              </div>
            )}

            {/* Working Days Per Month */}
            <div className="space-y-2">
              <Label htmlFor="working-days">
                Default Working Days Per Month
              </Label>
              <Input
                id="working-days"
                type="number"
                min="1"
                max="31"
                placeholder="26"
                value={workingDaysPerMonth}
                onChange={(e) => setWorkingDaysPerMonth(e.target.value)}
              />
              <p className="text-lg text-muted-foreground">
                Used for monthly budget proration calculations (typically 22-26
                days)
              </p>
            </div>

            {/* Budget Calculation Preview */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-medium text-sm">
                Budget Calculation Preview
              </h4>
              <div className="text-sm text-muted-foreground space-y-1">
                {wageType === "daily" && dailyRate && (
                  <>
                    <p className="text-lg">
                      • Full Day: ${parseFloat(dailyRate).toFixed(2)}
                    </p>
                    <p className="text-lg">
                      • Half Day: ${(parseFloat(dailyRate) * 0.5).toFixed(2)}
                    </p>
                    <p className="text-lg">• Absent: $0.00</p>
                  </>
                )}
                {wageType === "monthly" &&
                  monthlySalary &&
                  workingDaysPerMonth && (
                    <>
                      <p className="text-lg">
                        • Daily equivalent: $
                        {(
                          parseFloat(monthlySalary) /
                          parseInt(workingDaysPerMonth)
                        ).toFixed(2)}
                      </p>
                      <p className="text-lg">
                        • Budget prorated based on project duration
                      </p>
                    </>
                  )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
