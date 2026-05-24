"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface TrendDataPoint {
  day: string;
  rate: number;
}

interface TrendChartProps {
  data?: TrendDataPoint[];
}

const defaultTrendData = [
  { day: "จันทร์", rate: 0 },
  { day: "อังคาร", rate: 0 },
  { day: "พุธ", rate: 0 },
  { day: "พฤหัสฯ", rate: 0 },
  { day: "ศุกร์", rate: 0 },
  { day: "เสาร์", rate: 0 },
  { day: "อาทิตย์", rate: 0 },
];

export default function TrendChart({ data = defaultTrendData }: TrendChartProps) {
  return (
    <div className="h-64 w-full text-xs font-semibold">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            dy={10}
            style={{ fontSize: "10px" }}
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            tickFormatter={(value) => `${value}%`}
            style={{ fontSize: "10px" }}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "600",
            }}
            formatter={(value: any) => [`${value}%`, "อัตราเข้าเรียน"]}
            labelStyle={{ color: "#94a3b8", fontWeight: "700" }}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRate)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
