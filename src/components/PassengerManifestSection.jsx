import { useMemo, useState } from "react";
import {
  STATUSES,
  dateLabel,
  formatBookingSeat,
  isN8nBooking,
  timeLabel,
  weekdayName,
} from "../utils/bookingUtils";

const PAID_STATUS = STATUSES[2] || "Dibayar";
const BOOKED_STATUS = STATUSES[1] || "Booked";

const formatWaHref = (booking) => {
  const digits = String(booking.phone || "")
    .replace(/\D/g, "")
    .replace(/^0/, "62");
  if (!digits) return "";
  const greeting = `Halo ${booking.name}, ini Ticketing Susi Air Melonguane (MNA) terkait penerbangan ${booking.route} tanggal ${dateLabel(booking.date)}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
};

function PassengerManifestSection({
  routeInfo,
  selectedDate,
  currentBookings,
  filteredBookings,
  occupiedSeats,
  remainingSeats,
  search,
  searchInputRef,
  isLoadingBookings,
  scheduleControls,
  onSearchChange,
  onOpenBookingForm,
  onUpdateStatus,
  onOpenEditForm,
  onRequestDelete,
}) {
  const [quickFilter, setQuickFilter] = useState("all");

  const unpaidCount = useMemo(
    () => currentBookings.filter((b) => b.status !== PAID_STATUS).length,
    [currentBookings],
  );
  const n8nCount = useMemo(
    () => currentBookings.filter((b) => isN8nBooking(b)).length,
    [currentBookings],
  );

  const displayedBookings = useMemo(() => {
    if (quickFilter === "unpaid") {
      return filteredBookings.filter((b) => b.status !== PAID_STATUS);
    }
    if (quickFilter === "n8n") {
      return filteredBookings.filter((b) => isN8nBooking(b));
    }
    return filteredBookings;
  }, [filteredBookings, quickFilter]);
  return (
    <section id="manifest-section" className="bookings-section unified-manifest-card">
      <div className="unified-manifest-header">
        <div>
          <span className="section-kicker">
            MANIFES AKTIF • {routeInfo.value} •{" "}
            {weekdayName(selectedDate).toUpperCase()},{" "}
            {dateLabel(selectedDate).toUpperCase()}
          </span>
          <h2 className="section-title">
            Daftar Penumpang{" "}
            <span className="table-total text-sm font-semibold text-teal-dark">
              {currentBookings.length}
            </span>
          </h2>
        </div>

        <div className="manifest-search-cta">
          <label className="search-box">
            <span className="search-icon">⌕</span>
            <input
              ref={searchInputRef}
              aria-label="Cari penumpang"
              placeholder="Cari nama, WA, atau kursi..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="search-input"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  onSearchChange("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Bersihkan pencarian"
                title="Bersihkan pencarian"
              >
                ×
              </button>
            )}
            <span className="search-shortcut">⌘ K</span>
          </label>

          <button
            type="button"
            className="btn btn-primary manifest-add-btn"
            onClick={onOpenBookingForm}
          >
            <span aria-hidden="true">+</span> Tambah PAX
          </button>
        </div>
      </div>

      {scheduleControls}

      {currentBookings.length > 0 && (
        <div
          className="manifest-quick-filters"
          role="group"
          aria-label="Filter cepat daftar penumpang"
        >
          <button
            type="button"
            className={`manifest-filter-pill ${quickFilter === "all" ? "active" : ""}`}
            onClick={() => setQuickFilter("all")}
          >
            Semua
            <span className="manifest-filter-count">
              {currentBookings.length}
            </span>
          </button>
          <button
            type="button"
            className={`manifest-filter-pill manifest-filter-unpaid ${quickFilter === "unpaid" ? "active" : ""}`}
            onClick={() =>
              setQuickFilter((prev) => (prev === "unpaid" ? "all" : "unpaid"))
            }
          >
            Belum Bayar
            <span className="manifest-filter-count">{unpaidCount}</span>
          </button>
          <button
            type="button"
            className={`manifest-filter-pill manifest-filter-n8n ${quickFilter === "n8n" ? "active" : ""}`}
            onClick={() =>
              setQuickFilter((prev) => (prev === "n8n" ? "all" : "n8n"))
            }
          >
            WA Otomatis
            <span className="manifest-filter-count">{n8nCount}</span>
          </button>
        </div>
      )}

      {displayedBookings.length === 0 ? (
        <div className="manifest-empty-box" role="status">
          <span className="empty-state-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" />
              <path d="M8 9h8M8 12.5h8M8 16h5" />
            </svg>
          </span>
          <strong className="manifest-empty-title">
            {isLoadingBookings
              ? "Memuat manifes dari MySQL..."
              : search || quickFilter !== "all"
                ? "Penumpang tidak ditemukan"
                : "Belum ada penumpang pada jadwal ini"}
          </strong>
          <span className="manifest-empty-desc">
            {isLoadingBookings
              ? "Sedang mengambil data penumpang terbaru."
              : quickFilter === "unpaid"
                ? "Semua penumpang pada jadwal ini sudah berstatus Dibayar."
                : quickFilter === "n8n"
                  ? "Belum ada pesanan dari WA Otomatis pada jadwal ini."
                  : search
                    ? "Coba periksa kembali nama, nomor WhatsApp, atau nomor kursi."
                    : "Klik tombol + Tambah PAX di atas untuk mulai mengisi manifes."}
          </span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>SEAT / NO</th>
                <th>IDENTITAS PENUMPANG</th>
                <th>KONTAK WHATSAPP</th>
                <th>STATUS TIKET</th>
                <th>WAKTU RESERVASI</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {displayedBookings.map((booking) => {
              const initial =
                String(booking.name || "P")
                  .trim()
                  .charAt(0)
                  .toUpperCase() || "P";
              const isFromN8n = isN8nBooking(booking);
              return (
                <tr key={booking.id}>
                  <td data-label="No. Kursi">
                    <span className="booking-number-pill">
                      {formatBookingSeat(booking)}
                    </span>
                  </td>
                  <td data-label="Penumpang">
                    <div className="passenger-cell">
                      <span className="passenger-avatar" aria-hidden="true">
                        {initial}
                      </span>
                      <div className="passenger-info">
                        <strong className="text-base font-semibold text-ink">
                          {booking.name}
                          {booking.type === "child" && (
                            <span className="passenger-badge passenger-badge-child">
                              ANAK
                            </span>
                          )}
                          {booking.type === "infant" && (
                            <span className="passenger-badge passenger-badge-infant">
                              INFANT
                            </span>
                          )}
                          {(!booking.type || booking.type === "adult") && (
                            <span className="passenger-badge passenger-badge-adult">
                              DEWASA
                            </span>
                          )}
                        </strong>
                        <span
                          className={`booking-source-pill passenger-source-sub ${isFromN8n ? "source-n8n" : "source-web"}`}
                        >
                          <i className="source-dot" aria-hidden="true" />
                          {isFromN8n ? "WA Otomatis" : "Manual Web"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Kontak">
                    {formatWaHref(booking) ? (
                      <a
                        href={formatWaHref(booking)}
                        target="_blank"
                        rel="noreferrer"
                        className="contact-link contact-link--wa"
                        title={`Chat WhatsApp ${booking.name}`}
                      >
                        <span className="wa-dot" aria-hidden="true" />
                        <span>{booking.phone}</span>
                        <span className="wa-chat-badge">WA</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td data-label="Status pemesanan">
                    <div
                      className="pay-segment"
                      role="group"
                      aria-label={`Status tiket ${booking.name}`}
                    >
                      <button
                        type="button"
                        className={`pay-segment-btn pay-segment-booked ${booking.status !== PAID_STATUS ? "active" : ""}`}
                        aria-pressed={booking.status !== PAID_STATUS}
                        onClick={() => {
                          if (booking.status === PAID_STATUS) {
                            onUpdateStatus(booking.id, BOOKED_STATUS);
                          }
                        }}
                      >
                        Booked
                      </button>
                      <button
                        type="button"
                        className={`pay-segment-btn pay-segment-paid ${booking.status === PAID_STATUS ? "active" : ""}`}
                        aria-pressed={booking.status === PAID_STATUS}
                        onClick={() => {
                          if (booking.status !== PAID_STATUS) {
                            onUpdateStatus(booking.id, PAID_STATUS);
                          }
                        }}
                      >
                        {booking.status === PAID_STATUS ? "✓ Paid" : "Paid"}
                      </button>
                    </div>
                  </td>
                  <td data-label="Tanggal pemesanan">
                    <span className="text-base font-semibold text-ink block">
                      {dateLabel(booking.bookingDate || booking.createdAt)}
                    </span>
                    <small className="text-xs text-muted">
                      Pukul {timeLabel(booking.bookingAt)}
                    </small>
                  </td>
                  <td className="text-right">
                    <div className="booking-actions">
                      <button
                        type="button"
                        title={`Edit data ${booking.name}`}
                        aria-label={`Edit data ${booking.name}`}
                        onClick={() => onOpenEditForm(booking)}
                        className="btn-icon btn-icon-edit"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m15 5 4 4" />
                          <path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16v4Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title={`Hapus data ${booking.name}`}
                        aria-label={`Hapus data ${booking.name}`}
                        onClick={() => onRequestDelete(booking)}
                        className="btn-icon btn-icon-delete"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="m19 6-1 14H6L5 6" />
                          <path d="M10 11v5M14 11v5" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}
      <footer className="manifest-footer">
        <span>
          Menampilkan{" "}
          <strong className="text-ink">{displayedBookings.length}</strong> dari{" "}
          <strong className="text-ink">{currentBookings.length}</strong>{" "}
          penumpang terdaftar
        </span>
        <div className="capacity-legend">
          <span className="flex items-center gap-2 text-xs">
            <span
              className="legend-dot"
              style={{
                backgroundColor: "var(--sf-surface-hover)",
                border: "1px solid var(--sf-line)",
              }}
            ></span>
            Kursi kosong ({remainingSeats})
          </span>
          <span className="flex items-center gap-2 text-xs">
            <span
              className="legend-dot"
              style={{ backgroundColor: "var(--sf-teal)" }}
            ></span>
            Kursi terisi ({occupiedSeats})
          </span>
        </div>
      </footer>
    </section>
  );
}

export default PassengerManifestSection;
