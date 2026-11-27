import { useState } from "react";
import {
  ROUTES,
  dateLabel,
  flightDatesInMonth,
  formatBookingSeat,
  isFlightDate,
} from "../utils/bookingUtils";

const PAX_TYPE_OPTIONS = [
  { value: "adult", label: "Dewasa" },
  { value: "child", label: "Anak" },
  { value: "infant", label: "Infant" },
];

function parseWhatsAppPassengerText(rawText, fallbackPhone = "") {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let lastPhone = String(fallbackPhone || "").trim();
  const parsed = [];

  for (const rawLine of lines) {
    // Strip leading numbering or bullet points (e.g. "1.", "2)", "-", "•")
    let line = rawLine.replace(/^\s*(?:\d+[.)\-:]|\*|-|•)\s*/, "").trim();
    if (!line) continue;

    // Extract phone number if present in the line
    const phoneMatch = line.match(/(?:\+?62|0)[\s-]*8[\d\s-]{7,14}/);
    let phone = "";
    if (phoneMatch) {
      phone = phoneMatch[0].replace(/[\s-]+/g, "");
      lastPhone = phone;
      line = line.replace(phoneMatch[0], " ").trim();
    }

    // Detect passenger type from tags/keywords
    let type = "adult";
    if (/\b(?:inf|infant|bayi)\b/i.test(line)) {
      type = "infant";
    } else if (/\b(?:chd|child|anak|anak-anak)\b/i.test(line)) {
      type = "child";
    }

    // Clean type keywords/brackets and stray separators
    const cleanName = line
      .replace(/[([]?\s*\b(?:inf|infant|bayi|chd|child|anak-anak|anak|adt|adult|dewasa)\b\s*[)\]]?/gi, " ")
      .replace(/^[\s\-–—:,/|]+|[\s\-–—:,/|]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleUpperCase("id-ID");

    if (!cleanName) continue;
    parsed.push({
      name: cleanName,
      phone: phone || lastPhone,
      type,
    });
  }

  // Backfill phone from first detected phone if earlier lines had none
  const firstDetectedPhone =
    parsed.find((item) => item.phone)?.phone || lastPhone;
  return parsed.map((item) => ({
    ...item,
    phone: item.phone || firstDetectedPhone,
  }));
}

