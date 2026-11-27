import { useEffect, useMemo, useRef, useState } from "react";
import {
  BOOKING_LIMIT,
  dateLabel,
  flightDatesInMonth,
  localDateISO,
} from "../utils/bookingUtils";

const monthLabel = (month) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00`));

const fullFlightDateLabel = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));

const shortDayLabel = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
    new Date(2026, index, 1),
  ),
}));

const NEAR_FULL_THRESHOLD = 9;

function FlightScheduleTabs({
  dates,
  bookingCounts,
  dateDetails = {},
  selectedMonth,
  selectedDate,
  routes,
  selectedRoute,
  embedded = false,
  isModalOpen = false,
  isActiveView = true,
  onRouteChange,
  onMonthChange,
  onYearChange,
  onDateChange,
  onJumpNearest,
}) {
  const [yearInput, setYearInput] = useState(selectedMonth.slice(0, 4));
  const [hidePast, setHidePast] = useState(
    () => window.localStorage.getItem("seatflow-hide-past-dates") === "on",
  );
  const tabRefs = useRef({});
  const selectedMonthNumber = selectedMonth.slice(5, 7);
  const today = localDateISO();
  const isCurrentMonth = selectedMonth === today.slice(0, 7);
  const pastDatesCount = useMemo(
    () => dates.filter((d) => d < today).length,
    [dates, today],
  );
  const canHidePast =
    isCurrentMonth && pastDatesCount > 0 && pastDatesCount < dates.length;
  const effectiveHidePast = canHidePast && hidePast;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "seatflow-hide-past-dates",
        hidePast ? "on" : "off",
      );
    } catch {
      // Abaikan jika localStorage penuh
    }
  }, [hidePast]);

  const visibleDates = useMemo(
    () =>
      effectiveHidePast
        ? dates.filter((d) => d >= today || d === selectedDate)
        : dates,
    [dates, effectiveHidePast, selectedDate, today],
  );

  // Kelompokkan jadwal ke dalam minggu kalender penuh (Senin, Rabu, Sabtu),
  // sehingga minggu di awal/akhir bulan tetap menampilkan tanggal bulan sebelah (misal 30, 02, 05).
  const weeks = useMemo(() => {
    const formatIso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const map = new Map();
    dates.forEach((date) => {
      const d = new Date(`${date}T00:00:00`);
      const dayNum = d.getDay(); // 1 = Sen, 3 = Rab, 6 = Sab
      const mondayOffset = (dayNum + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - mondayOffset);
      const weekKey = formatIso(monday);

      if (!map.has(weekKey)) {
        const wednesday = new Date(monday);
        wednesday.setDate(monday.getDate() + 2);
        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + 5);

        const monIso = formatIso(monday);
        const wedIso = formatIso(wednesday);
        const satIso = formatIso(saturday);

        map.set(weekKey, {
          key: weekKey,
          mon: monIso,
          wed: wedIso,
          sat: satIso,
          dates: [monIso, wedIso, satIso],
        });
      }
    });
    return Array.from(map.values());
  }, [dates]);

  const activeWeekIdx = useMemo(() => {
    const idx = weeks.findIndex((week) => week.dates.includes(selectedDate));
    return idx >= 0 ? idx : 0;
  }, [selectedDate, weeks]);

  const activeWeek = weeks[activeWeekIdx] || {
    mon: null,
    wed: null,
    sat: null,
    dates: [],
  };

  const selectMobileDate = (date) => {
    if (!date) return;
    if (date.slice(0, 7) !== selectedMonth) {
      const targetYear = date.slice(0, 4);
      const targetMonth = date.slice(5, 7);
      setYearInput(targetYear);
      onMonthChange(targetMonth, targetYear, date);
      return;
    }
    onDateChange(date);
  };

  const stepWeek = (delta) => {
    const nextWeek = weeks[activeWeekIdx + delta];
    if (nextWeek && nextWeek.dates.length > 0) {
      const inMonthDates = nextWeek.dates.filter((d) =>
        d.startsWith(`${selectedMonth}-`),
      );
      const currentDay = new Date(`${selectedDate}T00:00:00`).getDay();
      const sameWeekdayDate =
        (currentDay === 1 && nextWeek.mon) ||
        (currentDay === 3 && nextWeek.wed) ||
        (currentDay === 6 && nextWeek.sat);
      const preferredSameWeekday =
        sameWeekdayDate && sameWeekdayDate.startsWith(`${selectedMonth}-`)
          ? sameWeekdayDate
          : null;
      const fallbackPool =
        inMonthDates.length > 0 ? inMonthDates : nextWeek.dates;
      selectMobileDate(
        preferredSameWeekday ||
          (delta < 0
            ? fallbackPool[fallbackPool.length - 1]
            : fallbackPool[0]),
      );
      return;
    }

    const [yearNum, monthNum] = selectedMonth.split("-").map(Number);
    const targetPeriodDate = new Date(
      yearNum,
      monthNum - 1 + (delta > 0 ? 1 : -1),
      1,
    );
    const targetYear = String(targetPeriodDate.getFullYear());
    const targetMonth = String(targetPeriodDate.getMonth() + 1).padStart(
      2,
      "0",
    );
    const targetDates = flightDatesInMonth(`${targetYear}-${targetMonth}`);
    const distinctDates = targetDates.filter(
      (d) => !activeWeek.dates.includes(d),
    );
    const pool = distinctDates.length > 0 ? distinctDates : targetDates;
    const targetDate =
      delta > 0 ? pool[0] : pool[pool.length - 1];
    setYearInput(targetYear);
    onMonthChange(targetMonth, targetYear, targetDate);
  };

  useEffect(() => {
    if (!isActiveView || isModalOpen || visibleDates.length === 0) {
      return undefined;
    }

    function handleArrowNav(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      const activeTag = document.activeElement?.tagName || "";
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(activeTag) ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      const currentIdx = visibleDates.indexOf(selectedDate);
      if (currentIdx === -1) return;

      const nextIdx =
        event.key === "ArrowRight" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= visibleDates.length) return;

      event.preventDefault();
      const targetDate = visibleDates[nextIdx];
      onDateChange(targetDate);
      if (
        document.activeElement?.classList?.contains("flight-date-tab") &&
        tabRefs.current[targetDate]
      ) {
        tabRefs.current[targetDate].focus();
      }
    }

    window.addEventListener("keydown", handleArrowNav);
    return () => window.removeEventListener("keydown", handleArrowNav);
  }, [isActiveView, isModalOpen, onDateChange, selectedDate, visibleDates]);

  const stepMonth = (delta) => {
    const [yearNum, monthNum] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(yearNum, monthNum - 1 + delta, 1);
    const nextYear = String(nextDate.getFullYear());
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
    setYearInput(nextYear);
    onMonthChange(nextMonth, nextYear);
  };

  const nearestUpcomingToday = dates.includes(today);

  const WrapperTag = embedded ? "div" : "section";

  return (
    <WrapperTag
      className={`schedule-tabs ${embedded ? "schedule-tabs-embedded" : ""}`}
      aria-label="Pilih rute dan jadwal penerbangan"
    >
      <div className="schedule-command-top compact-command-top">
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

        <div className="schedule-period-deck compact-period-deck">
          <div className="schedule-period-controls">
            <label className="schedule-period-field" aria-label="Bulan penerbangan">
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
            <label
              className="schedule-period-field year-field"
              aria-label="Tahun penerbangan"
            >
              <input
                aria-label="Tahun penerbangan"
                type="text"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                value={yearInput}
                onChange={(event) => {
                  const year = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4);
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
          <div className="flight-date-heading-main">
            <strong>Jadwal {monthLabel(selectedMonth)}</strong>
            <span className="schedule-freq-pill">SEN • RAB • SAB</span>
          </div>

          <div className="flight-date-quick-bar">
            {weeks.length > 0 && (
              <div
                className="mobile-week-stepper"
                role="group"
                aria-label="Navigasi minggu keberangkatan"
              >
                <button
                  type="button"
                  className="mobile-week-btn"
                  onClick={() => stepWeek(-1)}
                  aria-label="Minggu sebelumnya"
                  title="Minggu sebelumnya"
                >
                  ‹
                </button>
                <span className="mobile-week-label">
                  Minggu {activeWeekIdx + 1}/{weeks.length}
                </span>
                <button
                  type="button"
                  className="mobile-week-btn"
                  onClick={() => stepWeek(1)}
                  aria-label="Minggu berikutnya"
                  title="Minggu berikutnya"
                >
                  ›
                </button>
              </div>
            )}
            {onJumpNearest && (
              <button
                type="button"
                className="calendar-quick-btn primary-quick"
                onClick={onJumpNearest}
                title="Lompat langsung ke jadwal penerbangan aktif terdekat"
              >
                <span className="quick-btn-dot" aria-hidden="true" />
                {nearestUpcomingToday ? "Hari Ini" : "Jadwal Terdekat"}
              </button>
            )}
            {canHidePast && (
              <button
                type="button"
                className={`calendar-quick-btn hide-past-btn ${effectiveHidePast ? "active" : ""}`}
                onClick={() => setHidePast((prev) => !prev)}
                aria-pressed={effectiveHidePast}
                title="Sembunyikan atau tampilkan jadwal yang sudah lewat pada bulan ini"
              >
                {effectiveHidePast
                  ? `Tampilkan Lewat (${pastDatesCount})`
                  : "Sembunyikan Lewat"}
              </button>
            )}
          </div>
        </div>

        <div className="mobile-week-date-strip">
          <button
            type="button"
            className="mobile-week-edge-btn"
            onClick={() => stepWeek(-1)}
            aria-label="Minggu sebelumnya"
            title="Geser ke minggu sebelumnya"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div
            key={activeWeek.key || selectedMonth}
            className="mobile-week-date-grid week-flow-enter"
            role="group"
            aria-label={`Jadwal minggu ${activeWeekIdx + 1} (Senin, Rabu, Sabtu)`}
          >
          {[
            { label: "Sen", date: activeWeek.mon },
            { label: "Rab", date: activeWeek.wed },
            { label: "Sab", date: activeWeek.sat },
          ].map((slot) => {
            if (!slot.date) {
              return (
                <div
                  key={slot.label}
                  className="flight-date-tab mobile-week-placeholder"
                  aria-hidden="true"
                >
                  <span className="date-tab-top">
                    <span className="date-tab-day">{slot.label}</span>
                  </span>
                  <strong className="date-tab-num">—</strong>
                  <span className="date-tab-status tier-empty">-</span>
                </div>
              );
            }

            const date = slot.date;
            const count = bookingCounts[date] || 0;
            const detail = dateDetails[date] || {
              mdcSeats: 0,
              iaxSeats: 0,
              waitingRoute: 0,
              waitingTotal: 0,
            };
            const fillPct = Math.min(
              Math.round((count / BOOKING_LIMIT) * 100),
              100,
            );
            const isFull = count >= BOOKING_LIMIT;
            const isNearFull = !isFull && count >= NEAR_FULL_THRESHOLD;
            const isToday = date === today;
            const isPast = date < today;
            const isSelected = date === selectedDate;
            const hasWaiting = detail.waitingRoute > 0;
            const tierClass = isFull
              ? "tier-full"
              : isNearFull
                ? "tier-warn"
                : count > 0
                  ? "tier-open"
                  : "tier-empty";

            return (
              <button
                key={date}
                type="button"
                className={`flight-date-tab ${tierClass} ${isToday ? "is-today" : ""} ${isPast ? "is-past" : ""} ${isSelected ? "selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => selectMobileDate(date)}
              >
                {hasWaiting && (
                  <span className="date-waiting-corner" aria-hidden="true" />
                )}
                <span className="date-tab-top">
                  <span className="date-tab-day">{shortDayLabel(date)}</span>
                  {isToday && (
                    <span className="date-tab-today-dot" aria-hidden="true" />
                  )}
                </span>
                <strong className="date-tab-num">{date.slice(-2)}</strong>
                <span className={`date-tab-status ${tierClass}`}>
                  {isFull ? "FULL" : `${count}/${BOOKING_LIMIT}`}
                </span>
                <div className="date-tab-meter" aria-hidden="true">
                  <div
                    className="date-tab-meter-fill"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </button>
            );
          })}
          </div>

          <button
            type="button"
            className="mobile-week-edge-btn"
            onClick={() => stepWeek(1)}
            aria-label="Minggu berikutnya"
            title="Geser ke minggu berikutnya"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div
          className="flight-date-tabs"
          role="group"
          aria-label={`Tanggal penerbangan ${monthLabel(selectedMonth)}`}
        >
          {visibleDates.map((date) => {
            const count = bookingCounts[date] || 0;
            const detail = dateDetails[date] || {
              mdcSeats: 0,
              iaxSeats: 0,
              waitingRoute: 0,
              waitingTotal: 0,
            };
            const fillPct = Math.min(
              Math.round((count / BOOKING_LIMIT) * 100),
              100,
            );
            const isFull = count >= BOOKING_LIMIT;
            const isNearFull = !isFull && count >= NEAR_FULL_THRESHOLD;
            const isToday = date === today;
            const isPast = date < today;
            const isSelected = date === selectedDate;
            const hasWaiting = detail.waitingRoute > 0;

            const tierClass = isFull
              ? "tier-full"
              : isNearFull
                ? "tier-warn"
                : count > 0
                  ? "tier-open"
                  : "tier-empty";

            const tooltipParts = [
              fullFlightDateLabel(date),
              `MNA-MDC: ${detail.mdcSeats}/${BOOKING_LIMIT} kursi`,
              `MNA-IAX: ${detail.iaxSeats}/${BOOKING_LIMIT} kursi`,
            ];
            if (detail.waitingTotal > 0) {
              tooltipParts.push(`${detail.waitingTotal} menunggu verifikasi`);
            }

            return (
              <button
                ref={(el) => {
                  if (el) tabRefs.current[date] = el;
                }}
                className={`flight-date-tab ${tierClass} ${isToday ? "is-today" : ""} ${isPast ? "is-past" : ""} ${isSelected ? "selected" : ""}`}
                type="button"
                key={date}
                title={tooltipParts.join(" • ")}
                aria-pressed={isSelected}
                aria-label={`${dateLabel(date)}${isToday ? " (Hari ini)" : ""}, ${count} dari ${BOOKING_LIMIT} kursi terisi${hasWaiting ? `, ${detail.waitingRoute} menunggu verifikasi` : ""}`}
                onClick={() => onDateChange(date)}
              >
                {hasWaiting && (
                  <span
                    className="date-waiting-corner"
                    title={`${detail.waitingRoute} penumpang menunggu verifikasi`}
                    aria-hidden="true"
                  />
                )}
                <span className="date-tab-top">
                  <span className="date-tab-day">{shortDayLabel(date)}</span>
                  {isToday && (
                    <span
                      className="date-tab-today-dot"
                      title="Hari ini"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <strong className="date-tab-num">{date.slice(-2)}</strong>
                <span className={`date-tab-status ${tierClass}`}>
                  {isFull ? "FULL" : `${count}/${BOOKING_LIMIT}`}
                </span>
                <div className="date-tab-meter" aria-hidden="true">
                  <div
                    className="date-tab-meter-fill"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="flight-calendar-legend"
          aria-label="Keterangan warna tanggal"
        >
          <div className="calendar-legend-items">
            <span>
              <i className="cal-dot today" aria-hidden="true" /> Hari ini
            </span>
            <span>
              <i className="cal-dot open" aria-hidden="true" /> Tersedia
            </span>
            <span>
              <i className="cal-dot warn" aria-hidden="true" /> Hampir penuh
            </span>
            <span>
              <i className="cal-dot full" aria-hidden="true" /> Penuh
            </span>
            <span>
              <i className="cal-dot waiting" aria-hidden="true" /> Menunggu verifikasi
            </span>
          </div>
          <span className="calendar-kbd-hint">
            <kbd>←</kbd> <kbd>→</kbd> Pindah tanggal
          </span>
        </div>
      </div>
    </WrapperTag>
  );
}

export default FlightScheduleTabs;
