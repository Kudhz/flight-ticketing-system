import { useEffect, useMemo, useRef, useState } from "react";
import AppSidebar from "./components/AppSidebar";
import FlightScheduleTabs from "./components/FlightScheduleTabs";
import FlightDataPages from "./components/FlightDataPages";
import FlightDispatchBanner from "./components/FlightDispatchBanner";
import {
  OverviewDatesAndLiveManifest,
  OverviewMetricsAndTelemetry,
} from "./components/OverviewDashboard";
import PassengerManifestSection from "./components/PassengerManifestSection";
import {
  DeleteConfirmDialog,
  EditPassengerDialog,
  FinanceLoginDialog,
  NewReservationDialog,
} from "./components/BookingDialogs";
import { NAV_ITEMS } from "./components/navigation";
import { BOOKINGS_ENDPOINT } from "./apiConfig";
import {
  BOOKING_LIMIT,
  BOOKING_NUMBERS,
  DEFAULT_DATE,
  DEFAULT_ROUTE,
  FINANCE_PAGES,
  ROUTES,
  STATUSES,
  apiRequest,
  bookingsFromApiResponse,
  dateLabel,
  fetchBookings,
  financeAuthUrl,
  flightDatesInMonth,
  isFlightDate,
  isOccupiedSeat,
  localDateISO,
  nearestFlightDateInMonth,
  normalizePassengerName,
  weekdayName,
} from "./utils/bookingUtils";
import "./App.css";

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
  const [flightCacheVersion, setFlightCacheVersion] = useState(0);
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem("seatflow-theme-v2") || "light",
  );
  const [selectedRoute, setSelectedRoute] = useState(DEFAULT_ROUTE);
  const [selectedDate, setSelectedDate] = useState(DEFAULT_DATE);
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_DATE.slice(0, 7));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [deletingBooking, setDeletingBooking] = useState(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);
  const searchInputRef = useRef(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    type: "adult",
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
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        "content",
        theme === "dark" ? "#212529" : "#f8f9fa",
      );
    }
  }, [theme]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (activePage !== "bookings") {
          setActivePage("bookings");
        }
        window.setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      } else if (event.key === "Escape") {
        if (deletingBooking && !isDeletingBooking) {
          setDeletingBooking(null);
        } else if (editingBooking && !isUpdatingBooking) {
          setEditingBooking(null);
        } else if (showForm && !isSavingBooking) {
          setShowForm(false);
        } else if (isFinanceLoginOpen && !isFinanceSubmitting) {
          setIsFinanceLoginOpen(false);
          setPendingFinancePage(null);
          setFinancePassword("");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activePage,
    deletingBooking,
    editingBooking,
    isDeletingBooking,
    isFinanceLoginOpen,
    isFinanceSubmitting,
    isSavingBooking,
    isUpdatingBooking,
    showForm,
  ]);

  const routeInfo = ROUTES.find((route) => route.value === selectedRoute);
  const flightDates = flightDatesInMonth(selectedMonth);
  const pageTitles = Object.fromEntries(
    NAV_ITEMS.map((item) => [item.id, item.label]),
  );
  const isFlightDataPage = activePage.startsWith("flight");
  const currentBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.route === selectedRoute && booking.date === selectedDate,
      ),
    [bookings, selectedDate, selectedRoute],
  );
  // Infant tidak memakai kursi; anak dan dewasa dihitung terisi.
  const occupiedSeats = currentBookings.filter(isOccupiedSeat).length;
  const adultCount = currentBookings.filter(
    (b) => !b.type || b.type === "adult",
  ).length;
  const childCount = currentBookings.filter((b) => b.type === "child").length;
  const infantCount = currentBookings.filter((b) => b.type === "infant").length;
  const waitingCount = currentBookings.filter(
    (b) => b.status === STATUSES[0],
  ).length;
  const bookedCount = currentBookings.filter(
    (b) => b.status === STATUSES[1],
  ).length;
  const paidCount = currentBookings.filter(
    (b) => b.status === STATUSES[2],
  ).length;

  const dualSectorStats = useMemo(
    () =>
      ROUTES.map((route) => {
        const sectorBookings = bookings.filter(
          (b) => b.route === route.value && b.date === selectedDate,
        );
        const seatsUsed = sectorBookings.filter(isOccupiedSeat).length;
        const infants = sectorBookings.filter(
          (b) => b.type === "infant",
        ).length;
        const paid = sectorBookings.filter(
          (b) => b.status === STATUSES[2],
        ).length;
        const waiting = sectorBookings.filter(
          (b) => b.status === STATUSES[0],
        ).length;
        return {
          ...route,
          totalPax: sectorBookings.length,
          seatsUsed,
          seatsLeft: Math.max(BOOKING_LIMIT - seatsUsed, 0),
          infants,
          paid,
          waiting,
          pct: Math.min(Math.round((seatsUsed / BOOKING_LIMIT) * 100), 100),
        };
      }),
    [bookings, selectedDate],
  );

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

  async function copyWhatsAppManifest() {
    const sorted = [...currentBookings].sort(
      (a, b) => Number(a.bookingNo) - Number(b.bookingNo),
    );
    const lines = [
      `*MANIFES PENERBANGAN SUSI AIR*`,
      `Rute: *${routeInfo.label}*`,
      `Tanggal: *${weekdayName(selectedDate)}, ${dateLabel(selectedDate)}*`,
      `Kapasitas: *${occupiedSeats}/${BOOKING_LIMIT} Kursi* (${infantCount} Infant)`,
      `Status: ${paidCount} Lunas • ${bookedCount} Dipesan • ${waitingCount} Menunggu`,
      `--------------------------------`,
    ];

    if (sorted.length === 0) {
      lines.push(`_Belum ada penumpang terdaftar._`);
    } else {
      sorted.forEach((b) => {
        const tag =
          b.type === "infant"
            ? " [INF]"
            : b.type === "child"
              ? " [ANAK]"
              : "";
        const statusShort =
          b.status === STATUSES[2]
            ? "✓ Lunas"
            : b.status === STATUSES[1]
              ? "• Dipesan"
              : "? Menunggu";
        lines.push(
          `${String(b.bookingNo).padStart(2, "0")}. *${b.name}*${tag} — ${b.phone} (${statusShort})`,
        );
      });
    }

    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showMessage("Format laporan manifes WhatsApp berhasil disalin!");
    } catch {
      showMessage("Gagal menyalin ke clipboard browser.");
    }
  }

  async function navigateToPage(page) {
    if (FINANCE_PAGES.has(page)) {
      if (isFinanceAuthenticated) {
        setActivePage(page);
        apiRequest(financeAuthUrl("session"))
          .then((result) => {
            setFinanceAuthConfigured(result.configured === true);
            if (result.authenticated !== true) {
              setFlightCacheVersion((version) => version + 1);
              setIsFinanceAuthenticated(false);
              setPendingFinancePage(page);
              setActivePage("overview");
              setIsFinanceLoginOpen(true);
            }
          })
          .catch(() => {});
        return;
      }

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
      setFlightCacheVersion((version) => version + 1);
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
      setFlightCacheVersion((version) => version + 1);
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
    setIsDeletingBooking(true);
    try {
      await apiRequest(`${BOOKINGS_ENDPOINT}?id=${id}`, { method: "DELETE" });
      setBookings((current) => current.filter((booking) => booking.id !== id));
      setDeletingBooking(null);
      showMessage("Data pemesanan dihapus dari MySQL.");
    } catch (error) {
      setDataError(error.message);
    } finally {
      setIsDeletingBooking(false);
    }
  }

  const remainingSeats = Math.max(BOOKING_LIMIT - occupiedSeats, 0);
  const loadFactorPct = Math.min(
    Math.round((occupiedSeats / BOOKING_LIMIT) * 100),
    100,
  );

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
          <div className="topbar-left">
            <span className="mobile-brand-mark" aria-label="Lupin Portal">
              ✈
            </span>
            <div className="topbar-breadcrumb">
              <span className="topbar-label">
                {isFlightDataPage ? "LAPORAN & KEUANGAN" : "FLIGHT OPERATIONS"}
              </span>
              <span className="sep">/</span>
              <strong className="topbar-title">{pageTitles[activePage]}</strong>
            </div>
          </div>
          <div className="topbar-status">
            <div className="topbar-sync-badge">
              <span className="topbar-dot"></span>
              <span className="topbar-text">Database Sinkron</span>
            </div>
            <span className="topbar-date">{dateLabel(localDateISO())}</span>
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Aktifkan mode ${theme === "light" ? "gelap" : "terang"}`}
              title={`Aktifkan mode ${theme === "light" ? "gelap" : "terang"}`}
            >
              <span aria-hidden="true" className="theme-toggle-icon">
                {theme === "light" ? "☾" : "☼"}
              </span>
              <span className="theme-toggle-label">
                {theme === "light" ? "Mode Gelap" : "Mode Terang"}
              </span>
            </button>
          </div>
        </header>

        {isFlightDataPage && (
          <div className="flex flex-col gap-24">
            <section className="page-hero-header">
              <div className="section-header">
                <div className="section-eyebrow">
                  TELEMETRI & AKUNTANSI PENERBANGAN
                </div>
                <h1 className="section-title">{pageTitles[activePage]}</h1>
                <p className="section-subtitle">
                  {activePage === "flightDashboard" &&
                    "Analitik performa penerbangan bulan aktif beserta komparasi fee tiket & Ground Handling 4 bulan terakhir."}
                  {activePage === "flightHistory" &&
                    "Log manifes kargo, bagasi, dan riwayat beban angkut pesawat per periode."}
                  {activePage === "flightIncome" &&
                    "Rekapitulasi tagihan fee tiket Susi Air Melonguane dan pendapatan Ground Handling."}
                </p>
              </div>
            </section>
            <FlightDataPages
              cacheVersion={flightCacheVersion}
              isFinanceAuthenticated={isFinanceAuthenticated}
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
                <span className="eyebrow-badge">{routeInfo.value}</span>
                <span>
                  {weekdayName(selectedDate).toUpperCase()},{" "}
                  {dateLabel(selectedDate).toUpperCase()}
                </span>
              </div>
              <h1 className="section-title">{pageTitles[activePage]}</h1>
              <p className="section-subtitle">
                {activePage === "overview" &&
                  "Kendali kuota kabin 12 kursi, jadwal keberangkatan aktif, dan status verifikasi tiket penumpang."}
                {activePage === "bookings" &&
                  "Manifes penumpang terdaftar, pembaruan status pembayaran cepat, dan kontak langsung WhatsApp."}
              </p>
            </section>
            <div className="heading-cta-group">
              <button
                type="button"
                className="btn btn-outline"
                onClick={copyWhatsAppManifest}
                title="Salin format laporan manifes untuk dikirim ke grup WhatsApp"
              >
                <span aria-hidden="true">📋</span> Salin Laporan WA
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={openBookingForm}
              >
                <span aria-hidden="true">+</span> Tambah PAX
              </button>
            </div>
          </div>

          {dataError && (
            <div className="alert alert-error" role="alert">
              <strong>Koneksi Data Terputus</strong>
              <span>{dataError}</span>
            </div>
          )}

          <FlightDispatchBanner
            routeInfo={routeInfo}
            selectedDate={selectedDate}
            occupiedSeats={occupiedSeats}
            remainingSeats={remainingSeats}
            loadFactorPct={loadFactorPct}
            infantCount={infantCount}
          />

          {activePage === "overview" && (
            <OverviewMetricsAndTelemetry
              routeInfo={routeInfo}
              selectedRoute={selectedRoute}
              selectedDate={selectedDate}
              currentBookings={currentBookings}
              occupiedSeats={occupiedSeats}
              remainingSeats={remainingSeats}
              adultCount={adultCount}
              childCount={childCount}
              infantCount={infantCount}
              waitingCount={waitingCount}
              bookedCount={bookedCount}
              paidCount={paidCount}
              dualSectorStats={dualSectorStats}
              onSelectRoute={setSelectedRoute}
            />
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

          {activePage === "overview" && (
            <OverviewDatesAndLiveManifest
              routeInfo={routeInfo}
              selectedDate={selectedDate}
              dashboardBookingEntries={dashboardBookingEntries}
              currentBookings={currentBookings}
              onSelectDate={setSelectedDate}
              onOpenBookingsPage={() => setActivePage("bookings")}
              onUpdateStatus={updateStatus}
            />
          )}

          {activePage === "bookings" && (
            <PassengerManifestSection
              routeInfo={routeInfo}
              selectedDate={selectedDate}
              currentBookings={currentBookings}
              filteredBookings={filteredBookings}
              occupiedSeats={occupiedSeats}
              remainingSeats={remainingSeats}
              filter={filter}
              search={search}
              searchInputRef={searchInputRef}
              isLoadingBookings={isLoadingBookings}
              isRefreshingBookings={isRefreshingBookings}
              onOpenBookingForm={openBookingForm}
              onRefreshBookings={refreshBookings}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onUpdateStatus={updateStatus}
              onOpenEditForm={openEditForm}
              onRequestDelete={setDeletingBooking}
            />
          )}
        </div>
      </main>

      {showForm && (
        <NewReservationDialog
          form={form}
          setForm={setForm}
          availableBookingNumbers={availableBookingNumbers}
          formBookingNumbers={formBookingNumbers}
          isLoadingBookings={isLoadingBookings}
          isSavingBooking={isSavingBooking}
          onClose={() => setShowForm(false)}
          onSubmit={addBooking}
          onShowMessage={showMessage}
        />
      )}

      {editingBooking && (
        <EditPassengerDialog
          editingBooking={editingBooking}
          editForm={editForm}
          setEditForm={setEditForm}
          isUpdatingBooking={isUpdatingBooking}
          onClose={() => setEditingBooking(null)}
          onSubmit={saveBookingChanges}
        />
      )}

      {deletingBooking && (
        <DeleteConfirmDialog
          deletingBooking={deletingBooking}
          isDeletingBooking={isDeletingBooking}
          onClose={() => setDeletingBooking(null)}
          onConfirmDelete={deleteBooking}
        />
      )}

      {isFinanceLoginOpen && (
        <FinanceLoginDialog
          financeAuthConfigured={financeAuthConfigured}
          financeLoginError={financeLoginError}
          financeUsername={financeUsername}
          setFinanceUsername={setFinanceUsername}
          financePassword={financePassword}
          setFinancePassword={setFinancePassword}
          isFinanceSubmitting={isFinanceSubmitting}
          onClose={() => {
            setIsFinanceLoginOpen(false);
            setPendingFinancePage(null);
            setFinancePassword("");
          }}
          onSubmit={loginFinance}
        />
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
