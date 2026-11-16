import { useEffect, useMemo, useState } from "react";
import signatureUrl from "../assets/ttd.png";

const API_URL = "/flights.php";
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const RECENT_PERIODS = Array.from({ length: 4 }, (_, index) => {
  const date = new Date(CURRENT_YEAR, CURRENT_DATE.getMonth() - index, 1);
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1),
    label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  };
});
const EMPTY_FLIGHTS = [];
const YEARS = Array.from(
  { length: Math.max(7, CURRENT_YEAR - 2024 + 1) },
  (_, index) => String(2024 + index),
);
const INCOME_ROUTES = new Set(["MNA-MDC", "MNA-IAX"]);
const GROUND_HANDLING_FEE_PER_FLIGHT = 30000;
const ROUTES = ["MNA-MDC", "MNA-IAX", "MDC-MNA", "IAX-MNA"];

const mapApiFlight = (flight) => ({
  id: Number(flight.id),
  date: Number(flight.flight_day),
  route: String(flight.route || ""),
  pax: Number(flight.pax) || 0,
  basicFare: Number(flight.basic_fare) || 0,
  feeTicket: Number(flight.fee_ticket) || 0,
  note: String(flight.note || ""),
  passengerWeight: Number(flight.passenger_weight) || 0,
  baggagePieces: Number(flight.baggage_pieces) || 0,
  baggageWeight: Number(flight.baggage_weight) || 0,
  cabinBaggagePieces: Number(flight.cabin_baggage_pieces) || 0,
  cabinBaggageWeight: Number(flight.cabin_baggage_weight) || 0,
  cargoPieces: Number(flight.cargo_pieces) || 0,
  cargoWeight: Number(flight.cargo_weight) || 0,
});

const formatCurrency = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatWeight = (weight) =>
  `${Number(weight || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })} KG`;

const formatFlightDate = (day, month, year) =>
  new Date(Number(year), month - 1, day).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatPdfDate = (day, month, year) =>
  `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;

async function getPeriodFlights(year, month, signal) {
  const params = new URLSearchParams({ year, month: String(month) });
  const response = await fetch(`${API_URL}?${params}`, { signal });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !Array.isArray(result.data)) {
    throw new Error(
      result?.message || `Gagal memuat data dari API (${response.status}).`,
    );
  }

  return result.data.map(mapApiFlight);
}

async function saveHistoryPdf(pdfBlob, year, month) {
  const params = new URLSearchParams({
    path: "/api/flight-pdf",
    year: String(year),
    month: String(month),
  });
  const response = await fetch(`/server/index.php?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdfBlob,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success !== true || !result.filename) {
    throw new Error(result.error || "PDF gagal disimpan ke folder server.");
  }

  return result.filename;
}

