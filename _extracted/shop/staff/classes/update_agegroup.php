<?php
$servername = "localhost";
$username = "join_xv446";
$password = "o3De@460p";
$dbname = "join_xv445";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Sanitize input using prepared statements:
$player_id = $_POST['player_id'];
$age_group = $_POST['age_group'];

$stmt = $conn->prepare("UPDATE kjihc_members SET player_agegroup = ? WHERE player_id = ?");
$stmt->bind_param("si", $age_group, $player_id); //s for string, i for integer.

if ($stmt->execute()) {
    echo "success";
} else {
    echo "Error updating record: " . $stmt->error;
}

$stmt->close();
$conn->close();
?>