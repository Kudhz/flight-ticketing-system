// Set VITE_API_BACKEND=node saat build/dev untuk memakai API Node.js; bawaan tetap PHP.
const useNodeApi = import.meta.env.VITE_API_BACKEND === "node";

export const BOOKINGS_ENDPOINT = useNodeApi ? "/api/bookings" : "/server/index.php";
export const FINANCE_AUTH_ENDPOINT = useNodeApi
  ? "/api/finance"
  : "/server/index.php?path=/api/finance";
export const FLIGHTS_ENDPOINT = useNodeApi ? "/api/flights" : "/server/flights.php";

export const flightPdfUrl = (year, month) => {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (useNodeApi) return `/api/flight-pdf?${params}`;

  params.set("path", "/api/flight-pdf");
  return `/server/index.php?${params}`;
};
