import { RefreshCw } from "lucide-react";
import {
  STATUSES,
  dateLabel,
  isN8nBooking,
  timeLabel,
} from "../utils/bookingUtils";

function PassengerManifestSection({
  routeInfo,
  selectedDate,
  currentBookings,
  filteredBookings,
  occupiedSeats,
  remainingSeats,
  filter,
  search,
  searchInputRef,
  isLoadingBookings,
  isRefreshingBookings,
  onOpenBookingForm,
  onRefreshBookings,
  onFilterChange,
  onSearchChange,
  onUpdateStatus,
  onOpenEditForm,
  onRequestDelete,
}) {
  const n8nCount = currentBookings.filter(isN8nBooking).length;
  const webCount = currentBookings.length - n8nCount;

  return (
    <section className="bookings-section">
      <div className="manifest-heading-row">
        <section className="section-header">
          <div className="section-eyebrow">
            PASSENGER MANIFEST • {routeInfo.value} •{" "}
            {dateLabel(selectedDate).toUpperCase()}
          </div>
          <h2 className="section-title">
            Daftar Penumpang{" "}
            <span className="table-total text-sm font-semibold text-teal-dark">
              {currentBookings.length}
            </span>
          </h2>
        </section>
        <div className="manifest-heading-actions">
          <button
            type="button"
            className="btn btn-primary manifest-add-button"
            onClick={onOpenBookingForm}
          >
            <span aria-hidden="true">+</span> Tambah PAX
          </button>
          <button
            type="button"
            className="secondary-button refresh-button"
            onClick={onRefreshBookings}
            disabled={isLoadingBookings || isRefreshingBookings}
            aria-label="Refresh daftar penumpang"
            title="Refresh daftar penumpang"
          >
            <RefreshCw
              className={isRefreshingBookings ? "spinning" : ""}
              aria-hidden="true"
              strokeWidth={1.9}
            />
            {isRefreshingBookings ? "Memuat..." : "Sinkronisasi"}
          </button>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="flex gap-2 flex-wrap">
          {["Semua", ...STATUSES].map((status) => {
            const statusCount =
              status === "Semua"
                ? currentBookings.length
                : currentBookings.filter((b) => b.status === status).length;
            return (
              <button
                type="button"
                key={status}
                className={`filter-btn ${filter === status ? "active" : ""}`}
                onClick={() => onFilterChange(status)}
              >
                {status === "Menunggu verifikasi"
                  ? "Menunggu"
                  : status === "Booked"
                    ? "Dipesan"
                    : status}
                <span>{statusCount}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`filter-btn ${filter === "SOURCE_N8N" ? "active" : ""}`}
            onClick={() => onFilterChange("SOURCE_N8N")}
            title="Filter penumpang yang memesan lewat WA Otomatis"
          >
            WA Otomatis
            <span>{n8nCount}</span>
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === "SOURCE_WEB" ? "active" : ""}`}
            onClick={() => onFilterChange("SOURCE_WEB")}
            title="Filter penumpang yang diinput manual lewat Web Dashboard"
          >
            Manual Web
            <span>{webCount}</span>
          </button>
        </div>
        <label className="search-box">
          <span className="search-icon">⌕</span>
          <input
            ref={searchInputRef}
            aria-label="Cari penumpang"
            placeholder="Cari nama, WA, atau no. kursi..."
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
      </div>

      <div className="table-wrap">
        <table className="table w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>SEAT / NO</th>
              <th>IDENTITAS PENUMPANG</th>
              <th>SUMBER PESANAN</th>
              <th>KONTAK WHATSAPP</th>
              <th>STATUS TIKET</th>
              <th>WAKTU RESERVASI</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((booking) => {
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
                      #{String(booking.bookingNo).padStart(2, "0")}
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
                        <span className="text-xs text-muted">
                          Sektor {booking.route} • {dateLabel(booking.date)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Sumber Pesanan">
                    <span
                      className={`booking-source-pill ${isFromN8n ? "source-n8n" : "source-web"}`}
                    >
                      <i className="source-dot" aria-hidden="true" />
                      {isFromN8n ? "WA Otomatis" : "Manual Web"}
                    </span>
                  </td>
                  <td data-label="Kontak">
                    <a
                      href={`https://wa.me/${String(booking.phone || "")
                        .replace(/\D/g, "")
                        .replace(/^0/, "62")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="contact-link"
                      title={`Hubungi ${booking.name} via WhatsApp`}
                    >
                      <span className="wa-dot" aria-hidden="true" />
                      <span>{booking.phone}</span>
                    </a>
                  </td>
                  <td data-label="Status pemesanan">
                    <label
                      className={`status-label ${booking.status === STATUSES[0] ? "status-waiting" : booking.status === STATUSES[1] ? "status-verified" : "status-issued"} cursor-pointer`}
                    >
                      <span className="status-dot"></span>
                      <select
                        aria-label={`Status ${booking.name}`}
                        value={booking.status}
                        onChange={(event) =>
                          onUpdateStatus(booking.id, event.target.value)
                        }
                        className="bg-transparent border-none text-inherit font-inherit text-xs cursor-pointer appearance-none p-0 m-0 w-full"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status === "Booked" ? "Dipesan" : status}
                          </option>
                        ))}
                      </select>
                      <span className="select-chevron text-xs text-muted pointer-events-none">
                        ⌄
                      </span>
                    </label>
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
            {filteredBookings.length === 0 && (
              <tr className="empty-row">
                <td className="empty-state" colSpan="7">
                  <div className="empty-state-content">
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
                    <strong className="text-base text-ink block">
                      {isLoadingBookings
                        ? "Memuat manifes dari MySQL..."
                        : "Manifes masih kosong atau tidak cocok"}
                    </strong>
                    <span className="text-sm">
                      {isLoadingBookings
                        ? "Sedang mengambil data penumpang terbaru."
                        : "Tambahkan reservasi baru atau ubah filter pencarian di atas."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="manifest-footer">
        <span>
          Menampilkan{" "}
          <strong className="text-ink">{filteredBookings.length}</strong> dari{" "}
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
