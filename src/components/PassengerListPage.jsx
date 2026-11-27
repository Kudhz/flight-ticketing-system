import { useMemo, useState } from "react";
import {
  STATUSES,
  dateLabel,
  formatBookingSeat,
  isBookingCheckedIn,
  weekdayName,
} from "../utils/bookingUtils";

function normalizeWaNumber(phone) {
  return String(phone || "")
    .replace(/\D/g, "")
    .replace(/^0/, "62");
}

function PassengerListPage({
  mode = "list",
  routeInfo,
  selectedDate,
  currentBookings,
  checkedInOverrides = {},
  isLoadingBookings,
  scheduleControls,
  onCopyWhatsAppManifest,
  onOpenBookingForm,
  onOpenEditForm,
  onRequestDelete,
  onShowMessage,
  onToggleCheckIn,
}) {
  const isCheckInMode = mode === "checkin";
  const [checkInSearch, setCheckInSearch] = useState("");
  const [onlyUnchecked, setOnlyUnchecked] = useState(false);

  const sortedBookings = useMemo(
    () =>
      [...currentBookings].sort(
        (a, b) =>
          Number(a.bookingNo) - Number(b.bookingNo) ||
          Number(a.id) - Number(b.id),
      ),
    [currentBookings],
  );

  const checkedInCount = sortedBookings.filter((b) =>
    isBookingCheckedIn(b, checkedInOverrides),
  ).length;
  const uncheckedCount = Math.max(sortedBookings.length - checkedInCount, 0);
  const checkInPct =
    sortedBookings.length > 0
      ? Math.round((checkedInCount / sortedBookings.length) * 100)
      : 0;
  const allCheckedIn =
    sortedBookings.length > 0 && checkedInCount === sortedBookings.length;

  const searchedCheckInBookings = useMemo(() => {
    const q = checkInSearch.trim().toLowerCase();
    if (!q) return sortedBookings;
    return sortedBookings.filter((b) =>
      `${b.name} ${b.phone} ${b.bookingNo}`.toLowerCase().includes(q),
    );
  }, [checkInSearch, sortedBookings]);

  const pendingList = useMemo(
    () =>
      searchedCheckInBookings.filter(
        (b) => !isBookingCheckedIn(b, checkedInOverrides),
      ),
    [checkedInOverrides, searchedCheckInBookings],
  );

  const checkedList = useMemo(
    () =>
      onlyUnchecked
        ? []
        : searchedCheckInBookings.filter((b) =>
            isBookingCheckedIn(b, checkedInOverrides),
          ),
    [checkedInOverrides, onlyUnchecked, searchedCheckInBookings],
  );

  async function copyCheckInRecap() {
    const allPending = sortedBookings.filter(
      (b) => !isBookingCheckedIn(b, checkedInOverrides),
    );
    const allChecked = sortedBookings.filter((b) =>
      isBookingCheckedIn(b, checkedInOverrides),
    );

    const lines = [
      `*REKAP CHECK-IN SUSI AIR*`,
      `Rute: *${routeInfo.label}*`,
      `Tanggal: *${weekdayName(selectedDate)}, ${dateLabel(selectedDate)}*`,
      `Kehadiran: *${allChecked.length}/${sortedBookings.length} PAX Hadir*${
        allPending.length === 0
          ? " (✓ Lengkap - Siap Boarding)"
          : ` (${allPending.length} Belum Check-in)`
      }`,
      `--------------------------------`,
    ];

    if (sortedBookings.length === 0) {
      lines.push(`_Belum ada penumpang terdaftar._`);
    } else {
      if (allPending.length > 0) {
        lines.push(`*BELUM CHECK-IN (${allPending.length}):*`);
        allPending.forEach((b) => {
          const unpaidNote =
            b.status !== STATUSES[2] ? " [⚠ Belum Lunas]" : "";
          lines.push(
            `⏳ ${String(b.bookingNo).padStart(2, "0")}. *${b.name}* — ${b.phone}${unpaidNote}`,
          );
        });
        if (allChecked.length > 0) lines.push("");
      }

      if (allChecked.length > 0) {
        lines.push(`*SUDAH CHECK-IN (${allChecked.length}):*`);
        allChecked.forEach((b) => {
          const unpaidNote =
            b.status !== STATUSES[2] ? " [⚠ Belum Lunas]" : "";
          lines.push(
            `✅ ${String(b.bookingNo).padStart(2, "0")}. *${b.name}*${unpaidNote}`,
          );
        });
      }
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      onShowMessage?.("Rekap check-in WhatsApp berhasil disalin!");
    } catch {
      onShowMessage?.("Gagal menyalin rekap ke clipboard browser.");
    }
  }

  function renderPassengerRow(booking) {
    const isChecked = isBookingCheckedIn(booking, checkedInOverrides);
    const isUnpaid = booking.status !== STATUSES[2];
    const statusClass =
      booking.status === STATUSES[2]
        ? "paid"
        : booking.status === STATUSES[1]
          ? "booked"
          : "waiting";
    const statusShort =
      booking.status === "Menunggu verifikasi"
        ? "Menunggu"
        : booking.status === "Booked"
          ? "Dipesan"
          : booking.status;

    const waPhone = normalizeWaNumber(booking.phone);
    const reminderMessage = `Halo Bapak/Ibu ${booking.name}, menginfokan loket check-in penerbangan Susi Air rute ${routeInfo.label} (${weekdayName(selectedDate)}, ${dateLabel(selectedDate)}) sudah dibuka di bandara. Mohon konfirmasi kehadirannya. Terima kasih.`;
    const waHref =
      isCheckInMode && !isChecked
        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(reminderMessage)}`
        : `https://wa.me/${waPhone}`;

    return (
      <div
        key={booking.id}
        role="listitem"
        onClick={
          isCheckInMode ? () => onToggleCheckIn?.(booking) : undefined
        }
        className={`pax-checklist-row ${
          isCheckInMode ? "mode-checkin" : "mode-list"
        } ${isCheckInMode && isChecked ? "is-checked" : ""}`}
      >
        {isCheckInMode && (
          <button
            type="button"
            role="checkbox"
            aria-checked={isChecked}
            aria-label={`Check-in ${booking.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCheckIn?.(booking);
            }}
            className={`checkin-box-btn ${isChecked ? "checked" : ""}`}
            title={
              isChecked
                ? "Klik untuk batalkan check-in"
                : "Klik untuk tandai sudah check-in"
            }
          >
            {isChecked && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12.5 4.5 4.5 9.5-10" />
              </svg>
            )}
          </button>
        )}

        <span className="booking-number-pill pax-desktop-only">
          {formatBookingSeat(booking)}
        </span>

        <div className="pax-checklist-identity">
          <strong className="pax-checklist-name">
            <span className="pax-name-truncate">{booking.name}</span>
            {booking.type === "infant" && (
              <span className="pax-inf-tag">(INF)</span>
            )}
            {isCheckInMode && isUnpaid && (
              <span
                className="unpaid-checkin-warn"
                title={`Tiket belum lunas (${statusShort})`}
                aria-label={`Tiket belum lunas: ${statusShort}`}
              >
                ⚠
              </span>
            )}
          </strong>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className={`pax-checklist-phone ${
              isCheckInMode && !isChecked ? "is-reminder-link" : ""
            }`}
            title={
              isCheckInMode && !isChecked
                ? `Kirim pengingat check-in via WhatsApp ke ${booking.name}`
                : `Hubungi ${booking.name} via WhatsApp`
            }
          >
            <span className="wa-dot" aria-hidden="true" />
            <span>{booking.phone}</span>
          </a>
        </div>

        <div
          className={`pax-checklist-right ${isCheckInMode ? "pax-desktop-only" : ""}`}
        >
          <span className={`pax-ticket-chip ${statusClass} pax-desktop-only`}>
            {statusShort}
          </span>
          {isCheckInMode ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCheckIn?.(booking);
              }}
              className={`checkin-pill-btn ${isChecked ? "checked" : ""}`}
            >
              {isChecked ? "✓ Sudah Check-in" : "Check-in"}
            </button>
          ) : (
            <div className="booking-actions pax-list-row-actions">
              <button
                type="button"
                title={`Edit data ${booking.name}`}
                aria-label={`Edit data ${booking.name}`}
                onClick={() => onOpenEditForm?.(booking)}
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
                onClick={() => onRequestDelete?.(booking)}
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
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      className="bookings-section unified-manifest-card passenger-list-only-card"
      aria-label={
        isCheckInMode
          ? "Halaman check-in penumpang"
          : "Halaman list penumpang"
      }
    >
      <div className="unified-manifest-header">
        <div>
          <span className="section-kicker">
            {routeInfo.value} • {weekdayName(selectedDate).toUpperCase()},{" "}
            {dateLabel(selectedDate).toUpperCase()}
          </span>
          <h1 className="section-title">
            {isCheckInMode ? "Check-in Penumpang" : "List Penumpang"}{" "}
            <span className="table-total text-sm font-semibold text-teal-dark">
              {sortedBookings.length}
            </span>
          </h1>
        </div>

        {isCheckInMode ? (
          <div className="checkin-head-actions">
            <div
              className={`checkin-summary-pill ${allCheckedIn ? "all-done" : ""}`}
              aria-live="polite"
            >
              <span className="checkin-summary-dot" aria-hidden="true" />
              <span>
                {allCheckedIn ? (
                  <strong>✓ Lengkap • Siap Boarding</strong>
                ) : (
                  <>
                    Sudah Check-in:{" "}
                    <strong>
                      {checkedInCount} / {sortedBookings.length}
                    </strong>
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline pax-list-wa-btn"
              onClick={copyCheckInRecap}
              title="Salin rekap kehadiran check-in ke WhatsApp"
            >
              <span aria-hidden="true">📋</span> Salin Rekap
            </button>
          </div>
        ) : (
          <div className="pax-list-head-actions">
            {onCopyWhatsAppManifest && (
              <button
                type="button"
                className="btn btn-outline pax-list-wa-btn"
                onClick={onCopyWhatsAppManifest}
                title="Salin daftar penumpang untuk dikirim ke WhatsApp"
              >
                <span aria-hidden="true">📋</span> Salin WA
              </button>
            )}
            {onOpenBookingForm && (
              <button
                type="button"
                className="btn btn-primary pax-list-add-btn"
                onClick={onOpenBookingForm}
              >
                <span aria-hidden="true">+</span> Tambah Penumpang
              </button>
            )}
          </div>
        )}
      </div>

      {scheduleControls}

      {isCheckInMode && sortedBookings.length > 0 && (
        <div className="checkin-ops-deck">
          <div
            className={`checkin-progress-panel ${allCheckedIn ? "is-complete" : ""}`}
          >
            <div className="checkin-progress-meta">
              <strong>
                {allCheckedIn
                  ? `✓ Seluruh Penumpang Lengkap — Siap Boarding (${checkedInCount}/${sortedBookings.length})`
                  : `${checkedInCount}/${sortedBookings.length} Hadir • Sisa ${uncheckedCount} belum datang`}
              </strong>
              <span>{checkInPct}%</span>
            </div>
            <div className="checkin-progress-track" aria-hidden="true">
              <div
                className="checkin-progress-fill"
                style={{ width: `${checkInPct}%` }}
              />
            </div>
          </div>

          <div className="checkin-toolbar">
            <label className="checkin-search-box">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                aria-label="Cari penumpang check-in"
                placeholder="Cari nama atau no. HP..."
                value={checkInSearch}
                onChange={(event) => setCheckInSearch(event.target.value)}
                className="checkin-search-input"
              />
              {checkInSearch && (
                <button
                  type="button"
                  className="checkin-search-clear"
                  onClick={() => setCheckInSearch("")}
                  aria-label="Bersihkan pencarian"
                >
                  ×
                </button>
              )}
            </label>

            <button
              type="button"
              aria-pressed={onlyUnchecked}
              onClick={() => setOnlyUnchecked((prev) => !prev)}
              className={`checkin-filter-toggle ${onlyUnchecked ? "active" : ""}`}
            >
              <span>Belum Hadir</span>
              <strong>{uncheckedCount}</strong>
            </button>
          </div>
        </div>
      )}

      {sortedBookings.length === 0 ? (
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
              ? "Memuat daftar penumpang..."
              : "Belum ada penumpang pada jadwal ini"}
          </strong>
          <span className="manifest-empty-desc">
            {isLoadingBookings
              ? "Sedang mengambil data penumpang dari MySQL."
              : "Pilih rute atau tanggal keberangkatan lain di atas."}
          </span>
        </div>
      ) : !isCheckInMode ? (
        <div className="pax-checklist-wrap" role="list">
          {sortedBookings.map(renderPassengerRow)}
        </div>
      ) : pendingList.length === 0 && checkedList.length === 0 ? (
        <div className="manifest-empty-box" role="status">
          <strong className="manifest-empty-title">
            {onlyUnchecked && allCheckedIn
              ? "Semua penumpang sudah check-in 🎉"
              : "Penumpang tidak ditemukan"}
          </strong>
          <span className="manifest-empty-desc">
            {onlyUnchecked && allCheckedIn
              ? "Tidak ada lagi penumpang yang belum hadir. Matikan filter Belum Hadir untuk melihat daftar lengkap."
              : "Coba periksa kata kunci pencarian nama atau nomor WhatsApp."}
          </span>
        </div>
      ) : (
        <div className="checkin-groups-stack">
          {pendingList.length > 0 && (
            <div className="checkin-group-block">
              <div className="checkin-group-label pending">
                <span>BELUM CHECK-IN ({pendingList.length})</span>
                <small>Tap No. HP untuk kirim WA pengingat</small>
              </div>
              <div className="pax-checklist-wrap" role="list">
                {pendingList.map(renderPassengerRow)}
              </div>
            </div>
          )}

          {checkedList.length > 0 && (
            <div className="checkin-group-block">
              <div className="checkin-group-label done">
                <span>SUDAH CHECK-IN ({checkedList.length})</span>
              </div>
              <div className="pax-checklist-wrap" role="list">
                {checkedList.map(renderPassengerRow)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default PassengerListPage;
