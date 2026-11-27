import { useEffect, useMemo, useState } from "react";
import signatureUrl from "../assets/ttd.png";
import { FLIGHTS_ENDPOINT, flightPdfUrl } from "../apiConfig";
import { buildFlightHistoryPdf } from "../utils/flightHistoryPdf";
import { buildFinanceInvoicePdf } from "../utils/flightFinancePdf";

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
  adultPax:
    flight.adult_pax !== undefined
      ? Number(flight.adult_pax) || 0
      : Number(flight.pax) || 0,
  childPax: Number(flight.child_pax) || 0,
  infantPax: Number(flight.infant_pax) || 0,
  pax:
    flight.adult_pax !== undefined ||
    flight.child_pax !== undefined ||
    flight.infant_pax !== undefined
      ? (Number(flight.adult_pax) || 0) +
        (Number(flight.child_pax) || 0) +
        (Number(flight.infant_pax) || 0)
      : Number(flight.pax) || 0,
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

const formatPax = (adult, child, infant) => {
  const adultValue = Number(adult) || 0;
  const childValue = Number(child) || 0;
  const infantValue = Number(infant) || 0;
  const totalPax = adultValue + childValue + infantValue;

  return `${String(adultValue).padStart(2, "0")}/${String(childValue).padStart(2, "0")}/${String(infantValue).padStart(2, "0")} (${totalPax} PAX)`;
};

const formatIncomePax = (adult, child, infant) => {
  const adultValue = Number(adult) || 0;
  const childValue = Number(child) || 0;
  const infantValue = Number(infant) || 0;
  const chargedPax = adultValue + childValue;

  return `${String(adultValue).padStart(2, "0")}/${String(childValue).padStart(2, "0")}/${String(infantValue).padStart(2, "0")} (${chargedPax} PAX)`;
};

const formatIncomePaxCount = (adult, child) =>
  String((Number(adult) || 0) + (Number(child) || 0));

