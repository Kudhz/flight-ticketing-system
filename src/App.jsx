import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import AppSidebar from "./components/AppSidebar";
import FlightScheduleTabs from "./components/FlightScheduleTabs";
import FlightDataPages from "./components/FlightDataPages";
import FlightDispatchBanner from "./components/FlightDispatchBanner";
import { WaOtomatisSummaryCard } from "./components/OverviewDashboard";
import PassengerListPage from "./components/PassengerListPage";
import PassengerManifestSection from "./components/PassengerManifestSection";
import {
  DeleteConfirmDialog,
  EditPassengerDialog,
  FinanceLoginDialog,
  NewReservationDialog,
} from "./components/BookingDialogs";
import {
  BookingNotificationBell,
  BookingNotificationPopup,
} from "./components/BookingNotifications";
import { NAV_ITEMS } from "./components/navigation";
import { BOOKINGS_ENDPOINT, BOOKINGS_STREAM_ENDPOINT } from "./apiConfig";
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
  createBookingNotifications,
  dateLabel,
  fetchBookings,
  financeAuthUrl,
  flightDatesInMonth,
  isBookingCheckedIn,
  isFlightDate,
  isN8nBooking,
  isOccupiedSeat,
  localDateISO,
  nearestFlightDateInMonth,
  normalizePassengerName,
  playNotificationChime,
  triggerBrowserNotification,
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
    date: DEFAULT_DATE,
    source: "n8n",
  });
  const [toast, setToast] = useState("");
  const [checkedInOverrides, setCheckedInOverrides] = useState(() => {
    try {
      const saved = window.localStorage.getItem("seatflow-checked-in-v1");
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  });
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = window.localStorage.getItem(
        "seatflow-n8n-notifications-v2",
      );
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [activeNotifPopup, setActiveNotifPopup] = useState(null);
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(
    () => window.localStorage.getItem("seatflow-notif-sound") !== "off",
  );
  const knownBookingIdsRef = useRef(new Set());
  const hasPersistedKnownIdsRef = useRef(false);
  const hasInitialBookingsLoadedRef = useRef(false);
  const isSavingBookingRef = useRef(false);
  const notifSoundEnabledRef = useRef(notifSoundEnabled);
  const popupTimeoutRef = useRef(null);
  const [form, setForm] = useState({
    passengers: [{ name: "", phone: "", type: "adult" }],
    route: DEFAULT_ROUTE,
    date: DEFAULT_DATE,
  });

  useEffect(() => {
    try {
      const savedIds = window.localStorage.getItem(
        "seatflow-known-booking-ids-v2",
      );
      const parsedIds = savedIds ? JSON.parse(savedIds) : null;
      if (Array.isArray(parsedIds) && parsedIds.length > 0) {
        knownBookingIdsRef.current = new Set(parsedIds.map(Number));
        hasPersistedKnownIdsRef.current = true;
      }
    } catch {
      knownBookingIdsRef.current = new Set();
    }
  }, []);

  const persistKnownBookingIds = useCallback(() => {
    try {
      window.localStorage.setItem(
        "seatflow-known-booking-ids-v2",
        JSON.stringify(Array.from(knownBookingIdsRef.current)),
      );
    } catch {
      // Abaikan jika localStorage penuh
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "seatflow-n8n-notifications-v2",
        JSON.stringify(notifications),
      );
    } catch {
      // Abaikan jika localStorage penuh
    }
  }, [notifications]);

  useEffect(() => {
    notifSoundEnabledRef.current = notifSoundEnabled;
    window.localStorage.setItem(
      "seatflow-notif-sound",
      notifSoundEnabled ? "on" : "off",
    );
  }, [notifSoundEnabled]);

  const handleIncomingExternalBookings = useCallback(
    (
      incomingBookings,
      source = "n8n",
      options = { showPopup: true, markRead: false },
    ) => {
      if (!Array.isArray(incomingBookings) || incomingBookings.length === 0) {
        return;
      }
      const createdNotifs = createBookingNotifications(
        incomingBookings,
        source,
      ).map((notif) => ({
        ...notif,
        read: options.markRead === true,
      }));
      if (createdNotifs.length === 0) return;

      setNotifications((current) => {
        const existingPaxIds = new Set(
          current.flatMap((n) => (n.passengers || []).map((p) => Number(p.id))),
        );
        const uniqueNotifs = createdNotifs.filter((n) =>
          n.passengers.some((p) => !existingPaxIds.has(Number(p.id))),
        );
        return uniqueNotifs.length > 0
          ? [...uniqueNotifs, ...current].slice(0, 30)
          : current;
      });

      if (options.showPopup) {
        setActiveNotifPopup(createdNotifs[0]);

        if (popupTimeoutRef.current) {
          window.clearTimeout(popupTimeoutRef.current);
        }
        popupTimeoutRef.current = window.setTimeout(() => {
          setActiveNotifPopup(null);
        }, 9000);

        if (notifSoundEnabledRef.current) {
          playNotificationChime();
        }
        createdNotifs.forEach((notif) => triggerBrowserNotification(notif));
      }
    },
    [],
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadBookings() {
      setIsLoadingBookings(true);
      setDataError("");
      try {
        const loadedBookings = await fetchBookings();
        if (isCurrent) {
          if (hasPersistedKnownIdsRef.current) {
            const arrivedWhileOffline = loadedBookings.filter(
              (booking) =>
                !knownBookingIdsRef.current.has(Number(booking.id)) &&
                isN8nBooking(booking),
            );
            loadedBookings.forEach((booking) => {
              knownBookingIdsRef.current.add(Number(booking.id));
            });
            persistKnownBookingIds();

            if (arrivedWhileOffline.length > 0) {
              handleIncomingExternalBookings(arrivedWhileOffline, "n8n", {
                showPopup: true,
                markRead: false,
              });
            }
          } else {
            loadedBookings.forEach((booking) => {
              knownBookingIdsRef.current.add(Number(booking.id));
            });
            hasPersistedKnownIdsRef.current = true;
            persistKnownBookingIds();
          }

          // Isi riwayat lonceng notifikasi awal hanya dengan pesanan yang berstatus WA Otomatis di MySQL
          let currentSavedNotifs = [];
          try {
            currentSavedNotifs = JSON.parse(
              window.localStorage.getItem("seatflow-n8n-notifications-v2") ||
                "[]",
            );
          } catch {
            currentSavedNotifs = [];
          }
          if (
            (!Array.isArray(currentSavedNotifs) ||
              currentSavedNotifs.length === 0) &&
            loadedBookings.length > 0
          ) {
            const recentN8n = [...loadedBookings]
              .filter(isN8nBooking)
              .sort(
                (a, b) =>
                  (b.bookingAt || "").localeCompare(a.bookingAt || "") ||
                  Number(b.id) - Number(a.id),
              )
              .slice(0, 10);
            if (recentN8n.length > 0) {
              handleIncomingExternalBookings(recentN8n, "n8n", {
                showPopup: false,
                markRead: true,
              });
            }
          }

          hasInitialBookingsLoadedRef.current = true;
          setBookings(loadedBookings);
        }
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
  }, [handleIncomingExternalBookings, persistKnownBookingIds]);

  useEffect(() => {
    let isCurrent = true;
    let eventSource = null;

    async function checkLatestBookings() {
      if (
        !isCurrent ||
        !hasInitialBookingsLoadedRef.current ||
        isSavingBookingRef.current
      ) {
        return;
      }
      try {
        const latestBookings = await fetchBookings();
        if (!isCurrent || isSavingBookingRef.current) return;

        const newExternalBookings = latestBookings.filter(
          (booking) =>
            !knownBookingIdsRef.current.has(Number(booking.id)) &&
            isN8nBooking(booking),
        );

        if (
          newExternalBookings.length > 0 ||
          latestBookings.length !== knownBookingIdsRef.current.size
        ) {
          latestBookings.forEach((booking) => {
            knownBookingIdsRef.current.add(Number(booking.id));
          });
          persistKnownBookingIds();
        }

        setBookings(latestBookings);

        if (newExternalBookings.length > 0) {
          handleIncomingExternalBookings(newExternalBookings, "n8n", {
            showPopup: true,
            markRead: false,
          });
        }
      } catch {
        // Abaikan error jaringan sementara saat background polling
      }
    }

    if (BOOKINGS_STREAM_ENDPOINT && typeof window.EventSource === "function") {
      try {
        eventSource = new window.EventSource(BOOKINGS_STREAM_ENDPOINT);
        eventSource.addEventListener("booking_created", (event) => {
          if (!isCurrent) return;
          try {
            const payload = JSON.parse(event.data || "{}");
            const incoming = Array.isArray(payload.bookings)
              ? payload.bookings
              : [];
            if (incoming.length === 0) return;

            const unseenBookings = incoming.filter(
              (booking) => !knownBookingIdsRef.current.has(Number(booking.id)),
            );
            incoming.forEach((booking) => {
              knownBookingIdsRef.current.add(Number(booking.id));
            });
            persistKnownBookingIds();

            if (unseenBookings.length > 0) {
              setBookings((current) => {
                const existingIds = new Set(
                  current.map((item) => Number(item.id)),
                );
                const toAdd = unseenBookings.filter(
                  (item) => !existingIds.has(Number(item.id)),
                );
                return toAdd.length > 0 ? [...toAdd, ...current] : current;
              });
            }

            if (payload.source !== "web" && unseenBookings.length > 0) {
              handleIncomingExternalBookings(
                unseenBookings,
                payload.source || "n8n",
                { showPopup: true },
              );
            }
          } catch {
            // Abaikan jika format payload SSE tidak valid
          }
        });
      } catch {
        // Fallback ke polling berkala
      }
    }

    const pollInterval = window.setInterval(checkLatestBookings, 4000);
    const handleWindowFocus = () => {
      void checkLatestBookings();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkLatestBookings();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCurrent = false;
      window.clearInterval(pollInterval);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [handleIncomingExternalBookings, persistKnownBookingIds]);

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
        if (activePage !== "overview") {
          setActivePage("overview");
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

  const n8nTelemetry = useMemo(() => {
    const currentN8n = currentBookings.filter(isN8nBooking);
    const currentWebCount = currentBookings.length - currentN8n.length;
    const currentSharePct = currentBookings.length
      ? Math.round((currentN8n.length / currentBookings.length) * 100)
      : 0;
    const currentUniqueContacts = new Set(
      currentN8n.map((b) => String(b.phone || "").trim()).filter(Boolean),
    ).size;
    const currentWaiting = currentN8n.filter(
      (b) => b.status === STATUSES[0],
    ).length;
    const currentBooked = currentN8n.filter(
      (b) => b.status === STATUSES[1],
    ).length;
    const currentPaid = currentN8n.filter(
      (b) => b.status === STATUSES[2],
    ).length;

    const allN8n = bookings.filter(isN8nBooking);
    const totalUniqueContacts = new Set(
      allN8n.map((b) => String(b.phone || "").trim()).filter(Boolean),
    ).size;
    const totalWaitingN8n = allN8n.filter(
      (b) => b.status === STATUSES[0],
    ).length;
    const totalBookedN8n = allN8n.filter(
      (b) => b.status === STATUSES[1],
    ).length;
    const totalPaidN8n = allN8n.filter((b) => b.status === STATUSES[2]).length;
    const totalAutomationRate = bookings.length
      ? Math.round((allN8n.length / bookings.length) * 100)
      : 0;

    const monthBookings = bookings.filter((b) =>
      b.date?.startsWith(`${selectedMonth}-`),
    );
    const monthN8n = monthBookings.filter(isN8nBooking);
    const monthMdcCount = monthN8n.filter((b) => b.route === "MNA-MDC").length;
    const monthIaxCount = monthN8n.filter((b) => b.route === "MNA-IAX").length;

    const allN8nBookings = [...allN8n].sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") ||
        (b.bookingAt || "").localeCompare(a.bookingAt || "") ||
        Number(b.id) - Number(a.id),
    );
    const currentN8nBookings = [...currentN8n].sort(
      (a, b) => Number(a.bookingNo) - Number(b.bookingNo),
    );

    return {
      currentN8nCount: currentN8n.length,
      currentWebCount,
      currentSharePct,
      currentUniqueContacts,
      currentWaiting,
      currentBooked,
      currentPaid,
      monthN8nCount: monthN8n.length,
      monthMdcCount,
      monthIaxCount,
      totalN8nCount: allN8n.length,
      totalWebCount: bookings.length - allN8n.length,
      totalUniqueContacts,
      totalWaitingN8n,
      totalBookedN8n,
      totalPaidN8n,
      totalAutomationRate,
      allN8nBookings,
      currentN8nBookings,
    };
  }, [bookings, currentBookings, selectedMonth]);

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

  const dateDetailsByDate = useMemo(() => {
    const details = {};
    bookings.forEach((booking) => {
      if (!booking.date?.startsWith(`${selectedMonth}-`)) return;
      if (!details[booking.date]) {
        details[booking.date] = {
          mdcSeats: 0,
          iaxSeats: 0,
          waitingRoute: 0,
          waitingTotal: 0,
        };
      }
      const entry = details[booking.date];
      if (isOccupiedSeat(booking)) {
        if (booking.route === "MNA-MDC") entry.mdcSeats += 1;
        if (booking.route === "MNA-IAX") entry.iaxSeats += 1;
      }
      if (booking.status === STATUSES[0]) {
        entry.waitingTotal += 1;
        if (booking.route === selectedRoute) entry.waitingRoute += 1;
      }
    });
    return details;
  }, [bookings, selectedMonth, selectedRoute]);

  const today = localDateISO();
  const formManifest = bookings.filter(
    (booking) => booking.route === form.route && booking.date === form.date,
  );
  const formUsedNumbers = new Set(
    formManifest
      .filter(isOccupiedSeat)
      .map((booking) => Number(booking.bookingNo))
      .filter((number) => number >= 1 && number <= BOOKING_LIMIT),
  );
  const availableBookingNumbers = BOOKING_NUMBERS.filter(
    (number) => !formUsedNumbers.has(number),
  );
  const formBookingNumbers = form.passengers.reduce((acc, passenger) => {
    if ((passenger.type || "adult") === "infant") {
      return [...acc, "INF"];
    }
    const usedSeatsInAcc = acc.filter((item) => item !== "INF").length;
    return [...acc, availableBookingNumbers[usedSeatsInAcc] ?? null];
  }, []);
  const filteredBookings = currentBookings
    .filter((booking) => {
      const isFromN8n = isN8nBooking(booking);
      const sourceText = isFromN8n
        ? "wa otomatis whatsapp otomatis n8n bot"
        : "manual web loket";
      return `${booking.name} ${booking.phone} ${booking.route} ${booking.bookingNo} ${booking.status} ${sourceText}`
        .toLowerCase()
        .includes(search.toLowerCase());
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
    const sorted = [...currentBookings].sort((a, b) => {
      const aInfant = a.type === "infant" ? 1 : 0;
      const bInfant = b.type === "infant" ? 1 : 0;
      return (
        aInfant - bInfant ||
        Number(a.bookingNo) - Number(b.bookingNo) ||
        Number(a.id) - Number(b.id)
      );
    });
    const checkedCount = sorted.filter((b) =>
      isBookingCheckedIn(b, checkedInOverrides),
    ).length;
    const lines = [
      `*MANIFES PENERBANGAN SUSI AIR*`,
      `Rute: *${routeInfo.label}*`,
      `Tanggal: *${weekdayName(selectedDate)}, ${dateLabel(selectedDate)}*`,
      `Kapasitas: *${occupiedSeats}/${BOOKING_LIMIT} Kursi* (${infantCount} Infant)`,
      `Status: ${paidCount} Lunas • ${bookedCount} Dipesan • ${waitingCount} Menunggu`,
      `Check-in: *${checkedCount}/${sorted.length} PAX*`,
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
        const checkInTag = isBookingCheckedIn(b, checkedInOverrides)
          ? " | ✅ Check-in"
          : "";
        const seatPrefix =
          b.type === "infant" || Number(b.bookingNo) > BOOKING_LIMIT
            ? "INF"
            : String(b.bookingNo).padStart(2, "0");
        lines.push(
          `${seatPrefix}. *${b.name}*${tag} — ${b.phone} (${statusShort}${checkInTag})`,
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
      const newExternalBookings = hasInitialBookingsLoadedRef.current
        ? loadedBookings.filter(
            (booking) =>
              !knownBookingIdsRef.current.has(Number(booking.id)) &&
              isN8nBooking(booking),
          )
        : [];
      loadedBookings.forEach((booking) => {
        knownBookingIdsRef.current.add(Number(booking.id));
      });
      hasPersistedKnownIdsRef.current = true;
      persistKnownBookingIds();
      hasInitialBookingsLoadedRef.current = true;
      setBookings(loadedBookings);
      if (newExternalBookings.length > 0) {
        handleIncomingExternalBookings(newExternalBookings, "n8n");
      } else {
        showMessage("Daftar penumpang berhasil diperbarui.");
      }
    } catch (error) {
      setDataError(error.message);
    } finally {
      setIsRefreshingBookings(false);
    }
  }

  function openNotificationSchedule(notification) {
    if (!notification) return;
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );
    setActiveNotifPopup((current) =>
      current?.id === notification.id ? null : current,
    );
    if (notification.route) {
      setSelectedRoute(notification.route);
    }
    if (notification.date) {
      setSelectedMonth(notification.date.slice(0, 7));
      setSelectedDate(notification.date);
    }
    setActivePage("overview");
    window.setTimeout(() => {
      document
        .getElementById("manifest-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function openBookingForm() {
    const defaultType = remainingSeats === 0 ? "infant" : "adult";
    setForm((current) => ({
      ...current,
      route: selectedRoute,
      date: selectedDate,
      passengers:
        current.passengers.length === 1 &&
        !current.passengers[0].name &&
        !current.passengers[0].phone
          ? [{ name: "", phone: "", type: defaultType }]
          : current.passengers,
    }));
    setShowForm(true);
  }

  async function addBooking(event) {
    event.preventDefault();
    const formCurrentManifest = bookings.filter(
      (booking) => booking.route === form.route && booking.date === form.date,
    );
    const usedNumbers = new Set(
      formCurrentManifest
        .filter(isOccupiedSeat)
        .map((booking) => Number(booking.bookingNo))
        .filter((number) => number >= 1 && number <= BOOKING_LIMIT),
    );
    const availableNumbers = BOOKING_NUMBERS.filter(
      (number) => !usedNumbers.has(number),
    );
    const passengers = form.passengers.map((passenger) => ({
      name: normalizePassengerName(passenger.name),
      phone: passenger.phone.trim(),
      type: passenger.type || "adult",
    }));
    const seatedPassengersCount = passengers.filter(
      (passenger) => passenger.type !== "infant",
    ).length;

    if (!isFlightDate(form.date)) {
      showMessage("Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.");
      return;
    }
    if (passengers.some((passenger) => !passenger.name || !passenger.phone)) {
      showMessage("Lengkapi nama dan nomor WhatsApp setiap penumpang.");
      return;
    }
    if (seatedPassengersCount > availableNumbers.length) {
      showMessage(
        `Kuota kursi tersisa hanya ${availableNumbers.length} kursi untuk jadwal ini.`,
      );
      return;
    }

    const hasLegacySeatedInfant = formCurrentManifest.some(
      (booking) =>
        booking.type === "infant" && Number(booking.bookingNo) <= BOOKING_LIMIT,
    );

    setIsSavingBooking(true);
    isSavingBookingRef.current = true;
    setDataError("");
    try {
      const booking = await apiRequest(BOOKINGS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          passengers,
          route: form.route,
          date: form.date,
          source: "web",
        }),
      });
      const createdBookings = bookingsFromApiResponse(booking);
      if (createdBookings.length !== passengers.length) {
        throw new Error(
          "Respons API tidak memuat data lengkap untuk semua penumpang.",
        );
      }

      createdBookings.forEach((item) => {
        knownBookingIdsRef.current.add(Number(item.id));
      });
      persistKnownBookingIds();

      setBookings((current) => {
        const existingIds = new Set(current.map((item) => Number(item.id)));
        const uniqueCreated = createdBookings.filter(
          (item) => !existingIds.has(Number(item.id)),
        );
        return [...uniqueCreated, ...current];
      });
      if (hasLegacySeatedInfant) {
        fetchBookings().then(setBookings).catch(() => {});
      }
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
      isSavingBookingRef.current = false;
      setIsSavingBooking(false);
    }
  }

  function toggleCheckIn(booking) {
    if (!booking) return;
    const nextCheckedIn = !isBookingCheckedIn(booking, checkedInOverrides);

    setCheckedInOverrides((prev) => {
      const next = { ...prev, [booking.id]: nextCheckedIn };
      try {
        window.localStorage.setItem(
          "seatflow-checked-in-v1",
          JSON.stringify(next),
        );
      } catch {
        // Abaikan jika penyimpanan lokal penuh
      }
      return next;
    });
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
      date: booking.date,
      source: isN8nBooking(booking) ? "n8n" : "web",
    });
  }

  async function saveBookingChanges(event) {
    event.preventDefault();
    if (!editingBooking) return;

    const name = normalizePassengerName(editForm.name);
    const phone = editForm.phone.trim();
    const targetDate = editForm.date || editingBooking.date;
    const targetSource = editForm.source === "web" ? "web" : "n8n";
    if (!name || !phone) {
      showMessage("Nama dan nomor WhatsApp wajib diisi.");
      return;
    }
    if (!isFlightDate(targetDate)) {
      showMessage("Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.");
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
            date: targetDate,
            source: targetSource,
          }),
        },
      );
      setBookings((current) =>
        current.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking,
        ),
      );
      const isDateChanged = updatedBooking.date !== editingBooking.date;
      setEditingBooking(null);
      showMessage(
        isDateChanged
          ? `Jadwal penumpang dipindahkan ke ${dateLabel(updatedBooking.date)}.`
          : "Data penumpang berhasil diperbarui.",
      );
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

  const scheduleControlsNode = (
    <FlightScheduleTabs
      key={selectedMonth}
      embedded
      dates={flightDates}
      bookingCounts={bookingCountsByDate}
      dateDetails={dateDetailsByDate}
      selectedMonth={selectedMonth}
      selectedDate={selectedDate}
      routes={ROUTES}
      selectedRoute={selectedRoute}
      isModalOpen={
        Boolean(showForm) ||
        Boolean(editingBooking) ||
        Boolean(deletingBooking) ||
        Boolean(isFinanceLoginOpen)
      }
      isActiveView={!isFlightDataPage}
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
      onJumpNearest={() => {
        const currentMonth = today.slice(0, 7);
        const upcomingThisMonth = flightDatesInMonth(currentMonth).find(
          (d) => d >= today,
        );
        if (upcomingThisMonth) {
          setSelectedMonth(currentMonth);
          setSelectedDate(upcomingThisMonth);
          return;
        }
        const [y, m] = currentMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
        const nextFirst = flightDatesInMonth(nextMonth)[0];
        setSelectedMonth(nextMonth);
        if (nextFirst) setSelectedDate(nextFirst);
      }}
    />
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
            <BookingNotificationBell
              notifications={notifications}
              soundEnabled={notifSoundEnabled}
              onToggleSound={() => setNotifSoundEnabled((prev) => !prev)}
              onMarkAllRead={() =>
                setNotifications((current) =>
                  current.map((item) => ({ ...item, read: true })),
                )
              }
              onClearAll={() => {
                setNotifications([]);
                setActiveNotifPopup(null);
              }}
              onSelectNotification={openNotificationSchedule}
            />
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

        {(activePage === "passengerList" || activePage === "checkIn") && (
          <div>
            {dataError && (
              <div className="alert alert-error" role="alert">
                <strong>Koneksi Data Terputus</strong>
                <span>{dataError}</span>
              </div>
            )}

            <PassengerListPage
              mode={activePage === "checkIn" ? "checkin" : "list"}
              routeInfo={routeInfo}
              selectedDate={selectedDate}
              currentBookings={currentBookings}
              checkedInOverrides={checkedInOverrides}
              isLoadingBookings={isLoadingBookings}
              scheduleControls={scheduleControlsNode}
              onCopyWhatsAppManifest={copyWhatsAppManifest}
              onShowMessage={showMessage}
              onToggleCheckIn={toggleCheckIn}
            />
          </div>
        )}

        <div
          className={
            isFlightDataPage ||
            activePage === "passengerList" ||
            activePage === "checkIn"
              ? "hidden"
              : ""
          }
        >
          <div className="ticketing-page-heading compact-page-heading">
            <section className="section-header">
              <div className="section-eyebrow">
                <span className="eyebrow-badge">{routeInfo.value}</span>
                <span>
                  {weekdayName(selectedDate).toUpperCase()},{" "}
                  {dateLabel(selectedDate).toUpperCase()}
                </span>
              </div>
              <h1 className="section-title">{pageTitles[activePage]}</h1>
            </section>
            <div className="heading-cta-group">
              <button
                type="button"
                className="secondary-button refresh-button"
                onClick={refreshBookings}
                disabled={isLoadingBookings || isRefreshingBookings}
                aria-label="Sinkronisasi daftar penumpang"
                title="Sinkronisasi data dari MySQL"
              >
                <RefreshCw
                  className={isRefreshingBookings ? "spinning" : ""}
                  aria-hidden="true"
                  strokeWidth={1.9}
                />
                <span>{isRefreshingBookings ? "Memuat..." : "Sinkron"}</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={copyWhatsAppManifest}
                title="Salin format laporan manifes untuk dikirim ke grup WhatsApp"
              >
                <span aria-hidden="true">📋</span> Salin WA
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
            currentBookings={currentBookings}
            checkedInOverrides={checkedInOverrides}
            occupiedSeats={occupiedSeats}
            remainingSeats={remainingSeats}
            loadFactorPct={loadFactorPct}
            infantCount={infantCount}
          />

          <PassengerManifestSection
            routeInfo={routeInfo}
            selectedDate={selectedDate}
            currentBookings={currentBookings}
            filteredBookings={filteredBookings}
            occupiedSeats={occupiedSeats}
            remainingSeats={remainingSeats}
            search={search}
            searchInputRef={searchInputRef}
            isLoadingBookings={isLoadingBookings}
            onSearchChange={setSearch}
            onOpenBookingForm={openBookingForm}
            onUpdateStatus={updateStatus}
            onOpenEditForm={openEditForm}
            onRequestDelete={setDeletingBooking}
            scheduleControls={scheduleControlsNode}
          />

          <WaOtomatisSummaryCard
            routeInfo={routeInfo}
            selectedRoute={selectedRoute}
            selectedDate={selectedDate}
            n8nTelemetry={n8nTelemetry}
            onSelectSchedule={(route, date) => {
              if (route) setSelectedRoute(route);
              if (date) {
                setSelectedMonth(date.slice(0, 7));
                setSelectedDate(date);
              }
              document
                .getElementById("manifest-section")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
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
          onShowMessage={showMessage}
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

      <BookingNotificationPopup
        activePopup={activeNotifPopup}
        onDismiss={() => setActiveNotifPopup(null)}
        onOpenSchedule={openNotificationSchedule}
      />

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