export function NewReservationDialog({
  form,
  setForm,
  availableBookingNumbers,
  formBookingNumbers,
  isLoadingBookings,
  isSavingBooking,
  onClose,
  onSubmit,
  onShowMessage,
}) {
  const [showWaPaste, setShowWaPaste] = useState(false);
  const [waPasteText, setWaPasteText] = useState("");

  const seatedInFormCount = form.passengers.filter(
    (passenger) => (passenger.type || "adult") !== "infant",
  ).length;
  const hasSeatQuota = seatedInFormCount <= availableBookingNumbers.length;
  const primaryPhone = String(form.passengers[0]?.phone || "").trim();

  const handleApplyWaPaste = () => {
    const parsed = parseWhatsAppPassengerText(waPasteText, primaryPhone);
    if (parsed.length === 0) {
      onShowMessage?.("Tidak ada nama penumpang yang terbaca dari teks WA.");
      return;
    }
    setForm((current) => ({
      ...current,
      passengers: parsed,
    }));
    setWaPasteText("");
    setShowWaPaste(false);
    onShowMessage?.(`${parsed.length} penumpang berhasil diisi dari teks WA.`);
  };

  const handleSyncPhoneFromFirst = () => {
    if (!primaryPhone) return;
    setForm((current) => ({
      ...current,
      passengers: current.passengers.map((passenger) => ({
        ...passenger,
        phone: primaryPhone,
      })),
    }));
    onShowMessage?.("Nomor WA semua penumpang disamakan dengan PAX #01.");
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="booking-modal reservation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <div className="modal-heading">
          <div>
            <span className="reservation-kicker">
              ISSUING DESK • RESERVASI BARU
            </span>
            <h2 id="form-title">Formulir Pemesanan Tiket</h2>
            <p className="reservation-subtitle">
              Masukkan identitas penumpang sesuai KTP/KK dan pilih jadwal
              keberangkatan.
            </p>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <section className="form-section passenger-section">
            <div className="form-section-heading">
              <span className="form-section-number">01</span>
              <div>
                <h3>Daftar Penumpang</h3>
                <p>
                  Gunakan nama lengkap sesuai identitas resmi dan nomor WhatsApp
                  aktif.
                </p>
              </div>
              <div className="form-section-heading-actions">
                <button
                  type="button"
                  className={`wa-paste-toggle-btn ${showWaPaste ? "active" : ""}`}
                  onClick={() => setShowWaPaste((prev) => !prev)}
                >
                  📋 Paste dari WA
                </button>
                <span className="form-section-count">
                  {form.passengers.length} PAX
                </span>
              </div>
            </div>
            {showWaPaste && (
              <div className="wa-paste-box">
                <label className="wa-paste-label" htmlFor="wa-paste-input">
                  Tempel daftar nama dari chat WhatsApp (1 nama per baris — bisa
                  sertakan nomor WA dan tag <code>(anak)</code> / <code>(inf)</code>)
                </label>
                <textarea
                  id="wa-paste-input"
                  className="form-control wa-paste-textarea"
                  rows={4}
                  placeholder={"1. BUDI SANTOSO 081234567890\n2. SITI AMINAH (anak)\n3. ADIK BUDI (inf)"}
                  value={waPasteText}
                  onChange={(event) => setWaPasteText(event.target.value)}
                />
                <div className="wa-paste-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setShowWaPaste(false);
                      setWaPasteText("");
                    }}
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleApplyWaPaste}
                    disabled={!waPasteText.trim()}
                  >
                    Isi Otomatis ke Form
                  </button>
                </div>
              </div>
            )}
            <div className="passenger-list">
              {form.passengers.map((passenger, index) => (
                <fieldset className="passenger-card" key={index}>
                  <legend>
                    PAX #{String(index + 1).padStart(2, "0")}
                    {formBookingNumbers[index] === "INF"
                      ? " • NON-SEAT (INFANT)"
                      : formBookingNumbers[index]
                        ? ` • SEAT ${String(formBookingNumbers[index]).padStart(2, "0")}`
                        : " • KURSI PENUH"}
                  </legend>
                  <label>
                    Nama lengkap
                    <input
                      className="form-control"
                      required
                      autoFocus={index === 0}
                      autoComplete="name"
                      placeholder="Sesuai KTP / Paspor"
                      value={passenger.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          passengers: current.passengers.map(
                            (currentPassenger, passengerIndex) =>
                              passengerIndex === index
                                ? {
                                    ...currentPassenger,
                                    name: event.target.value.toLocaleUpperCase(
                                      "id-ID",
                                    ),
                                  }
                                : currentPassenger,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Nomor WhatsApp
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      placeholder="08xx xxxx xxxx"
                      value={passenger.phone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          passengers: current.passengers.map(
                            (currentPassenger, passengerIndex) =>
                              passengerIndex === index
                                ? {
                                    ...currentPassenger,
                                    phone: event.target.value,
                                  }
                                : currentPassenger,
                          ),
                        }))
                      }
                      className="form-control"
                    />
                  </label>
                  <div className="pax-type-field">
                    <span className="pax-type-label">Kategori PAX</span>
                    <div
                      className="pax-type-segmented"
                      role="group"
                      aria-label={`Kategori PAX ${index + 1}`}
                    >
                      {PAX_TYPE_OPTIONS.map((option) => {
                        const isActive =
                          (passenger.type || "adult") === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`pax-type-pill ${isActive ? "active" : ""}`}
                            aria-pressed={isActive}
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                passengers: current.passengers.map(
                                  (currentPassenger, passengerIndex) =>
                                    passengerIndex === index
                                      ? {
                                          ...currentPassenger,
                                          type: option.value,
                                        }
                                      : currentPassenger,
                                ),
                              }))
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {form.passengers.length > 1 && (
                    <button
                      type="button"
                      className="remove-passenger-button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          passengers: current.passengers.filter(
                            (_, passengerIndex) => passengerIndex !== index,
                          ),
                        }))
                      }
                      aria-label={`Hapus penumpang ${index + 1}`}
                    >
                      Hapus
                    </button>
                  )}
                </fieldset>
              ))}
            </div>
            <div className="passenger-actions">
              <div className="passenger-actions-buttons">
                <button
                  type="button"
                  className="btn btn-outline add-passenger-button"
                  onClick={() => {
                    const nextType =
                      seatedInFormCount >= availableBookingNumbers.length
                        ? "infant"
                        : "adult";
                    setForm((current) => ({
                      ...current,
                      passengers: [
                        ...current.passengers,
                        {
                          name: "",
                          phone: current.passengers[0]?.phone || "",
                          type: nextType,
                        },
                      ],
                    }));
                  }}
                >
                  <span aria-hidden="true">+</span> Tambah PAX Lain
                </button>
                {form.passengers.length > 1 && primaryPhone && (
                  <button
                    type="button"
                    className="btn btn-outline sync-phone-button"
                    onClick={handleSyncPhoneFromFirst}
                    title="Salin nomor WA PAX #01 ke semua penumpang"
                  >
                    Samakan No. WA
                  </button>
                )}
              </div>
              <span className="passenger-capacity-hint">
                Sisa kuota kursi:{" "}
                <strong>{availableBookingNumbers.length} kursi</strong> (Infant
                non-seat tetap bisa ditambah)
              </span>
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-heading">
              <span className="form-section-number">02</span>
              <div>
                <h3>Sektor & Tanggal Penerbangan</h3>
                <p>
                  Pilih rute dan tanggal sesuai jadwal operasional Senin, Rabu,
                  atau Sabtu.
                </p>
              </div>
            </div>
            <div className="booking-details-grid">
              <label>
                Rute penerbangan
                <select
                  required
                  value={form.route}
                  onChange={(event) =>
                    setForm({ ...form, route: event.target.value })
                  }
                  className="form-control"
                >
                  {ROUTES.map((route) => (
                    <option key={route.value} value={route.value}>
                      {route.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tanggal terbang
                <span className="field-hint">
                  Jadwal: Senin, Rabu, dan Sabtu
                </span>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(event) => {
                    const date = event.target.value;
                    if (isFlightDate(date)) {
                      setForm({ ...form, date });
                    } else if (date) {
                      onShowMessage(
                        "Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.",
                      );
                    }
                  }}
                  className="form-control"
                />
                <div
                  className="quick-date-chips"
                  role="group"
                  aria-label="Pilih cepat tanggal jadwal bulan ini"
                >
                  {flightDatesInMonth(form.date.slice(0, 7))
                    .slice(0, 6)
                    .map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`quick-date-chip ${form.date === d ? "active" : ""}`}
                        onClick={() => setForm({ ...form, date: d })}
                      >
                        {new Intl.DateTimeFormat("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        }).format(new Date(`${d}T00:00:00`))}
                      </button>
                    ))}
                </div>
              </label>
            </div>
          </section>
          <div className="booking-number-preview">
            <div>
              <span className="preview-label">
                ALOKASI NOMOR MANIFES / KURSI
              </span>
              <small>
                Dialokasikan otomatis saat reservasi disimpan ke database.
              </small>
            </div>
            <strong>
              {hasSeatQuota
                ? formBookingNumbers
                    .map((number) =>
                      number === "INF"
                        ? "INF"
                        : `#${String(number).padStart(2, "0")}`,
                    )
                    .join(", ")
                : "Kuota kursi tidak cukup"}
            </strong>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!hasSeatQuota || isLoadingBookings || isSavingBooking}
            >
              {isSavingBooking ? "Menyimpan..." : "Simpan Reservasi"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EditPassengerDialog({
  editingBooking,
  editForm,
  setEditForm,
  isUpdatingBooking,
  onClose,
  onSubmit,
  onShowMessage,
}) {
  const activeMonth = (editForm.date || editingBooking.date || "").slice(0, 7);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-form-title"
      >
        <div className="modal-heading">
          <div>
            <span className="section-kicker">
              EDIT MANIFES • {formatBookingSeat(editingBooking)}
            </span>
            <h2 id="edit-form-title">Perbarui Data & Jadwal Penumpang</h2>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <p className="modal-description">
          Jika pindah rute atau jadwal tanggal terbang, nomor urut kursi
          disesuaikan otomatis apabila nomor saat ini sudah terisi pada jadwal
          tujuan.
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Nama lengkap
            <input
              required
              autoFocus
              autoComplete="name"
              value={editForm.name}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="form-control"
            />
          </label>
          <label>
            Nomor WhatsApp
            <input
              required
              type="tel"
              autoComplete="tel"
              value={editForm.phone}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              className="form-control"
            />
          </label>
          <label>
            Kategori Penumpang
            <select
              value={editForm.type || "adult"}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
              className="form-control"
            >
              <option value="adult">Dewasa (Adult)</option>
              <option value="child">Anak-anak (Child)</option>
              <option value="infant">Bayi (Infant - Non Seat)</option>
            </select>
          </label>
          <label>
            Sumber / Kanal Pemesanan
            <select
              value={editForm.source || "n8n"}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  source: event.target.value,
                }))
              }
              className="form-control"
            >
              <option value="n8n">WA Otomatis (Bot WhatsApp)</option>
              <option value="web">Input Manual Web / Loket</option>
            </select>
          </label>
          <label>
            Rute penerbangan
            <select
              required
              value={editForm.route}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  route: event.target.value,
                }))
              }
              className="form-control"
            >
              {ROUTES.map((route) => (
                <option key={route.value} value={route.value}>
                  {route.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tanggal terbang (Pindah Jadwal)
            <span className="field-hint">
              Jadwal operasional: Senin, Rabu, dan Sabtu
            </span>
            <input
              required
              type="date"
              value={editForm.date || editingBooking.date}
              onChange={(event) => {
                const date = event.target.value;
                if (isFlightDate(date)) {
                  setEditForm((current) => ({
                    ...current,
                    date,
                  }));
                } else if (date && onShowMessage) {
                  onShowMessage(
                    "Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.",
                  );
                }
              }}
              className="form-control"
            />
            {activeMonth && (
              <div
                className="quick-date-chips"
                role="group"
                aria-label="Pilih cepat tanggal jadwal bulan ini"
              >
                {flightDatesInMonth(activeMonth)
                  .slice(0, 6)
                  .map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`quick-date-chip ${(editForm.date || editingBooking.date) === d ? "active" : ""}`}
                      onClick={() =>
                        setEditForm((current) => ({
                          ...current,
                          date: d,
                        }))
                      }
                    >
                      {new Intl.DateTimeFormat("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }).format(new Date(`${d}T00:00:00`))}
                    </button>
                  ))}
              </div>
            )}
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isUpdatingBooking}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUpdatingBooking}
            >
              {isUpdatingBooking ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function DeleteConfirmDialog({
  deletingBooking,
  isDeletingBooking,
  onClose,
  onConfirmDelete,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeletingBooking) {
          onClose();
        }
      }}
    >
      <section
        className="booking-modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <div className="modal-heading">
          <div>
            <span className="section-kicker">KONFIRMASI PENGHAPUSAN</span>
            <h2 id="delete-confirm-title">Hapus dari Manifes?</h2>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            disabled={isDeletingBooking}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <div className="confirm-modal-body">
          <p className="m-0 text-sm text-muted">
            Data penumpang berikut akan dihapus permanen dari database MySQL:
          </p>
          <div className="confirm-summary-card">
            <strong>
              Seat #{String(deletingBooking.bookingNo).padStart(2, "0")} —{" "}
              {deletingBooking.name}
            </strong>
            <span>
              Sektor {deletingBooking.route} •{" "}
              {dateLabel(deletingBooking.date)}
            </span>
            <span>WhatsApp: {deletingBooking.phone}</span>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isDeletingBooking}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onConfirmDelete(deletingBooking.id)}
              disabled={isDeletingBooking}
            >
              {isDeletingBooking ? "Menghapus..." : "Ya, Hapus Permanen"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function FinanceLoginDialog({
  financeAuthConfigured,
  financeLoginError,
  financeUsername,
  setFinanceUsername,
  financePassword,
  setFinancePassword,
  isFinanceSubmitting,
  onClose,
  onSubmit,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isFinanceSubmitting) {
          onClose();
        }
      }}
    >
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-login-title"
      >
        <div className="modal-heading">
          <div>
            <span className="section-kicker">OTORISASI KEUANGAN</span>
            <h2 id="finance-login-title">Akses Portal Keuangan</h2>
          </div>
          <button
            className="close-button"
            type="button"
            onClick={onClose}
            disabled={isFinanceSubmitting}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <p className="modal-description">
          Masukkan kredensial Keuangan untuk membuka laporan penghasilan dan
          rincian fee tiket.
        </p>
        {financeAuthConfigured === false && (
          <div className="finance-auth-notice" role="status">
            Login Keuangan belum dikonfigurasi. Isi FINANCE_USERNAME dan
            FINANCE_PASSWORD pada file .env server.
          </div>
        )}
        {financeLoginError && (
          <div className="finance-auth-error" role="alert">
            {financeLoginError}
          </div>
        )}
        <form onSubmit={onSubmit}>
          <label>
            Username
            <input
              required
              autoComplete="username"
              value={financeUsername}
              onChange={(event) => setFinanceUsername(event.target.value)}
              disabled={isFinanceSubmitting}
              className="form-control"
            />
          </label>
          <label>
            Kata sandi
            <input
              required
              type="password"
              autoComplete="current-password"
              value={financePassword}
              onChange={(event) => setFinancePassword(event.target.value)}
              disabled={isFinanceSubmitting}
              className="form-control"
            />
          </label>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={onClose}
              disabled={isFinanceSubmitting}
            >
              Batal
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isFinanceSubmitting}
            >
              {isFinanceSubmitting ? "Memverifikasi..." : "Buka Portal"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
