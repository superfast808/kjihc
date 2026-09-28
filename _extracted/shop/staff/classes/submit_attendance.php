<?php
require_once 'db.php';

if (!isset($_POST['entries']) || !is_array($_POST['entries'])) {
    http_response_code(400);
    echo 'Invalid data';
    exit;
}

foreach ($_POST['entries'] as $entry) {
    $player_id = $entry['player_id'] ?? null;
    $training_session = $entry['training_session'] ?? null;
    $session_date = $entry['session_date'] ?? null;

    // Match the dynamic key for status: status_XX (player ID)
    foreach ($entry as $key => $value) {
        if (strpos($key, 'status_') === 0) {
            $status = $value;
            break;
        }
    }

    $miss_reason = ($status === 'no') ? ($entry['miss_reason'] ?? null) : null;

    if ($player_id && $training_session && $session_date) {
        $stmt = $pdo->prepare("INSERT INTO kjihc_signins 
            (player_id, training_session, session_date, timestamp, miss_reason)
            VALUES (?, ?, ?, NOW(), ?)");
        $stmt->execute([$player_id, $training_session, $session_date, $miss_reason]);
    }
}

echo 'success';
