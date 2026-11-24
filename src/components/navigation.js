export const NAV_GROUPS = [
  {
    label: "OPERASIONAL",
    items: [
      {
        id: "overview",
        label: "Reservasi & Manifes",
        icon: "passengers",
        countKey: "bookings",
      },
      {
        id: "passengerList",
        label: "List Penumpang",
        icon: "list",
      },
      {
        id: "checkIn",
        label: "Check-in Penumpang",
        icon: "checklist",
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
