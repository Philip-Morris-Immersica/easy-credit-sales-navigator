"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date | null;
  lastActiveAt: Date | null;
  convCount: number;
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("bg", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type SortKey = "name" | "role" | "convCount" | "lastActiveAt" | "createdAt";

function sortValue(row: UserRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return (row.name ?? row.email ?? "").toLowerCase();
    case "role":
      return row.role;
    case "convCount":
      return row.convCount;
    case "lastActiveAt":
      return row.lastActiveAt ? new Date(row.lastActiveAt).getTime() : -1;
    case "createdAt":
      return row.createdAt ? new Date(row.createdAt).getTime() : -1;
  }
}

export function UsersClient({ rows }: { rows: UserRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "createdAt",
    dir: "desc",
  });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "role" ? "asc" : "desc" }
    );
  }

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "bg");
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort]);

  const withRole = rows.filter((r) => r.role !== "user").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-heading font-bold">Потребители</h1>
        <p className="t-body text-muted-foreground">
          {rows.length} общо · {withRole} с роля
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {([
                { label: "Потребител", key: "name" },
                { label: "Роля", key: "role" },
                { label: "Разговори", key: "convCount" },
                { label: "Последна активност", key: "lastActiveAt" },
                { label: "Регистрация", key: "createdAt" },
                { label: "" },
              ] as { label: string; key?: SortKey }[]).map((h, i) => (
                <th
                  key={i}
                  className="text-left px-4 py-3 t-small font-semibold text-muted-foreground"
                >
                  {h.key ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(h.key!)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {h.label}
                      {sort.key === h.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    h.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.name ?? "—"}</div>
                  <div className="t-small text-muted-foreground">{row.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      className={cn(
                        row.role === "it"
                          ? "bg-purple-100 text-purple-700"
                          : row.role === "admin"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {row.role}
                    </Badge>
                    {!row.active && (
                      <Badge className="bg-red-100 text-red-700">Деактивиран</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{row.convCount}</td>
                <td className="px-4 py-3 t-small text-muted-foreground">
                  {formatDate(row.lastActiveAt)}
                </td>
                <td className="px-4 py-3 t-small text-muted-foreground">
                  {formatDate(row.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${row.id}`}
                    className="text-primary hover:underline t-small"
                  >
                    Детайли →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center t-body text-muted-foreground py-8">
            Няма потребители.
          </p>
        )}
      </div>
    </div>
  );
}
