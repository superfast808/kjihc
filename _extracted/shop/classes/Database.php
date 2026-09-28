<?php
class Database extends PDO {
    public function __construct() {
        $host = "localhost";
        $dbname = "join_xv445";
        $username = "join_xv446";
        $password = "o3De@460p";

        $dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";

        try {
            parent::__construct($dsn, $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);
        } catch (PDOException $e) {
            die("Database connection failed: " . $e->getMessage());
        }
    }
}
?>
