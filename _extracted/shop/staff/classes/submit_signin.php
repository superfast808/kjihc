<?php
$pdo = new PDO("mysql:host=localhost;dbname=join_xv445", "join_xv446", "o3De@460p");

$player_id = $_POST['player_id'];
$training_session = $_POST['training_session'];
$session_date = $_POST['session_date'];

$stmt = $pdo->prepare("INSERT INTO kjihc_signins (player_id, training_session, session_date, timestamp) VALUES (?, ?, ?, NOW())");
$stmt->execute([$player_id, $training_session, $session_date]);

echo 'success';
