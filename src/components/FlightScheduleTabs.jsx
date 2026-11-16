import { useState } from "react";

const monthLabel = (month) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00`));

const flightDateLabel = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
    new Date(2026, index, 1),
  ),
}));

function FlightScheduleTabs({
  dates,
  bookingCounts,
  selectedMonth,
  selectedDate,
  routes,
  selectedRoute,
  onRouteChange,
  onMonthChange,
  onYearChange,
  onDateChange,
}) {
  const [yearInput, setYearInput] = useState(selectedMonth.slice(0, 4));
  const selectedMonthNumber = selectedMonth.slice(5, 7);

  return (
    <section className="schedule-tabs" aria-label="Pilih jadwal penerbangan">
      <div className="schedule-period-controls">
        <label className="schedule-period-field route-period-field">
          <span>Rute penerbangan</span>
          <select
            aria-label="Rute penerbangan"
            value={selectedRoute}
            onChange={(event) => onRouteChange(event.target.value)}
          >
            {routes.map((route) => (
              <option key={route.value} value={route.value}>
                {route.label}
              </option>
            ))}
          </select>
        </label>
        <label className="schedule-period-field">
          <span>Bulan</span>
          <select
            aria-label="Bulan penerbangan"
            value={selectedMonthNumber}
            onChange={(event) => onMonthChange(event.target.value)}
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <label className="schedule-period-field year-field">
          <span>Tahun</span>
          <input
            aria-label="Tahun penerbangan"
            type="text"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            value={yearInput}
            onChange={(event) => {
              const year = event.target.value.replace(/\D/g, "").slice(0, 4);
              setYearInput(year);
              if (year.length === 4 && Number(year) >= 1900) {
                onYearChange(year);
              }
            }}
          />
        </label>
      </div>
      <div className="flight-date-section">
        <div className="flight-date-heading">
          <strong>Tanggal</strong>
          <span>Jadwal tersedia Senin, Rabu, dan Sabtu</span>
        </div>
        <div
          className="flight-date-tabs"
          role="group"
          aria-label={`Tanggal penerbangan ${monthLabel(selectedMonth)}`}
        >
          {dates.map((date) => (
            <button
              className={`flight-date-tab ${bookingCounts[date] ? "has-bookings" : ""} ${date === selectedDate ? "selected" : ""}`}
              type="button"
              key={date}
              aria-pressed={date === selectedDate}
              aria-label={`${flightDateLabel(date)}${bookingCounts[date] ? `, ${bookingCounts[date]} pemesanan` : ""}`}
              onClick={() => onDateChange(date)}
            >
              <span>{flightDateLabel(date).split(",")[0]}</span>
              <strong>{date.slice(-2)}</strong>
              {bookingCounts[date] > 0 && (
                <small className="flight-date-count">
                  {bookingCounts[date]}
                </small>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FlightScheduleTabs;
