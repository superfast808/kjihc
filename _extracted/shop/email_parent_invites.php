<?php
require_once 'vendor/autoload.php';
require_once 'classes/Database.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$db = new Database();

// Fetch distinct parent emails
$parents = $db->query("
    SELECT DISTINCT player_email 
    FROM kjihc_members 
    WHERE player_email IS NOT NULL 
      AND player_email != ''
      AND player_email NOT IN (
        SELECT DISTINCT email FROM parent_tokens
      )
")->fetchAll();
foreach ($parents as $parent) {
    $email = trim($parent['player_email']);

    $mail = new PHPMailer(true);

    // Enable debug logging to error log
    $mail->SMTPDebug = 0;
    $mail->Debugoutput = function($str, $level) {
        error_log("PHPMailer Debug: $str");
    };

    try {
        // Office 365 SMTP settings
        $mail->isSMTP();
        $mail->Host = 'smtp.office365.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'secretary@kjihc.org';
        $mail->Password = 'Magnumf0rce!'; // Replace with real password or app password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;

        // Email setup
        $mail->setFrom('secretary@kjihc.org', 'KJIHC Club Secretary');
        $mail->addAddress($email);
        $mail->isHTML(true);
        $mail->Subject = 'KJIHC Parent Portal - Please Confirm or Update Your Details';

        $body = '
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;">
            <div style="text-align:center;margin-bottom:20px;">
                <img src="https://join.shopkillieicehockey.com/img/KJIHC_beta.png" style="max-width:140px;" alt="KJIHC Logo">
            </div>
            <h2 style="color:#003366;">KJIHC Parent Portal Update</h2>
            <p>We are asking all parents and guardians to review and confirm the details we hold for your child(ren).</p>
            <p>You can now securely update emergency contacts, medical info, and confirm the latest policies and fees.</p>
            <p style="margin:20px 0;">
                <a href="https://join.shopkillieicehockey.com/parent-login.php" 
                   style="background:#003366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:5px;">
                   Access Parent Portal
                </a>
            </p>
            <p>This link will allow you to enter your email address and receive a secure login code.</p>
            <p style="font-size:12px;color:#666;">If you did not expect this message or are no longer part of the club, you can ignore this email.</p>
            <p style="font-size:12px;color:#666;">Thank you,<br><strong>Kilmarnock Junior Ice Hockey Club</strong></p>
        </div>';

        $mail->Body = $body;
        $mail->AltBody = 'Please visit https://join.shopkillieicehockey.com/parent-login.php to confirm your details.';

        $mail->send();
        echo "Sent to: {$email}<br>";
    } catch (Exception $e) {
        echo "Error sending to {$email}: " . $mail->ErrorInfo . "<br>";
        error_log("PHPMailer Error: " . $mail->ErrorInfo);
    }
}
?>