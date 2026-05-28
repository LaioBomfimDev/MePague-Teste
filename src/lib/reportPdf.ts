import { formatCurrency, formatDate } from "@/lib/format";
import type { DashboardStats, DebtWithCustomer, Payment } from "@/lib/types";

type PdfColor = [number, number, number];
type PdfFont = "regular" | "bold";
type PdfPage = {
  commands: string[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const colors = {
  black: rgb(17, 24, 39),
  blue: rgb(37, 99, 235),
  blueSoft: rgb(219, 234, 254),
  border: rgb(229, 231, 235),
  dark: rgb(15, 23, 42),
  gray: rgb(107, 114, 128),
  graySoft: rgb(249, 250, 251),
  green: rgb(22, 163, 74),
  greenSoft: rgb(220, 252, 231),
  red: rgb(220, 38, 38),
  redSoft: rgb(254, 226, 226),
  slate: rgb(51, 65, 85),
  white: rgb(255, 255, 255),
};

export function downloadReportPdf(input: {
  debts: DebtWithCustomer[];
  payments: Payment[];
  periodLabel: string;
  stats: DashboardStats;
}) {
  const pdf = buildReportPdf(input);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `me-pague-relatorio-${slugify(input.periodLabel)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildReportPdf({
  debts,
  payments,
  periodLabel,
  stats,
}: {
  debts: DebtWithCustomer[];
  payments: Payment[];
  periodLabel: string;
  stats: DashboardStats;
}) {
  const pages: PdfPage[] = [];
  let page = createPage(pages);
  const receivedTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  drawCoverHeader(page, periodLabel, generatedAt);
  drawMetricGrid(page, [
    { label: "Em aberto", value: formatCurrency(stats.totalOpen), accent: colors.blue, soft: colors.blueSoft },
    { label: "Recebido", value: formatCurrency(receivedTotal), accent: colors.green, soft: colors.greenSoft },
    { label: "Em atraso", value: formatCurrency(stats.totalOverdue), accent: colors.red, soft: colors.redSoft },
    { label: "Cobrancas abertas", value: String(stats.openCount), accent: colors.slate, soft: colors.graySoft },
    { label: "Previsto 7 dias", value: formatCurrency(stats.forecast7Days), accent: colors.blue, soft: colors.blueSoft },
    { label: "Previsto 30 dias", value: formatCurrency(stats.forecast30Days), accent: colors.slate, soft: colors.graySoft },
  ]);
  drawWeeklyChart(page, buildWeeklyTotals(debts));

  let y = 360;

  drawSectionTitle(page, "Cobrancas do periodo", y);
  y -= 28;
  drawDebtTableHeader(page, y);
  y -= 24;

  const sortedDebts = [...debts].sort((a, b) => getDebtReportDate(b).localeCompare(getDebtReportDate(a)));

  if (sortedDebts.length === 0) {
    drawEmptyState(page, "Sem cobrancas neste periodo.", y - 36);
    y -= 72;
  } else {
    sortedDebts.forEach((debt, index) => {
      if (y < 88) {
        page = createPage(pages);
        drawContinuationHeader(page, periodLabel);
        y = 746;
        drawDebtTableHeader(page, y);
        y -= 24;
      }

      drawDebtRow(page, debt, y, index % 2 === 0);
      y -= 26;
    });
  }

  if (payments.length > 0) {
    if (y < 170) {
      page = createPage(pages);
      drawContinuationHeader(page, periodLabel);
      y = 746;
    } else {
      y -= 22;
    }

    drawSectionTitle(page, "Pagamentos recebidos", y);
    y -= 28;
    drawPaymentTableHeader(page, y);
    y -= 24;

    payments
      .slice()
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .forEach((payment, index) => {
        if (y < 88) {
          page = createPage(pages);
          drawContinuationHeader(page, periodLabel);
          y = 746;
          drawPaymentTableHeader(page, y);
          y -= 24;
        }

        drawPaymentRow(page, payment, y, index % 2 === 0);
        y -= 26;
      });
  }

  pages.forEach((currentPage, index) => drawFooter(currentPage, index + 1, pages.length));

  return compilePdf(pages);
}

function createPage(pages: PdfPage[]) {
  const page = { commands: [] };
  pages.push(page);
  return page;
}

function drawCoverHeader(page: PdfPage, periodLabel: string, generatedAt: string) {
  rect(page, 0, 682, PAGE_WIDTH, 160, colors.dark);
  rect(page, MARGIN, 704, 86, 24, rgb(30, 41, 59));
  text(page, "ME PAGUE", MARGIN + 14, 712, 9, "bold", colors.white);
  text(page, "Relatorio financeiro", MARGIN, 782, 26, "bold", colors.white);
  text(page, periodLabel, MARGIN, 755, 12, "regular", rgb(203, 213, 225));
  text(page, "Gerado em", PAGE_WIDTH - MARGIN, 792, 8, "regular", rgb(203, 213, 225), "right");
  text(page, generatedAt, PAGE_WIDTH - MARGIN, 778, 10, "bold", colors.white, "right");
  text(page, "Resumo para acompanhamento de recebimentos e cobrancas em aberto.", MARGIN, 722, 10, "regular", rgb(226, 232, 240));
}

function drawContinuationHeader(page: PdfPage, periodLabel: string) {
  rect(page, 0, 784, PAGE_WIDTH, 58, colors.dark);
  text(page, "ME PAGUE", MARGIN, 808, 9, "bold", colors.white);
  text(page, periodLabel, PAGE_WIDTH - MARGIN, 807, 10, "regular", rgb(226, 232, 240), "right");
}

function drawMetricGrid(
  page: PdfPage,
  metrics: Array<{ accent: PdfColor; label: string; soft: PdfColor; value: string }>,
) {
  const gap = 10;
  const width = (CONTENT_WIDTH - gap * 2) / 3;
  const height = 62;
  const starts = [
    { x: MARGIN, y: 594 },
    { x: MARGIN + width + gap, y: 594 },
    { x: MARGIN + (width + gap) * 2, y: 594 },
    { x: MARGIN, y: 522 },
    { x: MARGIN + width + gap, y: 522 },
    { x: MARGIN + (width + gap) * 2, y: 522 },
  ];

  metrics.forEach((metric, index) => {
    const position = starts[index];
    rect(page, position.x, position.y, width, height, colors.white, colors.border);
    rect(page, position.x, position.y + height - 5, width, 5, metric.soft);
    text(page, metric.label.toUpperCase(), position.x + 12, position.y + 38, 7.5, "bold", colors.gray);
    text(page, metric.value, position.x + 12, position.y + 16, 15, "bold", metric.accent);
  });
}

function drawWeeklyChart(page: PdfPage, weeklyTotals: number[]) {
  const x = MARGIN;
  const y = 400;
  const width = CONTENT_WIDTH;
  const height = 90;
  const max = Math.max(...weeklyTotals, 1);

  drawSectionTitle(page, "Movimento por semana", y + height + 32);
  rect(page, x, y, width, height, colors.graySoft, colors.border);
  line(page, x + 16, y + 22, x + width - 16, y + 22, colors.border);

  const barGap = 16;
  const barWidth = (width - 48 - barGap * 4) / 5;

  weeklyTotals.forEach((amount, index) => {
    const barHeight = amount === 0 ? 8 : Math.max(14, (amount / max) * 48);
    const barX = x + 24 + index * (barWidth + barGap);
    const barY = y + 22;

    rect(page, barX, barY, barWidth, barHeight, index === 0 ? colors.slate : colors.blue);
    text(page, `S${index + 1}`, barX + barWidth / 2, y + 9, 8, "bold", colors.gray, "center");
    text(page, formatCurrency(amount), barX + barWidth / 2, barY + barHeight + 8, 7, "regular", colors.gray, "center");
  });
}

function drawSectionTitle(page: PdfPage, title: string, y: number) {
  text(page, title, MARGIN, y, 13, "bold", colors.black);
}

function drawDebtTableHeader(page: PdfPage, y: number) {
  rect(page, MARGIN, y - 5, CONTENT_WIDTH, 22, colors.dark);
  text(page, "Cliente", MARGIN + 10, y + 2, 7.5, "bold", colors.white);
  text(page, "Descricao", MARGIN + 140, y + 2, 7.5, "bold", colors.white);
  text(page, "Vencimento", MARGIN + 282, y + 2, 7.5, "bold", colors.white);
  text(page, "Status", MARGIN + 366, y + 2, 7.5, "bold", colors.white);
  text(page, "Valor", PAGE_WIDTH - MARGIN - 10, y + 2, 7.5, "bold", colors.white, "right");
}

function drawDebtRow(page: PdfPage, debt: DebtWithCustomer, y: number, shaded: boolean) {
  if (shaded) {
    rect(page, MARGIN, y - 7, CONTENT_WIDTH, 25, colors.graySoft);
  }

  const status = debt.status === "paid" ? "Pago" : debt.isOverdue ? "Atrasada" : "Aberta";
  const statusColor = debt.status === "paid" ? colors.green : debt.isOverdue ? colors.red : colors.blue;
  const amount = debt.status === "paid" ? debt.paidAmount || debt.amount : debt.outstandingAmount;

  text(page, truncate(debt.customerName, 24), MARGIN + 10, y + 2, 8.5, "bold", colors.black);
  text(page, truncate(debt.description || "-", 25), MARGIN + 140, y + 2, 8, "regular", colors.gray);
  text(page, formatDate(debt.dueDate), MARGIN + 282, y + 2, 8, "regular", colors.black);
  text(page, status, MARGIN + 366, y + 2, 8, "bold", statusColor);
  text(page, formatCurrency(amount), PAGE_WIDTH - MARGIN - 10, y + 2, 8.5, "bold", colors.black, "right");
  line(page, MARGIN, y - 8, PAGE_WIDTH - MARGIN, y - 8, colors.border, 0.5);
}

function drawPaymentTableHeader(page: PdfPage, y: number) {
  rect(page, MARGIN, y - 5, CONTENT_WIDTH, 22, colors.dark);
  text(page, "Data", MARGIN + 10, y + 2, 7.5, "bold", colors.white);
  text(page, "Observacao", MARGIN + 118, y + 2, 7.5, "bold", colors.white);
  text(page, "Valor", PAGE_WIDTH - MARGIN - 10, y + 2, 7.5, "bold", colors.white, "right");
}

function drawPaymentRow(page: PdfPage, payment: Payment, y: number, shaded: boolean) {
  if (shaded) {
    rect(page, MARGIN, y - 7, CONTENT_WIDTH, 25, colors.graySoft);
  }

  text(page, formatDate(payment.paidAt.slice(0, 10)), MARGIN + 10, y + 2, 8.5, "bold", colors.black);
  text(page, truncate(payment.note || "Pagamento recebido", 48), MARGIN + 118, y + 2, 8, "regular", colors.gray);
  text(page, formatCurrency(payment.amount), PAGE_WIDTH - MARGIN - 10, y + 2, 8.5, "bold", colors.green, "right");
  line(page, MARGIN, y - 8, PAGE_WIDTH - MARGIN, y - 8, colors.border, 0.5);
}

function drawEmptyState(page: PdfPage, message: string, y: number) {
  rect(page, MARGIN, y, CONTENT_WIDTH, 46, colors.graySoft, colors.border);
  text(page, message, MARGIN + CONTENT_WIDTH / 2, y + 17, 10, "regular", colors.gray, "center");
}

function drawFooter(page: PdfPage, pageNumber: number, totalPages: number) {
  line(page, MARGIN, 42, PAGE_WIDTH - MARGIN, 42, colors.border);
  text(page, "Me Pague", MARGIN, 24, 8, "bold", colors.gray);
  text(page, `Pagina ${pageNumber} de ${totalPages}`, PAGE_WIDTH - MARGIN, 24, 8, "regular", colors.gray, "right");
}

function buildWeeklyTotals(debts: DebtWithCustomer[]) {
  const totals = [0, 0, 0, 0, 0];

  debts.forEach((debt) => {
    const day = Number(getDebtReportDate(debt).slice(8, 10));
    const week = Math.min(4, Math.floor((day - 1) / 7));
    totals[week] += debt.status === "paid" ? debt.paidAmount || debt.amount : debt.outstandingAmount;
  });

  return totals;
}

function getDebtReportDate(debt: DebtWithCustomer) {
  return debt.status === "paid" && debt.paidAt ? debt.paidAt.slice(0, 10) : debt.dueDate;
}

function compilePdf(pages: PdfPage[]) {
  const objects: string[] = [];
  const pageRefs: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((page) => {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = `${page.commands.join("\n")}\n`;

    pageRefs.push(pageObjectNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fixed(PAGE_WIDTH)} ${fixed(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

  let output = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = output.length;
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return output;
}

function rect(page: PdfPage, x: number, y: number, width: number, height: number, fill: PdfColor, stroke?: PdfColor) {
  page.commands.push(`${color(fill)} rg ${fixed(x)} ${fixed(y)} ${fixed(width)} ${fixed(height)} re f`);

  if (stroke) {
    page.commands.push(`${color(stroke)} RG 0.8 w ${fixed(x)} ${fixed(y)} ${fixed(width)} ${fixed(height)} re S`);
  }
}

function line(page: PdfPage, x1: number, y1: number, x2: number, y2: number, stroke: PdfColor, width = 1) {
  page.commands.push(
    `${color(stroke)} RG ${fixed(width)} w ${fixed(x1)} ${fixed(y1)} m ${fixed(x2)} ${fixed(y2)} l S`,
  );
}

function text(
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  size: number,
  font: PdfFont = "regular",
  fill: PdfColor = colors.black,
  align: "left" | "center" | "right" = "left",
) {
  const clean = sanitizePdfText(value);
  const textWidth = estimateTextWidth(clean, size, font);
  const resolvedX = align === "right" ? x - textWidth : align === "center" ? x - textWidth / 2 : x;
  const fontRef = font === "bold" ? "F2" : "F1";

  page.commands.push(
    `${color(fill)} rg BT /${fontRef} ${fixed(size)} Tf ${fixed(resolvedX)} ${fixed(y)} Td ${pdfString(clean)} Tj ET`,
  );
}

function rgb(red: number, green: number, blue: number): PdfColor {
  return [red / 255, green / 255, blue / 255];
}

function color([red, green, blue]: PdfColor) {
  return `${fixed(red)} ${fixed(green)} ${fixed(blue)}`;
}

function fixed(value: number) {
  return Number(value.toFixed(3)).toString();
}

function estimateTextWidth(value: string, size: number, font: PdfFont) {
  return value.length * size * (font === "bold" ? 0.55 : 0.5);
}

function pdfString(value: string) {
  return `(${value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

function sanitizePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E]/g, "");
}

function truncate(value: string, maxLength: number) {
  const clean = sanitizePdfText(value).trim();

  if (clean.length <= maxLength) return clean;

  return `${clean.slice(0, Math.max(0, maxLength - 3))}...`;
}

function slugify(value: string) {
  return (
    sanitizePdfText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "geral"
  );
}
