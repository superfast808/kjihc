<?php
$pdo = new PDO("mysql:host=localhost;dbname=join_xv445", "join_xv446", "o3De@460p");

$where = [];
$params = [];

if (!empty($_POST['date'])) {
    $where[] = "s.session_date = ?";
    $params[] = $_POST['date'];
}

if (!empty($_POST['session'])) {
    $where[] = "s.training_session = ?";
    $params[] = $_POST['session'];
}

if (!empty($_POST['player_id'])) {
    $where[] = "s.player_id = ?";
    $params[] = $_POST['player_id'];
}

$sql = "SELECT 
            DATE_FORMAT(s.session_date,'%d/%m/%Y') as niceDate,
            TIME(s.timestamp) AS time,
            m.player_name,
            s.training_session,
            s.miss_reason
        FROM kjihc_signins s
        JOIN kjihc_members m ON s.player_id = m.player_id";

if ($where) {
    $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= " ORDER BY s.session_date DESC, s.timestamp DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["data" => $data]);
