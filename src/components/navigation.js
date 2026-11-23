export const NAV_GROUPS = [
  {
    label: "RESERVASI",
    items: [
      { id: "overview", label: "Overview", icon: "dashboard" },
      {
        id: "bookings",
        label: "Data Penumpang",
        icon: "passengers",
        countKey: "bookings",
      },
      { id: "flightHistory", label: "Riwayat Penerbangan", icon: "calendar" },
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
        label: "Rincian Fee Tiket",
        icon: "income",
        requiresFinanceAuth: true,
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
