import { useState } from "react";
import {
  BOOKING_LIMIT,
  STATUSES,
  dateLabel,
  isN8nBooking,
  weekdayName,
} from "../utils/bookingUtils";

export function OverviewMetricsAndTelemetry({
  routeInfo,
  selectedRoute,
  selectedDate,
  currentBookings,
  remainingSeats,
  adultCount,
  childCount,
  infantCount,
  waitingCount,
  bookedCount,
  paidCount,
  n8nTelemetry,
  dualSectorStats,
  onSelectRoute,
  onSelectSchedule,
}) {
  const [n8nScope, setN8nScope] = useState("all");
  const displayedN8nBookings = (
    n8nScope === "current"
      ? n8nTelemetry.currentN8nBookings
      : n8nTelemetry.allN8nBookings
  ).filter(isN8nBooking);

  return (
    <>
      <section className="metric-grid" aria-label="Ringkasan pemesanan">
        <div className="metric-card card-hover">
          <div className="metric-card-header">
            <span className="metric-label">
              <span className="metric-label-full">Total Manifes</span>
              <span className="metric-label-compact">Total</span>
            </span>
            <span className="metric-icon bg-teal-light text-teal-dark">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 9.5V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5Z" />
                <path d="M12 6.5v11" strokeDasharray="2 3" />
              </svg>
            </span>
          </div>
          <strong className="metric-value">{currentBookings.length}</strong>
          <div className="metric-footer">
            <span className="metric-dot bg-blue-500"></span>
            <span>
              {adultCount} Dws • {childCount} Ank • {infantCount} Bayi
            </span>
          </div>
        </div>

        <div className="metric-card card-hover">
          <div className="metric-card-header">
            <span className="metric-label">
              <span className="metric-label-full">Sisa Kuota Kursi</span>
              <span className="metric-label-compact">Kursi</span>
            </span>
            <span className="metric-icon bg-teal-light text-teal-dark">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 5a2 2 0 0 1 2 2v6h7.5a2.5 2.5 0 0 1 2.5 2.5V19" />
                <path d="M5 19h13" />
                <path d="M17 8.5h1.5a1.5 1.5 0 0 1 1.5 1.5v2" />
              </svg>
            </span>
          </div>
          <strong className="metric-value">{remainingSeats}</strong>
          <div className="metric-footer">
            <span className="metric-dot bg-green-500"></span>
            <span>dari {BOOKING_LIMIT} kapasitas kursi</span>
          </div>
        </div>

        <div className="metric-card card-hover">
          <div className="metric-card-header">
            <span className="metric-label">
              <span className="metric-label-full">Menunggu Verifikasi</span>
              <span className="metric-label-compact">Menunggu</span>
            </span>
            <span className="metric-icon bg-amber-light text-amber-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
            </span>
          </div>
          <strong className="metric-value">{waitingCount}</strong>
          <div className="metric-footer">
            <span className="metric-dot bg-amber-600"></span>
            <span>{bookedCount} sudah berstatus Dipesan</span>
          </div>
        </div>

        <div className="metric-card card-hover">
          <div className="metric-card-header">
            <span className="metric-label">
              <span className="metric-label-full">Tiket Lunas</span>
              <span className="metric-label-compact">Dibayar</span>
            </span>
            <span className="metric-icon bg-green-light text-green-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="8.5" />
                <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
              </svg>
            </span>
          </div>
          <strong className="metric-value">{paidCount}</strong>
          <div className="metric-footer">
            <span className="metric-dot bg-green-500"></span>
            <span>siap cetak tiket penerbangan</span>
          </div>
        </div>
      </section>

      <section
        className="dashboard-telemetry-grid"
        aria-label="Radar dua rute dan distribusi manifes"
      >
        <div className="telemetry-card">
          <div className="telemetry-card-head">
            <div>
              <span className="section-kicker">DUAL-SECTOR RADAR</span>
              <h3>Komparasi Rute — {dateLabel(selectedDate)}</h3>
            </div>
            <span className="telemetry-pill">2 SEKTOR</span>
          </div>
          <div className="dual-sector-list">
            {dualSectorStats.map((sector) => {
              const isCurrent = sector.value === selectedRoute;
              return (
                <button
                  key={sector.value}
                  type="button"
                  className={`dual-sector-row ${isCurrent ? "active" : ""}`}
                  onClick={() => onSelectRoute(sector.value)}
                  aria-pressed={isCurrent}
                >
                  <div className="dual-sector-top">
                    <div className="dual-sector-route">
                      <strong>{sector.value}</strong>
                      <span>
                        {sector.origin} → {sector.destination}
                      </span>
                    </div>
                    <div className="dual-sector-badges">
                      <span className="sector-seat-badge">
                        {sector.seatsUsed}/{BOOKING_LIMIT} Kursi
                      </span>
                      {sector.waiting > 0 && (
                        <span className="sector-warn-badge">
                          {sector.waiting} menunggu
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="dual-sector-bar" aria-hidden="true">
                    <div
                      className="dual-sector-bar-fill"
                      style={{ width: `${sector.pct}%` }}
                    />
                  </div>
                  <div className="dual-sector-meta">
                    <span>Sisa {sector.seatsLeft} kursi</span>
                    <span>•</span>
                    <span>{sector.paid} Lunas</span>
                    <span>•</span>
                    <span>{sector.infants} Infant</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="telemetry-card n8n-telemetry-card">
          <div className="telemetry-card-head">
            <div>
              <span className="section-kicker">
                WA OTOMATIS • WHATSAPP AI AGENT
              </span>
              <h3>Ringkasan Pemesanan via WA Otomatis</h3>
            </div>
            <span className="telemetry-pill n8n-live-pill">
              <i className="n8n-pulse-dot" aria-hidden="true" />
              {n8nTelemetry.totalN8nCount} PAX WA Otomatis
            </span>
          </div>

          <div className="pax-demographic-chips">
            <div className="pax-demo-chip">
              <span>JADWAL INI ({routeInfo.value})</span>
              <strong>{n8nTelemetry.currentN8nCount} PAX</strong>
            </div>
            <div className="pax-demo-chip">
              <span>MNA-MDC (BULAN INI)</span>
              <strong>{n8nTelemetry.monthMdcCount} PAX</strong>
            </div>
            <div className="pax-demo-chip">
              <span>MNA-IAX (BULAN INI)</span>
              <strong>{n8nTelemetry.monthIaxCount} PAX</strong>
            </div>
          </div>

          <div className="n8n-recent-block">
            <div className="n8n-list-toolbar">
              <strong>Daftar Penumpang WA Otomatis</strong>
              <div className="n8n-scope-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={n8nScope === "all"}
                  className={`n8n-scope-btn ${n8nScope === "all" ? "active" : ""}`}
                  onClick={() => setN8nScope("all")}
                >
                  Semua ({n8nTelemetry.allN8nBookings.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={n8nScope === "current"}
                  className={`n8n-scope-btn ${n8nScope === "current" ? "active" : ""}`}
                  onClick={() => setN8nScope("current")}
                >
                  Jadwal Ini ({n8nTelemetry.currentN8nBookings.length})
                </button>
              </div>
            </div>

            {displayedN8nBookings.length === 0 ? (
              <div className="n8n-recent-empty">
                {n8nScope === "current"
                  ? `Belum ada penumpang WA Otomatis untuk rute ${routeInfo.value} tanggal ${dateLabel(selectedDate)}.`
                  : "Belum ada data penumpang yang memesan melalui WA Otomatis."}
              </div>
            ) : (
              <div className="n8n-booking-table-wrap">
                <div className="n8n-booking-thead" aria-hidden="true">
                  <span>NAMA PENUMPANG</span>
                  <span>RUTE</span>
                  <span>TANGGAL TERBANG</span>
                </div>
                <div className="n8n-recent-list">
                  {displayedN8nBookings.map((item) => {
                    const isActiveSchedule =
                      item.route === selectedRoute &&
                      item.date === selectedDate;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`n8n-booking-row ${isActiveSchedule ? "is-current" : ""}`}
                        onClick={() => onSelectSchedule(item.route, item.date)}
                        title={`Klik untuk membuka jadwal ${item.route} • ${dateLabel(item.date)}`}
                      >
                        <div className="n8n-col-passenger">
                          <span className="n8n-recent-seat">
                            #{String(item.bookingNo).padStart(2, "0")}
                          </span>
                          <div className="n8n-passenger-text">
                            <strong>
                              {item.name}
                              {item.type === "child" && (
                                <em className="n8n-pax-tag child">ANAK</em>
                              )}
                              {item.type === "infant" && (
                                <em className="n8n-pax-tag infant">INF</em>
                              )}
                            </strong>
                            <small>WA: {item.phone}</small>
                          </div>
                        </div>

                        <div className="n8n-col-route">
                          <span className="notif-route-tag">{item.route}</span>
                        </div>

                        <div className="n8n-col-date">
                          <strong>
                            {weekdayName(item.date)}, {dateLabel(item.date)}
                          </strong>
                          <span
                            className={`n8n-status-chip ${
                              item.status === STATUSES[2]
                                ? "paid"
                                : item.status === STATUSES[1]
                                  ? "booked"
                                  : "waiting"
                            }`}
                          >
                            {item.status === "Menunggu verifikasi"
                              ? "Menunggu"
                              : item.status === "Booked"
                                ? "Dipesan"
                                : item.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export function OverviewDatesAndLiveManifest({
  routeInfo,
  selectedDate,
  dashboardBookingEntries,
  currentBookings,
  onSelectDate,
  onOpenBookingsPage,
  onUpdateStatus,
}) {
  return (
    <div className="overview-bottom-split">
      <section
        className="overview-dates-panel"
        aria-label="Tanggal dengan pemesanan"
      >
        <div className="overview-dates-header">
          <div>
            <span className="section-kicker">JADWAL TERISI BULAN INI</span>
            <h2 className="overview-dates-title">Kartu Keberangkatan Aktif</h2>
          </div>
          <span className="overview-dates-count">
            {dashboardBookingEntries.length} jadwal tercatat
          </span>
        </div>
        <div className="date-grid">
          {dashboardBookingEntries.map(([date, count]) => {
            const pct = Math.min(
              Math.round((count / BOOKING_LIMIT) * 100),
              100,
            );
            return (
              <button
                type="button"
                className={`date-card ${date === selectedDate ? "date-card-selected" : ""}`}
                key={date}
                onClick={() => onSelectDate(date)}
                aria-pressed={date === selectedDate}
                aria-label={`${dateLabel(date)}, ${count} pemesanan. Pilih tanggal`}
              >
                <div className="flex justify-between items-start gap-4">
                  <span className="date-card-label">
                    {weekdayName(date).toUpperCase()}
                  </span>
                  <span className="date-card-badge">
                    {count}/{BOOKING_LIMIT} SEAT
                  </span>
                </div>
                <strong className="date-card-value">{dateLabel(date)}</strong>
                <div className="date-card-progress" aria-hidden="true">
                  <div
                    className="date-card-progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="date-card-footer">
                  <span className="date-card-dot" aria-hidden="true"></span>
                  <span>{BOOKING_LIMIT - count} kursi tersisa</span>
                  <span className="date-card-arrow">
                    Pilih <span aria-hidden="true">→</span>
                  </span>
                </div>
              </button>
            );
          })}
          {dashboardBookingEntries.length === 0 && (
            <div className="date-empty">
              <span className="date-empty-dot" aria-hidden="true"></span>
              Belum ada tanggal dengan pemesanan untuk rute {
                routeInfo.value
              }{" "}
              pada bulan ini.
            </div>
          )}
        </div>
      </section>

      <section
        className="overview-live-manifest"
        aria-label="Preview manifes dan verifikasi cepat"
      >
        <div className="overview-dates-header">
          <div>
            <span className="section-kicker">
              LIVE MANIFEST • {routeInfo.value} •{" "}
              {dateLabel(selectedDate).toUpperCase()}
            </span>
            <h2 className="overview-dates-title">Preview & Verifikasi Cepat</h2>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={onOpenBookingsPage}
          >
            Lihat Semua ({currentBookings.length}) →
          </button>
        </div>

        {currentBookings.length === 0 ? (
          <div className="date-empty">
            <span className="date-empty-dot" aria-hidden="true"></span>
            Belum ada penumpang untuk jadwal {dateLabel(selectedDate)}.
          </div>
        ) : (
          <div className="quick-manifest-list">
            {[...currentBookings]
              .sort((a, b) => Number(a.bookingNo) - Number(b.bookingNo))
              .map((booking) => (
                <div className="quick-manifest-item" key={booking.id}>
                  <span className="booking-number-pill">
                    #{String(booking.bookingNo).padStart(2, "0")}
                  </span>
                  <div className="quick-manifest-info">
                    <strong>
                      {booking.name}
                      {booking.type === "child" && (
                        <span className="passenger-badge passenger-badge-child">
                          ANAK
                        </span>
                      )}
                      {booking.type === "infant" && (
                        <span className="passenger-badge passenger-badge-infant">
                          INF
                        </span>
                      )}
                      <span
                        className={`booking-source-badge ${
                          isN8nBooking(booking) ? "source-n8n" : "source-web"
                        }`}
                      >
                        {isN8nBooking(booking) ? "WA OTOMATIS" : "MANUAL WEB"}
                      </span>
                    </strong>
                    <span>{booking.phone}</span>
                  </div>
                  <div className="quick-manifest-actions">
                    <label
                      className={`status-label ${booking.status === STATUSES[0] ? "status-waiting" : booking.status === STATUSES[1] ? "status-verified" : "status-issued"} cursor-pointer`}
                    >
                      <span className="status-dot"></span>
                      <select
                        aria-label={`Ubah cepat status ${booking.name}`}
                        value={booking.status}
                        onChange={(event) =>
                          onUpdateStatus(booking.id, event.target.value)
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status === "Booked"
                              ? "Dipesan"
                              : status === "Menunggu verifikasi"
                                ? "Menunggu"
                                : status}
                          </option>
                        ))}
                      </select>
                      <span className="select-chevron text-xs text-muted pointer-events-none">
                        ⌄
                      </span>
                    </label>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
