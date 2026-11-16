export const NAV_GROUPS = [
  {
    label: "OPERASIONAL",
    items: [
      { id: "overview", label: "Ringkasan Tiket", icon: "dashboard" },
      {
        id: "bookings",
        label: "Data Penumpang",
        icon: "passengers",
        countKey: "bookings",
      },
      { id: "flightHistory", label: "Riwayat Flight", icon: "calendar" },
    ],
  },
  {
    label: "KEUANGAN",
    items: [
      {
        id: "flightDashboard",
        label: "Penghasilan",
        icon: "currency",
        requiresFinanceAuth: true,
      },
      {
        id: "flightIncome",
        label: "Rincian Penghasilan",
        icon: "income",
        requiresFinanceAuth: true,
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
