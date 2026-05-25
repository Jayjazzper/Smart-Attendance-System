"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

interface PeakTimePoint {
  name: string;
  count: number;
}

interface PeakTimeChartProps {
  data?: PeakTimePoint[];
}

const defaultData = [
  { name: "ก่อน 07:30", count: 0 },
  { name: "07:30 - 07:45", count: 0 },
  { name: "07:45 - 08:00", count: 0 },
  { name: "หลัง 08:00", count: 0 },
];

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"]; // Green, Blue, Amber, Red

export default function PeakTimeChart({ data = defaultData }: PeakTimeChartProps) {
  const totalCounts = data.reduce((sum, item) => sum + item.count, 0);

  if (totalCounts === 0) {
    return (
      <div className="h-64 w-full flex flex-col items-center justify-center bg-slate-50/30 rounded-2xl border border-slate-100/50">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300 animate-pulse-slow mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span className="text-[11px] font-bold text-slate-400">ยังไม่มีข้อมูลการสแกนเช็คชื่อของวันนี้</span>
      </div>
    );
  }

  return (
    <div className="h-64 w-full text-xs font-semibold">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            dy={10}
            style={{ fontSize: "10px" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            allowDecimals={false}
            tickFormatter={(value) => `${value} คน`}
            style={{ fontSize: "10px" }}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "600",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            }}
            formatter={(value: any) => [`${value} คน`, "จำนวนนักเรียน"]}
            labelStyle={{ color: "#94a3b8", fontWeight: "700" }}
          />
          <Bar
            dataKey="count"
            radius={[6, 6, 0, 0]}
            maxBarSize={45}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
