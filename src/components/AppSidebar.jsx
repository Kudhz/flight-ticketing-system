import { NAV_GROUPS } from "./navigation";

const NAV_ICONS = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </>
  ),
  passengers: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5v-1.25a5.5 5.5 0 0 1 11 0v1.25" />
      <path d="M16 5.2a3.25 3.25 0 0 1 0 6.3M17 14.5a4.75 4.75 0 0 1 3.5 4.6v.4" />
    </>
  ),
  flight: (
    <>
      <path d="m3.5 14.5 7.1-1.6 4.7 6.1 2-.4-2.6-6.7 4.7-1.1a2.1 2.1 0 0 0-.9-4.1l-5 .3-4.2-5.3-2 .4 2.2 5.6-4.5 2.7z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M8 13h2M14 13h2M8 16.5h2" />
    </>
  ),
  income: (
    <>
      <path d="M4 19.5h16M6.5 16v-4M11 16V7M15.5 16v-6M20 16V4.5" />
    </>
  ),
  currency: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.8c-.8-.8-1.9-1.2-3.2-1.2-1.7 0-2.9.9-2.9 2.1 0 3.1 5.6 1.3 5.6 4.6 0 1.4-1.3 2.3-3.1 2.3-1.4 0-2.6-.5-3.4-1.4M12 5.8v12.4" />
    </>
  ),
};

function AppSidebar({
  activePage,
  bookingCount,
  isFinanceAuthenticated,
  isFinanceSubmitting,
  onFinanceLogin,
  onFinanceLogout,
  onNavigate,
}) {
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.requiresFinanceAuth || isFinanceAuthenticated,
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </svg>
        </div>
        <div className="brand-copy">
          <div className="brand-title-row">
            <strong>LUPIN AIROPS</strong>
            <span className="brand-live-pill">LIVE</span>
          </div>
          <span className="brand-caption">MNA FLIGHT DISPATCH DECK</span>
        </div>
      </div>

      <div className="sidebar-station-card">
        <div className="station-card-item">
          <span className="station-label">STATION</span>
          <strong>MNA • Melonguane</strong>
        </div>
        <div className="station-card-divider" />
        <div className="station-card-item">
          <span className="station-label">FLEET</span>
          <strong>C208B • 12 PAX</strong>
        </div>
      </div>

      {visibleGroups.map((group) => (
        <nav className="nav-group" key={group.label} aria-label={group.label}>
          <div className="side-label">{group.label}</div>
          {group.items.map((item) => (
            <button
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              type="button"
              key={item.id}
              aria-current={activePage === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-glyph" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {NAV_ICONS[item.icon]}
                </svg>
              </span>
              <span className="nav-text">{item.label}</span>
              {item.countKey === "bookings" && (
                <span className="nav-count">{bookingCount}</span>
              )}
            </button>
          ))}
        </nav>
      ))}

      <div className="sidebar-bottom">
        <div className="help-box">
          <span className="help-icon" aria-hidden="true">
            ✈
          </span>
          <div>
            <strong>Jadwal Perintis</strong>
            <p>Operasional aktif setiap Senin, Rabu, dan Sabtu.</p>
          </div>
        </div>
        <button
          className={`sidebar-finance-action ${isFinanceAuthenticated ? "authenticated" : ""}`}
          type="button"
          onClick={isFinanceAuthenticated ? onFinanceLogout : onFinanceLogin}
          disabled={isFinanceSubmitting}
          title={
            isFinanceAuthenticated ? "Keluar dari Keuangan" : "Login Keuangan"
          }
          aria-label={
            isFinanceAuthenticated ? "Keluar dari Keuangan" : "Login Keuangan"
          }
        >
          <span className="sidebar-finance-icon" aria-hidden="true">
            {isFinanceAuthenticated ? "🔓" : "🔒"}
          </span>
          <span
            className="sidebar-finance-label"
            data-mobile-label={isFinanceAuthenticated ? "Keluar" : "Keuangan"}
          >
            {isFinanceAuthenticated ? "Keluar Keuangan" : "Portal Keuangan"}
          </span>
        </button>
      </div>
    </aside>
  );
}

export default AppSidebar;
