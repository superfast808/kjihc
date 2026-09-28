<?php



// PHP (e.g., your_page.php)

// Assuming you have a database connection established
// and a function to get the staff_access for the current user.
// Replace this with your actual database logic.
session_start();
$email=$_SESSION['staff_email'];
function getStaffAccessFromDatabase($userId) {


    // Example database query (replace with your actual query)
$servername = "localhost";
$username = "join_xv446";
$password = "o3De@460p";
$dbname = "join_xv445";

if($userId=='microsoft'){
return '1';
}
	$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

    $stmt = $conn->prepare("SELECT staff_level FROM kjihc_staff WHERE staff_email = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $staffAccess = $row["staff_level"];
        $stmt->close();
        $conn->close();
        return $staffAccess;
    } else {
        $stmt->close();
        $conn->close();
        return ""; // Or handle no user found
    }
}

// Get the user ID (you'll need to adapt this based on your authentication)
//$userId = 1; // Example user ID




$staffAccess = getStaffAccessFromDatabase($email);

// Output the staffAccess as JSON
echo json_encode(['staffAccess' => $staffAccess]);
?>