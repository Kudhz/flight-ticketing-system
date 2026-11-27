export const NAV_GROUPS = [
  {
    label: "OPERASIONAL",
    items: [
      {
        id: "overview",
        label: "Dashboard",
        icon: "passengers",
        countKey: "bookings",
      },
      {
        id: "passengerList",
        label: "List PAX",
        icon: "list",
      },
      {
        id: "checkIn",
        label: "Check-in",
        icon: "checklist",
      },
      { id: "flightHistory", label: "Data Flight", icon: "calendar" },
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
