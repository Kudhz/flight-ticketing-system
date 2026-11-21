<?php

declare(strict_types=1);

require_once __DIR__ . '/flights-config.php';
require_once __DIR__ . '/finance-auth.php';

cors();
startFinanceSession();
$isFinanceUser = financeSessionIsAuthenticated();

function parseMonth(mixed $value): ?int
{
    if (is_numeric($value)) {
        $month = (int) $value;
        return $month >= 1 && $month <= 12 ? $month : null;
    }

    if (is_string($value)) {
        $months = [
            'januari' => 1,
            'februari' => 2,
            'maret' => 3,
            'april' => 4,
            'mei' => 5,
            'juni' => 6,
            'juli' => 7,
            'agustus' => 8,
            'september' => 9,
            'oktober' => 10,
            'november' => 11,
            'desember' => 12,
        ];

        return $months[strtolower(trim($value))] ?? null;
    }

    return null;
}

function readInteger(mixed $value): ?int
{
    if (!is_scalar($value) || filter_var($value, FILTER_VALIDATE_INT) === false) {
        return null;
    }

    return (int) $value;
}

function readWeight(mixed $value): ?float
{
    if ($value === null || $value === '') {
        return 0.0;
    }

    if (!is_numeric($value) || (float) $value < 0 || (float) $value > 99999999.99) {
        return null;
    }

    return round((float) $value, 2);
}

