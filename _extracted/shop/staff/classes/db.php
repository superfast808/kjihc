<?php
$host = 'localhost';
$dbname = 'join_xv445';
$user = 'join_xv446';
$pass = 'o3De@460p';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, // Throw exceptions on errors
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, // Return results as associative arrays
        PDO::ATTR_EMULATE_PREPARES => false, // Use native prepared statements
    ]);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}
