import { auth } from "@/auth";
import { generateReportData } from "@/lib/reports";
import { isAdmin } from "@/lib/auth-helpers";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const data = await generateReportData(body);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EasyCredit Sales Navigator";
  workbook.created = new Date();

  // Summary sheet
  if (data.summary) {
    const sheet = workbook.addWorksheet("Обобщение");
    sheet.columns = [
      { header: "Показател", key: "metric", width: 30 },
      { header: "Стойност", key: "value", width: 20 },
    ];
    const s = data.summary as Record<string, unknown>;
    sheet.addRows([
      { metric: "Нови потребители", value: s.newUsers },
      { metric: "Разговори", value: s.conversations },
      { metric: "Съобщения", value: s.messages },
      { metric: "Разход (USD)", value: s.totalCost },
      { metric: "Период от", value: body.from },
      { metric: "Период до", value: body.to },
    ]);
    styleSheet(sheet);
  }

  // Active users sheet
  if (data.activeUsers) {
    const sheet = workbook.addWorksheet("Потребители");
    sheet.columns = [
      { header: "Имена", key: "name", width: 25 },
      { header: "Имейл", key: "email", width: 30 },
      { header: "Разговори", key: "conversations", width: 15 },
    ];
    const users = data.activeUsers as Array<Record<string, unknown>>;
    sheet.addRows(users);
    styleSheet(sheet);
  }

  // Language breakdown
  if (data.languageBreakdown) {
    const sheet = workbook.addWorksheet("По език");
    sheet.columns = [
      { header: "Език", key: "language", width: 20 },
      { header: "Разговори", key: "conversations", width: 15 },
    ];
    const langs = data.languageBreakdown as Array<Record<string, unknown>>;
    sheet.addRows(langs);
    styleSheet(sheet);
  }

  // Model breakdown
  if (data.modelBreakdown) {
    const sheet = workbook.addWorksheet("По модел");
    sheet.columns = [
      { header: "Модел", key: "model", width: 20 },
      { header: "Съобщения", key: "messages", width: 15 },
      { header: "Токени вход", key: "tokensIn", width: 15 },
      { header: "Токени изход", key: "tokensOut", width: 15 },
      { header: "Разход (USD)", key: "cost", width: 15 },
    ];
    const models = data.modelBreakdown as Array<Record<string, unknown>>;
    sheet.addRows(models);
    styleSheet(sheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${body.from}-${body.to}.xlsx"`,
    },
  });
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FFD6071A" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 20;
}
