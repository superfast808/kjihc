<?php
require_once 'db.php';

// Simple logging function
function log_debug($message) {
    file_put_contents(__DIR__ . '/../logs/signin_debug.log', date('Y-m-d H:i:s') . " - $message\n", FILE_APPEND);
}

$status = $_POST['status'] ?? [];
$reasons = $_POST['reason'] ?? [];
$date = $_POST['session_date'] ?? date('Y-m-d');
$session = $_POST['training_session'] ?? '';

log_debug("Received POST: " . json_encode($_POST));

if (!$session || empty($status)) {
    log_debug("Missing session or status data");
    echo 'error';
    exit;
}

foreach ($status as $player_id => $attended) {
    if ($attended === 'no') {
        $miss_reason = $reasons[$player_id] ?? '(no reason given)';
    } elseif ($attended === 'n/a') {
        $miss_reason = 'n/a - doesn\'t attend this session';
    } else {
        $miss_reason = null; // This means 'yes'
    }

    log_debug("Inserting: player_id=$player_id, session=$session, date=$date, attended=$attended, reason=$miss_reason");

    try {
        $stmt = $pdo->prepare("INSERT INTO kjihc_signins (player_id, training_session, session_date, timestamp, miss_reason)
                               VALUES (?, ?, ?, NOW(), ?)");
        $stmt->execute([$player_id, $session, $date, $miss_reason]);
    } catch (PDOException $e) {
        log_debug("DB Error: " . $e->getMessage());
        echo 'error';
        exit;
    }
}


log_debug("All sign-ins processed successfully");
echo 'success';
exit;
