import { useState } from "react";
import { PlaneTakeoff } from "lucide-react";
import {
  BOOKING_LIMIT,
  BOOKING_NUMBERS,
  dateLabel,
  isBookingCheckedIn,
  isOccupiedSeat,
  weekdayName,
} from "../utils/bookingUtils";

function FlightDispatchBanner({
  routeInfo,
  selectedDate,
  currentBookings = [],
  checkedInOverrides = {},
  occupiedSeats,
  remainingSeats,
  loadFactorPct,
  infantCount,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const seatMap = new Map();
  let checkedInSeatsCount = 0;
  currentBookings.forEach((booking) => {
    if (isOccupiedSeat(booking) && booking.bookingNo) {
      const checked = isBookingCheckedIn(booking, checkedInOverrides);
      if (checked) checkedInSeatsCount += 1;
      seatMap.set(Number(booking.bookingNo), { booking, checked });
    }
  });
  return (
    <section
      className={`flight-banner ${mobileExpanded ? "is-mobile-expanded" : "is-mobile-collapsed"}`}
      aria-label="Informasi penerbangan dan peta kursi"
    >
      <div className="flight-banner-mobile-bar">
        <div className="fbm-left">
          <span className="fbm-route">
            {routeInfo.originCode} → {routeInfo.destinationCode}
          </span>
          <span
            className={`fbm-quota ${remainingSeats === 0 ? "full" : "open"}`}
          >
            {occupiedSeats}/{BOOKING_LIMIT}{" "}
            {remainingSeats === 0 ? "FULL" : `• ${remainingSeats} Sisa`}
          </span>
          {infantCount > 0 && (
            <span className="fbm-inf">INF {infantCount}</span>
          )}
        </div>
        <button
          type="button"
          className="fbm-toggle-btn"
          aria-expanded={mobileExpanded}
          onClick={() => setMobileExpanded((prev) => !prev)}
        >
          {mobileExpanded ? "Tutup ▴" : "Detail ▾"}
        </button>
      </div>
      <div className="boarding-pass-side">
        <div className="boarding-pass-top">
          <span className="boarding-airline-tag">
            SUSI AIR • PERINTIS DISPATCH
          </span>
          <span
            className={`boarding-status-pill ${remainingSeats === 0 ? "full" : "open"}`}
          >
            {remainingSeats === 0
              ? "FULL BOOKED"
              : `${remainingSeats} SEAT AVAILABLE`}
          </span>
        </div>

        <div className="flight-legs">
          <div className="flight-leg">
            <span className="flight-leg-caption">ORIGIN</span>
            <strong className="flight-code">{routeInfo.originCode}</strong>
            <span className="flight-city">{routeInfo.origin}</span>
          </div>

          <div className="flight-route-visual" aria-hidden="true">
            <div className="route-line-track">
              <span className="route-node" />
              <span className="route-dashed" />
              <div className="flight-plane">
                <PlaneTakeoff strokeWidth={2} />
              </div>
              <span className="route-dashed" />
              <span className="route-node" />
            </div>
            <span className="route-aircraft-type">
              CESSNA 208B GRAND CARAVAN
            </span>
          </div>

          <div className="flight-leg flight-leg-dest">
            <span className="flight-leg-caption">DESTINATION</span>
            <strong className="flight-code">{routeInfo.destinationCode}</strong>
            <span className="flight-city">{routeInfo.destination}</span>
          </div>
        </div>

        <div className="boarding-pass-meta-strip">
          <div className="bp-meta-item">
            <span>TANGGAL TERBANG</span>
            <strong>{dateLabel(selectedDate)}</strong>
          </div>
          <div className="bp-meta-item">
            <span>HARI OPERASIONAL</span>
            <strong>{weekdayName(selectedDate)}</strong>
          </div>
          <div className="bp-meta-item">
            <span>LOAD FACTOR</span>
            <strong>
              {loadFactorPct}% ({occupiedSeats}/{BOOKING_LIMIT} Kursi)
            </strong>
          </div>
          <div className="bp-meta-item">
            <span>INFANT (NON-SEAT)</span>
            <strong>{infantCount} Bayi</strong>
          </div>
        </div>
      </div>

      <div className="flight-capacity">
        <div className="capacity-summary">
          <div className="capacity-total">
            <span className="capacity-label">KABIN PESAWAT (12 SEAT)</span>
            <div className="capacity-total-value">
              <strong>{occupiedSeats}</strong>
              <span>terisi</span>
              <span className="capacity-sep">/</span>
              <strong className="capacity-free-num">{remainingSeats}</strong>
              <span>kosong</span>
            </div>
          </div>
          <div className="capacity-available">
            <strong>
              {remainingSeats} / {BOOKING_LIMIT}
            </strong>
            <span>TERSEDIA</span>
          </div>
        </div>

        <div className="capacity-progress-track" aria-hidden="true">
          <div
            className="capacity-progress-fill"
            style={{ width: `${loadFactorPct}%` }}
          />
        </div>

        <div
          className="cabin-deck-frame"
          role="img"
          aria-label={`${occupiedSeats} kursi terisi, ${remainingSeats} kursi tersedia dari ${BOOKING_LIMIT}`}
        >
          <div className="cabin-cockpit-nose" aria-hidden="true">
            <span>COCKPIT</span>
          </div>
          <div className="capacity-seats">
            {BOOKING_NUMBERS.map((number) => {
              const seatEntry = seatMap.get(number);
              const isFilled = seatMap.size > 0 ? Boolean(seatEntry) : number <= occupiedSeats;
              const isCheckedIn = Boolean(seatEntry?.checked);
              return (
                <span
                  key={number}
                  className={`seat ${
                    isCheckedIn
                      ? "seat-checked-in"
                      : isFilled
                        ? "seat-occupied"
                        : "seat-free"
                  }`}
                  title={
                    seatEntry
                      ? `#${String(number).padStart(2, "0")} ${seatEntry.booking.name}${isCheckedIn ? " (Sudah Check-in)" : ""}`
                      : `Kursi #${String(number).padStart(2, "0")} Kosong`
                  }
                  aria-hidden="true"
                >
                  <span className="seat-num">
                    {isCheckedIn ? "✓" : String(number).padStart(2, "0")}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="cabin-seat-legend">
          <span>
            <i className="seat-dot free" /> Kosong ({remainingSeats})
          </span>
          <span>
            <i className="seat-dot occupied" /> Terisi ({occupiedSeats})
          </span>
          <span>
            <i className="seat-dot checked-in" /> Check-in ({checkedInSeatsCount})
          </span>
        </div>
      </div>
    </section>
  );
}

export default FlightDispatchBanner;
