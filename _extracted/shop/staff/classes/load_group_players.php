<?php
require_once 'db.php'; // your db connection

$group = $_GET['age_group'] ?? '';
$stmt = $pdo->prepare("SELECT player_id, player_name FROM kjihc_members WHERE player_agegroup = ? ORDER BY player_name");
$stmt->execute([$group]);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