const formatFlightDate = (day, month, year) =>
  new Date(Number(year), month - 1, day).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatPdfDate = (day, month, year) =>
  `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;

const periodFlightsCache = new Map();
const inFlightPeriodRequests = new Map();
let activeCacheVersion = 0;

const syncCacheVersion = (version) => {
  if (version !== activeCacheVersion) {
    periodFlightsCache.clear();
    inFlightPeriodRequests.clear();
    activeCacheVersion = version;
  }
};

const periodCacheKey = (authScope, year, month) =>
  `${authScope}:${year}-${Number(month)}`;

async function getPeriodFlights(year, month, signal) {
  const params = new URLSearchParams({ year, month: String(month) });
  const response = await fetch(`${FLIGHTS_ENDPOINT}?${params}`, { signal });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !Array.isArray(result.data)) {
    throw new Error(
      result?.message || `Gagal memuat data dari API (${response.status}).`,
    );
  }

  return result.data.map(mapApiFlight);
}

async function getPeriodFlightsCached(year, month, authScope, signal) {
  const key = periodCacheKey(authScope, year, month);
  if (periodFlightsCache.has(key)) {
    return periodFlightsCache.get(key);
  }

  let promise = inFlightPeriodRequests.get(key);
  if (!promise) {
    promise = getPeriodFlights(year, month)
      .then((records) => {
        periodFlightsCache.set(key, records);
        return records;
      })
      .finally(() => {
        inFlightPeriodRequests.delete(key);
      });
    inFlightPeriodRequests.set(key, promise);
  }

  if (!signal) return promise;

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function getCachedViewResult(page, year, month, monthName, authScope, requestKey) {
  if (page === "dashboard") {
    const allCached = RECENT_PERIODS.every((period) =>
      periodFlightsCache.has(periodCacheKey(authScope, period.year, period.month)),
    );
    if (!allCached) return null;

    const periods = RECENT_PERIODS.map((period) => ({
      ...period,
      flights: periodFlightsCache.get(
        periodCacheKey(authScope, period.year, period.month),
      ),
    }));
    return {
      key: requestKey,
      flights: periods[0].flights,
      periods,
      type: "success",
      message: "Ringkasan Penghasilan berhasil dimuat.",
    };
  }

  const key = periodCacheKey(authScope, year, month);
  if (!periodFlightsCache.has(key)) return null;

  const records = periodFlightsCache.get(key);
  return {
    key: requestKey,
    flights: records,
    type: "success",
    message: `${records.length} data penerbangan ditemukan untuk ${monthName} ${year}.`,
  };
}

async function saveHistoryPdf(pdfBlob, year, month) {
  const response = await fetch(flightPdfUrl(year, month), {
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

function FlightDataPages({
  page,
  isFinanceAuthenticated = false,
  cacheVersion = 0,
}) {
  syncCacheVersion(cacheVersion);
  const [month, setMonth] = useState(String(CURRENT_DATE.getMonth() + 1));
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [tableSearch, setTableSearch] = useState("");
  const [periodResult, setPeriodResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const monthName = MONTHS[Number(month) - 1];
  const authScope = isFinanceAuthenticated ? "finance" : "public";
  const requestKey = `${authScope}-${page}-${year}-${month}-${refreshKey}`;
  const cachedResult = getCachedViewResult(
    page,
    year,
    month,
    monthName,
    authScope,
    requestKey,
  );

  useEffect(() => {
    if (cachedResult) return undefined;

    const controller = new AbortController();

    const loadFlights = async () => {
      try {
        if (page === "dashboard") {
          const periods = await Promise.all(
            RECENT_PERIODS.map(async (period) => ({
              ...period,
              flights: await getPeriodFlightsCached(
                period.year,
                period.month,
                authScope,
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

        const records = await getPeriodFlightsCached(
          year,
          month,
          authScope,
          controller.signal,
        );
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
  }, [authScope, cachedResult, month, monthName, page, refreshKey, requestKey, year]);

  const handleManualRefresh = () => {
    if (page === "dashboard") {
      RECENT_PERIODS.forEach((period) => {
        periodFlightsCache.delete(
          periodCacheKey(authScope, period.year, period.month),
        );
      });
    } else {
      periodFlightsCache.delete(periodCacheKey(authScope, year, month));
    }
    setPeriodResult(null);
    setRefreshKey((key) => key + 1);
  };

  const currentPeriodResult =
    cachedResult || (periodResult?.key === requestKey ? periodResult : null);
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
        (INCOME_ROUTES.has(flight.route)
          ? (flight.adultPax + flight.childPax) * flight.feeTicket
          : 0),
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
          result.adultPax += flight.adultPax;
          result.childPax += flight.childPax;
          result.infantPax += flight.infantPax;
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
            result.routes["MNA-MDC"].adultPax += flight.adultPax;
            result.routes["MNA-MDC"].childPax += flight.childPax;
            result.routes["MNA-MDC"].infantPax += flight.infantPax;
          } else if (flight.route === "MNA-IAX") {
            result.routes["MNA-IAX"].flights += 1;
            result.routes["MNA-IAX"].pax += flight.pax;
            result.routes["MNA-IAX"].adultPax += flight.adultPax;
            result.routes["MNA-IAX"].childPax += flight.childPax;
            result.routes["MNA-IAX"].infantPax += flight.infantPax;
          } else if (flight.route === "MDC-MNA") {
            result.routes["MDC-MNA"].flights += 1;
            result.routes["MDC-MNA"].pax += flight.pax;
            result.routes["MDC-MNA"].adultPax += flight.adultPax;
            result.routes["MDC-MNA"].childPax += flight.childPax;
            result.routes["MDC-MNA"].infantPax += flight.infantPax;
          } else if (flight.route === "IAX-MNA") {
            result.routes["IAX-MNA"].flights += 1;
            result.routes["IAX-MNA"].pax += flight.pax;
            result.routes["IAX-MNA"].adultPax += flight.adultPax;
            result.routes["IAX-MNA"].childPax += flight.childPax;
            result.routes["IAX-MNA"].infantPax += flight.infantPax;
          }

          if (INCOME_ROUTES.has(flight.route)) {
            result.incomeFlights += 1;
            result.incomePax += flight.adultPax + flight.childPax;
            result.incomeAdultPax += flight.adultPax;
            result.incomeChildPax += flight.childPax;
            result.incomeInfantPax += flight.infantPax;
            result.income += (flight.adultPax + flight.childPax) * flight.feeTicket;
            result.routes[flight.route].income +=
              (flight.adultPax + flight.childPax) * flight.feeTicket;
          }
          return result;
        },
        {
          pax: 0,
          adultPax: 0,
          childPax: 0,
          infantPax: 0,
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
          incomeAdultPax: 0,
          incomeChildPax: 0,
          incomeInfantPax: 0,
          income: 0,
          routes: Object.fromEntries(
            ROUTES.map((route) => [
              route,
              { flights: 0, pax: 0, adultPax: 0, childPax: 0, infantPax: 0, income: 0 },
            ]),
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
  const filteredVisibleFlights = visibleFlights.filter((flight) => {
    const matchesRoute = routeFilter === "ALL" || flight.route === routeFilter;
    const formattedDate = formatFlightDate(flight.date, Number(month), year);
    const matchesSearch =
      !tableSearch.trim() ||
      `${formattedDate} ${flight.route} ${flight.note || ""}`
        .toLowerCase()
        .includes(tableSearch.toLowerCase());
    return matchesRoute && matchesSearch;
  });
  const filteredSummary = filteredVisibleFlights.reduce(
    (acc, flight) => {
      acc.adultPax += flight.adultPax;
      acc.childPax += flight.childPax;
      acc.infantPax += flight.infantPax;
      acc.pax += flight.pax;
      acc.chargedPax += flight.adultPax + flight.childPax;
      acc.passengerWeight += flight.passengerWeight;
      acc.baggagePieces += flight.baggagePieces;
      acc.baggageWeight += flight.baggageWeight;
      acc.cabinBaggagePieces += flight.cabinBaggagePieces;
      acc.cabinBaggageWeight += flight.cabinBaggageWeight;
      acc.cargoPieces += flight.cargoPieces;
      acc.cargoWeight += flight.cargoWeight;
      acc.totalWeight +=
        flight.passengerWeight +
        flight.baggageWeight +
        flight.cabinBaggageWeight +
        flight.cargoWeight;
      acc.feeTotal += (flight.adultPax + flight.childPax) * flight.feeTicket;
      return acc;
    },
    {
      adultPax: 0,
      childPax: 0,
      infantPax: 0,
      pax: 0,
      chargedPax: 0,
      passengerWeight: 0,
      baggagePieces: 0,
      baggageWeight: 0,
      cabinBaggagePieces: 0,
      cabinBaggageWeight: 0,
      cargoPieces: 0,
      cargoWeight: 0,
      totalWeight: 0,
      feeTotal: 0,
    },
  );
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
      const [{ jsPDF }, { applyPlugin }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      applyPlugin(jsPDF);
      const doc = new jsPDF({
        orientation: page === "history" ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      if (page === "history") {
        buildFlightHistoryPdf({
          doc,
          flights,
          totals,
          routes: ROUTES,
          month,
          monthName,
          year,
          formatWeight,
          formatPdfDate,
        });
      } else {
        const signature = new Image();
        await new Promise((resolve, reject) => {
          signature.onload = resolve;
          signature.onerror = () =>
            reject(new Error("Gambar tanda tangan tidak dapat dimuat."));
          signature.src = signatureUrl;
        });

        buildFinanceInvoicePdf({
          doc,
          incomeFlights,
          totals,
          pdfMonthName,
          pdfYear,
          signature,
          formatIncomePaxCount,
        });
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
          onClick={handleManualRefresh}
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
            aria-label="Ringkasan penerbangan keuangan"
          >
            <Metric
              label="Total Penerbangan"
              value={dashboardValue(totals.incomeFlights)}
              tone="flight"
            />
            <Metric
              label="PAX MNA-MDC"
              value={dashboardValue(formatPax(
                totals.routes["MNA-MDC"].adultPax,
                totals.routes["MNA-MDC"].childPax,
                totals.routes["MNA-MDC"].infantPax,
              ))}
              tone="mdc"
            />
            <Metric
              label="PAX MNA-IAX"
              value={dashboardValue(formatPax(
                totals.routes["MNA-IAX"].adultPax,
                totals.routes["MNA-IAX"].childPax,
                totals.routes["MNA-IAX"].infantPax,
              ))}
              tone="iax"
            />
            <Metric
              label="Total PAX (MNA-MDC & MNA-IAX)"
              value={dashboardValue(formatPax(
                totals.incomeAdultPax,
                totals.incomeChildPax,
                totals.incomeInfantPax,
              ))}
              tone="pax"
            />
          </section>

          <section className="flight-report-panel">
            <header className="flight-report-panel-heading">
              <div>
                <span className="section-kicker">RINGKASAN PENGHASILAN</span>
                <h2>Komparasi & Tren Empat Bulan Terakhir</h2>
              </div>
            </header>
            <div className="flight-dashboard-income-grid">
              {(() => {
                const maxIncome = Math.max(
                  ...monthlyIncome.map((item) => item.totalIncome || 0),
                  1,
                );
                return monthlyIncome.map((period, idx) => {
                  const pct = Math.round(
                    ((period.totalIncome || 0) / maxIncome) * 100,
                  );
                  const feeShare = period.totalIncome
                    ? Math.round((period.income / period.totalIncome) * 100)
                    : 0;
                  const ghShare = period.totalIncome ? 100 - feeShare : 0;
                  const prevPeriod = monthlyIncome[idx + 1];
                  const deltaPct =
                    prevPeriod && prevPeriod.totalIncome > 0
                      ? Math.round(
                          ((period.totalIncome - prevPeriod.totalIncome) /
                            prevPeriod.totalIncome) *
                            100,
                        )
                      : null;
                  return (
                    <article
                      className="flight-dashboard-income-card"
                      key={period.label}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span>{period.label}</span>
                        {!isLoading && deltaPct !== null && (
                          <span
                            className={`income-delta-pill ${deltaPct >= 0 ? "up" : "down"}`}
                          >
                            {deltaPct >= 0 ? `↑ +${deltaPct}%` : `↓ ${deltaPct}%`}
                          </span>
                        )}
                      </div>
                      <small className="income-total-label">
                        Total Penghasilan
                      </small>
                      <strong className="income-total-value">
                        {dashboardValue(formatCurrency(period.totalIncome))}
                      </strong>
                      <div className="income-trend-bar" aria-hidden="true">
                        <div
                          className="income-trend-fill"
                          style={{ width: `${isLoading ? 0 : pct}%` }}
                        />
                      </div>
                      <div className="income-card-breakdown">
                        <div>
                          <small>Fee Tiket ({feeShare}%)</small>
                          <strong>
                            {dashboardValue(formatCurrency(period.income))}
                          </strong>
                        </div>
                        <div>
                          <small>Penghasilan GH ({ghShare}%)</small>
                          <strong>
                            {dashboardValue(
                              formatCurrency(period.groundHandlingIncome),
                            )}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                });
              })()}
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
          <section className="flight-report-metrics history-metrics" aria-label="Ringkasan">
            <Metric
              label="Total Penerbangan"
              value={flights.length}
              tone="flight"
            />
            <Metric
              label="Total Penumpang (4 Rute)"
              value={formatPax(totals.adultPax, totals.childPax, totals.infantPax)}
              tone="pax"
            />
            <Metric
              label="Total PAX MNA-MDC"
              value={formatPax(
                totals.routes["MNA-MDC"].adultPax,
                totals.routes["MNA-MDC"].childPax,
                totals.routes["MNA-MDC"].infantPax,
              )}
              tone="mdc"
            />
            <Metric
              label="Total PAX MNA-IAX"
              value={formatPax(
                totals.routes["MNA-IAX"].adultPax,
                totals.routes["MNA-IAX"].childPax,
                totals.routes["MNA-IAX"].infantPax,
              )}
              tone="iax"
            />
            <Metric
              label="Total PAX MDC-MNA"
              value={formatPax(
                totals.routes["MDC-MNA"].adultPax,
                totals.routes["MDC-MNA"].childPax,
                totals.routes["MDC-MNA"].infantPax,
              )}
              tone="mdc"
            />
            <Metric
              label="Total PAX IAX-MNA"
              value={formatPax(
                totals.routes["IAX-MNA"].adultPax,
                totals.routes["IAX-MNA"].childPax,
                totals.routes["IAX-MNA"].infantPax,
              )}
              tone="iax"
            />
          </section>

          <section className="flight-report-panel">
            <header className="flight-report-panel-heading">
              <div>
                <span className="section-kicker">DISTRIBUSI BEBAN ANGKUT (PAYLOAD)</span>
                <h2>Komposisi Berat Penumpang, Bagasi & Kargo — {formatWeight(totals.totalWeight)}</h2>
              </div>
            </header>
            <div className="payload-breakdown-grid">
              {[
                {
                  label: "Berat Penumpang",
                  weight: totals.passengerWeight,
                  sub: `${totals.pax} PAX Terangkut`,
                  tone: "pax",
                },
                {
                  label: "Bagasi Tercatat",
                  weight: totals.baggageWeight,
                  sub: `${totals.baggagePieces} Koli Bagasi`,
                  tone: "baggage",
                },
                {
                  label: "Bagasi Kabin",
                  weight: totals.cabinBaggageWeight,
                  sub: `${totals.cabinBaggagePieces} Koli Kabin`,
                  tone: "cabin",
                },
                {
                  label: "Muatan Kargo",
                  weight: totals.cargoWeight,
                  sub: `${totals.cargoPieces} Koli Kargo`,
                  tone: "cargo",
                },
              ].map((item) => {
                const share = totals.totalWeight
                  ? Math.round((item.weight / totals.totalWeight) * 100)
                  : 0;
                return (
                  <div className="payload-card" key={item.label}>
                    <div className="payload-card-top">
                      <span>{item.label}</span>
                      <span className="payload-share-badge">{share}%</span>
                    </div>
                    <strong>{formatWeight(item.weight)}</strong>
                    <div className="payload-bar" aria-hidden="true">
                      <div
                        className={`payload-bar-fill ${item.tone}`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <small>{item.sub}</small>
                  </div>
                );
              })}
            </div>
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
                  <span>
                    {formatPax(
                      totals.routes[route].adultPax,
                      totals.routes[route].childPax,
                      totals.routes[route].infantPax,
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="flight-report-panel">
            <div className="report-table-toolbar">
              <div className="flex gap-2 flex-wrap">
                {["ALL", ...ROUTES].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`filter-btn ${routeFilter === r ? "active" : ""}`}
                    onClick={() => setRouteFilter(r)}
                  >
                    {r === "ALL" ? "Semua Rute" : r}
                  </button>
                ))}
              </div>
              <input
                type="search"
                className="search-input report-search-input"
                placeholder="Filter tanggal atau rute..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                aria-label="Filter tabel riwayat penerbangan"
              />
            </div>
            <div className="flight-report-table-wrap">
              <table className="flight-report-table history-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Rute</th>
                    <th>Penumpang</th>
                    <th className="num-col">Berat PAX</th>
                    <th className="num-col">Bagasi</th>
                    <th className="num-col">Kabin</th>
                    <th className="num-col">Kargo</th>
                    <th className="num-col">Total Load</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisibleFlights.map((flight) => {
                    const rowTotalWeight =
                      flight.passengerWeight +
                      flight.baggageWeight +
                      flight.cabinBaggageWeight +
                      flight.cargoWeight;
                    const routeTone = flight.route.includes("MDC")
                      ? "route-pill-mdc"
                      : "route-pill-iax";
                    return (
                      <tr key={flight.id}>
                        <td data-label="Tanggal" className="report-date-cell">
                          <strong>
                            {formatFlightDate(flight.date, Number(month), year)}
                          </strong>
                        </td>
                        <td data-label="Rute">
                          <span className={`report-route-pill ${routeTone}`}>
                            {flight.route}
                          </span>
                        </td>
                        <td data-label="Penumpang">
                          <div className="report-cell-stack">
                            <strong>{flight.pax} PAX</strong>
                            <small>
                              {flight.adultPax} Dws • {flight.childPax} Ank •{" "}
                              {flight.infantPax} Inf
                            </small>
                          </div>
                        </td>
                        <td data-label="Berat PAX" className="num-col">
                          <span className="report-num">
                            {formatWeight(flight.passengerWeight)}
                          </span>
                        </td>
                        <td data-label="Bagasi" className="num-col">
                          <div className="report-cell-stack align-end">
                            <strong>{formatWeight(flight.baggageWeight)}</strong>
                            <small>{flight.baggagePieces} koli</small>
                          </div>
                        </td>
                        <td data-label="Kabin" className="num-col">
                          <div className="report-cell-stack align-end">
                            <strong>
                              {formatWeight(flight.cabinBaggageWeight)}
                            </strong>
                            <small>{flight.cabinBaggagePieces} koli</small>
                          </div>
                        </td>
                        <td data-label="Kargo" className="num-col">
                          <div className="report-cell-stack align-end">
                            <strong>{formatWeight(flight.cargoWeight)}</strong>
                            <small>{flight.cargoPieces} koli</small>
                          </div>
                        </td>
                        <td data-label="Total Load" className="num-col emphasized">
                          <span className="report-total-chip">
                            {formatWeight(rowTotalWeight)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!isLoading && filteredVisibleFlights.length === 0 && (
                    <tr className="report-empty-row">
                      <td colSpan={8} className="flight-report-empty">
                        Belum ada data penerbangan yang cocok pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredVisibleFlights.length > 0 && (
                  <tfoot>
                    <tr className="report-summary-row">
                      <td colSpan={2}>
                        <strong>
                          TOTAL ({filteredVisibleFlights.length} Penerbangan)
                        </strong>
                      </td>
                      <td>
                        <div className="report-cell-stack">
                          <strong>{filteredSummary.pax} PAX</strong>
                          <small>
                            {filteredSummary.adultPax} Dws •{" "}
                            {filteredSummary.childPax} Ank •{" "}
                            {filteredSummary.infantPax} Inf
                          </small>
                        </div>
                      </td>
                      <td className="num-col">
                        <strong>
                          {formatWeight(filteredSummary.passengerWeight)}
                        </strong>
                      </td>
                      <td className="num-col">
                        <div className="report-cell-stack align-end">
                          <strong>
                            {formatWeight(filteredSummary.baggageWeight)}
                          </strong>
                          <small>{filteredSummary.baggagePieces} koli</small>
                        </div>
                      </td>
                      <td className="num-col">
                        <div className="report-cell-stack align-end">
                          <strong>
                            {formatWeight(filteredSummary.cabinBaggageWeight)}
                          </strong>
                          <small>
                            {filteredSummary.cabinBaggagePieces} koli
                          </small>
                        </div>
                      </td>
                      <td className="num-col">
                        <div className="report-cell-stack align-end">
                          <strong>
                            {formatWeight(filteredSummary.cargoWeight)}
                          </strong>
                          <small>{filteredSummary.cargoPieces} koli</small>
                        </div>
                      </td>
                      <td className="num-col emphasized">
                        <strong>
                          {formatWeight(filteredSummary.totalWeight)}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                )}
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
              value={dashboardValue(formatIncomePax(
                totals.incomeAdultPax,
                totals.incomeChildPax,
                totals.incomeInfantPax,
              ))}
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
                  <span>
                    {formatIncomePax(
                      totals.routes[route].adultPax,
                      totals.routes[route].childPax,
                      totals.routes[route].infantPax,
                    )}
                  </span>
                  <b>{formatCurrency(totals.routes[route].income)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="flight-report-panel">
            <div className="report-table-toolbar">
              <div className="flex gap-2 flex-wrap">
                {["ALL", "MNA-MDC", "MNA-IAX"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`filter-btn ${routeFilter === r ? "active" : ""}`}
                    onClick={() => setRouteFilter(r)}
                  >
                    {r === "ALL" ? "Semua Rute" : r}
                  </button>
                ))}
              </div>
              <input
                type="search"
                className="search-input report-search-input"
                placeholder="Filter tanggal atau keterangan..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                aria-label="Filter tabel rincian penghasilan"
              />
            </div>
            <div className="flight-report-table-wrap">
              <table className="flight-report-table income">
                <thead>
                  <tr>
                    <th className="no-col">No</th>
                    <th>Tanggal</th>
                    <th>Rute</th>
                    <th>Penumpang (Berbayar)</th>
                    <th className="num-col">Fee / PAX</th>
                    <th className="num-col">Total Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisibleFlights.map((flight, index) => {
                    const chargedPax = flight.adultPax + flight.childPax;
                    const rowFee = chargedPax * flight.feeTicket;
                    const routeTone = flight.route.includes("MDC")
                      ? "route-pill-mdc"
                      : "route-pill-iax";
                    return (
                      <tr key={flight.id}>
                        <td data-label="No" className="no-col">
                          <span className="report-index-badge">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </td>
                        <td data-label="Tanggal" className="report-date-cell">
                          <strong>
                            {formatFlightDate(flight.date, Number(month), year)}
                          </strong>
                        </td>
                        <td data-label="Rute">
                          <span className={`report-route-pill ${routeTone}`}>
                            {flight.route}
                          </span>
                        </td>
                        <td data-label="Penumpang">
                          <div className="report-cell-stack">
                            <strong>{chargedPax} PAX</strong>
                            <small>
                              {flight.adultPax} Dws • {flight.childPax} Ank •{" "}
                              {flight.infantPax} Inf
                            </small>
                          </div>
                        </td>
                        <td data-label="Fee / PAX" className="num-col">
                          <span className="report-num">
                            {formatCurrency(flight.feeTicket)}
                          </span>
                        </td>
                        <td data-label="Total Fee" className="num-col emphasized">
                          <span className="report-total-chip">
                            {formatCurrency(rowFee)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!isLoading && filteredVisibleFlights.length === 0 && (
                    <tr className="report-empty-row">
                      <td colSpan={6} className="flight-report-empty">
                        Belum ada data penghasilan yang cocok pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredVisibleFlights.length > 0 && (
                  <tfoot>
                    <tr className="report-summary-row">
                      <td colSpan={3}>
                        <strong>
                          TOTAL ({filteredVisibleFlights.length} Penerbangan)
                        </strong>
                      </td>
                      <td>
                        <div className="report-cell-stack">
                          <strong>{filteredSummary.chargedPax} PAX</strong>
                          <small>
                            {filteredSummary.adultPax} Dws •{" "}
                            {filteredSummary.childPax} Ank •{" "}
                            {filteredSummary.infantPax} Inf
                          </small>
                        </div>
                      </td>
                      <td className="num-col">
                        <span className="text-muted text-xs">Akumulasi</span>
                      </td>
                      <td className="num-col emphasized">
                        <strong>
                          {formatCurrency(filteredSummary.feeTotal)}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                )}
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
