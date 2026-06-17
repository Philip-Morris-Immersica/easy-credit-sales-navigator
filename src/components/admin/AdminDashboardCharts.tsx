"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const langData = [
  { lang: "Bulgarian", count: 180 },
  { lang: "English", count: 30 },
  { lang: "Arabic", count: 8 },
];

const modelData = [
  { model: "gpt-4.1-mini", tokens: 1600 },
  { model: "gpt-4.1", tokens: 200 },
];

export function AdminDashboardCharts() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="t-subheading font-semibold mb-4">Разговори по език</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={langData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="lang" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#D6071A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="t-subheading font-semibold mb-4">Употреба по модел</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={modelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="model" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="tokens" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
