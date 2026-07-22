import { auth } from "@/auth";
import { generateReportData } from "@/lib/reports";
import { isAdmin } from "@/lib/auth-helpers";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const data = await generateReportData(body);

    const wb = new ExcelJS.Workbook();
    wb.creator = "EasyCredit Sales Navigator";
    wb.created = new Date();

    // ── Sheet 1: Summary ──────────────────────────────────────────────────────
    if (data.summary) {
      const s = data.summary as Record<string, unknown>;
      const sh = wb.addWorksheet("Обобщение");
      sh.columns = [
        { header: "Показател", key: "metric", width: 32 },
        { header: "Стойност", key: "value", width: 22 },
      ];
      styleHeader(sh);
      sh.addRows([
        { metric: "Период от", value: body.from },
        { metric: "Период до", value: body.to },
        { metric: "", value: "" },
        { metric: "Нови потребители", value: s.newUsers },
        { metric: "Разговори", value: s.conversations },
        { metric: "Съобщения", value: s.messages },
        { metric: "Анализи", value: s.analyses },
        { metric: "Разход (USD)", value: Number(s.totalCost).toFixed(4) },
      ]);
      autoWidth(sh);
    }

    // ── Sheet 2: Users with costs ──────────────────────────────────────────
    if (data.activeUsers && (data.activeUsers as unknown[]).length > 0) {
      const sh = wb.addWorksheet("Потребители и разходи");
      sh.columns = [
        { header: "Потребител", key: "name", width: 28 },
        { header: "Имейл", key: "email", width: 32 },
        { header: "Разговори", key: "conversations", width: 14 },
        { header: "Съобщения", key: "messages", width: 14 },
        { header: "Токени вход", key: "tokensIn", width: 14 },
        { header: "Токени изход", key: "tokensOut", width: 14 },
        { header: "Разход (USD)", key: "cost", width: 16 },
      ];
      styleHeader(sh);
      sh.addRows(
        (data.activeUsers as Array<Record<string, unknown>>).map((u) => ({
          ...u,
          cost: Number(u.cost).toFixed(4),
        }))
      );
      addTotalRow(sh, "cost", "Общо разход:");
      autoWidth(sh);
    }

    // ── Sheet 3: Analyses ─────────────────────────────────────────────────
    if (data.analyses && (data.analyses as unknown[]).length > 0) {
      const sh = wb.addWorksheet("Анализи");
      sh.columns = [
        { header: "Потребител", key: "user", width: 28 },
        { header: "Имейл", key: "email", width: 32 },
        { header: "Симулация / Бот", key: "bot", width: 30 },
        { header: "Дата", key: "date", width: 14 },
        { header: "Оценка (1-10)", key: "overallScore", width: 14 },
        { header: "Обобщение", key: "summary", width: 60 },
        { header: "Силни страни", key: "strengths", width: 50 },
        { header: "Области за подобрение", key: "improvements", width: 50 },
      ];
      styleHeader(sh);
      sh.addRows(data.analyses as Array<Record<string, unknown>>);
      // Wrap text in long columns
      sh.getColumn("summary").alignment = { wrapText: true };
      sh.getColumn("strengths").alignment = { wrapText: true };
      sh.getColumn("improvements").alignment = { wrapText: true };
    }

    // ── Sheet 4: Transcripts ──────────────────────────────────────────────
    if (data.transcripts && (data.transcripts as unknown[]).length > 0) {
      const sh = wb.addWorksheet("Транскрипти");
      sh.columns = [
        { header: "Потребител", key: "user", width: 28 },
        { header: "Имейл", key: "email", width: 32 },
        { header: "Симулация / Бот", key: "bot", width: 30 },
        { header: "Дата", key: "startedAt", width: 14 },
        { header: "Статус", key: "status", width: 14 },
        { header: "Оценка", key: "overallScore", width: 10 },
        { header: "Транскрипт на разговора", key: "transcript", width: 120 },
      ];
      styleHeader(sh);

      for (const conv of data.transcripts as Array<{
        user: string; email: string; bot: string; startedAt: string;
        status: string; overallScore: number | null;
        messages: Array<{ role: string; content: string }>;
      }>) {
        // Build full transcript as single multiline string
        const transcriptText = conv.messages
          .map((m) => {
            const roleLabel = m.role === "user" ? "👤 Потребител" : "🤖 Асистент";
            return `${roleLabel}:\n${m.content}`;
          })
          .join("\n\n─────────────────────────\n\n");

        const row = sh.addRow({
          user: conv.user,
          email: conv.email,
          bot: conv.bot,
          startedAt: conv.startedAt,
          status: conv.status === "completed" ? "Завършен" : conv.status === "active" ? "Активен" : "Изоставен",
          overallScore: conv.overallScore ?? "—",
          transcript: transcriptText,
        });

        // Wrap and top-align the transcript cell
        row.getCell("transcript").alignment = { wrapText: true, vertical: "top" };
        row.getCell("user").alignment = { vertical: "top" };
        row.getCell("email").alignment = { vertical: "top" };
        row.getCell("bot").alignment = { vertical: "top" };
        row.getCell("startedAt").alignment = { vertical: "top" };
        row.getCell("status").alignment = { vertical: "top" };
        row.getCell("overallScore").alignment = { vertical: "top" };

        // Light alternating background for readability
        const fillColor = sh.rowCount % 2 === 0 ? "FFF9F9F9" : "FFFFFFFF";
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
          cell.border = {
            bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          };
        });
      }
    }

    const buffer = await wb.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report_${body.from}_do_${body.to}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[reports/export] POST error:", err);
    return Response.json({ error: "Грешка при генериране на файла: " + String(err) }, { status: 500 });
  }
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6071A" } };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addTotalRow(sheet: ExcelJS.Worksheet, costKey: string, label: string) {
  const lastRow = sheet.lastRow?.number ?? 1;
  const col = sheet.getColumn(costKey);
  const colLetter = col.letter;
  const totalRow = sheet.addRow({});
  totalRow.getCell(1).value = label;
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(colLetter).value = { formula: `SUM(${colLetter}2:${colLetter}${lastRow})` };
  totalRow.getCell(colLetter).font = { bold: true };
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    if (!col.width || col.width < 10) col.width = 14;
  });
}
