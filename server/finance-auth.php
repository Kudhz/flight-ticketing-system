<?php

declare(strict_types=1);

function financeEnvironmentVariables(): array
{
    $keys = ['FINANCE_USERNAME', 'FINANCE_PASSWORD'];
    $values = [];
    $envPath = dirname(__DIR__) . '/.env';

    if (is_file($envPath)) {
        $contents = file_get_contents($envPath);
        if ($contents === false) {
            throw new RuntimeException('File .env tidak dapat dibaca.');
        }

        foreach (preg_split('/\r\n|\n|\r/', $contents) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $separator = strpos($line, '=');
            if ($separator === false) {
                continue;
            }

            $key = trim(substr($line, 0, $separator));
            if (!in_array($key, $keys, true)) {
                continue;
            }

            $value = trim(substr($line, $separator + 1));
            if (
                strlen($value) >= 2 &&
                (($value[0] === '"' && $value[strlen($value) - 1] === '"') ||
                 ($value[0] === "'" && $value[strlen($value) - 1] === "'"))
            ) {
                $value = substr($value, 1, -1);
            }
            $values[$key] = $value;
        }
    }

    foreach ($keys as $key) {
        $environmentValue = getenv($key);
        if ($environmentValue !== false) {
            $values[$key] = $environmentValue;
        }
    }

    return $values;
}

function financeAuthConfiguration(): ?array
{
    $config = financeEnvironmentVariables();
    $username = $config['FINANCE_USERNAME'] ?? null;
    $password = $config['FINANCE_PASSWORD'] ?? null;
    if (
        !is_string($username) ||
        $username === '' ||
        strlen($username) > 100 ||
        !is_string($password) ||
        $password === '' ||
        strlen($password) > 4096
    ) {
        return null;
    }

    return ['username' => $username, 'password' => $password];
}

function startFinanceSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('lupin_finance');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function financeSessionIsAuthenticated(?array $config = null): bool
{
    $config ??= financeAuthConfiguration();
    if ($config === null || session_status() !== PHP_SESSION_ACTIVE) {
        return false;
    }

    $sessionUsername = $_SESSION['finance_username'] ?? null;
    return is_string($sessionUsername)
        && hash_equals($config['username'], $sessionUsername);
}

function destroyFinanceSession(): void
{
    startFinanceSession();
    $_SESSION = [];

    $cookie = session_get_cookie_params();
    if (ini_get('session.use_cookies')) {
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $cookie['path'],
            'domain' => $cookie['domain'],
            'secure' => $cookie['secure'],
            'httponly' => $cookie['httponly'],
            'samesite' => $cookie['samesite'] ?? 'Lax',
        ]);
    }

    session_destroy();
}
