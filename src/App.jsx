import { useEffect, useState } from "react";
import { PlaneTakeoff, RefreshCw } from "lucide-react";
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
const isOccupiedSeat = (booking) => booking.type !== "infant";
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
    passengers: [{ name: "", phone: "", type: "adult" }],
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
      .setAttribute("content", theme === "dark" ? "#0c1925" : "#f1f5f8");
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
  // Infant tidak memakai kursi; anak dan dewasa dihitung terisi.
  const occupiedSeats = currentBookings.filter(isOccupiedSeat).length;
  const bookingCountsByDate = bookings.reduce((counts, booking) => {
    if (
      booking.route === selectedRoute &&
      booking.date?.startsWith(`${selectedMonth}-`) &&
      isOccupiedSeat(booking)
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
          setFinanceLoginError("Akun Keuangan belum dikonfigurasi di server.");
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
      type: passenger.type || "adult",
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
        passengers: [{ name: "", phone: "", type: "adult" }],
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
      type: booking.type || "adult",
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
            type: editForm.type,
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

      <main className="app-main">
        <header className="app-topbar">
          <span className="mobile-brand-mark" aria-label="Lupin Portal">
            L
          </span>
          <div className="topbar-breadcrumb">
            <span className="topbar-label">
              {isFlightDataPage ? "Data Penerbangan" : "Data Reservasi"}
            </span>
            <span className="sep">/</span>
            <strong className="topbar-title">{pageTitles[activePage]}</strong>
          </div>
          <div className="topbar-status">
            <span className="topbar-dot"></span>
            <span className="topbar-text">Semua perubahan tersimpan</span>
            <span className="topbar-divider"></span>
            <span className="topbar-date">{dateLabel(localDateISO())}</span>
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Aktifkan mode ${theme === "light" ? "gelap" : "terang"}`}
              title={`Aktifkan mode ${theme === "light" ? "gelap" : "terang"}`}
            >
              <span aria-hidden="true" className="theme-toggle-icon">{theme === "light" ? "☾" : "☼"}</span>
              <span className="theme-toggle-label">
                {theme === "light" ? "Gelap" : "Terang"}
              </span>
            </button>
          </div>
        </header>

        {isFlightDataPage && (
          <div className="flex flex-col gap-24">
            <section className="section-header">
              <div className="section-eyebrow">DATA PENERBANGAN</div>
              <h1 className="section-title">{pageTitles[activePage]}</h1>
              <p className="section-subtitle">
                {activePage === "flightDashboard" &&
                  "Ringkasan penerbangan bulan ini serta fee tiket dan GH empat bulan terakhir."}
                {activePage === "flightHistory" &&
                  "Tinjau data dan ringkasan penerbangan dari layanan data penerbangan."}
                {activePage === "flightIncome" &&
                  "Rincian fee tiket, penghasilan GH, dan total penghasilan dari layanan data penerbangan."}
              </p>
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
        <div className={isFlightDataPage ? "hidden" : ""}>
          <div className="ticketing-page-heading">
            <section className="section-header">
              <div className="section-eyebrow">
                OPERASIONAL PENERBANGAN <span className="section-divider">•</span>{" "}
                {routeInfo.value}
              </div>
              <h1 className="section-title">{pageTitles[activePage]}</h1>
              <p className="section-subtitle">
                {activePage === "overview" &&
                  "Pantau kuota dan status pemesanan."}
                {activePage === "bookings" &&
                  "Kelola data penumpang untuk manifest penerbangan."}
              </p>
            </section>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openBookingForm}
            >
              <span>+</span> Tambah pemesanan
            </button>
          </div>

          {activePage === "overview" && (
            <section className="metric-grid" aria-label="Ringkasan pemesanan">
              <div className="metric-card card-hover">
                <div className="metric-card-header">
                  <span className="metric-label">
                    <span className="metric-label-full">Total Pemesanan</span>
                    <span className="metric-label-compact">Total</span>
                  </span>
                  <span className="metric-icon bg-teal-light text-teal-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9.5V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5Z" /><path d="M12 6.5v11" strokeDasharray="2 3" /></svg></span>
                </div>
                <strong className="metric-value">{currentBookings.length}</strong>
                <div className="metric-footer">
                  <span className="metric-dot bg-blue-500"></span>
                  <span>{BOOKING_LIMIT} kuota rute ini</span>
                </div>
              </div>
              <div className="metric-card card-hover">
                <div className="metric-card-header">
                  <span className="metric-label">
                    <span className="metric-label-full">Kursi Terisi</span>
                    <span className="metric-label-compact">Kursi</span>
                  </span>
                  <span className="metric-icon bg-teal-light text-teal-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5a2 2 0 0 1 2 2v6h7.5a2.5 2.5 0 0 1 2.5 2.5V19" /><path d="M5 19h13" /><path d="M17 8.5h1.5a1.5 1.5 0 0 1 1.5 1.5v2" /></svg></span>
                </div>
                <strong className="metric-value">{occupiedSeats}</strong>
                <div className="metric-footer">
                  <span className="metric-dot bg-green-500"></span>
                  <span>{Math.max(BOOKING_LIMIT - occupiedSeats, 0)} tersedia</span>
                </div>
              </div>
              <div className="metric-card card-hover">
                <div className="metric-card-header">
                  <span className="metric-label">
                    <span className="metric-label-full">Menunggu Verifikasi</span>
                    <span className="metric-label-compact">Menunggu</span>
                  </span>
                  <span className="metric-icon bg-amber-light text-amber-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg></span>
                </div>
                <strong className="metric-value">{currentBookings.filter(
                  (b) => b.status === STATUSES[0],
                ).length}</strong>
                <div className="metric-footer">
                  <span className="metric-dot bg-amber-600"></span>
                  <span>belum diverifikasi</span>
                </div>
              </div>
              <div className="metric-card card-hover">
                <div className="metric-card-header">
                  <span className="metric-label">
                    <span className="metric-label-full">Sudah Dibayar</span>
                    <span className="metric-label-compact">Dibayar</span>
                  </span>
                  <span className="metric-icon bg-green-light text-green-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-4.9" /></svg></span>
                </div>
                <strong className="metric-value">{currentBookings.filter(
                  (b) => b.status === STATUSES[2],
                ).length}</strong>
                <div className="metric-footer">
                  <span className="metric-dot bg-green-500"></span>
                  <span>status lunas</span>
                </div>
              </div>
            </section>
          )}

          {dataError && (
            <div className="alert alert-error" role="alert">
              <strong>Data belum tersinkron</strong>
              <span>{dataError}</span>
            </div>
          )}

          <section className="flight-banner" aria-label="Informasi penerbangan">
            <div className="flight-legs">
              <div className="flight-leg">
                <span className="flight-code">{routeInfo.originCode}</span>
                <span className="flight-city">{routeInfo.origin}</span>
              </div>
              <div className="flight-plane">
                <PlaneTakeoff aria-hidden="true" strokeWidth={1.8} />
              </div>
              <div className="flight-leg">
                <span className="flight-code">{routeInfo.destinationCode}</span>
                <span className="flight-city">{routeInfo.destination}</span>
              </div>
            </div>
            <div className="flight-capacity">
              <div className="capacity-summary">
                <div className="capacity-total">
                  <span className="capacity-label">KAPASITAS TERPAKAI</span>
                  <div className="capacity-total-value">
                    <strong>{occupiedSeats}</strong>
                    <span>kursi terisi</span>
                  </div>
                </div>
                <div className="capacity-available">
                  <strong>
                    {Math.max(BOOKING_LIMIT - occupiedSeats, 0)} / {BOOKING_LIMIT}
                  </strong>
                  <span>KURSI TERSEDIA</span>
                </div>
              </div>
              <div
                className="capacity-seats"
                role="img"
                aria-label={`${occupiedSeats} kursi terisi, ${Math.max(BOOKING_LIMIT - occupiedSeats, 0)} kursi tersedia dari ${BOOKING_LIMIT}`}
              >
                {BOOKING_NUMBERS.map((number) => (
                  <span
                    key={number}
                    className={`seat ${number <= occupiedSeats ? "seat-occupied" : "seat-free"}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </section>

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

          {activePage === "overview" && (
            <section className="date-grid" aria-label="Tanggal dengan pemesanan">
              {dashboardBookingEntries.map(([date, count]) => (
                <button
                  type="button"
                  className={`date-card ${date === selectedDate ? "date-card-selected" : ""}`}
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                    setActivePage("bookings");
                  }}
                  aria-pressed={date === selectedDate}
                  aria-label={`${dateLabel(date)}, ${count} pemesanan. Pilih tanggal`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <span className="date-card-label">TANGGAL PENERBANGAN</span>
                    <span className="date-card-icon" aria-hidden="true">
                      ▦
                    </span>
                  </div>
                  <strong className="date-card-value">{dateLabel(date)}</strong>
                  <div className="date-card-footer">
                    <span className="date-card-dot" aria-hidden="true"></span>
                    <span>{count} pemesanan terisi</span>
                  </div>
                  <span className="date-card-arrow">
                    Lihat jadwal <span aria-hidden="true">→</span>
                  </span>
                </button>
              ))}
              {dashboardBookingEntries.length === 0 && (
                <div className="date-empty">
                  <span className="date-empty-dot" aria-hidden="true"></span>
                  Belum ada tanggal dengan pemesanan untuk rute dan bulan ini.
                </div>
              )}
            </section>
          )}

          {activePage === "bookings" && (
            <section className="bookings-section">
              <div className="manifest-heading-row">
                <section className="section-header">
                  <div className="section-eyebrow">
                    MANIFEST {routeInfo.value} · {dateLabel(selectedDate).toUpperCase()}
                  </div>
                  <h2 className="section-title">
                    Daftar penumpang <span className="table-total text-sm font-semibold text-teal-dark">{currentBookings.length}</span>
                  </h2>
                </section>
                <button
                  type="button"
                  className="secondary-button refresh-button"
                  onClick={refreshBookings}
                  disabled={isLoadingBookings || isRefreshingBookings}
                  aria-label="Refresh daftar penumpang"
                  title="Refresh daftar penumpang"
                >
                  <RefreshCw
                    className={isRefreshingBookings ? "spinning" : ""}
                    aria-hidden="true"
                    strokeWidth={1.9}
                  />
                  {isRefreshingBookings ? "Memuat..." : "Refresh"}
                </button>
              </div>
              <div className="table-toolbar">
                <div className="flex gap-2 flex-wrap">
                  {["Semua", ...STATUSES].map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={`filter-btn ${filter === status ? "active" : ""}`}
                      onClick={() => setFilter(status)}
                    >
                      {status === "Menunggu verifikasi"
                        ? "Menunggu"
                        : status === "Booked"
                          ? "Dipesan"
                          : status}
                      {status === "Semua" && (
                        <span>{currentBookings.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <span className="search-icon">⌕</span>
                  <input
                    aria-label="Cari penumpang"
                    placeholder="Cari penumpang..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="search-input"
                  />
                  <span className="search-shortcut">⌘ K</span>
                </label>
              </div>
              <div className="table-wrap">
                <table className="table w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>PENUMPANG</th>
                      <th>KONTAK</th>
                      <th>STATUS PEMESANAN</th>
                      <th>TANGGAL PEMESANAN</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td data-label="No. pemesanan">
                          <span className="booking-number-pill">
                            {String(booking.bookingNo).padStart(2, "0")}
                          </span>
                        </td>
                        <td data-label="Penumpang">
                          <div className="flex flex-col gap-2">
                            <div>
                              <strong className="text-base font-semibold text-ink">
                                {booking.name}
                                {booking.type === "child" && (
                                  <span className="passenger-badge passenger-badge-child">
                                    (Anak-anak)
                                  </span>
                                )}
                                {booking.type === "infant" && (
                                  <span className="passenger-badge passenger-badge-infant">
                                    (INF)
                                  </span>
                                )}
                              </strong>
                              <span className="text-xs text-muted">{booking.route}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Kontak">
                          <span>{booking.phone}</span>
                        </td>
                        <td data-label="Status pemesanan">
                          <label
                            className={`status-label ${booking.status === STATUSES[0] ? "status-waiting" : booking.status === STATUSES[1] ? "status-verified" : "status-issued"} cursor-pointer`}
                          >
                            <span className="status-dot"></span>
                            <select
                              aria-label={`Status ${booking.name}`}
                              value={booking.status}
                              onChange={(event) =>
                                updateStatus(booking.id, event.target.value)
                              }
                              className="bg-transparent border-none text-inherit font-inherit text-xs cursor-pointer appearance-none p-0 m-0 w-full"
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status === "Booked" ? "Dipesan" : status}
                                </option>
                              ))}
                            </select>
                            <span className="select-chevron text-xs text-muted pointer-events-none">⌄</span>
                          </label>
                        </td>
                        <td data-label="Tanggal pemesanan">
                          <span className="text-base font-semibold text-ink block">
                            {dateLabel(
                              booking.bookingDate || booking.createdAt,
                            )}
                          </span>
                          <small className="text-xs text-muted">{timeLabel(booking.bookingAt)}</small>
                        </td>
                        <td className="text-right">
                          <div className="booking-actions">
                            <button
                              type="button"
                              title={`Edit data ${booking.name}`}
                              aria-label={`Edit data ${booking.name}`}
                              onClick={() => openEditForm(booking)}
                              className="btn-icon btn-icon-edit"
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
                              type="button"
                              title={`Hapus data ${booking.name}`}
                              aria-label={`Hapus data ${booking.name}`}
                              onClick={() => deleteBooking(booking.id)}
                              className="btn-icon btn-icon-delete"
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
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBookings.length === 0 && (
                      <tr className="empty-row">
                        <td className="empty-state" colSpan="6">
                          <div className="empty-state-content">
                            <span className="empty-state-icon" aria-hidden="true">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" />
                                <path d="M8 9h8M8 12.5h8M8 16h5" />
                              </svg>
                            </span>
                            <strong className="text-base text-ink block">
                              {isLoadingBookings
                                ? "Memuat data dari MySQL..."
                                : "Belum ada data yang cocok"}
                            </strong>
                            <span className="text-sm">
                              {isLoadingBookings
                                ? "Manifest penerbangan sedang dimuat."
                                : "Coba ubah pencarian atau filter status."}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="flex justify-between items-center text-sm text-muted mt-12">
                <span>
                  Menampilkan <strong className="text-ink">{filteredBookings.length}</strong> dari{" "}
                  <strong className="text-ink">{currentBookings.length}</strong> pemesanan
                </span>
                <div className="capacity-legend">
                  <span className="flex items-center gap-2 text-xs">
                    <span className="legend-dot" style={{ backgroundColor: "var(--sf-surface-hover)", border: "1px solid var(--sf-line)" }}></span>Nomor tersedia
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="legend-dot" style={{ backgroundColor: "var(--sf-teal)" }}></span>Nomor digunakan
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
            className="booking-modal reservation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
          >
            <div className="modal-heading">
              <div>
                <span className="reservation-kicker">RESERVASI BARU</span>
                <h2 id="form-title">Input data pemesan</h2>
                <p className="reservation-subtitle">
                  Lengkapi data penumpang dan jadwal penerbangan untuk membuat pemesanan.
                </p>
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
            <form onSubmit={addBooking}>
              <section className="form-section passenger-section">
                <div className="form-section-heading">
                  <span className="form-section-number">01</span>
                  <div>
                    <h3>Data penumpang</h3>
                    <p>Gunakan nama sesuai identitas dan nomor WhatsApp aktif.</p>
                  </div>
                  <span className="form-section-count">
                    {form.passengers.length} penumpang
                  </span>
                </div>
                <div className="passenger-list">
                  {form.passengers.map((passenger, index) => (
                    <fieldset className="passenger-card" key={index}>
                      <legend>Penumpang {String(index + 1).padStart(2, "0")}</legend>
                      <label>
                        Nama lengkap
                        <input
                          className="form-control"
                          required
                          autoFocus={index === 0}
                          autoComplete="name"
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
                        Tipe penumpang
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
                          <option value="adult">Dewasa</option>
                          <option value="child">Anak-anak</option>
                          <option value="infant">Bayi</option>
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
                    <span aria-hidden="true">+</span> Tambah penumpang
                  </button>
                  <span className="passenger-capacity-hint">
                    Sisa kuota: {availableBookingNumbers.length} penumpang
                  </span>
                </div>
              </section>
              <section className="form-section">
                <div className="form-section-heading">
                  <span className="form-section-number">02</span>
                  <div>
                    <h3>Detail penerbangan</h3>
                    <p>Pilih rute dan tanggal sesuai jadwal operasional.</p>
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
                    <span className="field-hint">Jadwal: Senin, Rabu, dan Sabtu</span>
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
                      className="form-control"
                    />
                  </label>
                </div>
              </section>
              <div className="booking-number-preview">
                <div>
                  <span className="preview-label">NOMOR URUT PEMESANAN</span>
                  <small>Nomor dibuat otomatis saat pemesanan disimpan.</small>
                </div>
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
                  className="btn btn-outline"
                  onClick={() => setShowForm(false)}
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
                Tipe Penumpang
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
                  <option value="adult">Dewasa</option>
                  <option value="child">Anak-anak</option>
                  <option value="infant">Bayi</option>
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
                  onClick={() => setEditingBooking(null)}
                  disabled={isUpdatingBooking}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
                Login Keuangan belum dikonfigurasi. Isi FINANCE_USERNAME dan
                FINANCE_PASSWORD pada file .env server.
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
                  className="btn btn-primary"
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
