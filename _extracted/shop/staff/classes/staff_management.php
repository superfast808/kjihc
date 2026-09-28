<?php
// classes/staff_management.php

require_once '../../vendor/autoload.php'; // Adjusted autoloader path
require_once 'config.php';
require_once '../../vendor/phpmailer/phpmailer/src/Exception.php'; // Adjusted path
require_once '../../vendor/phpmailer/phpmailer/src/PHPMailer.php'; // Adjusted path
require_once '../../vendor/phpmailer/phpmailer/src/SMTP.php'; // Adjusted path

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once 'config.php';

$db_host = DB_HOST;
$db_user = DB_USER;
$db_pass = DB_PASS;
$db_name = DB_NAME;

try {
    $db = new PDO("mysql:host=$db_host;dbname=$db_name", $db_user, $db_pass);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

class StaffManagement {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    public function getStaff() {
        $query = "SELECT staff_id, staff_email, staff_name, staff_level FROM kjihc_staff";
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getStaffById($id) {
        $query = "SELECT staff_id, staff_email, staff_name, staff_level FROM kjihc_staff WHERE staff_id = ?";
        $stmt = $this->db->prepare($query);
     $stmt->execute([$id]);
		
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function addStaff($email, $name, $password, $level) {
		//$password=$this->generatePassword();
		$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $query = "INSERT INTO kjihc_staff (staff_email, staff_name, staff_password, staff_level) VALUES (?, ?, ?, ?)";
        $stmt = $this->db->prepare($query);
        return $stmt->execute([$email, $name, $hashedPassword, $level]);
    }

    public function updateStaff($id, $email, $name, $level) {
        $query = "UPDATE kjihc_staff SET staff_email = ?, staff_name = ?, staff_level = ? WHERE staff_id = ?";
        $stmt = $this->db->prepare($query);
        return $stmt->execute([$email, $name, $level, $id]);
    }

    public function deleteStaff($id) {
        $query = "DELETE FROM kjihc_staff WHERE staff_id = ?";
        $stmt = $this->db->prepare($query);
        return $stmt->execute([$id]);
    }

    public function resetPassword($email,$id) {
        $newPassword = $this->generatePassword();
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
		error_log("pass set to $hashedPassword");
        $query = "UPDATE kjihc_staff SET staff_password = ? WHERE staff_id = ?";
		error_log("$query");
        $stmt = $this->db->prepare($query);

        if ($stmt->execute([$hashedPassword, $id])) {
					$errorInfo = $stmt->errorInfo();
    error_log("SQL Error: " . print_r($errorInfo, true));
            $this->sendPasswordEmail($email, $newPassword);
            return "true";
        } else {
			$errorInfo = $stmt->errorInfo();
			error_log("bullshit");
    error_log("SQL Error: " . print_r($errorInfo, true));
            return false;
        }
    }

    private function generatePassword($length = 12) {
        $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
        $password = '';
        $charLength = strlen($characters) - 1;

        for ($i = 0; $i < $length; $i++) {
            $password .= $characters[random_int(0, $charLength)];
        }

        return $password;
    }

 private function sendPasswordEmail($email, $password) {
        $mail = new PHPMailer(true);

        try {
            // Server settings
            $mail->SMTPDebug = SMTP::DEBUG_OFF; // Enable verbose debug output
            $mail->isSMTP(); // Send using SMTP
            $mail->Host = 'smtp.example.com'; // Set the SMTP server to send through
            $mail->SMTPAuth = true; // Enable SMTP authentication
            $mail->Username = 'your_email@example.com'; // SMTP username
            $mail->Password = 'your_smtp_password'; // SMTP password
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // Enable TLS encryption; `PHPMailer::ENCRYPTION_SMTPS` encouraged
            $mail->Port = 587; // TCP port to connect to, use 465 for `PHPMailer::ENCRYPTION_SMTPS` above

            // Recipients
            $mail->setFrom('webmaster@shopkillieicehockey.com', 'Webmaster');
            $mail->addAddress($email);

            // Content
            $mail->isHTML(false); // Set email format to plain text
            $mail->Subject = 'Your New Password';
            $mail->Body = 'Your new password is: ' . $password;

            $mail->send();
            error_log("Email sent to $email");
        } catch (Exception $e) {
            error_log("Message could not be sent. Mailer Error: {$mail->ErrorInfo}");
        }
    }
}

$staffManager = new StaffManagement($db);

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'getStaff':
        if (isset($_GET['id'])) {
          $staff = $staffManager->getStaffById($_GET['id']);
          echo json_encode($staff);
        } else {
          echo json_encode($staffManager->getStaff());
        }
        break;
    case 'addStaff':
        $email = $_POST['email'];
        $name = $_POST['name'];
        $level = $_POST['level'];
		        $staffPassword = $_POST['password'];
        echo $staffManager->addStaff($email, $name, $staffPassword, $level);
        break;
    case 'updateStaff':
        $id = $_POST['id'];
        $email = $_POST['email'];
        $name = $_POST['name'];
        $level = $_POST['level'];
        echo $staffManager->updateStaff($id, $email, $name, $level);
        break;
    case 'deleteStaff':
        $id = $_POST['id'];
        echo $staffManager->deleteStaff($id);
        break;
    case 'resetPassword':
        $email = $_POST['email'];
		$id = $_POST['id'];
		error_log("id:$id");
        echo $staffManager->resetPassword($email,$id);
        break;
		
		    case 'addStaff':
        $staffEmail = $_POST['email'];
        $staffName = $_POST['name'];
        $staffPassword = $_POST['password'];
        $staffLevel = $_POST['level'];

        $hashedPassword = password_hash($staffPassword, PASSWORD_DEFAULT);

        $query = "INSERT INTO staff (staff_email, staff_name, staff_password, staff_level) VALUES (:staff_email, :staff_name, :staff_password, :staff_level)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':staff_email', $staffEmail);
        $stmt->bindParam(':staff_name', $staffName);
        $stmt->bindParam(':staff_password', $hashedPassword);
        $stmt->bindParam(':staff_level', $staffLevel);
        $stmt->execute();
        break;
    default:
        // Handle invalid actions
        break;
}

?>