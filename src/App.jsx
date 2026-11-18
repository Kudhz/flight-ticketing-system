import { useEffect, useState } from "react";
import AppSidebar from "./components/AppSidebar";
import FlightScheduleTabs from "./components/FlightScheduleTabs";
import FlightDataPages from "./components/FlightDataPages";
import { NAV_ITEMS } from "./components/navigation";
import { BOOKINGS_ENDPOINT, FINANCE_AUTH_ENDPOINT } from "./apiConfig";
import "./App.css";

const BOOKING_LIMIT = 12;
const BOOKING_NUMBERS = Array.from(
  { length: BOOKING_LIMIT },
  (_, index) => index + 1,
);
const STATUSES = ["Menunggu verifikasi", "Booked", "Dibayar"];
const ROUTES = [
  {
    value: "MNA-IAX",
    origin: "Melonguane",
    originCode: "MNA",
    destination: "Miangas",
    destinationCode: "IAX",
    label: "Melonguane (MNA) - Miangas (IAX)",
  },
  {
    value: "MNA-MDC",
    origin: "Melonguane",
    originCode: "MNA",
    destination: "Manado",
    destinationCode: "MDC",
    label: "Melonguane (MNA) - Manado (MDC)",
  },
];
const DEFAULT_ROUTE = "MNA-MDC";
const FLIGHT_DAYS = new Set([1, 3, 6]);
const localDateISO = (date = new Date()) => {
  const today = date;
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const isFlightDate = (date) =>
  FLIGHT_DAYS.has(new Date(`${date}T00:00:00`).getDay());
const firstFlightDateInMonth = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  while (
    date.getMonth() === monthNumber - 1 &&
    !FLIGHT_DAYS.has(date.getDay())
  ) {
    date.setDate(date.getDate() + 1);
  }
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
};
const nearestFlightDateInMonth = (month) => {
  const today = localDateISO();
  const anchor = today.startsWith(`${month}-`) ? today : `${month}-01`;
  const anchorDate = new Date(`${anchor}T00:00:00`);

  for (let distance = 0; distance <= 3; distance += 1) {
    const offsets = distance === 0 ? [0] : [distance, -distance];
    for (const offset of offsets) {
      const candidate = new Date(anchorDate);
      candidate.setDate(anchorDate.getDate() + offset);
      if (
        localDateISO(candidate).startsWith(`${month}-`) &&
        FLIGHT_DAYS.has(candidate.getDay())
      ) {
        return localDateISO(candidate);
      }
    }
  }

  return firstFlightDateInMonth(month);
};
const DEFAULT_DATE = nearestFlightDateInMonth(localDateISO().slice(0, 7));
const flightDatesInMonth = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: dayCount }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  }).filter(isFlightDate);
};
const timeLabel = (timestamp) =>
  timestamp
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestamp))
    : "Waktu tidak tercatat";
const normalizePassengerName = (name) =>
  String(name || "")
    .trim()
    .toLocaleUpperCase("id-ID");
const FINANCE_PAGES = new Set(["flightDashboard", "flightIncome"]);

const apiRequest = async (path, options = {}) => {
  const headers = { ...options.headers };
  if (options.body) headers["Content-Type"] = "application/json";

  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  }
  return result;
};

const financeAuthUrl = (action) => `${FINANCE_AUTH_ENDPOINT}/${action}`;

const bookingsFromApiResponse = (result) => {
  const bookings = [
    result,
    result?.bookings,
    result?.data,
    result?.data?.bookings,
  ].find(Array.isArray);
  const bookingList = bookings || (result?.id !== undefined ? [result] : null);

  if (
    !bookingList ||
    bookingList.some(
      (booking) =>
        !booking || typeof booking !== "object" || booking.id === undefined,
    )
  ) {
    throw new Error(
      "Format respons API tidak memuat daftar pemesanan yang valid.",
    );
  }

  return bookingList;
};

