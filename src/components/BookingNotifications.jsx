import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  ExternalLink,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { dateLabel, timeLabel, weekdayName } from "../utils/bookingUtils";

const paxTypeLabel = (type) => {
  if (type === "infant") return "INF";
  if (type === "child") return "ANAK";
  return "DEWASA";
};

export function BookingNotificationBell({
  notifications,
  soundEnabled,
  onToggleSound,
  onMarkAllRead,
  onClearAll,
  onSelectNotification,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported",
  );
  const containerRef = useRef(null);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function requestDesktopPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const result = await window.Notification.requestPermission();
      setBrowserPermission(result);
    } catch {
      // Abaikan jika browser menolak permintaan izin
    }
  }

  return (
    <div className="notif-bell-wrap" ref={containerRef}>
      <button
        type="button"
        className={`notif-bell-btn ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifikasi pesanan masuk (${unreadCount} belum dibaca)`}
        title="Notifikasi pesanan masuk dari WA Otomatis"
      >
        {unreadCount > 0 ? (
          <BellRing className="notif-bell-icon ringing" />
        ) : (
          <Bell className="notif-bell-icon" />
        )}
        {unreadCount > 0 && (
          <span className="notif-unread-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notif-dropdown"
          role="dialog"
          aria-label="Daftar notifikasi pesanan masuk"
        >
          <div className="notif-dropdown-header">
            <div className="notif-dropdown-title">
              <strong>Pesanan Masuk (WA Otomatis)</strong>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} pesanan baru belum dilihat`
                  : "Memantau pesanan WA Otomatis secara langsung"}
              </span>
            </div>
            <div className="notif-header-actions">
              <button
                type="button"
                className="notif-icon-action"
                onClick={onToggleSound}
                title={
                  soundEnabled
                    ? "Matikan suara notifikasi"
                    : "Aktifkan suara notifikasi"
                }
                aria-label="Toggle suara notifikasi"
              >
                {soundEnabled ? <Volume2 /> : <VolumeX />}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-icon-action"
                  onClick={onMarkAllRead}
                  title="Tandai semua sudah dibaca"
                  aria-label="Tandai semua sudah dibaca"
                >
                  <CheckCheck />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="notif-icon-action"
                  onClick={onClearAll}
                  title="Bersihkan riwayat notifikasi"
                  aria-label="Bersihkan riwayat notifikasi"
                >
                  <Trash2 />
                </button>
              )}
            </div>
          </div>

          {browserPermission === "default" && (
            <div className="notif-permission-banner">
              <span>Aktifkan notifikasi layar desktop saat tab di latar belakang?</span>
              <button
                type="button"
                className="notif-permission-btn"
                onClick={requestDesktopPermission}
              >
                Izinkan
              </button>
            </div>
          )}

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell className="notif-empty-icon" />
                <strong>Belum Ada Pesanan Baru</strong>
                <span>
                  Saat WA Otomatis mengirim data penumpang baru, notifikasi akan
                  langsung muncul di sini secara otomatis.
                </span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`notif-card ${item.read ? "read" : "unread"}`}
                >
                  <div className="notif-card-top">
                    <span className="notif-source-pill">
                      WA OTOMATIS ({item.passengers.length} PAX)
                    </span>
                    <span className="notif-time">{timeLabel(item.createdAt)}</span>
                  </div>

                  <div className="notif-pax-list">
                    {item.passengers.map((pax) => (
                      <div key={pax.id} className="notif-pax-chip">
                        <span className="notif-seat-no">
                          #{String(pax.bookingNo).padStart(2, "0")}
                        </span>
                        <strong>{pax.name}</strong>
                        <span className={`notif-pax-type type-${pax.type}`}>
                          {paxTypeLabel(pax.type)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="notif-card-meta">
                    <span className="notif-route-tag">{item.route}</span>
                    <span>
                      {weekdayName(item.date)}, {dateLabel(item.date)}
                    </span>
                    {item.phone && item.phone !== "-" && (
                      <span className="notif-phone">WA: {item.phone}</span>
                    )}
                  </div>

                  <div className="notif-card-footer">
                    <button
                      type="button"
                      className="notif-jump-btn"
                      onClick={() => {
                        onSelectNotification(item);
                        setIsOpen(false);
                      }}
                    >
                      <span>Buka Jadwal & Manifes</span>
                      <ExternalLink />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingNotificationPopup({
  activePopup,
  onDismiss,
  onOpenSchedule,
}) {
  if (!activePopup) return null;

  return (
    <div
      className="notif-live-popup"
      role="status"
      aria-live="polite"
    >
      <div className="notif-live-glow" aria-hidden="true" />
      <div className="notif-live-header">
        <div className="notif-live-badge">
          <BellRing className="notif-live-icon" />
          <span>PESANAN BARU • WA OTOMATIS</span>
        </div>
        <button
          type="button"
          className="notif-live-close"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
        >
          <X />
        </button>
      </div>

      <div className="notif-live-body">
        <div className="notif-live-route-row">
          <span className="notif-route-tag">{activePopup.route}</span>
          <strong>
            {weekdayName(activePopup.date)}, {dateLabel(activePopup.date)}
          </strong>
        </div>

        <div className="notif-pax-list">
          {activePopup.passengers.map((pax) => (
            <div key={pax.id} className="notif-pax-chip">
              <span className="notif-seat-no">
                #{String(pax.bookingNo).padStart(2, "0")}
              </span>
              <strong>{pax.name}</strong>
              <span className={`notif-pax-type type-${pax.type}`}>
                {paxTypeLabel(pax.type)}
              </span>
            </div>
          ))}
        </div>

        {activePopup.phone && activePopup.phone !== "-" && (
          <div className="notif-live-phone">
            Kontak Pemesan: <strong>{activePopup.phone}</strong>
          </div>
        )}
      </div>

      <div className="notif-live-actions">
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={onDismiss}
        >
          Tutup
        </button>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          onClick={() => onOpenSchedule(activePopup)}
        >
          Lihat Manifes ({activePopup.passengers.length} PAX) →
        </button>
      </div>
    </div>
  );
}
