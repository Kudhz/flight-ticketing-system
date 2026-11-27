const MARGIN_X = 12;
const BRAND_GREEN = [32, 165, 58]; // #20a53a
const DEEP_GREEN = [20, 83, 45]; // #14532d
const MINT_BG = [236, 253, 243]; // #ecfdf3
const MINT_BORDER = [167, 243, 208]; // #a7f3d0
const INK = [17, 24, 39]; // #111827
const MUTED = [75, 85, 99]; // #4b5563
const SUBTLE_LINE = [229, 231, 235]; // #e5e7eb
const ZEBRA_BG = [249, 250, 251]; // #f9fafb
const INBOUND_BLUE = [30, 64, 175]; // #1e40af

const ROUTE_DIRECTION = {
  "MNA-MDC": "Berangkat",
  "MNA-IAX": "Berangkat",
  "MDC-MNA": "Tiba",
  "IAX-MNA": "Tiba",
};

const formatPercent = (value, total) => {
  if (!total || total <= 0) return "0,0%";
  const pct = (value / total) * 100;
  return `${pct.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

const formatCompactPax = (adult, child, infant) => {
  const a = Number(adult) || 0;
  const c = Number(child) || 0;
  const i = Number(infant) || 0;
  return `${String(a).padStart(2, "0")}/${String(c).padStart(2, "0")}/${String(i).padStart(2, "0")} (${a + c + i})`;
};

export function buildFlightHistoryPdf({
  doc,
  flights,
  totals,
  routes,
  month,
  monthName,
  year,
  formatWeight,
  formatPdfDate,
}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;
  const periodLabel = `${monthName.toUpperCase()} ${year}`;
  const printedAt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const totalFlights = flights.length;
  const totalPax = totals.adultPax + totals.childPax + totals.infantPax;
  const totalPieces =
    totals.baggagePieces + totals.cabinBaggagePieces + totals.cargoPieces;

  const routeWeights = Object.fromEntries(routes.map((route) => [route, 0]));
  for (const flight of flights) {
    if (routeWeights[flight.route] !== undefined) {
      routeWeights[flight.route] +=
        flight.passengerWeight +
        flight.baggageWeight +
        flight.cabinBaggageWeight +
        flight.cargoWeight;
    }
  }

  // =========================================================================
  // COMPACT BRANDED HEADER (1-PAGE LAYOUT)
  // =========================================================================
  doc.setFillColor(...BRAND_GREEN);
  doc.roundedRect(MARGIN_X, 9, 2.2, 13.5, 0.8, 0.8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...BRAND_GREEN);
  doc.text("SUSI AIR  •  PERINTIS DISPATCH MELONGUANE (MNA)", MARGIN_X + 5, 12.2);

  doc.setFontSize(13.5);
  doc.setTextColor(...INK);
  doc.text("LAPORAN DATA PENERBANGAN", MARGIN_X + 5, 18.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(
    `Rekapitulasi Operasional Penumpang, Bagasi, Kabin & Kargo — Cessna 208B Grand Caravan  •  ${totalFlights} Flight  •  ${totalPax} PAX  •  ${formatWeight(totals.totalWeight)}`,
    MARGIN_X + 5,
    22,
  );

  // Period pill & print date on right
  const pillWidth = 52;
  const pillX = pageWidth - MARGIN_X - pillWidth;
  doc.setFillColor(...MINT_BG);
  doc.setDrawColor(...MINT_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillX, 9.2, pillWidth, 7.5, 1.8, 1.8, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DEEP_GREEN);
  doc.text(`PERIODE ${periodLabel}`, pillX + pillWidth / 2, 14, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text(`Dicetak: ${printedAt} WITA`, pageWidth - MARGIN_X, 21.5, {
    align: "right",
  });

  doc.setDrawColor(...SUBTLE_LINE);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, 24.5, pageWidth - MARGIN_X, 24.5);

  // =========================================================================
  // COMPACT 2-COLUMN SUMMARY TABLES (RUTE & KOMPOSISI BERAT)
  // =========================================================================
  const summaryTopY = 27.5;
  const colGap = 6;
  const leftColWidth = 135;
  const rightColWidth = contentWidth - leftColWidth - colGap;
  const rightColX = MARGIN_X + leftColWidth + colGap;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...DEEP_GREEN);
  doc.text("RINGKASAN PER RUTE", MARGIN_X, summaryTopY);
  doc.text("KOMPOSISI BERAT & KOLI", rightColX, summaryTopY);

  doc.autoTable({
    startY: summaryTopY + 1.8,
    margin: { left: MARGIN_X, right: pageWidth - (MARGIN_X + leftColWidth) },
    tableWidth: leftColWidth,
    head: [["RUTE", "ARAH", "FLIGHT", "PAX (A/C/I)", "TOTAL BERAT"]],
    body: routes.map((route) => {
      const r = totals.routes[route];
      return [
        route,
        ROUTE_DIRECTION[route] || "-",
        r.flights,
        formatCompactPax(r.adultPax, r.childPax, r.infantPax),
        formatWeight(routeWeights[route]),
      ];
    }),
    foot: [
      [
        "TOTAL",
        "",
        totalFlights,
        formatCompactPax(totals.adultPax, totals.childPax, totals.infantPax),
        formatWeight(totals.totalWeight),
      ],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.7,
      cellPadding: { top: 1.15, bottom: 1.15, left: 2, right: 2 },
      lineColor: SUBTLE_LINE,
      lineWidth: 0.2,
      textColor: INK,
      valign: "middle",
    },
    headStyles: {
      fillColor: DEEP_GREEN,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    footStyles: {
      fillColor: MINT_BG,
      textColor: DEEP_GREEN,
      fontStyle: "bold",
      fontSize: 6.7,
    },
    alternateRowStyles: {
      fillColor: ZEBRA_BG,
    },
    columnStyles: {
      0: { cellWidth: 23, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 23, halign: "center", textColor: MUTED },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 39, halign: "center" },
      4: { cellWidth: 34, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const route = String(data.cell.raw || "");
        data.cell.styles.textColor = route.startsWith("MNA-")
          ? DEEP_GREEN
          : INBOUND_BLUE;
      }
      if (data.section === "foot") {
        if (data.column.index === 0) data.cell.styles.halign = "left";
        if (data.column.index === 2 || data.column.index === 4) {
          data.cell.styles.halign = "right";
        }
        if (data.column.index === 3) data.cell.styles.halign = "center";
      }
    },
  });

  const leftEndY = doc.lastAutoTable.finalY;

  const compositionRows = [
    ["Penumpang (PAX)", "—", totals.passengerWeight],
    ["Bagasi Tercatat", totals.baggagePieces, totals.baggageWeight],
    ["Bagasi Kabin", totals.cabinBaggagePieces, totals.cabinBaggageWeight],
    ["Kargo", totals.cargoPieces, totals.cargoWeight],
  ];

  doc.autoTable({
    startY: summaryTopY + 1.8,
    margin: { left: rightColX, right: MARGIN_X },
    tableWidth: rightColWidth,
    head: [["KATEGORI MUATAN", "KOLI", "BERAT", "PORSI"]],
    body: compositionRows.map(([label, pieces, weight]) => [
      label,
      pieces,
      formatWeight(weight),
      formatPercent(weight, totals.totalWeight),
    ]),
    foot: [
      [
        "TOTAL MUATAN",
        totalPieces,
        formatWeight(totals.totalWeight),
        totals.totalWeight > 0 ? "100,0%" : "0,0%",
      ],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.7,
      cellPadding: { top: 1.15, bottom: 1.15, left: 2.2, right: 2.2 },
      lineColor: SUBTLE_LINE,
      lineWidth: 0.2,
      textColor: INK,
      valign: "middle",
    },
    headStyles: {
      fillColor: DEEP_GREEN,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    footStyles: {
      fillColor: MINT_BG,
      textColor: DEEP_GREEN,
      fontStyle: "bold",
      fontSize: 6.7,
    },
    alternateRowStyles: {
      fillColor: ZEBRA_BG,
    },
    columnStyles: {
      0: { cellWidth: 54, halign: "left" },
      1: { cellWidth: 20, halign: "right" },
      2: { cellWidth: 36, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 22, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 0) {
        data.cell.styles.halign = "left";
      }
      if (data.section === "foot") {
        data.cell.styles.halign = data.column.index === 0 ? "left" : "right";
      }
    },
  });

  // =========================================================================
  // DETAIL TABLE ON THE SAME PAGE (AUTO-SCALED TO FIT 1 SHEET)
  // =========================================================================
  const detailTitleY = Math.max(leftEndY, doc.lastAutoTable.finalY) + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...DEEP_GREEN);
  doc.text(`RINCIAN PENERBANGAN HARIAN — ${periodLabel}`, MARGIN_X, detailTitleY);

  // Adaptive row sizing calculated from remaining vertical space so the report stays on 1 page
  const detailStartY = detailTitleY + 1.8;
  const availableH = Math.max(40, pageHeight - 11.5 - detailStartY);
  const totalTableRows = Math.max(1, flights.length) + 2; // head + body + foot
  const targetRowH = availableH / totalTableRows;
  const detailFontSize = Number(
    Math.max(4.6, Math.min(7.0, (targetRowH - 0.75) / 0.52)).toFixed(2),
  );
  const detailPadY = Number(
    Math.max(0.22, Math.min(1.45, (targetRowH - detailFontSize * 0.46) / 2)).toFixed(2),
  );

  doc.autoTable({
    startY: detailStartY,
    margin: { top: 14, left: MARGIN_X, right: MARGIN_X, bottom: 10.5 },
    tableWidth: contentWidth,
    head: [
      [
        "NO",
        "TANGGAL",
        "RUTE",
        "PAX (A/C/I)",
        "BERAT PAX",
        "KOLI BAG",
        "BERAT BAG",
        "KOLI CAB",
        "BERAT CAB",
        "KOLI CRG",
        "BERAT CRG",
        "TOTAL BERAT",
      ],
    ],
    body: flights.map((flight, index) => {
      const rowWeight =
        flight.passengerWeight +
        flight.baggageWeight +
        flight.cabinBaggageWeight +
        flight.cargoWeight;
      return [
        index + 1,
        formatPdfDate(flight.date, month, year),
        flight.route,
        formatCompactPax(flight.adultPax, flight.childPax, flight.infantPax),
        formatWeight(flight.passengerWeight),
        flight.baggagePieces,
        formatWeight(flight.baggageWeight),
        flight.cabinBaggagePieces,
        formatWeight(flight.cabinBaggageWeight),
        flight.cargoPieces,
        formatWeight(flight.cargoWeight),
        formatWeight(rowWeight),
      ];
    }),
    foot: [
      [
        "",
        "TOTAL",
        `${totalFlights} Flt`,
        formatCompactPax(totals.adultPax, totals.childPax, totals.infantPax),
        formatWeight(totals.passengerWeight),
        totals.baggagePieces,
        formatWeight(totals.baggageWeight),
        totals.cabinBaggagePieces,
        formatWeight(totals.cabinBaggageWeight),
        totals.cargoPieces,
        formatWeight(totals.cargoWeight),
        formatWeight(totals.totalWeight),
      ],
    ],
    showFoot: "lastPage",
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: detailFontSize,
      cellPadding: { top: detailPadY, bottom: detailPadY, left: 1.8, right: 1.8 },
      lineColor: SUBTLE_LINE,
      lineWidth: 0.2,
      textColor: INK,
      valign: "middle",
    },
    headStyles: {
      fillColor: DEEP_GREEN,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: Math.min(detailFontSize, 6.6),
      halign: "center",
    },
    footStyles: {
      fillColor: MINT_BG,
      textColor: DEEP_GREEN,
      fontStyle: "bold",
      fontSize: detailFontSize,
    },
    alternateRowStyles: {
      fillColor: ZEBRA_BG,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: MUTED },
      1: { cellWidth: 23, halign: "center" },
      2: { cellWidth: 21, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 34, halign: "center" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 17, halign: "right" },
      6: { cellWidth: 25, halign: "right" },
      7: { cellWidth: 17, halign: "right" },
      8: { cellWidth: 25, halign: "right" },
      9: { cellWidth: 17, halign: "right" },
      10: { cellWidth: 26, halign: "right" },
      11: { cellWidth: 33, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const route = String(data.cell.raw || "");
        data.cell.styles.textColor = route.startsWith("MNA-")
          ? DEEP_GREEN
          : INBOUND_BLUE;
      }
      if (data.section === "foot" && data.column.index >= 4) {
        data.cell.styles.halign = "right";
      }
      if (data.section === "foot" && data.column.index <= 3) {
        data.cell.styles.halign = "center";
      }
    },
  });

  // =========================================================================
  // CONSISTENT FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
    doc.setPage(pageNo);
    const footerLineY = pageHeight - 9.5;
    doc.setDrawColor(...SUBTLE_LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN_X, footerLineY, pageWidth - MARGIN_X, footerLineY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      `Laporan Data Penerbangan • Susi Air Melonguane (MNA) — ${monthName} ${year}`,
      MARGIN_X,
      pageHeight - 5.5,
    );
    doc.text(
      `Halaman ${pageNo} dari ${totalPages}`,
      pageWidth - MARGIN_X,
      pageHeight - 5.5,
      { align: "right" },
    );
  }
}