const fetchBookings = async () => {
  const result = await apiRequest(BOOKINGS_ENDPOINT);
  return bookingsFromApiResponse(result);
};

const dateLabel = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
function App() {
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isRefreshingBookings, setIsRefreshingBookings] = useState(false);
  const [dataError, setDataError] = useState("");
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [activePage, setActivePage] = useState("overview");
  const [isFinanceAuthenticated, setIsFinanceAuthenticated] = useState(false);
  const [financeAuthConfigured, setFinanceAuthConfigured] = useState(null);
  const [pendingFinancePage, setPendingFinancePage] = useState(null);
  const [isFinanceLoginOpen, setIsFinanceLoginOpen] = useState(false);
  const [financeUsername, setFinanceUsername] = useState("");
  const [financePassword, setFinancePassword] = useState("");
  const [financeLoginError, setFinanceLoginError] = useState("");
  const [isFinanceSubmitting, setIsFinanceSubmitting] = useState(false);
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem("seatflow-theme-v2") || "dark",
  );
  const [selectedRoute, setSelectedRoute] = useState(DEFAULT_ROUTE);
  const [selectedDate, setSelectedDate] = useState(DEFAULT_DATE);
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_DATE.slice(0, 7));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    route: DEFAULT_ROUTE,
  });
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({
    passengers: [{ name: "", phone: "" }],
    route: DEFAULT_ROUTE,
    date: DEFAULT_DATE,
  });

  useEffect(() => {
    let isCurrent = true;

    async function loadBookings() {
      setIsLoadingBookings(true);
      setDataError("");
      try {
        const loadedBookings = await fetchBookings();
        if (isCurrent) setBookings(loadedBookings);
      } catch (error) {
        if (isCurrent) {
          setDataError(
            `${error.message} Pastikan MySQL dan API lokal sedang berjalan.`,
          );
        }
      } finally {
        if (isCurrent) setIsLoadingBookings(false);
      }
    }

    loadBookings();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function checkFinanceSession() {
      try {
        const result = await apiRequest(financeAuthUrl("session"));
        if (!isCurrent) return;
        setFinanceAuthConfigured(result.configured === true);
        setIsFinanceAuthenticated(result.authenticated === true);
      } catch (error) {
        if (isCurrent) setFinanceLoginError(error.message);
      }
    }

    checkFinanceSession();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("seatflow-theme-v2", theme);
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", theme === "dark" ? "#0c0b09" : "#f5f7f6");
  }, [theme]);

  const routeInfo = ROUTES.find((route) => route.value === selectedRoute);
  const flightDates = flightDatesInMonth(selectedMonth);
  const pageTitles = Object.fromEntries(
    NAV_ITEMS.map((item) => [item.id, item.label]),
  );
  const isFlightDataPage = activePage.startsWith("flight");
  const currentBookings = bookings.filter(
    (booking) =>
      booking.route === selectedRoute && booking.date === selectedDate,
  );
  const bookingCountsByDate = bookings.reduce((counts, booking) => {
    if (
      booking.route === selectedRoute &&
      booking.date?.startsWith(`${selectedMonth}-`)
    ) {
      counts[booking.date] = (counts[booking.date] || 0) + 1;
    }
    return counts;
  }, {});
  const today = localDateISO();
  const bookingDateEntries = Object.entries(bookingCountsByDate);
  const todayBookingEntries = bookingDateEntries.filter(
    ([date]) => date === today,
  );
  const futureBookingEntries = bookingDateEntries
    .filter(([date]) => date > today)
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate));
  const pastBookingEntries = bookingDateEntries
    .filter(([date]) => date < today)
    .sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate));
  const futureBookingLimit = todayBookingEntries.length ? 5 : 6;
  const visibleFutureBookingEntries = futureBookingEntries.slice(
    0,
    futureBookingLimit,
  );
  const remainingPastBookingSlots = Math.max(
    0,
    6 - todayBookingEntries.length - visibleFutureBookingEntries.length,
  );
  const dashboardBookingEntries = [
    ...todayBookingEntries,
    ...visibleFutureBookingEntries,
    ...pastBookingEntries.slice(0, remainingPastBookingSlots),
  ].sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate));
  const formManifest = bookings.filter(
    (booking) => booking.route === form.route && booking.date === form.date,
  );
  const formUsedNumbers = new Set(
    formManifest.map((booking) => booking.bookingNo),
  );
  const availableBookingNumbers = BOOKING_NUMBERS.filter(
    (number) => !formUsedNumbers.has(number),
  );
  const formBookingNumbers = availableBookingNumbers.slice(
    0,
    form.passengers.length,
  );
  const filteredBookings = currentBookings
    .filter((booking) => {
      const matchesSearch =
        `${booking.name} ${booking.phone} ${booking.route} ${booking.bookingNo}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesFilter = filter === "Semua" || booking.status === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((first, second) => {
      const firstDate = first.bookingDate || first.createdAt || "";
      const secondDate = second.bookingDate || second.createdAt || "";
      return (
        secondDate.localeCompare(firstDate) ||
        (second.bookingAt || "").localeCompare(first.bookingAt || "") ||
        Number(second.id) - Number(first.id)
      );
    });
  function showMessage(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function navigateToPage(page) {
    if (FINANCE_PAGES.has(page)) {
      setPendingFinancePage(page);
      setFinanceLoginError("");
      try {
        const result = await apiRequest(financeAuthUrl("session"));
        setFinanceAuthConfigured(result.configured === true);
        setIsFinanceAuthenticated(result.authenticated === true);
        if (result.authenticated === true) {
          setActivePage(page);
          setPendingFinancePage(null);
          return;
        }
        if (FINANCE_PAGES.has(activePage)) setActivePage("overview");
        if (result.configured !== true) {
          setFinanceLoginError(
            "Akun Keuangan belum dikonfigurasi di server.",
          );
        }
      } catch (error) {
        setFinanceLoginError(error.message);
      }
      setIsFinanceLoginOpen(true);
      return;
    }
    setActivePage(page);
  }

  async function loginFinance(event) {
    event.preventDefault();
    setIsFinanceSubmitting(true);
    setFinanceLoginError("");
    try {
      const result = await apiRequest(financeAuthUrl("login"), {
        method: "POST",
        body: JSON.stringify({
          username: financeUsername.trim(),
          password: financePassword,
        }),
      });
      setIsFinanceAuthenticated(result.authenticated === true);
      setFinanceAuthConfigured(true);
      setFinancePassword("");
      setIsFinanceLoginOpen(false);
      setActivePage(pendingFinancePage || "flightDashboard");
      setPendingFinancePage(null);
    } catch (error) {
      setFinanceLoginError(error.message);
    } finally {
      setIsFinanceSubmitting(false);
    }
  }

  async function logoutFinance() {
    setIsFinanceSubmitting(true);
    setFinanceLoginError("");
    try {
      await apiRequest(financeAuthUrl("logout"), {
        method: "POST",
        body: JSON.stringify({}),
      });
      setIsFinanceAuthenticated(false);
      setPendingFinancePage(null);
      setIsFinanceLoginOpen(false);
      if (FINANCE_PAGES.has(activePage)) setActivePage("overview");
      showMessage("Anda telah keluar dari Keuangan.");
    } catch (error) {
      setFinanceLoginError(error.message);
      setIsFinanceLoginOpen(true);
    } finally {
      setIsFinanceSubmitting(false);
    }
  }

  async function refreshBookings() {
    setIsRefreshingBookings(true);
    setDataError("");
    try {
      const loadedBookings = await fetchBookings();
      setBookings(loadedBookings);
      showMessage("Daftar penumpang berhasil diperbarui.");
    } catch (error) {
      setDataError(error.message);
    } finally {
      setIsRefreshingBookings(false);
    }
  }

  function openBookingForm() {
    setForm((current) => ({
      ...current,
      route: selectedRoute,
      date: selectedDate,
    }));
    setShowForm(true);
  }

  async function addBooking(event) {
    event.preventDefault();
    const formCurrentManifest = bookings.filter(
      (booking) => booking.route === form.route && booking.date === form.date,
    );
    const usedNumbers = new Set(
      formCurrentManifest.map((booking) => booking.bookingNo),
    );
    const availableNumbers = BOOKING_NUMBERS.filter(
      (number) => !usedNumbers.has(number),
    );
    const passengers = form.passengers.map((passenger) => ({
      name: normalizePassengerName(passenger.name),
      phone: passenger.phone.trim(),
    }));

    if (!isFlightDate(form.date)) {
      showMessage("Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.");
      return;
    }
    if (passengers.some((passenger) => !passenger.name || !passenger.phone)) {
      showMessage("Lengkapi nama dan nomor WhatsApp setiap penumpang.");
      return;
    }
    if (passengers.length > availableNumbers.length) {
      showMessage(
        `Kuota tersisa hanya ${availableNumbers.length} penumpang untuk jadwal ini.`,
      );
      return;
    }

    setIsSavingBooking(true);
    setDataError("");
    try {
      const booking = await apiRequest(BOOKINGS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          passengers,
          route: form.route,
          date: form.date,
        }),
      });
      const createdBookings = bookingsFromApiResponse(booking);
      if (createdBookings.length !== passengers.length) {
        throw new Error(
          "Respons API tidak memuat data lengkap untuk semua penumpang.",
        );
      }

      setBookings((current) => [...createdBookings, ...current]);
      setShowForm(false);
      setForm((current) => ({
        ...current,
        passengers: [{ name: "", phone: "" }],
      }));
      showMessage(
        `${createdBookings.length} data penumpang tersimpan ke MySQL.`,
      );
    } catch (error) {
      setDataError(error.message);
    } finally {
      setIsSavingBooking(false);
    }
  }

  async function updateStatus(id, status) {
    setDataError("");
    try {
      const updatedBooking = await apiRequest(`${BOOKINGS_ENDPOINT}?id=${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setBookings((current) =>
        current.map((booking) =>
          booking.id === id ? updatedBooking : booking,
        ),
      );
    } catch (error) {
      setDataError(error.message);
    }
  }

  function openEditForm(booking) {
    setEditingBooking(booking);
    setEditForm({
      name: booking.name,
      phone: booking.phone,
      route: booking.route,
    });
  }

  async function saveBookingChanges(event) {
    event.preventDefault();
    if (!editingBooking) return;

    const name = normalizePassengerName(editForm.name);
    const phone = editForm.phone.trim();
    if (!name || !phone) {
      showMessage("Nama dan nomor WhatsApp wajib diisi.");
      return;
    }

    setIsUpdatingBooking(true);
    setDataError("");
    try {
      const updatedBooking = await apiRequest(
        `${BOOKINGS_ENDPOINT}?id=${editingBooking.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            phone,
            route: editForm.route,
          }),
        },
      );
      setBookings((current) =>
        current.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking,
        ),
      );
      setEditingBooking(null);
      showMessage("Data penumpang berhasil diperbarui.");
    } catch (error) {
      setDataError(error.message);
    } finally {
      setIsUpdatingBooking(false);
    }
  }

  async function deleteBooking(id) {
    setDataError("");
    try {
      await apiRequest(`${BOOKINGS_ENDPOINT}?id=${id}`, { method: "DELETE" });
      setBookings((current) => current.filter((booking) => booking.id !== id));
      showMessage("Data pemesanan dihapus dari MySQL.");
    } catch (error) {
      setDataError(error.message);
    }
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <AppSidebar
        activePage={activePage}
        bookingCount={bookings.length}
        isFinanceAuthenticated={isFinanceAuthenticated}
        isFinanceSubmitting={isFinanceSubmitting}
        onFinanceLogin={() => navigateToPage("flightDashboard")}
        onFinanceLogout={logoutFinance}
        onNavigate={navigateToPage}
      />

      <main className="main-content">
        <header className="topbar">
          <span className="mobile-brand-mark" aria-label="Lupin Portal">
            L
          </span>
          <div className="breadcrumb">
            <span className="breadcrumb-context">
              {isFlightDataPage ? "Flight Data" : "Ticketing Data"}
            </span>
            <span className="breadcrumb-separator">/</span>
            <strong>{pageTitles[activePage]}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-dot"></span>
            <span>Semua perubahan tersimpan</span>
            <span className="topbar-divider"></span>
            <span className="today-label">{dateLabel(localDateISO())}</span>
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Aktifkan mode ${theme === "light" ? "gelap" : "terang"}`}
              title={`Aktifkan mode ${theme === "light" ? "gelap" : "terang"}`}
            >
              <span aria-hidden="true">{theme === "light" ? "☾" : "☼"}</span>
              <span className="theme-toggle-label">
                {theme === "light" ? "Gelap" : "Terang"}
              </span>
            </button>
          </div>
        </header>

        {isFlightDataPage && (
          <div className="page-content flight-data-content">
            <section className="page-heading">
              <div>
                <div className="eyebrow">FLIGHT DATA</div>
                <h1>{pageTitles[activePage]}</h1>
                <p>
                  {activePage === "flightDashboard" &&
                    "Ringkasan penerbangan bulan ini serta fee tiket dan GH empat bulan terakhir."}
                  {activePage === "flightHistory" &&
                    "Tinjau data dan ringkasan penerbangan dari API Flight Data."}
                  {activePage === "flightIncome" &&
                    "Rincian fee tiket, penghasilan GH, dan total penghasilan dari API Flight Data."}
                </p>
              </div>
            </section>
            <FlightDataPages
              page={
                activePage === "flightDashboard"
                  ? "dashboard"
                  : activePage === "flightHistory"
                    ? "history"
                    : "income"
              }
            />
          </div>
        )}
        <div className="page-content" hidden={isFlightDataPage}>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                FLIGHT OPERATIONS <span>•</span> {routeInfo.value}
              </div>
              <h1>{pageTitles[activePage]}</h1>
              <p>
                {activePage === "overview" &&
                  "Pantau kuota dan status pemesanan."}
                {activePage === "bookings" &&
                  "Kelola data penumpang untuk manifest penerbangan."}
              </p>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={openBookingForm}
            >
              <span>+</span> Tambah pemesanan
            </button>
          </section>

          {dataError && (
            <div className="api-error" role="alert">
              <strong>Data belum tersinkron</strong>
              <span>{dataError}</span>
            </div>
          )}

          <FlightScheduleTabs
            key={selectedMonth}
            dates={flightDates}
            bookingCounts={bookingCountsByDate}
            selectedMonth={selectedMonth}
            selectedDate={selectedDate}
            routes={ROUTES}
            selectedRoute={selectedRoute}
            onRouteChange={setSelectedRoute}
            onMonthChange={(monthNumber) => {
              const month = `${selectedMonth.slice(0, 4)}-${monthNumber}`;
              setSelectedMonth(month);
              setSelectedDate(nearestFlightDateInMonth(month));
            }}
            onYearChange={(year) => {
              const month = `${year}-${selectedMonth.slice(5, 7)}`;
              setSelectedMonth(month);
              setSelectedDate(nearestFlightDateInMonth(month));
            }}
            onDateChange={setSelectedDate}
          />

          <section
            className={`flight-banner ${activePage === "bookings" ? "bookings-flight-banner" : ""}`}
            aria-label="Informasi penerbangan"
          >
            <div className="flight-route">
              <div className="flight-path">
                <div className="airport">
                  <span className="airport-code">{routeInfo.originCode}</span>
                  <span>{routeInfo.origin}</span>
                </div>
                <div className="flight-line">
                  <span className="plane-mark">✈</span>
                </div>
                <div className="airport destination">
                  <span className="airport-code">
                    {routeInfo.destinationCode}
                  </span>
                  <span>{routeInfo.destination}</span>
                </div>
              </div>
            </div>
            <div className="flight-capacity">
              <div className="capacity-summary">
                <span className="capacity-label">KAPASITAS TERISI</span>
                <div className="capacity-totals">
                  <strong>{currentBookings.length}</strong>
                  <span>
                    <b>terisi</b>
                    <small>
                      {Math.max(BOOKING_LIMIT - currentBookings.length, 0)} dari{" "}
                      {BOOKING_LIMIT} tersedia
                    </small>
                  </span>
                </div>
              </div>
              <div
                className="capacity-seats"
                role="img"
                aria-label={`${currentBookings.length} kursi terisi, ${Math.max(BOOKING_LIMIT - currentBookings.length, 0)} kursi tersedia dari ${BOOKING_LIMIT}`}
              >
                {BOOKING_NUMBERS.map((number) => (
                  <span
                    key={number}
                    className={`capacity-seat ${number <= currentBookings.length ? "occupied" : ""}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </section>

          {activePage === "overview" && (
            <section
              className="metrics-grid"
              aria-label="Tanggal dengan pemesanan"
            >
              {dashboardBookingEntries.map(([date, count]) => (
                <button
                  type="button"
                  className={`metric-card date-metric-card ${date === selectedDate ? "selected" : ""}`}
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={date === selectedDate}
                  aria-label={`${dateLabel(date)}, ${count} pemesanan. Pilih tanggal`}
                >
                  <div className="metric-top">
                    <span>TANGGAL PENERBANGAN</span>
                    <span className="metric-symbol teal" aria-hidden="true">▦</span>
                  </div>
                  <strong className="date-metric-value">{dateLabel(date)}</strong>
                  <div className="metric-foot">
                    <span className="status-dot green-dot"></span>
                    <span>{count} pemesanan terisi</span>
                  </div>
                  <span className="metric-action">
                    Lihat jadwal <span aria-hidden="true">→</span>
                  </span>
                </button>
              ))}
              {dashboardBookingEntries.length === 0 && (
                <div className="date-metrics-empty">
                  <span className="status-dot"></span>
                  Belum ada tanggal dengan pemesanan untuk rute dan bulan ini.
                </div>
              )}
            </section>
          )}

          {activePage === "bookings" && (
            <section className="bookings-panel">
              <div className="table-heading">
                <div>
                  <span className="section-kicker">
                    MANIFEST {routeInfo.value} ·{" "}
                    {dateLabel(selectedDate).toUpperCase()}
                  </span>
                  <h2>
                    Daftar penumpang{" "}
                    <span className="table-total">
                      {currentBookings.length}
                    </span>
                  </h2>
                </div>
                <div className="table-heading-actions">
                  <button
                    type="button"
                    className="secondary-button refresh-button"
                    onClick={refreshBookings}
                    disabled={isLoadingBookings || isRefreshingBookings}
                    aria-label="Muat ulang daftar penumpang"
                    title="Muat ulang daftar penumpang"
                  >
                    <svg
                      className={isRefreshingBookings ? "spinning" : ""}
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 7v5h-5" />
                      <path d="M4.9 9A7.5 7.5 0 0 1 18 6.2L20 12M4 17v-5h5" />
                      <path d="M19.1 15A7.5 7.5 0 0 1 6 17.8L4 12" />
                    </svg>
                    {isRefreshingBookings ? "Memuat..." : "Refresh"}
                  </button>
                </div>
              </div>
              <div className="table-toolbar">
                <div className="filter-tabs">
                  {["Semua", ...STATUSES].map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={`filter-tab ${filter === status ? "selected" : ""}`}
                      onClick={() => setFilter(status)}
                    >
                      {status === "Menunggu verifikasi" ? "Menunggu" : status}
                      {status === "Semua" && (
                        <span>{currentBookings.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <span>⌕</span>
                  <input
                    aria-label="Cari penumpang"
                    placeholder="Cari penumpang..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <kbd>⌘ K</kbd>
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>PENUMPANG</th>
                      <th>KONTAK</th>
                      <th>STATUS WORKFLOW</th>
                      <th>TANGGAL PEMESANAN</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="ordinal-column">
                          <span className="booking-number-pill">
                            {String(booking.bookingNo).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="passenger-column">
                          <div className="passenger-cell">
                            <div>
                              <strong>{booking.name}</strong>
                              <span>{booking.route}</span>
                            </div>
                          </div>
                        </td>
                        <td className="phone-cell contact-column">
                          {booking.phone}
                        </td>
                        <td className="status-column">
                          <label
                            className={`status-select status-${booking.status === STATUSES[0] ? "waiting" : booking.status === STATUSES[1] ? "verified" : "issued"}`}
                          >
                            <span className="status-dot"></span>
                            <select
                              aria-label={`Status ${booking.name}`}
                              value={booking.status}
                              onChange={(event) =>
                                updateStatus(booking.id, event.target.value)
                              }
                            >
                              {STATUSES.map((status) => (
                                <option key={status}>{status}</option>
                              ))}
                            </select>
                            <span className="select-chevron">⌄</span>
                          </label>
                        </td>
                        <td className="date-cell booking-date-column">
                          <span>
                            {dateLabel(
                              booking.bookingDate || booking.createdAt,
                            )}
                          </span>
                          <small>{timeLabel(booking.bookingAt)}</small>
                        </td>
                        <td className="action-column">
                          <button
                            className="edit-button"
                            type="button"
                            title={`Edit data ${booking.name}`}
                            aria-label={`Edit data ${booking.name}`}
                            onClick={() => openEditForm(booking)}
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
                            className="delete-button"
                            type="button"
                            title={`Hapus data ${booking.name}`}
                            aria-label={`Hapus data ${booking.name}`}
                            onClick={() => deleteBooking(booking.id)}
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
                        </td>
                      </tr>
                    ))}
                    {filteredBookings.length === 0 && (
                      <tr className="empty-row">
                        <td className="empty-state" colSpan="6">
                          <strong>
                            {isLoadingBookings
                              ? "Memuat data dari MySQL..."
                              : "Belum ada data yang cocok"}
                          </strong>
                          <span>
                            {isLoadingBookings
                              ? "Manifest penerbangan sedang dimuat."
                              : "Coba ubah pencarian atau filter status."}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="table-footer">
                <span>
                  Menampilkan <strong>{filteredBookings.length}</strong> dari{" "}
                  <strong>{currentBookings.length}</strong> pemesanan
                </span>
                <div className="booking-number-legend">
                  <span>
                    <i className="legend-dot available"></i>Nomor tersedia
                  </span>
                  <span>
                    <i className="legend-dot occupied"></i>Nomor digunakan
                  </span>
                </div>
              </footer>
            </section>
          )}

        </div>
      </main>

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowForm(false);
          }}
        >
          <section
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
          >
            <div className="modal-heading">
              <div>
                <span className="section-kicker">PEMESANAN BARU</span>
                <h2 id="form-title">Tambah penumpang</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowForm(false)}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <p className="modal-description">
              Tambahkan satu atau beberapa penumpang. Waktu pemesanan dicatat
              otomatis saat data disimpan.
            </p>
            <form onSubmit={addBooking}>
              <div className="passenger-list">
                {form.passengers.map((passenger, index) => (
                  <fieldset className="passenger-form-card" key={index}>
                    <legend>Penumpang {index + 1}</legend>
                    <label>
                      Nama lengkap
                      <input
                        className="passenger-name-input"
                        required
                        autoFocus={index === 0}
                        placeholder="Sesuai kartu identitas"
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
                      />
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
                <button
                  type="button"
                  className="add-passenger-button"
                  disabled={
                    form.passengers.length >= availableBookingNumbers.length
                  }
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      passengers: [
                        ...current.passengers,
                        { name: "", phone: "" },
                      ],
                    }))
                  }
                >
                  + Tambah penumpang
                </button>
                <span className="passenger-capacity-hint">
                  Kuota tersedia: {availableBookingNumbers.length} penumpang
                </span>
              </div>
              <label>
                Rute penerbangan
                <select
                  required
                  value={form.route}
                  onChange={(event) =>
                    setForm({ ...form, route: event.target.value })
                  }
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
                <span className="field-hint">Jadwal: Senin, Rabu, Sabtu</span>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(event) => {
                    const date = event.target.value;
                    if (isFlightDate(date)) {
                      setForm({ ...form, date });
                    } else if (date) {
                      showMessage(
                        "Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.",
                      );
                    }
                  }}
                />
              </label>
              <div className="booking-number-preview">
                <span>Nomor urut otomatis</span>
                <strong>
                  {formBookingNumbers.length === form.passengers.length
                    ? formBookingNumbers
                        .map((number) => String(number).padStart(2, "0"))
                        .join(", ")
                    : "Kuota tidak cukup"}
                </strong>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowForm(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    formBookingNumbers.length !== form.passengers.length ||
                    isLoadingBookings ||
                    isSavingBooking
                  }
                >
                  {isSavingBooking ? "Menyimpan..." : "Simpan pemesanan"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {editingBooking && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingBooking(null);
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
                <span className="section-kicker">EDIT DATA</span>
                <h2 id="edit-form-title">Edit penumpang</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setEditingBooking(null)}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <p className="modal-description">
              Nomor urut dan tanggal terbang tetap. Jika pindah rute, nomor urut
              disesuaikan bila nomor saat ini sudah dipakai.
            </p>
            <form onSubmit={saveBookingChanges}>
              <label>
                Nama lengkap
                <input
                  required
                  autoFocus
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Nomor WhatsApp
                <input
                  required
                  type="tel"
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
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
                  className="secondary-button"
                  onClick={() => setEditingBooking(null)}
                  disabled={isUpdatingBooking}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isUpdatingBooking}
                >
                  {isUpdatingBooking ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isFinanceLoginOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isFinanceSubmitting) {
              setIsFinanceLoginOpen(false);
              setPendingFinancePage(null);
              setFinancePassword("");
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
                <span className="section-kicker">AREA TERBATAS</span>
                <h2 id="finance-login-title">Masuk ke Keuangan</h2>
              </div>
              <button
                className="close-button"
                type="button"
                onClick={() => {
                  setIsFinanceLoginOpen(false);
                  setPendingFinancePage(null);
                  setFinancePassword("");
                }}
                disabled={isFinanceSubmitting}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <p className="modal-description">
              Masuk dengan akun yang diizinkan untuk membuka data penghasilan.
            </p>
            {financeAuthConfigured === false && (
              <div className="finance-auth-notice" role="status">
                Login Keuangan belum dikonfigurasi. Isi
                FINANCE_USERNAME dan FINANCE_PASSWORD pada file .env server.
              </div>
            )}
            {financeLoginError && (
              <div className="finance-auth-error" role="alert">
                {financeLoginError}
              </div>
            )}
            <form onSubmit={loginFinance}>
              <label>
                Username
                <input
                  required
                  autoComplete="username"
                  value={financeUsername}
                  onChange={(event) => setFinanceUsername(event.target.value)}
                  disabled={isFinanceSubmitting}
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
                />
              </label>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setIsFinanceLoginOpen(false);
                    setPendingFinancePage(null);
                    setFinancePassword("");
                  }}
                  disabled={isFinanceSubmitting}
                >
                  Batal
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isFinanceSubmitting}
                >
                  {isFinanceSubmitting ? "Memeriksa..." : "Masuk"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast-message">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
