import { useState } from "react";
import {
  STATUSES,
  dateLabel,
  isN8nBooking,
  weekdayName,
} from "../utils/bookingUtils";

export function WaOtomatisSummaryCard({
  routeInfo,
  selectedRoute,
  selectedDate,
  n8nTelemetry,
  onSelectSchedule,
}) {
  const [n8nScope, setN8nScope] = useState("all");
  const [isExpanded, setIsExpanded] = useState(true);
  const displayedN8nBookings = (
    n8nScope === "current"
      ? n8nTelemetry.currentN8nBookings
      : n8nTelemetry.allN8nBookings
  ).filter(isN8nBooking);

  return (
    <section
      className="telemetry-card n8n-telemetry-card wa-summary-standalone"
      aria-label="Ringkasan pemesanan via WA Otomatis"
    >
      <div className="telemetry-card-head">
        <div>
          <span className="section-kicker">WA OTOMATIS • LINTAS JADWAL</span>
          <h3>Ringkasan Pemesanan via WA Otomatis</h3>
        </div>
        <div className="wa-card-head-actions">
          <span className="telemetry-pill n8n-live-pill">
            <i className="n8n-pulse-dot" aria-hidden="true" />
            {n8nTelemetry.totalN8nCount} PAX WA Otomatis
          </span>
          <button
            type="button"
            className="calendar-quick-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Ringkaskan ▴" : "Tampilkan Daftar ▾"}
          </button>
        </div>
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

      {isExpanded && (
        <div className="n8n-recent-block">
          <div className="n8n-list-toolbar">
            <strong>
              Klik baris penumpang untuk langsung pindah ke jadwalnya
            </strong>
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
                    item.route === selectedRoute && item.date === selectedDate;
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
      )}
    </section>
  );
}
