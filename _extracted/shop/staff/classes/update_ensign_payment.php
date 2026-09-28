<?php
session_start();

// Permission check: staff_level = 1 or Microsoft
$allowed = (
    (isset($_SESSION['staff_level']) && (int)$_SESSION['staff_level'] === 1) ||
    (isset($_SESSION['staff_email']) && $_SESSION['staff_email'] === "microsoft")
);

if (!$allowed) {
    http_response_code(403);
    echo 'forbidden';
    exit;
}

// Basic validation
$id     = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$status = isset($_POST['status']) ? (int)$_POST['status'] : 0;

if ($id <= 0 || $status < 0 || $status > 2) {
    http_response_code(400);
    echo 'invalid';
    exit;
}

// PDO connection (same creds you gave earlier)
try {
    $dsn = "mysql:host=localhost;dbname=join_xv445;charset=utf8mb4";
    $pdo = new PDO($dsn, "join_xv446", "o3De@460p", [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false
    ]);

    $stmt = $pdo->prepare("UPDATE ensign_ewart_entries SET payment_status = :status WHERE id = :id");
    $stmt->execute([
        ':status' => $status,
        ':id'     => $id,
    ]);

    echo 'ok';
} catch (PDOException $e) {
    http_response_code(500);
    echo 'error';
}
