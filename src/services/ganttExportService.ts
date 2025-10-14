import * as XLSX from "xlsx";
import { format, differenceInDays } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_datetime: string | null;
  end_datetime: string | null;
  task_assignments: Array<{
    profiles: {
      full_name: string | null;
    };
  }>;
}

export class GanttExportService {
  /**
   * Export Gantt chart data to Excel
   */
  static exportToExcel(
    tasks: Task[],
    projectName: string = "Project",
    currency: string = "USD"
  ): void {
    try {
      // Filter tasks with dates
      const validTasks = tasks.filter(
        (task) => task.start_datetime && task.end_datetime
      );

      if (validTasks.length === 0) {
        throw new Error("No tasks with dates to export");
      }

      // Prepare data for Excel
      const excelData = validTasks.map((task) => {
        const startDate = task.start_datetime
          ? new Date(task.start_datetime)
          : null;
        const endDate = task.end_datetime ? new Date(task.end_datetime) : null;

        const duration =
          startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;

        const assignedMembers =
          task.task_assignments
            .map((a) => a.profiles?.full_name || "Unknown")
            .join(", ") || "Unassigned";

        return {
          "Task Name": task.title,
          Description: task.description || "",
          Status: task.status?.replace("_", " ") || "N/A",
          "Start Date": startDate ? format(startDate, "MMM dd, yyyy") : "N/A",
          "End Date": endDate ? format(endDate, "MMM dd, yyyy") : "N/A",
          "Duration (days)": duration,
          "Assigned To": assignedMembers,
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 30 }, // Task Name
        { wch: 40 }, // Description
        { wch: 15 }, // Status
        { wch: 15 }, // Start Date
        { wch: 15 }, // End Date
        { wch: 15 }, // Duration
        { wch: 30 }, // Assigned To
      ];
      worksheet["!cols"] = columnWidths;

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Gantt Chart");

      // Add a summary sheet
      const summaryData = [
        { Field: "Project Name", Value: projectName },
        { Field: "Total Tasks", Value: validTasks.length },
        {
          Field: "Export Date",
          Value: format(new Date(), "MMM dd, yyyy hh:mm a"),
        },
        { Field: "", Value: "" },
        { Field: "Status Summary", Value: "" },
      ];

      // Count tasks by status
      const statusCounts = validTasks.reduce((acc, task) => {
        const status = task.status || "N/A";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(statusCounts).forEach(([status, count]) => {
        summaryData.push({
          Field: status.replace("_", " "),
          Value: count,
        });
      });

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 20 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Generate filename
      const filename = `Gantt_Chart_${projectName.replace(
        /[^a-z0-9]/gi,
        "_"
      )}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Write file
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Error exporting Gantt chart to Excel:", error);
      throw new Error("Failed to export Gantt chart to Excel");
    }
  }

  /**
   * Export Gantt chart data to CSV (fallback option)
   */
  static exportToCSV(tasks: Task[], projectName: string = "Project"): void {
    try {
      // Filter tasks with dates
      const validTasks = tasks.filter(
        (task) => task.start_datetime && task.end_datetime
      );

      if (validTasks.length === 0) {
        throw new Error("No tasks with dates to export");
      }

      const csvRows = [];

      // Add header
      csvRows.push(`Gantt Chart - ${projectName}`);
      csvRows.push(
        `Export Date: ${format(new Date(), "MMM dd, yyyy hh:mm a")}`
      );
      csvRows.push("");

      // Add column headers
      csvRows.push(
        "Task Name,Description,Status,Start Date,End Date,Duration (days),Assigned To"
      );

      // Add task rows
      validTasks.forEach((task) => {
        const startDate = task.start_datetime
          ? new Date(task.start_datetime)
          : null;
        const endDate = task.end_datetime ? new Date(task.end_datetime) : null;

        const duration =
          startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;

        const assignedMembers =
          task.task_assignments
            .map((a) => a.profiles?.full_name || "Unknown")
            .join("; ") || "Unassigned";

        csvRows.push(
          [
            `"${task.title}"`,
            `"${task.description || ""}"`,
            task.status?.replace("_", " ") || "N/A",
            startDate ? format(startDate, "MMM dd, yyyy") : "N/A",
            endDate ? format(endDate, "MMM dd, yyyy") : "N/A",
            duration,
            `"${assignedMembers}"`,
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
        `Gantt_Chart_${projectName.replace(/[^a-z0-9]/gi, "_")}_${format(
          new Date(),
          "yyyy-MM-dd"
        )}.csv`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting Gantt chart to CSV:", error);
      throw new Error("Failed to export Gantt chart to CSV");
    }
  }
}
