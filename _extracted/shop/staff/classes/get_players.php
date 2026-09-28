<?php
// Replace with your database credentials
$servername = "localhost";
$username = "join_xv446";
$password = "o3De@460p";
$dbname = "join_xv445";
session_start();
$email=$_SESSION['staff_email'];
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
$sqlpre="SELECT staff_level FROM kjihc_staff WHERE staff_email=?";

$stmt = $conn->prepare($sqlpre);
$stmt->bind_param("s", $email);
$stmt->execute();
$resultf = $stmt->get_result();

$resultarray=$resultf->fetch_array(MYSQLI_BOTH);



$sql = "SELECT player_id, player_name, player_dob, player_agegroup, player_parent, player_contacttel, player_email FROM kjihc_members";

$result = $conn->query($sql);
if($resultarray[0]==1 || $email=="microsoft"){
$players = array();
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $players[] = $row;
    }
}
} else {
$exp=explode(",",$resultarray[0]);	
$players = array();
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
		if(in_array($row['player_agegroup'],$exp)){
        $players[] = $row;
		}
    }
}	
		   }
echo json_encode($players);
$conn->close();
?>