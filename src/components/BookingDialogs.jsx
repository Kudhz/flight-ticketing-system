import {
  ROUTES,
  dateLabel,
  flightDatesInMonth,
  isFlightDate,
} from "../utils/bookingUtils";

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
              <span className="form-section-count">
                {form.passengers.length} PAX
              </span>
            </div>
            <div className="passenger-list">
              {form.passengers.map((passenger, index) => (
                <fieldset className="passenger-card" key={index}>
                  <legend>
                    PAX #{String(index + 1).padStart(2, "0")}
                    {formBookingNumbers[index]
                      ? ` • SEAT ${String(formBookingNumbers[index]).padStart(2, "0")}`
                      : ""}
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
                  <label>
                    Kategori PAX
                    <select
                      className="form-control"
                      value={passenger.type || "adult"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          passengers: current.passengers.map(
                            (currentPassenger, passengerIndex) =>
                              passengerIndex === index
                                ? {
                                    ...currentPassenger,
                                    type: event.target.value,
                                  }
                                : currentPassenger,
                          ),
                        }))
                      }
                    >
                      <option value="adult">Dewasa (Adult)</option>
                      <option value="child">Anak-anak (Child)</option>
                      <option value="infant">Bayi (Infant - Non Seat)</option>
                    </select>
                  </label>
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
              <button
                type="button"
                className="btn btn-outline add-passenger-button"
                disabled={
                  form.passengers.length >= availableBookingNumbers.length
                }
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    passengers: [
                      ...current.passengers,
                      { name: "", phone: "", type: "adult" },
                    ],
                  }))
                }
              >
                <span aria-hidden="true">+</span> Tambah PAX Lain
              </button>
              <span className="passenger-capacity-hint">
                Sisa kuota jadwal ini:{" "}
                <strong>{availableBookingNumbers.length} nomor</strong>
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
              {formBookingNumbers.length === form.passengers.length
                ? formBookingNumbers
                    .map((number) => `#${String(number).padStart(2, "0")}`)
                    .join(", ")
                : "Kuota tidak cukup"}
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
              disabled={
                formBookingNumbers.length !== form.passengers.length ||
                isLoadingBookings ||
                isSavingBooking
              }
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
}) {
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
              EDIT MANIFES • SEAT #
              {String(editingBooking.bookingNo).padStart(2, "0")}
            </span>
            <h2 id="edit-form-title">Perbarui Data Penumpang</h2>
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
          Nomor urut dan tanggal terbang tetap. Jika pindah rute, nomor urut
          disesuaikan otomatis apabila nomor saat ini sudah terisi.
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
