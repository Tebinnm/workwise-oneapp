import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface ProfitLossData {
  name: string;
  value: number;
  color: string;
}

interface ProfitLossPieChartProps {
  data: ProfitLossData[];
  isLoading?: boolean;
  title?: string;
}

const ProfitLossPieChart = ({
  data,
  isLoading = false,
  title = "Project Profit/Loss Overview",
}: ProfitLossPieChartProps) => {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const profitData = data.find((item) => item.name === "Profit");
  const lossData = data.find((item) => item.name === "Loss");

  const profitPercentage = profitData
    ? (profitData.value / totalValue) * 100
    : 0;
  const lossPercentage = lossData ? (lossData.value / totalValue) * 100 : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-background border border-border p-2 sm:p-3 shadow-lg">
          <p className="text-xs sm:text-sm font-medium">{data.name}</p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Amount: ${data.value.toLocaleString()}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Percentage: {((data.value / totalValue) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="w-full h-[250px] sm:h-[300px] lg:h-[350px] xl:h-[400px] flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="w-full h-[250px] sm:h-[300px] lg:h-[350px] xl:h-[400px] flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <DollarSign className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
            <p className="text-base sm:text-lg">No financial data available</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Add projects and expenses to see profit/loss analysis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-[250px] sm:h-[300px] lg:h-[350px] xl:h-[400px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
          Project Profit/Loss Overview
        </CardTitle>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
            <span>Profit: {profitPercentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
            <span>Loss: {lossPercentage.toFixed(1)}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: "12px",
                  paddingTop: "10px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-2 sm:mt-4 pt-2 sm:pt-4 border-t flex-shrink-0">
          <div className="text-center">
            <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
              ${profitData?.value.toLocaleString() || 0}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Total Profit
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">
              ${lossData?.value.toLocaleString() || 0}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Total Loss
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitLossPieChart;