function readPassengerTypes(array $source): ?array
{
    $hasBreakdown = array_key_exists('adult_pax', $source) ||
        array_key_exists('adultPax', $source) ||
        array_key_exists('child_pax', $source) ||
        array_key_exists('childPax', $source) ||
        array_key_exists('infant_pax', $source) ||
        array_key_exists('infantPax', $source);

    if (!$hasBreakdown) {
        $pax = readInteger($source['pax'] ?? null);
        if ($pax === null || $pax < 0) return null;
        return ['pax' => $pax, 'adult_pax' => $pax, 'child_pax' => 0, 'infant_pax' => 0];
    }

    $adult = readInteger($source['adult_pax'] ?? $source['adultPax'] ?? 0);
    $child = readInteger($source['child_pax'] ?? $source['childPax'] ?? 0);
    $infant = readInteger($source['infant_pax'] ?? $source['infantPax'] ?? 0);
    if ($adult === null || $adult < 0 || $child === null || $child < 0 || $infant === null || $infant < 0) {
        return null;
    }

    $totalPax = $adult + $child + $infant;
    return ['pax' => $totalPax, 'adult_pax' => $adult, 'child_pax' => $child, 'infant_pax' => $infant];
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    $pdo = database();

    if ($method === 'GET') {
        $conditions = [];
        $params = [];

        if (isset($_GET['year']) && $_GET['year'] !== '') {
            $year = readInteger($_GET['year']);
            if ($year === null || $year < 2000 || $year > 2100) {
                sendJson(['success' => false, 'message' => 'Tahun tidak valid.'], 400);
            }
            $conditions[] = 'billing_year = :year';
            $params['year'] = $year;
        }

        if (isset($_GET['month']) && $_GET['month'] !== '') {
            $month = parseMonth($_GET['month']);
            if ($month === null) {
                sendJson(['success' => false, 'message' => 'Bulan tidak valid (gunakan 1-12 atau nama bulan Indonesia).'], 400);
            }
            $conditions[] = 'billing_month = :month';
            $params['month'] = $month;
        }

        if (($_GET['dataset'] ?? '') === 'loads') {
            $where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';
            $loadsQuery = $pdo->prepare("SELECT id, billing_year, billing_month, flight_day, pax, adult_pax, child_pax, infant_pax, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight FROM flight_load_records{$where} ORDER BY billing_year DESC, billing_month DESC, flight_day ASC, id ASC");
            $loadsQuery->execute($params);
            sendJson(['success' => true, 'data' => $loadsQuery->fetchAll()]);
        }

        $where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';
        $recordsQuery = $pdo->prepare("SELECT id, billing_year, billing_month, flight_day, route, pax, adult_pax, child_pax, infant_pax, basic_fare, fee_ticket, note, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight, created_at, updated_at FROM flight_records{$where} ORDER BY billing_year DESC, billing_month DESC, flight_day ASC, id ASC");
        $recordsQuery->execute($params);
        $records = $recordsQuery->fetchAll();

        $summaryQuery = $pdo->prepare("SELECT route, COUNT(*) AS total_flights, COALESCE(SUM(pax), 0) AS total_pax, COALESCE(SUM(adult_pax), 0) AS total_adult_pax, COALESCE(SUM(child_pax), 0) AS total_child_pax, COALESCE(SUM(infant_pax), 0) AS total_infant_pax, COALESCE(SUM((adult_pax + child_pax) * fee_ticket), 0) AS total_fee FROM flight_records{$where} GROUP BY route ORDER BY route");
        $summaryQuery->execute($params);
        $byRoute = $summaryQuery->fetchAll();

        $summary = [
            'total_flights' => 0,
            'total_pax' => 0,
            'total_adult_pax' => 0,
            'total_child_pax' => 0,
            'total_infant_pax' => 0,
            'total_fee' => 0,
            'by_route' => $byRoute,
        ];

        foreach ($byRoute as $routeSummary) {
            $summary['total_flights'] += (int) $routeSummary['total_flights'];
            $summary['total_pax'] += (int) $routeSummary['total_pax'];
            $summary['total_adult_pax'] += (int) ($routeSummary['total_adult_pax'] ?? 0);
            $summary['total_child_pax'] += (int) ($routeSummary['total_child_pax'] ?? 0);
            $summary['total_infant_pax'] += (int) ($routeSummary['total_infant_pax'] ?? 0);
            $summary['total_fee'] += (float) $routeSummary['total_fee'];
        }

        if (!$isFinanceUser) {
            $records = array_map(static function (array $record): array {
                unset($record['basic_fare'], $record['fee_ticket']);
                return $record;
            }, $records);
            $byRoute = array_map(static function (array $routeSummary): array {
                unset($routeSummary['total_fee']);
                return $routeSummary;
            }, $byRoute);
            unset($summary['total_fee']);
            $summary['by_route'] = $byRoute;
        }

        sendJson([
            'success' => true,
            'data' => $records,
            'summary' => $summary,
        ]);
    }

    if ($method === 'POST') {
        $payload = json_decode(file_get_contents('php://input'), true);
        if (!is_array($payload)) {
            sendJson(['success' => false, 'message' => 'Body harus berupa JSON yang valid.'], 400);
        }

        $year = readInteger($payload['billing_year'] ?? $payload['year'] ?? null);
        $month = parseMonth($payload['billing_month'] ?? $payload['month'] ?? null);
        if ($year === null || $year < 2000 || $year > 2100 || $month === null) {
            sendJson(['success' => false, 'message' => 'billing_year/year dan billing_month/month wajib diisi dengan nilai yang valid.'], 400);
        }

        if (($payload['dataset'] ?? '') === 'loads') {
            $loadRecords = $payload['records'] ?? null;
            if (!is_array($loadRecords) || $loadRecords === [] || count($loadRecords) > 500) {
                sendJson(['success' => false, 'message' => 'Kirim 1 sampai 500 data berat penerbangan.'], 400);
            }

            $validatedLoads = [];
            foreach ($loadRecords as $index => $record) {
                if (!is_array($record)) {
                    sendJson(['success' => false, 'message' => 'Format data tidak valid pada urutan ' . ($index + 1) . '.'], 400);
                }

                $day = readInteger($record['flight_day'] ?? null);
                $passengers = readPassengerTypes($record);
                $passengerWeight = readWeight($record['passenger_weight'] ?? 0);
                $baggagePieces = readInteger($record['baggage_pieces'] ?? 0);
                $baggageWeight = readWeight($record['baggage_weight'] ?? 0);
                $cabinBaggagePieces = readInteger($record['cabin_baggage_pieces'] ?? 0);
                $cabinBaggageWeight = readWeight($record['cabin_baggage_weight'] ?? 0);
                $cargoPieces = readInteger($record['cargo_pieces'] ?? 0);
                $cargoWeight = readWeight($record['cargo_weight'] ?? 0);

                if ($day === null || !checkdate($month, $day, $year) || $passengers === null) {
                    sendJson(['success' => false, 'message' => 'Tanggal atau jumlah PAX tidak valid pada urutan ' . ($index + 1) . '.'], 400);
                }
                if (
                    $passengerWeight === null || $baggagePieces === null || $baggagePieces < 0 ||
                    $baggageWeight === null || $cabinBaggagePieces === null || $cabinBaggagePieces < 0 ||
                    $cabinBaggageWeight === null || $cargoPieces === null || $cargoPieces < 0 ||
                    $cargoWeight === null
                ) {
                    sendJson(['success' => false, 'message' => 'Berat harus nol atau lebih dan jumlah koli harus bilangan bulat nol atau lebih pada urutan ' . ($index + 1) . '.'], 400);
                }

                $validatedLoads[] = [
                    'year' => $year,
                    'month' => $month,
                    'day' => $day,
                    'pax' => $passengers['pax'],
                    'adult_pax' => $passengers['adult_pax'],
                    'child_pax' => $passengers['child_pax'],
                    'infant_pax' => $passengers['infant_pax'],
                    'passenger_weight' => $passengerWeight,
                    'baggage_pieces' => $baggagePieces,
                    'baggage_weight' => $baggageWeight,
                    'cabin_baggage_pieces' => $cabinBaggagePieces,
                    'cabin_baggage_weight' => $cabinBaggageWeight,
                    'cargo_pieces' => $cargoPieces,
                    'cargo_weight' => $cargoWeight,
                    'total_weight' => round($passengerWeight + $baggageWeight + $cabinBaggageWeight + $cargoWeight, 2),
                ];
            }

            $pdo->beginTransaction();
            $deleteLoads = $pdo->prepare('DELETE FROM flight_load_records WHERE billing_year = :year AND billing_month = :month');
            $deleteLoads->execute(['year' => $year, 'month' => $month]);
            $insertLoad = $pdo->prepare('INSERT INTO flight_load_records (billing_year, billing_month, flight_day, pax, adult_pax, child_pax, infant_pax, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight) VALUES (:year, :month, :day, :pax, :adult_pax, :child_pax, :infant_pax, :passenger_weight, :baggage_pieces, :baggage_weight, :cabin_baggage_pieces, :cabin_baggage_weight, :cargo_pieces, :cargo_weight, :total_weight)');
            foreach ($validatedLoads as $record) {
                $insertLoad->execute($record);
            }
            $pdo->commit();

            sendJson([
                'success' => true,
                'message' => 'Data berat dan bagasi berhasil disimpan tanpa mengubah data keuangan.',
                'saved' => count($validatedLoads),
            ], 201);
        }

        $replacePeriod = ($payload['replace_period'] ?? false) === true;
        $flights = $payload['flights'] ?? [$payload];
        if (!is_array($flights) || count($flights) > 500 || ($flights === [] && !$replacePeriod)) {
            sendJson(['success' => false, 'message' => 'Kirim maksimal 500 data penerbangan. Data kosong hanya boleh untuk mengganti seluruh periode.'], 400);
        }

        $validatedFlights = [];
        $allowedRoutes = ['MDC-MNA', 'MNA-IAX', 'IAX-MNA', 'MNA-MDC'];

        foreach ($flights as $index => $flight) {
            if (!is_array($flight)) {
                sendJson(['success' => false, 'message' => 'Format data penerbangan tidak valid pada urutan ' . ($index + 1) . '.'], 400);
            }

            $day = readInteger($flight['flight_day'] ?? $flight['date'] ?? null);
            $route = $flight['route'] ?? null;
            $passengers = readPassengerTypes($flight);
            $routeFares = [
                'MNA-IAX' => ['basic_fare' => 380000, 'fee_ticket' => 19000],
                'MNA-MDC' => ['basic_fare' => 483000, 'fee_ticket' => 24150],
            ];
            $routeFare = is_string($route) ? ($routeFares[$route] ?? null) : null;
            $basicFare = $routeFare['basic_fare'] ?? $flight['basic_fare'] ?? $flight['basicFare'] ?? null;
            $feeTicket = $routeFare['fee_ticket'] ?? $flight['fee_ticket'] ?? $flight['feeTicket'] ?? null;
            $passengerWeight = readWeight($flight['passenger_weight'] ?? 0);
            $baggagePieces = readInteger($flight['baggage_pieces'] ?? 0);
            $baggageWeight = readWeight($flight['baggage_weight'] ?? 0);
            $cabinBaggagePieces = readInteger($flight['cabin_baggage_pieces'] ?? 0);
            $cabinBaggageWeight = readWeight($flight['cabin_baggage_weight'] ?? 0);
            $cargoPieces = readInteger($flight['cargo_pieces'] ?? 0);
            $cargoWeight = readWeight($flight['cargo_weight'] ?? 0);

            if ($day === null || !checkdate($month, $day, $year)) {
                sendJson(['success' => false, 'message' => 'Tanggal penerbangan tidak valid pada urutan ' . ($index + 1) . '.'], 400);
            }
            if (!is_string($route) || !in_array($route, $allowedRoutes, true)) {
                sendJson(['success' => false, 'message' => 'Route tidak valid pada urutan ' . ($index + 1) . '.'], 400);
            }
            if ($passengers === null) {
                sendJson(['success' => false, 'message' => 'PAX harus bilangan bulat nol atau lebih pada urutan ' . ($index + 1) . '.'], 400);
            }
            if (!is_numeric($basicFare) || (float) $basicFare < 0 || !is_numeric($feeTicket) || (float) $feeTicket < 0) {
                sendJson(['success' => false, 'message' => 'Basic fare dan fee tiket harus berupa angka nol atau lebih pada urutan ' . ($index + 1) . '.'], 400);
            }
            if (
                $passengerWeight === null || $baggagePieces === null || $baggagePieces < 0 ||
                $baggageWeight === null || $cabinBaggagePieces === null || $cabinBaggagePieces < 0 ||
                $cabinBaggageWeight === null || $cargoPieces === null || $cargoPieces < 0 ||
                $cargoWeight === null
            ) {
                sendJson(['success' => false, 'message' => 'Berat harus angka nol atau lebih dan jumlah koli harus bilangan bulat nol atau lebih pada urutan ' . ($index + 1) . '.'], 400);
            }

            $note = trim((string) ($flight['note'] ?? 'BERJADWAL'));
            $note = function_exists('mb_substr')
                ? mb_substr($note, 0, 255, 'UTF-8')
                : substr($note, 0, 255);

            $validatedFlights[] = [
                'year' => $year,
                'month' => $month,
                'day' => $day,
                'route' => $route,
                'pax' => $passengers['pax'],
                'adult_pax' => $passengers['adult_pax'],
                'child_pax' => $passengers['child_pax'],
                'infant_pax' => $passengers['infant_pax'],
                'basic_fare' => (float) $basicFare,
                'fee_ticket' => (float) $feeTicket,
                'note' => $note,
                'passenger_weight' => $passengerWeight,
                'baggage_pieces' => $baggagePieces,
                'baggage_weight' => $baggageWeight,
                'cabin_baggage_pieces' => $cabinBaggagePieces,
                'cabin_baggage_weight' => $cabinBaggageWeight,
                'cargo_pieces' => $cargoPieces,
                'cargo_weight' => $cargoWeight,
                'total_weight' => round(
                    $passengerWeight + $baggageWeight + $cabinBaggageWeight + $cargoWeight,
                    2
                ),
            ];
        }

        $insert = $pdo->prepare('INSERT INTO flight_records (billing_year, billing_month, flight_day, route, pax, adult_pax, child_pax, infant_pax, basic_fare, fee_ticket, note, passenger_weight, baggage_pieces, baggage_weight, cabin_baggage_pieces, cabin_baggage_weight, cargo_pieces, cargo_weight, total_weight) VALUES (:year, :month, :day, :route, :pax, :adult_pax, :child_pax, :infant_pax, :basic_fare, :fee_ticket, :note, :passenger_weight, :baggage_pieces, :baggage_weight, :cabin_baggage_pieces, :cabin_baggage_weight, :cargo_pieces, :cargo_weight, :total_weight)');
        $pdo->beginTransaction();
        if ($replacePeriod) {
            $deletePeriod = $pdo->prepare('DELETE FROM flight_records WHERE billing_year = :year AND billing_month = :month');
            $deletePeriod->execute(['year' => $year, 'month' => $month]);
        }
        foreach ($validatedFlights as $flight) {
            $insert->execute($flight);
        }
        $pdo->commit();

        sendJson([
            'success' => true,
            'message' => 'Data penerbangan berhasil disimpan.',
            'inserted' => count($validatedFlights),
        ], 201);
    }

    header('Allow: GET, POST, OPTIONS');
    sendJson(['success' => false, 'message' => 'Method tidak didukung.'], 405);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log($error->getMessage());
    $driverCode = $error instanceof PDOException
        ? ($error->errorInfo[1] ?? $error->getCode())
        : 'INTERNAL_ERROR';
    sendJson([
        'success' => false,
        'message' => 'Kesalahan server/database. Periksa koneksi MySQL dan log PHP.',
        'error_code' => (string) $driverCode,
    ], 500);
}
