/**
 * User Import/Export Service
 * Handles CSV import/export functionality for user management
 */

export interface UserImportData {
  full_name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  wage_type?: "daily" | "monthly";
  daily_rate?: number;
  monthly_salary?: number;
  default_working_days_per_month?: number;
}

export class UserImportExportService {
  /**
   * Export users to CSV
   */
  static exportUsersToCSV(users: any[]): void {
    try {
      const csvRows = [];

      // Add header
      csvRows.push("User Export - " + new Date().toLocaleString());
      csvRows.push("");
      csvRows.push("User Information");
      csvRows.push(
        "Full Name,Email,Role,Status,Wage Type,Daily Rate,Monthly Salary,Working Days Per Month,Created At"
      );

      users.forEach((user) => {
        csvRows.push(
          [
            user.full_name || "",
            user.email || "",
            user.role || "",
            user.status || "",
            user.wage_type || "",
            user.daily_rate ? user.daily_rate.toString() : "",
            user.monthly_salary ? user.monthly_salary.toString() : "",
            user.default_working_days_per_month
              ? user.default_working_days_per_month.toString()
              : "",
            user.created_at
              ? new Date(user.created_at).toLocaleDateString()
              : "",
          ].join(",")
        );
      });

      // Create blob and download
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `users_export_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting users to CSV:", error);
      throw new Error("Failed to export users to CSV");
    }
  }

  /**
   * Parse CSV file for user import
   */
  static parseUserCSV(csvContent: string): UserImportData[] {
    try {
      const lines = csvContent.split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());

      // Find required columns
      const nameIndex = headers.findIndex(
        (h) =>
          h.toLowerCase().includes("name") ||
          h.toLowerCase().includes("full_name")
      );
      const emailIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("email")
      );
      const roleIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("role")
      );
      const statusIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("status")
      );
      const wageTypeIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("wage_type")
      );
      const dailyRateIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("daily_rate")
      );
      const monthlySalaryIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("monthly_salary")
      );
      const workingDaysIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("working_days")
      );

      if (nameIndex === -1 || emailIndex === -1) {
        throw new Error("Required columns (name, email) not found in CSV");
      }

      const users: UserImportData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(",").map((v) => v.trim());

        const user: UserImportData = {
          full_name: values[nameIndex] || "",
          email: values[emailIndex] || "",
          role: values[roleIndex] || "worker",
          status: (values[statusIndex] as "active" | "inactive") || "active",
        };

        // Optional wage configuration
        if (wageTypeIndex !== -1 && values[wageTypeIndex]) {
          user.wage_type = values[wageTypeIndex] as "daily" | "monthly";
        }

        if (dailyRateIndex !== -1 && values[dailyRateIndex]) {
          user.daily_rate = parseFloat(values[dailyRateIndex]);
        }

        if (monthlySalaryIndex !== -1 && values[monthlySalaryIndex]) {
          user.monthly_salary = parseFloat(values[monthlySalaryIndex]);
        }

        if (workingDaysIndex !== -1 && values[workingDaysIndex]) {
          user.default_working_days_per_month = parseInt(
            values[workingDaysIndex]
          );
        }

        // Validate required fields
        if (user.full_name && user.email) {
          users.push(user);
        }
      }

      return users;
    } catch (error) {
      console.error("Error parsing user CSV:", error);
      throw new Error("Failed to parse CSV file");
    }
  }

  /**
   * Generate CSV template for user import
   */
  static generateUserTemplate(): void {
    try {
      const csvRows = [];

      // Header
      csvRows.push("User Import Template");
      csvRows.push("Generated on: " + new Date().toLocaleString());
      csvRows.push("");
      csvRows.push("Instructions:");
      csvRows.push("1. Fill in the required fields (Full Name, Email)");
      csvRows.push(
        "2. Optional fields: Role, Status, Wage Type, Daily Rate, Monthly Salary, Working Days"
      );
      csvRows.push("3. Save as CSV and upload");
      csvRows.push("");

      // Column headers
      csvRows.push(
        "Full Name,Email,Role,Status,Wage Type,Daily Rate,Monthly Salary,Working Days Per Month"
      );

      // Example rows
      csvRows.push("John Doe,john@example.com,worker,active,daily,100,,");
      csvRows.push(
        "Jane Smith,jane@example.com,supervisor,active,monthly,,3000,25"
      );
      csvRows.push("Bob Johnson,bob@example.com,worker,active,daily,150,,");

      // Create blob and download
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `user_import_template_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error generating user template:", error);
      throw new Error("Failed to generate user template");
    }
  }

  /**
   * Validate user import data
   */
  static validateUserData(users: UserImportData[]): {
    valid: UserImportData[];
    invalid: Array<{ user: UserImportData; errors: string[] }>;
  } {
    const valid: UserImportData[] = [];
    const invalid: Array<{ user: UserImportData; errors: string[] }> = [];

    users.forEach((user, index) => {
      const errors: string[] = [];

      // Required field validation
      if (!user.full_name?.trim()) {
        errors.push("Full name is required");
      }

      if (!user.email?.trim()) {
        errors.push("Email is required");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
        errors.push("Invalid email format");
      }

      // Role validation
      if (user.role && !["admin", "supervisor", "worker"].includes(user.role)) {
        errors.push("Invalid role. Must be admin, supervisor, or worker");
      }

      // Status validation
      if (user.status && !["active", "inactive"].includes(user.status)) {
        errors.push("Invalid status. Must be active or inactive");
      }

      // Wage type validation
      if (user.wage_type && !["daily", "monthly"].includes(user.wage_type)) {
        errors.push("Invalid wage type. Must be daily or monthly");
      }

      // Wage configuration validation
      if (user.wage_type === "daily" && !user.daily_rate) {
        errors.push("Daily rate is required for daily wage type");
      }

      if (user.wage_type === "monthly" && !user.monthly_salary) {
        errors.push("Monthly salary is required for monthly wage type");
      }

      // Numeric validation
      if (user.daily_rate && (isNaN(user.daily_rate) || user.daily_rate < 0)) {
        errors.push("Daily rate must be a positive number");
      }

      if (
        user.monthly_salary &&
        (isNaN(user.monthly_salary) || user.monthly_salary < 0)
      ) {
        errors.push("Monthly salary must be a positive number");
      }

      if (
        user.default_working_days_per_month &&
        (isNaN(user.default_working_days_per_month) ||
          user.default_working_days_per_month < 1 ||
          user.default_working_days_per_month > 31)
      ) {
        errors.push("Working days per month must be between 1 and 31");
      }

      if (errors.length > 0) {
        invalid.push({ user, errors });
      } else {
        valid.push(user);
      }
    });

    return { valid, invalid };
  }
}
