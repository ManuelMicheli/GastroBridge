export type SpendTrendPeriod = "7D" | "30D" | "90D" | "YTD";

export interface SpendTrendPoint {
  date: string; // ISO date YYYY-MM-DD
  value: number;
}

export interface SpendTrendStats {
  total: number;
  average: number;
  peak: SpendTrendPoint;
  low: number;
  activeDays: number;
  totalDays: number;
  transactionsCount: number;
  deltaPercent: number;
  deltaAbsolute: number;
  hasCurrentData: boolean;
  hasPreviousData: boolean;
}

export interface SpendTrendChartProps {
  points: SpendTrendPoint[];
  transactionsByDate?: Record<string, number>;
  initialPeriod?: SpendTrendPeriod;
  className?: string;
}
