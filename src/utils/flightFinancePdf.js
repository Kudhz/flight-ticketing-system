const MARGIN_X = 14;
const BRAND_GREEN = [32, 165, 58]; // #20a53a
const DEEP_GREEN = [20, 83, 45]; // #14532d
const MINT_BG = [236, 253, 243]; // #ecfdf3
const MINT_BORDER = [167, 243, 208]; // #a7f3d0
const INK = [17, 24, 39]; // #111827
const MUTED = [75, 85, 99]; // #4b5563
const SUBTLE_LINE = [229, 231, 235]; // #e5e7eb
const ZEBRA_BG = [249, 250, 251]; // #f9fafb
const SECONDARY_BLUE = [30, 64, 175]; // #1e40af

const formatRp = (amount) =>
  `Rp ${Number(amount || 0).toLocaleString("id-ID")}`;

const formatNumber = (amount) => Number(amount || 0).toLocaleString("id-ID");

export function buildFinanceInvoicePdf({
  doc,
  incomeFlights,
  totals,
  pdfMonthName,
  pdfYear,
  signature,
  formatIncomePaxCount,
}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;
  const periodLabel = `${pdfMonthName.toUpperCase()} ${pdfYear}`;

  const printedAt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const signedDate = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const mdcRoute = totals.routes["MNA-MDC"];
  const iaxRoute = totals.routes["MNA-IAX"];
  const mdcPax = Number(
    formatIncomePaxCount(mdcRoute.adultPax, mdcRoute.childPax),
  );
  const iaxPax = Number(
    formatIncomePaxCount(iaxRoute.adultPax, iaxRoute.childPax),
  );
  const totalChargedPax = Number(
    formatIncomePaxCount(totals.incomeAdultPax, totals.incomeChildPax),
  );

  // =========================================================================
  // COMPACT BRANDED HEADER (NO TOP KPI CARDS — 1-PAGE LAYOUT)
  // =========================================================================
  doc.setFillColor(...BRAND_GREEN);
  doc.roundedRect(MARGIN_X, 10, 2.3, 15.5, 0.9, 0.9, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND_GREEN);
  doc.text("TICKETING SUSI AIR MELONGUANE (MNA)", MARGIN_X + 5.2, 13.5);

  doc.setFontSize(14.5);
  doc.setTextColor(...INK);
  doc.text("TAGIHAN FEE TIKET", MARGIN_X + 5.2, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...MUTED);
  doc.text(
    "Rekapitulasi Fee Penjualan Tiket Penerbangan Perintis",
    MARGIN_X + 5.2,
    24.6,
  );

  // Period pill & print date on right
  const pillWidth = 52;
  const pillX = pageWidth - MARGIN_X - pillWidth;
  doc.setFillColor(...MINT_BG);
  doc.setDrawColor(...MINT_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillX, 10.5, pillWidth, 8.2, 1.8, 1.8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...DEEP_GREEN);
  doc.text(`PERIODE ${periodLabel}`, pillX + pillWidth / 2, 15.8, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`Dicetak: ${printedAt} WITA`, pageWidth - MARGIN_X, 23.8, {
    align: "right",
  });

  doc.setDrawColor(...SUBTLE_LINE);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, 28, pageWidth - MARGIN_X, 28);

  // =========================================================================
  // INVOICE DETAIL TABLE (AUTO-SCALED TO FIT 1 SHEET WITH SUMMARY + SIGNATURE)
  // =========================================================================
  const tableStartY = 31.5;
  const summaryReserveH = 60; // gap (6) + summary/signature block (52) + safety (2)
  const availableTableH = Math.max(
    50,
    pageHeight - 13 - summaryReserveH - tableStartY,
  );
  const totalTableRows = Math.max(1, incomeFlights.length) + 2; // head + body + foot
  const targetRowH = availableTableH / totalTableRows;
  const tableFontSize = Number(
    Math.max(5.0, Math.min(7.6, (targetRowH - 0.85) / 0.54)).toFixed(2),
  );
  const tablePadY = Number(
    Math.max(0.28, Math.min(1.9, (targetRowH - tableFontSize * 0.46) / 2)).toFixed(2),
  );

  doc.autoTable({
    startY: tableStartY,
    margin: { top: 14, left: MARGIN_X, right: MARGIN_X, bottom: 13 },
    tableWidth: contentWidth,
    head: [
      [
        "NO",
        "TANGGAL",
        "RUTE",
        "PAX",
        "BASIC FARE",
        "FEE / PAX",
        "TOTAL FEE",
        "KETERANGAN",
      ],
    ],
    body: incomeFlights.map((flight, index) => {
      const chargedPax = flight.adultPax + flight.childPax;
      const rowFeeTotal = chargedPax * flight.feeTicket;
      return [
        index + 1,
        `${flight.date} ${pdfMonthName} ${pdfYear}`,
        flight.route,
        formatIncomePaxCount(flight.adultPax, flight.childPax),
        formatNumber(flight.basicFare),
        formatNumber(flight.feeTicket),
        formatNumber(rowFeeTotal),
        flight.note || "—",
      ];
    }),
    foot: [
      [
        "",
        "TOTAL",
        `${totals.incomeFlights} Flt`,
        String(totalChargedPax),
        "",
        "",
        formatRp(totals.income),
        "",
      ],
    ],
    showFoot: "lastPage",
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: tableFontSize,
      cellPadding: { top: tablePadY, bottom: tablePadY, left: 2, right: 2 },
      lineColor: SUBTLE_LINE,
      lineWidth: 0.25,
      textColor: INK,
      valign: "middle",
    },
    headStyles: {
      fillColor: DEEP_GREEN,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: Math.min(tableFontSize, 7),
      halign: "center",
    },
    footStyles: {
      fillColor: MINT_BG,
      textColor: DEEP_GREEN,
      fontStyle: "bold",
      fontSize: tableFontSize,
    },
    alternateRowStyles: {
      fillColor: ZEBRA_BG,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: MUTED },
      1: { cellWidth: 30, halign: "left" },
      2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 13, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 29, halign: "right", fontStyle: "bold" },
      7: { cellWidth: 30, halign: "center", textColor: MUTED },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const route = String(data.cell.raw || "");
        data.cell.styles.textColor =
          route === "MNA-MDC" ? DEEP_GREEN : SECONDARY_BLUE;
      }
      if (data.section === "foot") {
        if (data.column.index === 1) data.cell.styles.halign = "left";
        if (data.column.index === 2 || data.column.index === 3) {
          data.cell.styles.halign = "center";
        }
        if (data.column.index === 6) data.cell.styles.halign = "right";
      }
    },
  });

  // =========================================================================
  // COMPACT SUMMARY BOX & SIGNATURE BLOCK
  // =========================================================================
  const blockHeight = 52;
  let summaryY = doc.lastAutoTable.finalY + 6;
  if (summaryY + blockHeight > pageHeight - 13) {
    doc.addPage();
    summaryY = 16;
  }

  // Left card: Ringkasan Tagihan + Info Rekening
  const leftW = 108;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...SUBTLE_LINE);
  doc.setLineWidth(0.35);
  doc.roundedRect(MARGIN_X, summaryY, leftW, 38.5, 2, 2, "FD");

  doc.setFillColor(...ZEBRA_BG);
  doc.roundedRect(MARGIN_X, summaryY, leftW, 7.2, 2, 2, "F");
  doc.setDrawColor(...SUBTLE_LINE);
  doc.line(MARGIN_X, summaryY + 7.2, MARGIN_X + leftW, summaryY + 7.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...DEEP_GREEN);
  doc.text("RINGKASAN TAGIHAN", MARGIN_X + 4, summaryY + 4.9);

  const labelX = MARGIN_X + 4;
  const valX = MARGIN_X + leftW - 4;
  doc.setFontSize(7.8);

  // Row 1: MNA-MDC
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DEEP_GREEN);
  doc.text("MNA-MDC", labelX, summaryY + 12.6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(
    `${mdcRoute.flights} Flight  •  ${mdcPax} PAX`,
    labelX + 20,
    summaryY + 12.6,
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(formatRp(mdcRoute.income), valX, summaryY + 12.6, {
    align: "right",
  });

  // Row 2: MNA-IAX
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SECONDARY_BLUE);
  doc.text("MNA-IAX", labelX, summaryY + 18.4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(
    `${iaxRoute.flights} Flight  •  ${iaxPax} PAX`,
    labelX + 20,
    summaryY + 18.4,
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(formatRp(iaxRoute.income), valX, summaryY + 18.4, {
    align: "right",
  });

  // Row 3: Total Flight & PAX
  doc.setDrawColor(...SUBTLE_LINE);
  doc.setLineWidth(0.25);
  doc.line(labelX, summaryY + 21.6, valX, summaryY + 21.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);
  doc.setTextColor(...MUTED);
  doc.text(
    `Total Keseluruhan: ${totals.incomeFlights} Penerbangan  •  ${totalChargedPax} PAX`,
    labelX,
    summaryY + 26,
  );

  // Highlighted Total Fee Agent bar inside card
  doc.setFillColor(...MINT_BG);
  doc.setDrawColor(...MINT_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_X + 3, summaryY + 28.6, leftW - 6, 7.6, 1.4, 1.4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DEEP_GREEN);
  doc.text("TOTAL FEE AGENT", MARGIN_X + 6, summaryY + 33.6);
  doc.setFontSize(9.2);
  doc.text(formatRp(totals.income), MARGIN_X + leftW - 6, summaryY + 33.6, {
    align: "right",
  });

  // Bank transfer strip under left card
  doc.setFillColor(...ZEBRA_BG);
  doc.setDrawColor(...SUBTLE_LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_X, summaryY + 41, leftW, 10.5, 1.8, 1.8, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("REKENING TRANSFER", MARGIN_X + 4, summaryY + 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...INK);
  doc.text(
    "BRI  5788 0104 1260 535  •  a.n. Witri Lia Anggraini",
    MARGIN_X + 4,
    summaryY + 49.3,
  );

  // Right block: Signature
  const sigW = 64;
  const sigX = pageWidth - MARGIN_X - sigW;
  const sigCenterX = sigX + sigW / 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...INK);
  doc.text(`Melonguane, ${signedDate}`, sigCenterX, summaryY + 5, {
    align: "center",
  });

  if (signature) {
    doc.addImage(signature, "PNG", sigCenterX - 22, summaryY + 7.5, 44, 24.5);
  }

  doc.setDrawColor(...SUBTLE_LINE);
  doc.setLineWidth(0.35);
  doc.line(sigX + 6, summaryY + 34.8, sigX + sigW - 6, summaryY + 34.8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.6);
  doc.setTextColor(...INK);
  doc.text("Witri Lia Anggraini", sigCenterX, summaryY + 39.5, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text("Ticketing Susi Air MNA", sigCenterX, summaryY + 43.8, {
    align: "center",
  });
  doc.text("BRI - 5788 0104 1260 535", sigCenterX, summaryY + 47.8, {
    align: "center",
  });

  // =========================================================================
  // CONSISTENT FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
    doc.setPage(pageNo);
    const footerLineY = pageHeight - 10;
    doc.setDrawColor(...SUBTLE_LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN_X, footerLineY, pageWidth - MARGIN_X, footerLineY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...MUTED);
    doc.text(
      `Tagihan Fee Tiket • Susi Air Melonguane (MNA) — ${pdfMonthName} ${pdfYear}`,
      MARGIN_X,
      pageHeight - 6,
    );
    doc.text(
      `Halaman ${pageNo} dari ${totalPages}`,
      pageWidth - MARGIN_X,
      pageHeight - 6,
      { align: "right" },
    );
  }
}
