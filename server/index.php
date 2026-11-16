<?php
declare(strict_types=1);

const BOOKING_LIMIT = 12;
const FLIGHT_DAYS = [1, 3, 6];
const ROUTES = ['MNA-IAX', 'MNA-MDC'];
const STATUSES = ['Menunggu verifikasi', 'Booked', 'Dibayar'];

require_once __DIR__ . '/finance-auth.php';

function sendJson(int $status, array $data = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($status !== 204) {
        echo json_encode(
            $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
        );
    }
    exit;
}

function getDatabase(): PDO
{
    $configPath = dirname(__DIR__) . '/config.local.php';
    if (!is_file($configPath)) {
        throw new RuntimeException(
            'Konfigurasi MySQL belum dibuat. Salin config.example.php menjadi config.local.php.'
        );
    }

    $config = require $configPath;
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'],
        $config['database']
    );

    return new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function bookingForApi(array $row): array
{
    $bookingAt = str_replace(' ', 'T', (string) $row['booking_at']);

    return [
        'id' => (int) $row['id'],
        'name' => $row['passenger_name'],
        'phone' => $row['phone'],
        'bookingNo' => (int) $row['booking_no'],
        'route' => $row['route_code'],
        'date' => (string) $row['travel_date'],
        'status' => $row['status'],
        'createdAt' => substr($bookingAt, 0, 10),
        'bookingDate' => substr($bookingAt, 0, 10),
        'bookingAt' => $bookingAt,
    ];
}

function requestBody(): array
{
    try {
        $body = json_decode(
            file_get_contents('php://input'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    } catch (JsonException $error) {
        throw new InvalidArgumentException('Format JSON tidak valid.', 0, $error);
    }

    if (!is_array($body)) {
        throw new InvalidArgumentException('Isi permintaan harus berupa objek JSON.');
    }

    return $body;
}

function validFlightDate(string $date): bool
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    $errors = DateTimeImmutable::getLastErrors();

    return $parsed !== false
        && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))
        && $parsed->format('Y-m-d') === $date
        && in_array((int) $parsed->format('N'), FLIGHT_DAYS, true);
}

function extractPassengers(array $body): array
{
    $sourcePassengers = $body['passengers'] ?? null;
    if ($sourcePassengers === null && isset($body['name'])) {
        $sourcePassengers = [[
            'name' => $body['name'],
            'phone' => $body['phone'] ?? '',
        ]];
    }

    if (!is_array($sourcePassengers) || $sourcePassengers === []) {
        throw new InvalidArgumentException('Isi minimal satu data penumpang.');
    }

    $passengers = [];
    foreach ($sourcePassengers as $passenger) {
        if (is_string($passenger)) {
            $name = trim($passenger);
            $phone = trim((string) ($body['phone'] ?? ''));
        } elseif (is_array($passenger)) {
            $name = trim((string) ($passenger['name'] ?? $passenger['passenger_name'] ?? ''));
            $phone = trim((string) ($passenger['phone'] ?? $body['phone'] ?? ''));
        } else {
            throw new InvalidArgumentException('Data penumpang tidak valid.');
        }

        if ($name === '' || $phone === '') {
            throw new InvalidArgumentException('Nama dan nomor WhatsApp setiap penumpang wajib diisi.');
        }

        $passengers[] = ['name' => $name, 'phone' => $phone];
    }

    if (count($passengers) > BOOKING_LIMIT) {
        throw new InvalidArgumentException(
            'Jumlah penumpang melebihi kapasitas maksimum ' . BOOKING_LIMIT . '.'
        );
    }

    return $passengers;
}


// Memvalidasi tanggal kalender tanpa memeriksa hari penerbangan.
function validCalendarDate(string $date): bool
{
    $parsed = DateTimeImmutable::createFromFormat(
        '!Y-m-d',
        $date,
        new DateTimeZone('Asia/Makassar')
    );

    $errors = DateTimeImmutable::getLastErrors();

    return $parsed !== false
        && ($errors === false ||
            ($errors['warning_count'] === 0 &&
             $errors['error_count'] === 0))
        && $parsed->format('Y-m-d') === $date;
}

// Mengubah nomor hari menjadi nama hari Indonesia.
function flightDayName(string $date): string
{
    $days = [
        1 => 'Senin',
        2 => 'Selasa',
        3 => 'Rabu',
        4 => 'Kamis',
        5 => 'Jumat',
        6 => 'Sabtu',
        7 => 'Minggu'
    ];

    $day = new DateTimeImmutable(
        $date,
        new DateTimeZone('Asia/Makassar')
    );

    return $days[(int) $day->format('N')];
}

