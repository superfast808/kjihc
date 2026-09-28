<?php
// classes/delete_player.php
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['player_id'])) {
    $player_id = $_POST['player_id'];

    // Database connection details
$servername = "localhost";
$username = "join_xv446";
$password = "o3De@460p";
$dbname = "join_xv445";

    try {
        $conn = new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Prepare and execute the delete statement
        $stmt = $conn->prepare("DELETE FROM kjihc_members WHERE player_id = :player_id");
        $stmt->bindParam(':player_id', $player_id);
        $stmt->execute();

        echo "success"; // Indicate successful deletion
    } catch (PDOException $e) {
        echo "error: " . $e->getMessage(); // Indicate error with message
    }

    $conn = null; // Close the connection
} else {
    echo "error: Invalid request."; // Handle invalid requests
}
?>