<?php
require_once 'db.php';

$group = $_GET['session'] ?? '';
$group = strtoupper($group);

$groupMap = [
    'LTP' => ['LTP', 'U10', 'U12'],
    'U12' => ['LTP','U10', 'U12', 'U14'],
    'U14' => ['U12', 'U14', 'U16'],
    'U16' => ['U14', 'U16', 'U19'],
    'U19' => ['U16', 'U19'],
    'LIGHTNING' => ['LIGHTNING']
];

$allowedGroups = $groupMap[$group] ?? [];

if (empty($allowedGroups)) {
    echo json_encode([]);
    exit;
}

$placeholders = rtrim(str_repeat('?,', count($allowedGroups)), ',');
$sql = "SELECT player_id, player_name FROM kjihc_members WHERE UPPER(player_agegroup) IN ($placeholders) ORDER BY player_name ASC";
$stmt = $pdo->prepare($sql);
$stmt->execute($allowedGroups);

$players = $stmt->fetchAll(PDO::FETCH_ASSOC);

header('Content-Type: application/json');
echo json_encode($players);
exit;
