"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface HealthTrendDataPoint {
  day: string;
  fever: number;
  cough: number;
}

interface HealthTrendChartProps {
  data?: HealthTrendDataPoint[];
}

const defaultHealthTrendData = [
  { day: "จันทร์", fever: 0, cough: 0 },
  { day: "อังคาร", fever: 0, cough: 0 },
  { day: "พุธ", fever: 0, cough: 0 },
  { day: "พฤหัสฯ", fever: 0, cough: 0 },
  { day: "ศุกร์", fever: 0, cough: 0 },
  { day: "เสาร์", fever: 0, cough: 0 },
  { day: "อาทิตย์", fever: 0, cough: 0 },
];

export default function HealthTrendChart({ data = defaultHealthTrendData }: HealthTrendChartProps) {
  return (
    <div className="h-64 w-full text-xs font-semibold">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            dy={10}
            style={{ fontSize: "10px" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            tickFormatter={(value) => `${value} คน`}
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
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "#94a3b8", fontWeight: "700", marginBottom: "4px" }}
            formatter={(value: any, name?: any) => {
              const label = name === "fever" ? "มีไข้สูง" : "ไอ/จาม";
              return [`${value} คน`, label];
            }}
          />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
            formatter={(value) => {
              if (value === "fever") return <span className="text-slate-600 dark:text-slate-350">ตัวร้อน/มีไข้</span>;
              if (value === "cough") return <span className="text-slate-600 dark:text-slate-350">มีอาการไอ/จาม</span>;
              return value;
            }}
          />
          <Bar dataKey="fever" name="fever" stackId="a" fill="#f43f5e" />
          <Bar dataKey="cough" name="cough" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
