<?php
$pdo = new PDO("mysql:host=localhost;dbname=join_xv445", "join_xv446", "o3De@460p");

$search = isset($_GET['search']) ? strtolower($_GET['search']) : '';

// SQL query base
$sql = "SELECT player_id, player_name, player_agegroup FROM kjihc_members";
$params = [];

if (!empty($search)) {
    $sql .= " WHERE player_name LIKE :search";
    $params['search'] = "%$search%";
}

$sql .= " ORDER BY player_agegroup ASC, player_name ASC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Return as JSON
header('Content-Type: application/json');
echo json_encode($results);
exit;
