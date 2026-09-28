<?php
// Replace with your database credentials
$servername = "localhost";
$username = "join_xv446";
$password = "o3De@460p";
$dbname = "join_xv445";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$player_id = $_GET['player_id'];

$sql = "SELECT player_id, player_name, player_dob, player_agegroup, player_parent, player_contacttel, player_email, player_address1, player_address2, player_city, player_post, player_medicalnotes, player_medication, player_fee, read_code, agree_fee, agree_gdpr, agree_photo FROM kjihc_members WHERE player_id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $player_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $player = $result->fetch_assoc();
    echo json_encode($player);
} else {
    echo json_encode(array()); // Return empty array if not found
}

$stmt->close();
$conn->close();
?>