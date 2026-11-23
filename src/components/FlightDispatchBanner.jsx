import { PlaneTakeoff } from "lucide-react";
import {
  BOOKING_LIMIT,
  BOOKING_NUMBERS,
  dateLabel,
  weekdayName,
} from "../utils/bookingUtils";

function FlightDispatchBanner({
  routeInfo,
  selectedDate,
  occupiedSeats,
  remainingSeats,
  loadFactorPct,
  infantCount,
}) {
  return (
    <section
      className="flight-banner"
      aria-label="Informasi penerbangan dan peta kursi"
    >
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
              const isFilled = number <= occupiedSeats;
              return (
                <span
                  key={number}
                  className={`seat ${isFilled ? "seat-occupied" : "seat-free"}`}
                  aria-hidden="true"
                >
                  <span className="seat-num">
                    {String(number).padStart(2, "0")}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="cabin-seat-legend">
          <span>
            <i className="seat-dot free" /> Kursi Kosong ({remainingSeats})
          </span>
          <span>
            <i className="seat-dot occupied" /> Kursi Terisi ({occupiedSeats})
          </span>
        </div>
      </div>
    </section>
  );
}

export default FlightDispatchBanner;