// Mencari maksimal 5 jadwal alternatif dengan seat tersedia.

function findAlternativeFlights(
    PDO $pdo,
    string $route,
    string $requestedDate
): array {
    $timezone = new DateTimeZone('Asia/Makassar');

    $requested = new DateTimeImmutable($requestedDate, $timezone);
    $today = new DateTimeImmutable('today', $timezone);
    $endDate = $today->modify('last day of this month');

    $baseDate = $requested < $today ? $today : $requested;

    if ($baseDate >= $endDate) {
        return [];
    }

    $query = $pdo->prepare(
        'SELECT travel_date, COUNT(DISTINCT booking_no) AS booked
         FROM bookings
         WHERE route_code = :route
           AND travel_date > :start_date
           AND travel_date <= :end_date
         GROUP BY travel_date'
    );

    $query->execute([
        'route' => $route,
        'start_date' => $baseDate->format('Y-m-d'),
        'end_date' => $endDate->format('Y-m-d'),
    ]);

    $bookedByDate = [];

    foreach ($query->fetchAll() as $row) {
        $bookedByDate[$row['travel_date']] = (int) $row['booked'];
    }

    $alternatives = [];
    $cursor = $baseDate->modify('+1 day');

    while ($cursor <= $endDate) {
        $date = $cursor->format('Y-m-d');
        $weekday = (int) $cursor->format('N');

        if (in_array($weekday, FLIGHT_DAYS, true)) {
            $booked = $bookedByDate[$date] ?? 0;

            // Kapasitas yang ditampilkan untuk rekomendasi pelanggan = 10
            $available = max(0, 10 - $booked);

            if ($available > 0) {
                $alternatives[] = [
                    'date' => $date,
                    'day' => flightDayName($date),
                    'capacity' => 10,
                    'booked' => $booked,
                    'available' => $available,
                    'availableSeats' => $available,
                ];
            }
        }

        $cursor = $cursor->modify('+1 day');
    }

    return $alternatives;
}


function validateRouteAndDate(string $route, string $date): void
{
    if (!in_array($route, ROUTES, true)) {
        throw new InvalidArgumentException('Rute penerbangan tidak valid.');
    }

    if (!validCalendarDate($date)) {
        throw new InvalidArgumentException('Tanggal tidak valid.');
    }

    $timezone = new DateTimeZone('Asia/Makassar');
    $today = new DateTimeImmutable('today', $timezone);

    if ($date < $today->format('Y-m-d')) {
        throw new InvalidArgumentException('Tanggal penerbangan sudah lewat.');
    }

    if (substr($date, 0, 7) !== $today->format('Y-m')) {
        throw new InvalidArgumentException('Pemesanan bulan berikutnya belum dibuka.');
    }

    if (!validFlightDate($date)) {
        throw new InvalidArgumentException(
            'Penerbangan hanya tersedia Senin, Rabu, dan Sabtu.'
        );
    }
}

