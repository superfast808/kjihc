<?php
// processData.php
session_start();
// Sanitize and validate input (crucial!)
$playerName = htmlspecialchars($_POST['playerName']);
$parentName = htmlspecialchars($_POST['parentName']);
$dob = htmlspecialchars($_POST['dob']);
$addressLine1 = htmlspecialchars($_POST['addressLine1']);
$addressLine2 = htmlspecialchars($_POST['addressLine2']);
$city = htmlspecialchars($_POST['city']);
$postcode = htmlspecialchars($_POST['postcode']);
$contactNumber = htmlspecialchars($_POST['contactNumber']);
$emailAddress = htmlspecialchars($_POST['emailAddress']);
$playerlevel = htmlspecialchars($_POST['playerlevel']);
$medicalinfo = htmlspecialchars($_POST['medicalinfo']);
$medication = htmlspecialchars($_POST['medication']);
$hiddenfee = htmlspecialchars($_POST['hiddenfee']);
$codeOfConductCheckbox = htmlspecialchars($_POST['codeOfConductCheckbox']); // Ensure it's an integer
$feeCheckbox = htmlspecialchars($_POST['feeCheckbox']); // Ensure it's an integer

$_SESSION['playerName']=$playerName;
$_SESSION['parentName']=$parentName;
$_SESSION['hideenfee']=$hiddenfee;
$_SESSION['playerlevel']=$playerlevel;
$_SESSION['step2complete']='0';


// Basic validation example:
if (empty($playerName) || empty($parentName) || empty($dob) || empty($addressLine1) || empty($city) || empty($postcode) || empty($contactNumber) || empty($emailAddress) || empty($playerlevel)) {
    $response = ['status' => 'error', 'message' => 'All required fields must be filled.'];
    header('Content-Type: application/json');
    echo json_encode($response);
    exit; // Stop further processing
}

// More robust validation (example):
if (!filter_var($emailAddress, FILTER_VALIDATE_EMAIL)) {
    $response = ['status' => 'error', 'message' => 'Invalid email format.'];
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Process the data (e.g., save to a database)
// Example database connection and insert (replace with your actual database code):

$servername = "localhost";
$username = "join_xv446";
$password = "o3De@460p";
$dbname = "join_xv445";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    $response = ['status' => 'error', 'message' => 'Database connection failed: ' . $conn->connect_error];
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

$sql = "INSERT INTO kjihc_members (player_name, player_parent, player_dob, player_address1, player_address2, player_city, player_post, player_contacttel, player_email, player_agegroup, player_medicalnotes, player_medication, player_fee, read_code,agree_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sssssssssssssss", $playerName, $parentName, $dob, $addressLine1, $addressLine2, $city, $postcode, $contactNumber, $emailAddress, $playerlevel, $medicalinfo, $medication, $hiddenfee, $codeOfConductCheckbox, $feeCheckbox);

if ($stmt->execute()) {
    $response = ['status' => 'success', 'message' => 'Data received and processed.'];
	$_SESSION['step2complete']='1';
} else {
    $response = ['status' => 'error', 'message' => 'Error: ' . $sql . "<br>" . $conn->error];
}


$stmt->close();
$conn->close();

// Send a JSON response
header('Content-Type: application/json');
echo json_encode($response);
?>