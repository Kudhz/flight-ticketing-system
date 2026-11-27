# Graph Report - flight-ticketing-system  (2026-11-27)

## Corpus Check
- 60 files · ~58,206 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .example 2, .css 2)

## Summary
- 596 nodes · 1131 edges · 37 communities (26 shown, 11 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8d8eb99e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Main React App & Bookings
- Node API Auth & Bookings
- Backup Frontend Package Config
- Backup React App & Bookings
- Current Frontend Package Config
- Node API Package Config
- Node API Flights Router
- Flight Data & Income Pages
- GitHub Actions Deploy Workflow
- Backup Flight Data Pages
- Project Docs & HTML Entry
- Flight History PDF Generator
- PHP Bookings API (Live)
- PHP Bookings API (Backup)
- Finance Invoice PDF Generator
- Dashboard UI Mockup Design
- Oxlint Config (Current)
- MNA Aviation Favicon Brand
- Lupin Developer Brand Logo
- PHP Flights API (Live)
- AI Customer Service Prompts
- Oxlint Config (Backup)
- PHP Finance Auth (Live)
- PHP Finance Auth (Backup)
- Frontend API Endpoint Config
- PHP Flights Config (Live)
- iOS Apple Touch Icon
- MNA 512px App Icon
- PHP Flights Config (Backup)
- Space Grotesk Font License
- Digital Signature PDF Asset
- Shell Deployment Script

## God Nodes (most connected - your core abstractions)
1. `App()` - 50 edges
2. `dateLabel()` - 24 edges
3. `App()` - 21 edges
4. `FlightDataPages()` - 20 edges
5. `HttpError` - 18 edges
6. `weekdayName()` - 18 edges
7. `bookingsRouter()` - 17 edges
8. `InvalidInput` - 12 edges
9. `apiRequest()` - 12 edges
10. `updateBooking()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Pre-Node-API Backup README` --semantically_similar_to--> `Ticketing Data Service Documentation`  [INFERRED] [semantically similar]
  backup/2026-11-18_pre-node-api/README.md → README.md
- `AI Customer Service System Message (system-message.txt)` --semantically_similar_to--> `AI Customer Service System Message (server/)`  [INFERRED] [semantically similar]
  system-message.txt → server/# SYSTEM MESSAGE — AI CUSTOMER SERVICE T.md
- `n8n Workflow Cek seat & PHP POST Integration` --shares_data_with--> `PHP/PDO API (server/index.php)`  [INFERRED]
  server/# SYSTEM MESSAGE — AI CUSTOMER SERVICE T.md → README.md
- `Node.js Express API Alternative (node-api/)` --references--> `Pre-Node-API Backup README`  [EXTRACTED]
  README.md → backup/2026-11-18_pre-node-api/README.md
- `fail()` --calls--> `HttpError`  [EXTRACTED]
  node-api/src/flights.js → node-api/src/http.js

## Import Cycles
- None detected.

## Communities (37 total, 11 thin omitted)

### Community 0 - "Main React App & Bookings"
Cohesion: 0.07
Nodes (71): BOOKINGS_ENDPOINT, App(), addBooking(), checkFinanceSession(), checkLatestBookings(), copyWhatsAppManifest(), deleteBooking(), loadBookings() (+63 more)

### Community 1 - "Node API Auth & Bookings"
Cohesion: 0.07
Nodes (59): createApp(), base64url(), createFinanceAuth(), digest(), equalText(), financeRouter(), allocateScheduleNumbers(), BOOKING_LIMIT (+51 more)

### Community 2 - "Backup Frontend Package Config"
Cohesion: 0.07
Nodes (36): dependencies, bootstrap@^5.3.9, jspdf@^2.5.2, jspdf-autotable@^3.8.4, lucide-react@^0.544.0, react@^19.3.1, react-bootstrap@^2.10.10, react-dom@^19.3.1 (+28 more)

### Community 3 - "Backup React App & Bookings"
Cohesion: 0.11
Nodes (30): apiRequest(), App(), addBooking(), checkFinanceSession(), deleteBooking(), loadBookings(), loginFinance(), logoutFinance() (+22 more)

### Community 4 - "Current Frontend Package Config"
Cohesion: 0.07
Nodes (35): dependencies, jspdf@^4.2.1, jspdf-autotable@^5.0.9, lucide-react@^0.544.0, react@^19.3.1, react-dom@^19.3.1, devDependencies, oxlint@^1.89.0 (+27 more)

### Community 5 - "Node API Package Config"
Cohesion: 0.08
Nodes (24): dependencies, express@^5.1.0, mysql2@^3.14.0, engines, node, name, private, scripts (+16 more)

### Community 6 - "Node API Flights Router"
Cohesion: 0.20
Nodes (26): withTransaction(), ALLOWED_ROUTES, bind(), buildPeriodFilter(), corsMiddleware(), fail(), flightsRouter(), isValidDay() (+18 more)

### Community 7 - "Flight Data & Income Pages"
Cohesion: 0.12
Nodes (25): CURRENT_DATE, CURRENT_YEAR, EMPTY_FLIGHTS, FlightDataPages(), formatCurrency(), formatFlightDate(), formatIncomePax(), formatIncomePaxCount() (+17 more)

### Community 8 - "GitHub Actions Deploy Workflow"
Cohesion: 0.08
Nodes (25): runs-on, steps, jobs, build-and-deploy, name, on, push, workflow_dispatch (+17 more)

### Community 9 - "Backup Flight Data Pages"
Cohesion: 0.12
Nodes (17): CURRENT_DATE, CURRENT_YEAR, EMPTY_FLIGHTS, FlightDataPages(), formatCurrency(), formatFlightDate(), formatPdfDate(), formatWeight() (+9 more)

### Community 10 - "Project Docs & HTML Entry"
Cohesion: 0.12
Nodes (20): Pre-Node-API Backup README, Pre-Node-API PHP/PDO & Keuangan Setup, Lupin AirOps HTML Entry (index.html), Web App Manifest (/site.webmanifest), Frontend Entry Module (/src/main.jsx), MySQL Database db-jmt (Flight Data), Flight Data API (server/flights.php), Flight & Penghasilan PDF Reports (+12 more)

### Community 11 - "Flight History PDF Generator"
Cohesion: 0.16
Nodes (13): BRAND_GREEN, buildFlightHistoryPdf(), DEEP_GREEN, formatCompactPax(), formatPercent(), INBOUND_BLUE, INK, MINT_BG (+5 more)

### Community 12 - "PHP Bookings API (Live)"
Cohesion: 0.23
Nodes (8): bookingForApi(), fetchBooking(), findAlternativeFlights(), flightDayName(), getDatabase(), validateRouteAndDate(), validCalendarDate(), validFlightDate()

### Community 13 - "PHP Bookings API (Backup)"
Cohesion: 0.23
Nodes (8): bookingForApi(), fetchBooking(), findAlternativeFlights(), flightDayName(), getDatabase(), validateRouteAndDate(), validCalendarDate(), validFlightDate()

### Community 14 - "Finance Invoice PDF Generator"
Cohesion: 0.18
Nodes (12): BRAND_GREEN, buildFinanceInvoicePdf(), DEEP_GREEN, formatNumber(), formatRp(), INK, MINT_BG, MINT_BORDER (+4 more)

### Community 15 - "Dashboard UI Mockup Design"
Cohesion: 0.36
Nodes (8): Flight Route Banner (Melonguane MNA to Manado MDC) and 7-Day Date Strip, Lupin Portal Overview Dashboard UI Mockup, Monthly Revenue Bar Chart (Rp 186.750.000 Apr 2025, Nov 2024 - Apr 2025), Flight Operational KPI Cards (142 Occupied, 38 Available, 3 Pending Verification, 142 Passengers), Passenger Booking Data Table (Search, Status Filter, Add Booking, LPB Bookings), Route (MNA to MDC) and Date (28 Apr 2025) Filter Dropdowns, Sidebar Navigation (Overview, Flight Management, Schedule, Flight Data, Finance), Top Header Bar (Breadcrumb, Live Indicator, WIB Clock, Theme Toggle)

### Community 16 - "Oxlint Config (Current)"
Cohesion: 0.29
Nodes (6): ignorePatterns, plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 17 - "MNA Aviation Favicon Brand"
Cohesion: 0.48
Nodes (6): Ascending White Airplane, Base Squircle Badge, MNA Aviation Brand Identity, MNA Favicon SVG, MNA Vector Monogram, Clipped Diagonal Speed Ribbons

### Community 18 - "Lupin Developer Brand Logo"
Cohesion: 0.43
Nodes (6): BUILD / WIRE / AUTOMATE, Electrical, Software, and DevOps, Lupin Dark Coding Logo, Lupin, Terminal Icon with Green L Initial, Lupin Brand Wordmark and Tagline

### Community 20 - "AI Customer Service Prompts"
Cohesion: 0.29
Nodes (6): AI Customer Service System Message (server/), Customer Service Intents (check_availability, booking, other), Perintis Routes MNA-IAX & MNA-MDC, AI Customer Service System Message (system-message.txt), Passenger Type Classification (adult, child, infant), Perintis Routes & Pricing (MNA-IAX, MNA-MDC, Infant 10%)

### Community 21 - "Oxlint Config (Backup)"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 22 - "PHP Finance Auth (Live)"
Cohesion: 0.53
Nodes (5): destroyFinanceSession(), financeAuthConfiguration(), financeEnvironmentVariables(), financeSessionIsAuthenticated(), startFinanceSession()

### Community 24 - "PHP Finance Auth (Backup)"
Cohesion: 0.53
Nodes (5): destroyFinanceSession(), financeAuthConfiguration(), financeEnvironmentVariables(), financeSessionIsAuthenticated(), startFinanceSession()

### Community 25 - "Frontend API Endpoint Config"
Cohesion: 0.33
Nodes (5): BOOKINGS_STREAM_ENDPOINT, FINANCE_AUTH_ENDPOINT, flightPdfUrl(), FLIGHTS_ENDPOINT, saveHistoryPdf()

### Community 27 - "iOS Apple Touch Icon"
Cohesion: 0.50
Nodes (4): Angled White Airplane Silhouette, MNA Apple Touch App Icon, iOS Home Screen Bookmark Icon, MNA Brand Monogram

### Community 28 - "MNA 512px App Icon"
Cohesion: 0.60
Nodes (5): White Airplane Silhouette, MNA App Icon (512x512), Aviation Ticketing Brand Identity, Layered Green Diagonal Palette, MNA Monogram

## Knowledge Gaps
- **17 isolated node(s):** `Frontend Entry Module (/src/main.jsx)`, `Pre-Node-API PHP/PDO & Keuangan Setup`, `Flight & Penghasilan PDF Reports`, `n8n Booking Webhook (BOOKING_WEBHOOK_URL)`, `AI Structured JSON Output Contract` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App()` connect `Main React App & Bookings` to `Flight Data & Income Pages`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `checkLatestBookings()` and `handleKeyDown()`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Frontend Entry Module (/src/main.jsx)`, `Pre-Node-API PHP/PDO & Keuangan Setup`, `Flight & Penghasilan PDF Reports` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Main React App & Bookings` be split into smaller, more focused modules?**
  _Cohesion score 0.07059373539036932 - nodes in this community are weakly interconnected._
- **Why does `FlightDataPages()` connect `Flight Data & Income Pages` to `Main React App & Bookings`, `Backup Flight Data Pages`, `Flight History PDF Generator`, `Finance Invoice PDF Generator`, `Frontend API Endpoint Config`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `FlightDataPages()` (e.g. with `formatIncomePaxCount()` and `formatPdfDate()`) actually correct?**
  _`FlightDataPages()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Node API Auth & Bookings` be split into smaller, more focused modules?**
  _Cohesion score 0.07171171171171171 - nodes in this community are weakly interconnected._