function fetchBooking(PDO $database, int $id): ?array
{
    $statement = $database->prepare(
        'SELECT id, passenger_name, phone, booking_no, route_code, travel_date, status, booking_at
         FROM bookings WHERE id = :id'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();

    return $row === false ? null : bookingForApi($row);
}

try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $path = $_GET['path'] ?? '';

    if ($method === 'GET' && $path === '/api/health') {
        sendJson(200, ['status' => 'ok']);
    }

    if ($path === '/api/finance/session' && $method === 'GET') {
        startFinanceSession();
        $financeConfig = financeAuthConfiguration();
        sendJson(200, [
            'configured' => $financeConfig !== null,
            'authenticated' => financeSessionIsAuthenticated($financeConfig),
        ]);
    }

    if ($path === '/api/finance/login' && $method === 'POST') {
        $financeConfig = financeAuthConfiguration();
        if ($financeConfig === null) {
            sendJson(503, ['error' => 'Login Keuangan belum dikonfigurasi di server.']);
        }

        $body = requestBody();
        $username = $body['username'] ?? null;
        $password = $body['password'] ?? null;
        if (
            !is_string($username) ||
            strlen($username) > 100 ||
            !is_string($password) ||
            strlen($password) > 4096
        ) {
            sendJson(400, ['error' => 'Username atau kata sandi tidak valid.']);
        }

        $validUsername = hash_equals($financeConfig['username'], $username);
        $validPassword = hash_equals($financeConfig['password'], $password);
        if (!$validUsername || !$validPassword) {
            sendJson(401, ['error' => 'Username atau kata sandi salah.']);
        }

        startFinanceSession();
        session_regenerate_id(true);
        $_SESSION['finance_username'] = $financeConfig['username'];
        sendJson(200, ['authenticated' => true]);
    }

    if ($path === '/api/finance/logout' && $method === 'POST') {
        destroyFinanceSession();
        sendJson(200, ['authenticated' => false]);
    }

    if (in_array($path, [
        '/api/finance/session',
        '/api/finance/login',
        '/api/finance/logout',
    ], true)) {
        header('Allow: ' . ($path === '/api/finance/session' ? 'GET' : 'POST'));
        sendJson(405, ['error' => 'Method tidak didukung.']);
    }

    if ($path === '/api/flight-pdf') {
        if ($method !== 'POST') {
            header('Allow: POST');
            sendJson(405, ['error' => 'Method tidak didukung.']);
        }

        $contentType = strtolower(trim(explode(
            ';',
            $_SERVER['CONTENT_TYPE'] ?? ''
        )[0]));
        if ($contentType !== 'application/pdf') {
            sendJson(415, ['error' => 'Konten harus berupa PDF.']);
        }

        $maxPdfBytes = 10 * 1024 * 1024;
        $contentLength = filter_var(
            $_SERVER['CONTENT_LENGTH'] ?? null,
            FILTER_VALIDATE_INT
        );
        if ($contentLength !== false && $contentLength > $maxPdfBytes) {
            sendJson(413, ['error' => 'Ukuran PDF melebihi batas 10 MB.']);
        }

        $pdfBytes = file_get_contents(
            'php://input',
            false,
            null,
            0,
            $maxPdfBytes + 1
        );
        if ($pdfBytes === false || strlen($pdfBytes) > $maxPdfBytes) {
            sendJson(413, ['error' => 'Ukuran PDF melebihi batas 10 MB.']);
        }
        if (!str_starts_with($pdfBytes, '%PDF-')) {
            sendJson(400, ['error' => 'Isi file bukan PDF yang valid.']);
        }

        $pdfDirectory = dirname(__DIR__) . '/flight-pdf';
        if (
            !is_dir($pdfDirectory) &&
            !mkdir($pdfDirectory, 0775, true) &&
            !is_dir($pdfDirectory)
        ) {
            throw new RuntimeException('Folder flight-pdf tidak dapat dibuat.');
        }
        if (!is_writable($pdfDirectory)) {
            throw new RuntimeException('Folder flight-pdf tidak dapat ditulis oleh PHP.');
        }

        $fileName = (new DateTimeImmutable(
            'now',
            new DateTimeZone('Asia/Makassar')
        ))->format('d-m-Y') . '.pdf';
        $targetPath = $pdfDirectory . '/' . $fileName;
        $temporaryPath = tempnam($pdfDirectory, '.flight-pdf-');
        if ($temporaryPath === false) {
            throw new RuntimeException('File sementara PDF tidak dapat dibuat.');
        }

        try {
            $writtenBytes = file_put_contents($temporaryPath, $pdfBytes, LOCK_EX);
            if ($writtenBytes !== strlen($pdfBytes)) {
                throw new RuntimeException('PDF tidak dapat ditulis dengan lengkap.');
            }

            if (
                !rename($temporaryPath, $targetPath) &&
                (
                    DIRECTORY_SEPARATOR !== '\\' ||
                    !is_file($targetPath) ||
                    !unlink($targetPath) ||
                    !rename($temporaryPath, $targetPath)
                )
            ) {
                throw new RuntimeException('PDF tidak dapat disimpan ke folder flight-pdf.');
            }
        } finally {
            if (is_file($temporaryPath)) {
                unlink($temporaryPath);
            }
        }

        sendJson(201, ['success' => true, 'filename' => $fileName]);
    }

    $database = getDatabase();

    if ($method === 'GET') {
        if (!isset($_GET['route']) && !isset($_GET['date'])) {
            $statement = $database->query(
                'SELECT id, passenger_name, phone, booking_no, route_code, travel_date, status, booking_at
                 FROM bookings ORDER BY booking_at DESC, id DESC'
            );
            sendJson(200, array_map('bookingForApi', $statement->fetchAll()));
        }

        $route = (string) ($_GET['route'] ?? '');
        $date = (string) ($_GET['date'] ?? '');

        if (!in_array($route, ROUTES, true)) {
            sendJson(400, [
                'success' => false,
                'status' => 'invalid_route',
                'error' => 'Rute penerbangan tidak valid.',
            ]);
        }

        if (!validCalendarDate($date)) {
            sendJson(400, [
                'success' => false,
                'status' => 'invalid_date',
                'error' => 'Format tanggal harus YYYY-MM-DD.',
            ]);
        }

        $dateObject = new DateTimeImmutable(
            $date,
            new DateTimeZone('Asia/Makassar')
        );
        $weekday = (int) $dateObject->format('N');
        $dayName = flightDayName($date);

        if (!in_array($weekday, FLIGHT_DAYS, true)) {
            $alternatives = findAlternativeFlights($database, $route, $date);
            sendJson(200, [
                'success' => true,
                'status' => 'no_schedule',
                'route' => $route,
                'date' => $date,
                'day' => $dayName,
                'message' => 'Tidak ada jadwal penerbangan pada tanggal tersebut.',
                'alternatives' => $alternatives,
            ]);
        }

        $statement = $database->prepare(
            'SELECT COUNT(DISTINCT booking_no)
             FROM bookings
             WHERE route_code = :route AND travel_date = :date'
        );
        $statement->execute(['route' => $route, 'date' => $date]);
        $booked = (int) $statement->fetchColumn();
        $available = max(BOOKING_LIMIT - $booked, 0);
        $alternatives = findAlternativeFlights($database, $route, $date);

        sendJson(200, [
            'success' => true,
            'status' => $available > 0 ? 'available' : 'full',
            'route' => $route,
            'date' => $date,
            'day' => $dayName,
            'capacity' => BOOKING_LIMIT,
            'booked' => $booked,
            'availableSeats' => $available,
            'available' => $available,
            'alternatives' => $alternatives,
        ]);
    }

    
if ($method === 'POST') {
    $body = requestBody();

    $action = strtolower(trim((string) ($body['action'] ?? 'create_booking')));
    $route = (string) ($body['route'] ?? '');
    $date = (string) ($body['date'] ?? '');

    validateRouteAndDate($route, $date);

    // ==========================================
    // ACTION 1: CHECK BOOKING DUPLICATE
    // ==========================================
    if ($action === 'check_booking') {

        $sourcePassengers = $body['passengers'] ?? null;

        // Mendukung pemeriksaan satu penumpang
        if ($sourcePassengers === null && isset($body['name'])) {
            $sourcePassengers = [$body['name']];
        }

        if (!is_array($sourcePassengers) || $sourcePassengers === []) {
            throw new InvalidArgumentException(
                'Nama penumpang wajib diisi untuk pemeriksaan booking.'
            );
        }

        $checkDuplicate = $database->prepare(
            'SELECT id, passenger_name, booking_no, status
             FROM bookings
             WHERE route_code = :route
               AND travel_date = :date
               AND LOWER(TRIM(passenger_name)) = LOWER(TRIM(:name))
             LIMIT 1'
        );

        $duplicates = [];
        $checkedNames = [];

        foreach ($sourcePassengers as $passenger) {

            if (is_string($passenger)) {
                $name = trim($passenger);
            } elseif (is_array($passenger)) {
                $name = trim((string) (
                    $passenger['name'] ??
                    $passenger['passenger_name'] ??
                    ''
                ));
            } else {
                throw new InvalidArgumentException(
                    'Format data penumpang tidak valid.'
                );
            }

            if ($name === '') {
                throw new InvalidArgumentException(
                    'Nama penumpang tidak boleh kosong.'
                );
            }

            // Hindari pemeriksaan nama yang sama berulang kali
            $normalizedName = mb_strtolower($name);

            if (isset($checkedNames[$normalizedName])) {
                continue;
            }

            $checkedNames[$normalizedName] = true;

            $checkDuplicate->execute([
                'route' => $route,
                'date' => $date,
                'name' => $name
            ]);

            $existing = $checkDuplicate->fetch();

            if ($existing !== false) {
                $duplicates[] = [
                    'name' => $existing['passenger_name'],
                    'bookingNo' => (int) $existing['booking_no'],
                    'status' => $existing['status']
                ];
            }
        }

        $isDuplicate = count($duplicates) > 0;

        sendJson(200, [
            'success' => true,
            'status' => $isDuplicate
                ? 'duplicate_booking'
                : 'not_duplicate',
            'duplicate' => $isDuplicate,
            'route' => $route,
            'date' => $date,
            'duplicates' => $duplicates,
            'message' => $isDuplicate
                ? 'Penumpang sudah terdaftar pada rute dan tanggal tersebut.'
                : 'Penumpang belum terdaftar.'
        ]);
    }

    // ==========================================
    // ACTION 2: CREATE BOOKING
    // ==========================================

    if (!in_array($action, ['create_booking', 'booking'], true)) {
        throw new InvalidArgumentException('Action tidak dikenal.');
    }

    $passengers = extractPassengers($body);

    $database->beginTransaction();

    // Pemeriksaan duplikat sekali lagi sebelum menyimpan.
    // Ini mencegah pemesanan ulang melalui jalur POST biasa.
    $checkDuplicate = $database->prepare(
        'SELECT id
         FROM bookings
         WHERE route_code = :route
           AND travel_date = :date
           AND LOWER(TRIM(passenger_name)) = LOWER(TRIM(:name))
         LIMIT 1
         FOR UPDATE'
    );

    $seenNames = [];

    foreach ($passengers as $passenger) {

        $name = $passenger['name'];
        $normalizedName = mb_strtolower($name);

        if (isset($seenNames[$normalizedName])) {
            $database->rollBack();

            sendJson(409, [
                'success' => false,
                'status' => 'duplicate_booking',
                'duplicate' => true,
                'message' => 'Nama penumpang yang sama terdapat lebih dari satu kali dalam pemesanan.'
            ]);
        }

        $seenNames[$normalizedName] = true;

        $checkDuplicate->execute([
            'route' => $route,
            'date' => $date,
            'name' => $name
        ]);

        if ($checkDuplicate->fetch()) {
            $database->rollBack();

            sendJson(409, [
                'success' => false,
                'status' => 'duplicate_booking',
                'duplicate' => true,
                'message' => 'Penumpang ' . $name .
                    ' sudah terdaftar pada rute dan tanggal tersebut.'
            ]);
        }
    }

    // Mengambil nomor booking yang sudah digunakan.
    $statement = $database->prepare(
        'SELECT booking_no
         FROM bookings
         WHERE route_code = :route
           AND travel_date = :date
         FOR UPDATE'
    );

    $statement->execute([
        'route' => $route,
        'date' => $date
    ]);

    $usedNumbers = array_map(
        'intval',
        $statement->fetchAll(PDO::FETCH_COLUMN)
    );

    $availableNumbers = array_values(
        array_diff(range(1, BOOKING_LIMIT), $usedNumbers)
    );

    if (count($passengers) > count($availableNumbers)) {
        $database->rollBack();

        sendJson(409, [
            'success' => false,
            'error' => 'Kapasitas pemesanan untuk jadwal ini tidak mencukupi.'
        ]);
    }

    $insert = $database->prepare(
        'INSERT INTO bookings
            (passenger_name, phone, booking_no, route_code, travel_date, status, booking_at)
         VALUES
            (:name, :phone, :booking_no, :route, :date, :status, CURRENT_TIMESTAMP)'
    );

    $createdBookings = [];

    foreach ($passengers as $index => $passenger) {

        $insert->execute([
            'name' => $passenger['name'],
            'phone' => $passenger['phone'],
            'booking_no' => $availableNumbers[$index],
            'route' => $route,
            'date' => $date,
            'status' => STATUSES[0]
        ]);

        $createdBookings[] = fetchBooking(
            $database,
            (int) $database->lastInsertId()
        );
    }

    $database->commit();

    sendJson(201, $createdBookings);
}


    $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
    if ($id === false || $id === null || $id < 1) {
        throw new InvalidArgumentException('ID pemesanan tidak valid.');
    }

    if ($method === 'PATCH') {
        $body = requestBody();
        $database->beginTransaction();
        $statement = $database->prepare(
            'SELECT id, passenger_name, phone, booking_no, route_code, travel_date, status, booking_at
             FROM bookings WHERE id = :id FOR UPDATE'
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if ($row === false) {
            $database->rollBack();
            sendJson(404, ['error' => 'Pemesanan tidak ditemukan.']);
        }

        $booking = bookingForApi($row);
        $name = $booking['name'];
        $phone = $booking['phone'];
        $route = $booking['route'];
        $bookingNo = $booking['bookingNo'];
        $status = $booking['status'];

        if (array_key_exists('name', $body)) {
            $name = trim((string) $body['name']);
            if ($name === '') {
                throw new InvalidArgumentException('Nama penumpang wajib diisi.');
            }
        }
        if (array_key_exists('phone', $body)) {
            $phone = trim((string) $body['phone']);
            if ($phone === '') {
                throw new InvalidArgumentException('Nomor WhatsApp wajib diisi.');
            }
        }
        if (array_key_exists('route', $body)) {
            $route = (string) $body['route'];
            if (!in_array($route, ROUTES, true)) {
                throw new InvalidArgumentException('Rute penerbangan tidak valid.');
            }
        }
        if (array_key_exists('status', $body)) {
            $status = (string) $body['status'];
            if (!in_array($status, STATUSES, true)) {
                throw new InvalidArgumentException('Status pemesanan tidak valid.');
            }
        }
        if (
            !array_key_exists('name', $body)
            && !array_key_exists('phone', $body)
            && !array_key_exists('route', $body)
            && !array_key_exists('status', $body)
        ) {
            throw new InvalidArgumentException('Tidak ada perubahan data pemesanan.');
        }

        if ($route !== $booking['route']) {
            $statement = $database->prepare(
                'SELECT booking_no FROM bookings
                 WHERE route_code = :route AND travel_date = :date AND id <> :id
                 FOR UPDATE'
            );
            $statement->execute([
                'route' => $route,
                'date' => $booking['date'],
                'id' => $id,
            ]);
            $usedNumbers = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
            $availableNumbers = array_values(array_diff(range(1, BOOKING_LIMIT), $usedNumbers));

            if ($availableNumbers === []) {
                $database->rollBack();
                sendJson(409, ['error' => 'Kapasitas pada rute tujuan sudah penuh.']);
            }
            if (!in_array($bookingNo, $availableNumbers, true)) {
                $bookingNo = $availableNumbers[0];
            }
        }

        $statement = $database->prepare(
            'UPDATE bookings
             SET passenger_name = :name, phone = :phone, route_code = :route,
                 booking_no = :booking_no, status = :status
             WHERE id = :id'
        );
        $statement->execute([
            'name' => $name,
            'phone' => $phone,
            'route' => $route,
            'booking_no' => $bookingNo,
            'status' => $status,
            'id' => $id,
        ]);
        $database->commit();

$updatedBooking = fetchBooking($database, $id);

if ($updatedBooking === null) {
    sendJson(404, ['error' => 'Pemesanan tidak ditemukan.']);
}

// Kirim webhook hanya ketika status berubah menjadi Booked
if (
    $booking['status'] !== 'Booked'
    && $updatedBooking['status'] === 'Booked'
) {
    $webhookUrl = 'http://`192`.168.111.177:5678/webhook/booking-status';

    $payload = [
        'id' => $updatedBooking['id'],
        'name' => $updatedBooking['name'],
        'phone' => $updatedBooking['phone'],
        'bookingNo' => $updatedBooking['bookingNo'],
        'route' => $updatedBooking['route'],
        'date' => $updatedBooking['date'],
        'status' => $updatedBooking['status']
    ];

    $ch = curl_init($webhookUrl);

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10
    ]);

    $webhookResponse = curl_exec($ch);
    $webhookError = curl_error($ch);
    $webhookHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    error_log(
        'Booking webhook: HTTP ' . $webhookHttpCode .
        ' | Error: ' . $webhookError .
        ' | Response: ' . $webhookResponse
    );
}

sendJson(200, $updatedBooking);
    }

    if ($method === 'DELETE') {
        $statement = $database->prepare('DELETE FROM bookings WHERE id = :id');
        $statement->execute(['id' => $id]);
        if ($statement->rowCount() === 0) {
            sendJson(404, ['error' => 'Pemesanan tidak ditemukan.']);
        }
        sendJson(204);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    sendJson(405, ['error' => 'Metode permintaan tidak didukung.']);
} catch (InvalidArgumentException $error) {
    if (isset($database) && $database instanceof PDO && $database->inTransaction()) {
        $database->rollBack();
    }
    sendJson(400, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    if (isset($database) && $database instanceof PDO && $database->inTransaction()) {
        $database->rollBack();
    }
    error_log($error->getMessage());
    sendJson(500, ['error' => 'Terjadi kesalahan pada server. Periksa konfigurasi dan log PHP.']);
}
