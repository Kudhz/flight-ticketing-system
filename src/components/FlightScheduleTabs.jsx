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

  const stepMonth = (delta) => {
    const [yearNum, monthNum] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(yearNum, monthNum - 1 + delta, 1);
    const nextYear = String(nextDate.getFullYear());
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
    setYearInput(nextYear);
    if (nextYear !== String(yearNum)) {
      onYearChange(nextYear);
    }
    onMonthChange(nextMonth);
  };

  const totalMonthPax = Object.values(bookingCounts).reduce(
    (acc, count) => acc + count,
    0,
  );

  return (
    <section className="schedule-tabs" aria-label="Pilih jadwal penerbangan">
      <div className="schedule-command-top">
        <div className="schedule-route-deck">
          <div className="schedule-deck-header">
            <span className="deck-tag">SECTOR ROUTE</span>
            <span className="deck-sub">Pilih sektor penerbangan aktif</span>
          </div>
          <div
            className="route-switcher-cards"
            role="group"
            aria-label="Pilih rute penerbangan"
          >
            {routes.map((route) => {
              const isActive = selectedRoute === route.value;
              return (
                <button
                  key={route.value}
                  type="button"
                  className={`route-sector-card ${isActive ? "active" : ""}`}
                  onClick={() => onRouteChange(route.value)}
                  aria-pressed={isActive}
                >
                  <div className="route-sector-codes">
                    <strong>{route.originCode}</strong>
                    <span className="route-sector-arrow" aria-hidden="true">
                      ✈
                    </span>
                    <strong>{route.destinationCode}</strong>
                  </div>
                  <div className="route-sector-cities">
                    <span>
                      {route.origin} → {route.destination}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="schedule-period-deck">
          <div className="schedule-deck-header">
            <span className="deck-tag">PERIODE OPERASIONAL</span>
            <span className="deck-sub">{totalMonthPax} kursi terpesan bulan ini</span>
          </div>
          <div className="schedule-period-controls">
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
            <div className="period-step-group" aria-label="Navigasi bulan">
              <button
                type="button"
                className="period-step-btn"
                onClick={() => stepMonth(-1)}
                title="Bulan sebelumnya"
                aria-label="Bulan sebelumnya"
              >
                ‹
              </button>
              <button
                type="button"
                className="period-step-btn"
                onClick={() => stepMonth(1)}
                title="Bulan berikutnya"
                aria-label="Bulan berikutnya"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flight-date-section">
        <div className="flight-date-heading">
          <div className="flex items-center gap-2">
            <strong>Kalender Keberangkatan — {monthLabel(selectedMonth)}</strong>
            <span className="schedule-freq-pill">SEN • RAB • SAB</span>
          </div>
          <span>Klik tanggal untuk memuat manifest dan peta kursi</span>
        </div>
        <div
          className="flight-date-tabs"
          role="group"
          aria-label={`Tanggal penerbangan ${monthLabel(selectedMonth)}`}
        >
          {dates.map((date) => {
            const count = bookingCounts[date] || 0;
            const fillPct = Math.min(Math.round((count / 12) * 100), 100);
            const isFull = count >= 12;
            return (
              <button
                className={`flight-date-tab ${count ? "has-bookings" : ""} ${isFull ? "is-full" : ""} ${date === selectedDate ? "selected" : ""}`}
                type="button"
                key={date}
                aria-pressed={date === selectedDate}
                aria-label={`${flightDateLabel(date)}${count ? `, ${count} pemesanan` : ""}`}
                onClick={() => onDateChange(date)}
              >
                <span className="date-tab-day">
                  {flightDateLabel(date).split(",")[0]}
                </span>
                <strong className="date-tab-num">{date.slice(-2)}</strong>
                <div className="date-tab-meter" aria-hidden="true">
                  <div
                    className="date-tab-meter-fill"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                {count > 0 && (
                  <small className="flight-date-count">{count}/12</small>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FlightScheduleTabs;
