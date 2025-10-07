/**
 * Budget Export Service
 * Handles PDF and Excel export functionality for budget reports
 *
 * Note: This is a basic implementation. For production use, you would want to:
 * - Add PDF generation library like jsPDF or pdfmake
 * - Add Excel generation library like xlsx or exceljs
 * - Add proper styling and formatting
 * - Add company branding and headers
 */

export class BudgetExportService {
  /**
   * Export budget report to CSV (basic implementation)
   */
  static exportToCSV(budgetReport: any): void {
    try {
      const csvRows = [];

      // Add header
      csvRows.push("Budget Report - " + budgetReport.project_name);
      csvRows.push("");
      csvRows.push("Project Information");
      csvRows.push(`Project Name,${budgetReport.project_name}`);
      csvRows.push(`Start Date,${budgetReport.project_start_date || "N/A"}`);
      csvRows.push(`End Date,${budgetReport.project_end_date || "N/A"}`);
      csvRows.push(
        `Total Budget Allocated,$${budgetReport.total_budget_allocated.toFixed(
          2
        )}`
      );
      csvRows.push(
        `Total Budget Spent,$${budgetReport.total_budget_spent.toFixed(2)}`
      );
      csvRows.push("");

      // Member Budget Summary
      csvRows.push("Member Budget Summary");
      csvRows.push(
        "Member Name,Wage Type,Daily Rate,Monthly Salary,Full Days,Half Days,Absent,Task Budget,Monthly Budget,Final Budget,Budget Type"
      );

      budgetReport.member_summaries.forEach((member: any) => {
        csvRows.push(
          [
            member.user_name,
            member.wage_type,
            member.daily_rate ? `$${member.daily_rate.toFixed(2)}` : "-",
            member.monthly_salary
              ? `$${member.monthly_salary.toFixed(2)}`
              : "-",
            member.total_full_days,
            member.total_half_days,
            member.total_absent_days,
            `$${member.total_task_budget.toFixed(2)}`,
            `$${member.monthly_budget.toFixed(2)}`,
            `$${member.final_budget.toFixed(2)}`,
            member.has_attendance_data ? "Attendance-based" : "Monthly-based",
          ].join(",")
        );
      });

      csvRows.push("");

      // Task Budget Details
      if (budgetReport.task_budgets.length > 0) {
        csvRows.push("Task Budget Details");
        csvRows.push(
          "Date,Task,Member,Attendance,Daily Rate,Calculated Amount"
        );

        budgetReport.task_budgets.forEach((taskBudget: any) => {
          csvRows.push(
            [
              new Date(taskBudget.date).toLocaleDateString(),
              taskBudget.task_title,
              taskBudget.user_name,
              taskBudget.attendance_status?.replace("_", " ") || "-",
              `$${taskBudget.daily_rate.toFixed(2)}`,
              `$${taskBudget.calculated_amount.toFixed(2)}`,
            ].join(",")
          );
        });
      }

      // Create blob and download
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `budget_report_${budgetReport.project_name}_${
          new Date().toISOString().split("T")[0]
        }.csv`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      throw new Error("Failed to export budget report to CSV");
    }
  }

  /**
   * Export budget report to Excel (placeholder for future implementation)
   * In production, use libraries like 'xlsx' or 'exceljs'
   */
  static async exportToExcel(budgetReport: any): Promise<void> {
    // For now, export as CSV
    // TODO: Implement proper Excel export with formatting using xlsx library
    console.log("Excel export - using CSV for now");
    this.exportToCSV(budgetReport);
  }

  /**
   * Export budget report to PDF (placeholder for future implementation)
   * In production, use libraries like 'jspdf' or 'pdfmake'
   */
  static async exportToPDF(budgetReport: any): Promise<void> {
    // TODO: Implement PDF export using jsPDF or pdfmake
    console.log("PDF export - not yet implemented, using CSV for now");
    this.exportToCSV(budgetReport);
  }

  /**
   * Generate print-friendly HTML version
   */
  static generatePrintableHTML(budgetReport: any): string {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Budget Report - ${budgetReport.project_name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          h2 { color: #666; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .summary { background-color: #f9f9f9; padding: 15px; margin: 20px 0; }
          .summary-item { margin: 5px 0; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>Budget Report</h1>
        <div class="summary">
          <h3>${budgetReport.project_name}</h3>
          <div class="summary-item"><strong>Start Date:</strong> ${
            budgetReport.project_start_date || "N/A"
          }</div>
          <div class="summary-item"><strong>End Date:</strong> ${
            budgetReport.project_end_date || "N/A"
          }</div>
          <div class="summary-item"><strong>Total Budget Allocated:</strong> $${budgetReport.total_budget_allocated.toFixed(
            2
          )}</div>
          <div class="summary-item"><strong>Total Budget Spent:</strong> $${budgetReport.total_budget_spent.toFixed(
            2
          )}</div>
          <div class="summary-item"><strong>Report Generated:</strong> ${new Date().toLocaleString()}</div>
        </div>

        <h2>Member Budget Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Wage Type</th>
              <th>Daily Rate</th>
              <th>Monthly Salary</th>
              <th>Full Days</th>
              <th>Half Days</th>
              <th>Absent</th>
              <th>Final Budget</th>
            </tr>
          </thead>
          <tbody>
            ${budgetReport.member_summaries
              .map(
                (member: any) => `
              <tr>
                <td>${member.user_name}</td>
                <td>${member.wage_type}</td>
                <td>${
                  member.daily_rate ? `$${member.daily_rate.toFixed(2)}` : "-"
                }</td>
                <td>${
                  member.monthly_salary
                    ? `$${member.monthly_salary.toFixed(2)}`
                    : "-"
                }</td>
                <td>${member.total_full_days}</td>
                <td>${member.total_half_days}</td>
                <td>${member.total_absent_days}</td>
                <td>$${member.final_budget.toFixed(2)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        ${
          budgetReport.task_budgets.length > 0
            ? `
          <h2>Task Budget Details</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Task</th>
                <th>Member</th>
                <th>Attendance</th>
                <th>Daily Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${budgetReport.task_budgets
                .map(
                  (task: any) => `
                <tr>
                  <td>${new Date(task.date).toLocaleDateString()}</td>
                  <td>${task.task_title}</td>
                  <td>${task.user_name}</td>
                  <td>${task.attendance_status?.replace("_", " ") || "-"}</td>
                  <td>$${task.daily_rate.toFixed(2)}</td>
                  <td>$${task.calculated_amount.toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
            : ""
        }

        <button onclick="window.print()" style="margin-top: 30px; padding: 10px 20px; font-size: 16px;">Print This Report</button>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Open print dialog with formatted report
   */
  static printReport(budgetReport: any): void {
    const html = this.generatePrintableHTML(budgetReport);
    const printWindow = window.open("", "_blank");

    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      // Auto-print after a short delay to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }
}