function FlightDataPages({ page }) {
  const [month, setMonth] = useState(String(CURRENT_DATE.getMonth() + 1));
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [periodResult, setPeriodResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const monthName = MONTHS[Number(month) - 1];
  const requestKey = `${page}-${year}-${month}-${refreshKey}`;

  useEffect(() => {
    const controller = new AbortController();

    const loadFlights = async () => {
      try {
        if (page === "dashboard") {
          const periods = await Promise.all(
            RECENT_PERIODS.map(async (period) => ({
              ...period,
              flights: await getPeriodFlights(
                period.year,
                period.month,
                controller.signal,
              ),
            })),
          );
          setPeriodResult({
            key: requestKey,
            flights: periods[0].flights,
            periods,
            type: "success",
            message: "Ringkasan Penghasilan berhasil dimuat.",
          });
          return;
        }

        const records = await getPeriodFlights(year, month, controller.signal);
        setPeriodResult({
          key: requestKey,
          flights: records,
          type: "success",
          message: `${records.length} data penerbangan ditemukan untuk ${monthName} ${year}.`,
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setPeriodResult({
            key: requestKey,
            flights: [],
            type: "error",
            message: error.message,
          });
        }
      }
    };

    loadFlights();

    return () => controller.abort();
  }, [month, monthName, page, refreshKey, requestKey, year]);

  const currentPeriodResult =
    periodResult?.key === requestKey ? periodResult : null;
  const flights = currentPeriodResult?.flights || EMPTY_FLIGHTS;
  const status = currentPeriodResult || {
    type: "loading",
    message:
      page === "dashboard"
        ? "Memuat ringkasan empat bulan terakhir..."
        : `Memuat data ${monthName} ${year}...`,
  };
  const dashboardPeriods = currentPeriodResult?.periods || EMPTY_FLIGHTS;
  const monthlyIncome = RECENT_PERIODS.map((period, index) => {
    const periodFlights = dashboardPeriods[index]?.flights || EMPTY_FLIGHTS;
    const incomeFlights = periodFlights.filter((flight) =>
      INCOME_ROUTES.has(flight.route),
    ).length;
    const income = periodFlights.reduce(
      (total, flight) =>
        total +
        (INCOME_ROUTES.has(flight.route) ? flight.pax * flight.feeTicket : 0),
      0,
    );

    return {
      ...period,
      income,
      groundHandlingIncome:
        incomeFlights * GROUND_HANDLING_FEE_PER_FLIGHT,
      totalIncome:
        income + incomeFlights * GROUND_HANDLING_FEE_PER_FLIGHT,
    };
  });

  const totals = useMemo(
    () =>
      flights.reduce(
        (result, flight) => {
          result.pax += flight.pax;
          result.passengerWeight += flight.passengerWeight;
          result.baggagePieces += flight.baggagePieces;
          result.baggageWeight += flight.baggageWeight;
          result.cabinBaggagePieces += flight.cabinBaggagePieces;
          result.cabinBaggageWeight += flight.cabinBaggageWeight;
          result.cargoPieces += flight.cargoPieces;
          result.cargoWeight += flight.cargoWeight;
          result.totalWeight +=
            flight.passengerWeight +
            flight.baggageWeight +
            flight.cabinBaggageWeight +
            flight.cargoWeight;

          if (flight.route === "MNA-MDC") {
            result.routes["MNA-MDC"].flights += 1;
            result.routes["MNA-MDC"].pax += flight.pax;
          } else if (flight.route === "MNA-IAX") {
            result.routes["MNA-IAX"].flights += 1;
            result.routes["MNA-IAX"].pax += flight.pax;
          } else if (flight.route === "MDC-MNA") {
            result.routes["MDC-MNA"].flights += 1;
            result.routes["MDC-MNA"].pax += flight.pax;
          } else if (flight.route === "IAX-MNA") {
            result.routes["IAX-MNA"].flights += 1;
            result.routes["IAX-MNA"].pax += flight.pax;
          }

          if (INCOME_ROUTES.has(flight.route)) {
            result.incomeFlights += 1;
            result.incomePax += flight.pax;
            result.income += flight.pax * flight.feeTicket;
            result.routes[flight.route].income += flight.pax * flight.feeTicket;
          }
          return result;
        },
        {
          pax: 0,
          passengerWeight: 0,
          baggagePieces: 0,
          baggageWeight: 0,
          cabinBaggagePieces: 0,
          cabinBaggageWeight: 0,
          cargoPieces: 0,
          cargoWeight: 0,
          totalWeight: 0,
          incomeFlights: 0,
          incomePax: 0,
          income: 0,
          routes: Object.fromEntries(
            ROUTES.map((route) => [route, { flights: 0, pax: 0, income: 0 }]),
          ),
        },
      ),
    [flights],
  );
  const groundHandlingIncome =
    totals.incomeFlights * GROUND_HANDLING_FEE_PER_FLIGHT;
  const totalIncome = totals.income + groundHandlingIncome;
  const incomeFlights = flights.filter((flight) =>
    INCOME_ROUTES.has(flight.route),
  );
  const visibleFlights = page === "history" ? flights : incomeFlights;
  const isLoading = status.type === "loading";
  const dashboardValue = (value) =>
    isLoading ? "..." : status.type === "error" ? "—" : value;

  const exportPdf = async (action) => {
    if (isLoading || visibleFlights.length === 0 || isPdfLoading) return;

    const previewWindow =
      action === "preview" ? window.open("about:blank", "_blank") : null;
    if (action === "preview" && !previewWindow) {
      setPdfError("Izinkan pop-up di browser untuk melihat preview PDF.");
      return;
    }

    setPdfError("");
    setIsPdfLoading(true);
    try {
      const pdfMonth = page === "dashboard" ? RECENT_PERIODS[0].month : month;
      const pdfYear = page === "dashboard" ? RECENT_PERIODS[0].year : year;
      const pdfMonthName = MONTHS[Number(pdfMonth) - 1];
      const [{ jsPDF }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({
        orientation: page === "history" ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      if (page === "history") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(
          `RIWAYAT PENERBANGAN - ${monthName.toUpperCase()} ${year}`,
          doc.internal.pageSize.getWidth() / 2,
          15,
          { align: "center" },
        );
        doc.autoTable({
          startY: 23,
          head: [["RINGKASAN BULANAN", "JUMLAH"]],
          body: [
            ["Total penerbangan", flights.length],
            ["Total penumpang (PAX)", totals.pax],
            ["Total berat penumpang", formatWeight(totals.passengerWeight)],
            ["Jumlah koli bagasi", totals.baggagePieces],
            ["Total berat bagasi", formatWeight(totals.baggageWeight)],
            ["Jumlah koli bagasi cabin", totals.cabinBaggagePieces],
            [
              "Total berat bagasi cabin",
              formatWeight(totals.cabinBaggageWeight),
            ],
            ["Jumlah koli cargo", totals.cargoPieces],
            ["Total berat cargo", formatWeight(totals.cargoWeight)],
            ["Total seluruh berat", formatWeight(totals.totalWeight)],
          ],
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 2.5 },
          headStyles: { fontStyle: "bold", fillColor: [23, 118, 109] },
          columnStyles: { 1: { halign: "right" } },
          tableWidth: 110,
        });
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 5,
          head: [["RINGKASAN RUTE", "PENERBANGAN", "PAX"]],
          body: ROUTES.map((route) => [
            route,
            totals.routes[route].flights,
            totals.routes[route].pax,
          ]),
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 2.5 },
          headStyles: { fontStyle: "bold", fillColor: [23, 118, 109] },
          tableWidth: 110,
        });
        doc.addPage();
        doc.setFontSize(12);
        doc.text(
          `RINCIAN PENERBANGAN - ${monthName.toUpperCase()} ${year}`,
          doc.internal.pageSize.getWidth() / 2,
          12,
          { align: "center" },
        );
        doc.autoTable({
          startY: 18,
          head: [
            [
              "TANGGAL",
              "RUTE",
              "PAX",
              "BERAT PAX",
              "KOLI BAGASI",
              "BERAT BAGASI",
              "KOLI CABIN",
              "BERAT CABIN",
              "KOLI CARGO",
              "BERAT CARGO",
              "TOTAL BERAT",
            ],
          ],
          body: flights.map((flight) => [
            formatPdfDate(flight.date, month, year),
            flight.route,
            flight.pax,
            formatWeight(flight.passengerWeight),
            flight.baggagePieces,
            formatWeight(flight.baggageWeight),
            flight.cabinBaggagePieces,
            formatWeight(flight.cabinBaggageWeight),
            flight.cargoPieces,
            formatWeight(flight.cargoWeight),
            formatWeight(
              flight.passengerWeight +
                flight.baggageWeight +
                flight.cabinBaggageWeight +
                flight.cargoWeight,
            ),
          ]),
          foot: [
            [
              "TOTAL",
              "",
              totals.pax,
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
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 2, halign: "center" },
          headStyles: { fontStyle: "bold", fillColor: [23, 118, 109] },
          footStyles: {
            fontStyle: "bold",
            fillColor: [232, 244, 240],
            textColor: [23, 59, 62],
          },
        });
      } else {
        const margin = 14;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const tableWidth = pageWidth - margin * 2;
        const signature = new Image();
        await new Promise((resolve, reject) => {
          signature.onload = resolve;
          signature.onerror = () => reject(new Error("Gambar tanda tangan tidak dapat dimuat."));
          signature.src = signatureUrl;
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(
          [
            "TAGIHAN FEE TIKET SUSI AIR MELONGUANE",
            `PERIODE BULAN ${pdfMonthName.toUpperCase()} ${pdfYear}`,
          ],
          pageWidth / 2,
          15,
          { align: "center" },
        );
        doc.autoTable({
          startY: 30,
          margin: { left: margin, right: margin, bottom: margin },
          head: [["NO", "TANGGAL", "ROUTE", "PAX", "BASIC FARE", "FEE TIKET", "KETERANGAN"]],
          body: incomeFlights.map((flight, index) => [
            index + 1,
            `${flight.date} ${pdfMonthName} ${pdfYear}`,
            flight.route,
            flight.pax,
            flight.basicFare.toLocaleString("id-ID"),
            flight.feeTicket.toLocaleString("id-ID"),
            flight.note,
          ]),
          theme: "grid",
          styles: {
            fontSize: 8,
            cellPadding: 2,
            lineColor: [80, 80, 80],
            lineWidth: 0.35,
            textColor: [80, 80, 80],
          },
          headStyles: {
            fontStyle: "bold",
            halign: "center",
            fillColor: [26, 189, 156],
            textColor: [0, 0, 0],
          },
          columnStyles: {
            0: { cellWidth: tableWidth * 12 / 182, halign: "center" },
            1: { cellWidth: tableWidth * 35 / 182 },
            2: { cellWidth: tableWidth * 25 / 182, halign: "center" },
            3: { cellWidth: tableWidth * 15 / 182, halign: "center" },
            4: { cellWidth: tableWidth * 35 / 182, halign: "right" },
            5: { cellWidth: tableWidth * 35 / 182, halign: "right" },
            6: { cellWidth: tableWidth * 25 / 182, halign: "center" },
          },
        });

        let summaryY = doc.lastAutoTable.finalY + 9;
        if (summaryY + 64 > pageHeight - margin) {
          doc.addPage();
          summaryY = margin + 4;
        }
        const rightX = pageWidth - margin - 48;
        const formatAmount = (amount) => amount.toLocaleString("id-ID");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Ringkasan:", margin, summaryY);
        doc.setFont("helvetica", "normal");
        doc.text(`Total PAX MNA-MDC: ${totals.routes["MNA-MDC"].pax}`, margin, summaryY + 7);
        doc.text(`Total Flight MNA-MDC: ${totals.routes["MNA-MDC"].flights}`, margin, summaryY + 14);
        doc.text(`Total PAX MNA-IAX: ${totals.routes["MNA-IAX"].pax}`, rightX, summaryY + 7);
        doc.text(`Total Flight MNA-IAX: ${totals.routes["MNA-IAX"].flights}`, rightX, summaryY + 14);
        doc.setFont("helvetica", "bold");
        doc.text("Total Keseluruhan:", margin, summaryY + 25);
        doc.setFont("helvetica", "normal");
        doc.text(`Total PAX: ${totals.incomePax}`, margin, summaryY + 32);
        doc.text(`Total Fee MNA-MDC: ${formatAmount(totals.routes["MNA-MDC"].income)}`, margin, summaryY + 39);
        doc.text(`Total Fee MNA-IAX: ${formatAmount(totals.routes["MNA-IAX"].income)}`, margin, summaryY + 46);
        doc.text(`Total Fee Agent: ${formatAmount(totals.income)}`, margin, summaryY + 53);
        doc.text(`Total Flight: ${totals.incomeFlights}`, margin, summaryY + 60);
        const signedDate = new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Makassar",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date());
        doc.text(`Melonguane, ${signedDate}`, rightX + 24, summaryY + 25, { align: "center" });
        doc.addImage(signature, "PNG", rightX, summaryY + 27, 48, 28);
        doc.setFont("helvetica", "bold");
        doc.text("Witri Lia Anggraini", rightX + 24, summaryY + 56, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(
          "BRI - 5788 0104 1260 535",
          rightX + 24,
          summaryY + 63,
          { align: "center" },
        );
      }

      const pdfBlob = doc.output("blob");
      const historyPdfName =
        page === "history" ? await saveHistoryPdf(pdfBlob, year, month) : null;

      if (previewWindow) {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        previewWindow.location.href = pdfUrl;
        window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
      } else {
        doc.save(
          historyPdfName ||
          (page === "history"
            ? `Riwayat_Penerbangan_${monthName}_${year}.pdf`
            : `Fee_Ticket_Melonguane_${pdfMonthName}_${pdfYear}.pdf`),
        );
      }
    } catch (error) {
      previewWindow?.close();
      setPdfError(`PDF gagal dibuat: ${error.message}`);
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div className="flight-report">
      <section
        className={`flight-report-controls ${
          page === "dashboard" ? "dashboard-controls" : ""
        }`}
        aria-label={
          page === "dashboard" ? "Dashboard Flight Data" : "Pilih periode"
        }
      >
        {page === "dashboard" ? (
          <strong>Ringkasan {RECENT_PERIODS[0].label}</strong>
        ) : (
          <>
            <label className="schedule-period-field">
              Bulan
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                {MONTHS.map((name, index) => (
                  <option key={name} value={String(index + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="schedule-period-field">
              Tahun
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                {YEARS.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button
          type="button"
          className="secondary-button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={isLoading}
        >
          {isLoading ? "Memuat..." : "Muat ulang"}
        </button>
      </section>

      <div
        className={`flight-report-status ${status.type}`}
        role={status.type === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {status.type === "loading" ? status.message : null}
        {status.type === "success" ? status.message : null}
        {status.type === "error" && `Gagal memuat data: ${status.message}`}
      </div>
      {pdfError && (
        <div className="flight-report-status error" role="alert">
          {pdfError}
        </div>
      )}

      {page === "dashboard" ? (
        <>
          <section
            className="flight-report-metrics"
            aria-label="Ringkasan penerbangan"
          >
            <Metric
              label="Total Penerbangan"
              value={dashboardValue(flights.length)}
              tone="flight"
            />
            <Metric
              label="PAX MNA-MDC"
              value={dashboardValue(totals.routes["MNA-MDC"].pax)}
              tone="mdc"
            />
            <Metric
              label="PAX MNA-IAX"
              value={dashboardValue(totals.routes["MNA-IAX"].pax)}
              tone="iax"
            />
            <Metric
              label="Total PAX"
              value={dashboardValue(totals.pax)}
              tone="pax"
            />
          </section>

          <section className="flight-report-panel">
            <header className="flight-report-panel-heading">
              <div>
                <span className="section-kicker">RINGKASAN PENGHASILAN</span>
                <h2>Empat Bulan Terakhir</h2>
              </div>
            </header>
            <div className="flight-dashboard-income-grid">
              {monthlyIncome.map((period) => (
                <article
                  className="flight-dashboard-income-card"
                  key={period.label}
                >
                  <span>{period.label}</span>
                  <small className="income-total-label">Total Penghasilan</small>
                  <strong className="income-total-value">
                    {dashboardValue(formatCurrency(period.totalIncome))}
                  </strong>
                  <div className="income-card-breakdown">
                    <div>
                      <small>Fee Tiket</small>
                      <strong>
                        {dashboardValue(formatCurrency(period.income))}
                      </strong>
                    </div>
                    <div>
                      <small>Penghasilan GH</small>
                      <strong>
                        {dashboardValue(
                          formatCurrency(period.groundHandlingIncome),
                        )}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <div className="flight-report-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportPdf("preview")}
              disabled={isLoading || visibleFlights.length === 0 || isPdfLoading}
            >
              {isPdfLoading ? "Membuat PDF..." : "Preview PDF"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => exportPdf("download")}
              disabled={isLoading || visibleFlights.length === 0 || isPdfLoading}
            >
              Download PDF
            </button>
          </div>
        </>
      ) : page === "history" ? (
        <>
          <section className="flight-report-metrics" aria-label="Ringkasan">
            <Metric
              label="Total Penerbangan"
              value={flights.length}
              tone="flight"
            />
            <Metric
              label="Total Penumpang (PAX)"
              value={totals.pax}
              tone="mdc"
            />
            <Metric
              label="Total PAX MNA-MDC"
              value={totals.routes["MNA-MDC"].pax}
              tone="mdc"
            />
            <Metric
              label="Total PAX MNA-IAX"
              value={totals.routes["MNA-IAX"].pax}
              tone="iax"
            />
          </section>

          <section className="flight-report-panel">
            <header className="flight-report-panel-heading tone-mdc">
              <div>
                <span className="section-kicker">RINGKASAN RUTE</span>
                <h2>
                  {monthName} {year}
                </h2>
              </div>
            </header>
            <div className="flight-report-route-grid">
              {ROUTES.map((route) => (
                <div
                  className={`flight-report-route route-${route.toLowerCase()}`}
                  key={route}
                >
                  <strong>{route}</strong>
                  <span>{totals.routes[route].flights} penerbangan</span>
                  <span>{totals.routes[route].pax} PAX</span>
                </div>
              ))}
            </div>
          </section>

          <section className="flight-report-panel">
            <div className="flight-report-table-wrap">
              <table className="flight-report-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Rute</th>
                    <th>PAX</th>
                    <th>Berat PAX</th>
                    <th>Koli Bagasi</th>
                    <th>Berat Bagasi</th>
                    <th>Koli Cabin</th>
                    <th>Berat Cabin</th>
                    <th>Koli Cargo</th>
                    <th>Berat Cargo</th>
                    <th>Total Load</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFlights.map((flight) => (
                    <tr key={flight.id}>
                      <td>
                        {formatFlightDate(flight.date, Number(month), year)}
                      </td>
                      <td>{flight.route}</td>
                      <td>{flight.pax}</td>
                      <td>{formatWeight(flight.passengerWeight)}</td>
                      <td>{flight.baggagePieces}</td>
                      <td>{formatWeight(flight.baggageWeight)}</td>
                      <td>{flight.cabinBaggagePieces}</td>
                      <td>{formatWeight(flight.cabinBaggageWeight)}</td>
                      <td>{flight.cargoPieces}</td>
                      <td>{formatWeight(flight.cargoWeight)}</td>
                      <td className="emphasized">
                        {formatWeight(
                          flight.passengerWeight +
                            flight.baggageWeight +
                            flight.cabinBaggageWeight +
                            flight.cargoWeight,
                        )}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && visibleFlights.length === 0 && (
                    <tr>
                      <td colSpan={11} className="flight-report-empty">
                        Belum ada data penerbangan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flight-report-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportPdf("preview")}
              disabled={
                isLoading || visibleFlights.length === 0 || isPdfLoading
              }
            >
              {isPdfLoading ? "Membuat PDF..." : "Preview PDF"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => exportPdf("download")}
              disabled={
                isLoading || visibleFlights.length === 0 || isPdfLoading
              }
            >
              Download PDF
            </button>
          </div>
        </>
      ) : (
        <>
          <section
            className="flight-report-metrics income-metrics"
            aria-label="Ringkasan"
          >
            <Metric
              label="Total Penghasilan"
              value={dashboardValue(formatCurrency(totalIncome))}
              tone="flight"
            />
            <Metric
              label="Total Penghasilan Fee"
              value={dashboardValue(formatCurrency(totals.income))}
              tone="iax"
            />
            <Metric
              label="Penghasilan GH"
              value={dashboardValue(formatCurrency(groundHandlingIncome))}
              tone="pax"
            />
            <Metric
              label="Total Penerbangan"
              value={dashboardValue(totals.incomeFlights)}
              tone="mdc"
            />
            <Metric
              label="Total PAX"
              value={dashboardValue(totals.incomePax)}
              tone="total"
            />
          </section>

          <section className="flight-report-panel">
            <header className="flight-report-panel-heading tone-flight">
              <div>
                <span className="section-kicker">RINCIAN PENGHASILAN</span>
                <h2>
                  {monthName} {year}
                </h2>
              </div>
            </header>
            <div className="flight-report-route-grid income">
              {["MNA-MDC", "MNA-IAX"].map((route) => (
                <div
                  className={`flight-report-route route-${route.toLowerCase()}`}
                  key={route}
                >
                  <strong>{route}</strong>
                  <span>{totals.routes[route].flights} penerbangan</span>
                  <span>{totals.routes[route].pax} PAX</span>
                  <b>{formatCurrency(totals.routes[route].income)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="flight-report-panel">
            <div className="flight-report-table-wrap">
              <table className="flight-report-table income">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Rute</th>
                    <th>PAX</th>
                    <th>Fee per PAX</th>
                    <th>Total Penghasilan</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFlights.map((flight) => (
                    <tr key={flight.id}>
                      <td>
                        {formatFlightDate(flight.date, Number(month), year)}
                      </td>
                      <td>{flight.route}</td>
                      <td>{flight.pax}</td>
                      <td>{formatCurrency(flight.feeTicket)}</td>
                      <td className="emphasized">
                        {formatCurrency(flight.pax * flight.feeTicket)}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && visibleFlights.length === 0 && (
                    <tr>
                      <td colSpan={5} className="flight-report-empty">
                        Belum ada data penghasilan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flight-report-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportPdf("preview")}
              disabled={
                isLoading || visibleFlights.length === 0 || isPdfLoading
              }
            >
              {isPdfLoading ? "Membuat PDF..." : "Preview PDF"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => exportPdf("download")}
              disabled={
                isLoading || visibleFlights.length === 0 || isPdfLoading
              }
            >
              Download PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <article
      className={`flight-report-metric ${tone ? `tone-${tone}` : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default FlightDataPages;
