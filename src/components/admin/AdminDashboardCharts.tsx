"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface DailyCostItem {
  date: string;
  cost: number;
}

interface DailyConvItem {
  date: string;
  count: number;
}

interface AdminDashboardChartsProps {
  dailyCosts: DailyCostItem[];
  dailyConvs: DailyConvItem[];
}

export function AdminDashboardCharts({ dailyCosts, dailyConvs }: AdminDashboardChartsProps) {
  const router = useRouter();
  const totalCost = dailyCosts.reduce((s, d) => s + d.cost, 0);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Conversations per day — clickable */}
      <div
        className="bg-white rounded-2xl border border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group"
        onClick={() => router.push("/admin/conversations")}
        title="Виж всички разговори"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="t-subheading font-semibold">Разговори — последните 14 дни</h2>
          <span className="t-small text-primary opacity-0 group-hover:opacity-100 transition-opacity">Виж всички →</span>
        </div>
        {dailyConvs.some((d) => d.count > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyConvs}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                name="Разговори"
                stroke="#D6071A"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground t-body">
            Няма данни за последните 14 дни.
          </div>
        )}
      </div>

      {/* Total expenses — clickable */}
      <div
        className="bg-white rounded-2xl border border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group"
        onClick={() => router.push("/admin/expenses")}
        title="Виж детайлни разходи"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="t-subheading font-semibold">Разходи — последните 14 дни</h2>
            <p className="t-small text-muted-foreground mt-0.5">Общо ${totalCost.toFixed(4)} USD</p>
          </div>
          <span className="t-small text-primary opacity-0 group-hover:opacity-100 transition-opacity">Виж детайли →</span>
        </div>
        {dailyCosts.some((d) => d.cost > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyCosts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(4)}`} />
              <Tooltip formatter={(v) => [`$${typeof v === "number" ? v.toFixed(4) : v} USD`, "Разход"]} />
              <Bar dataKey="cost" name="Разход" fill="#D6071A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground t-body">
            Няма данни за разходи.
          </div>
        )}
      </div>
    </div>
  );
}
