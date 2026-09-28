<?php
require_once 'header.php'; // ✅ ensures Bootstrap & site layout are applied
require_once 'vendor/autoload.php';
require_once 'classes/Database.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$logo = "img/KJIHC_beta.png";

if (!empty($_POST['email'])) {
    $email = trim($_POST['email']);
    $db = new Database();

    $stmt = $db->prepare("SELECT COUNT(*) as c FROM kjihc_members WHERE player_email = ?");
    $stmt->execute([$email]);
    $count = $stmt->fetch()['c'];
?>
<div class="container mt-4" style="max-width:600px;">
  <div class="card shadow">
    <div class="card-body text-center">
      <img src="<?php echo $logo; ?>" alt="KJIHC Logo" style="max-width:150px; margin-bottom:15px;">
      <h3 class="mb-3">Parent Portal</h3>
      <?php
      if ($count > 0) {
          $token = bin2hex(random_bytes(16));
          $expires = date('Y-m-d H:i:s', strtotime('+10 minutes'));

          $stmt = $db->prepare("INSERT INTO parent_tokens (email, token, expires_at) VALUES (?, ?, ?)");
          $stmt->execute([$email, $token, $expires]);

          $link = "https://" . $_SERVER['HTTP_HOST'] . "/parent-dashboard.php?token=" . $token;

          $mail = new PHPMailer(true);
          $mail->SMTPDebug = 2;
          $mail->Debugoutput = function ($str, $level) { error_log("PHPMailer Debug: $str"); };

          try {
              $mail->isSMTP();
              $mail->Host = 'smtp.office365.com';
              $mail->SMTPAuth = true;
              $mail->Username = 'secretary@kjihc.org';
              $mail->Password = 'Magnumf0rce!'; // change to real password or app password
              $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
              $mail->Port = 587;

              $mail->setFrom('secretary@kjihc.org', 'KJIHC Parent Portal');
              $mail->addAddress($email);
              $mail->Subject = 'Your Parent Portal Login Link';
              $mail->Body = "Hello,\n\nYou requested access to the KJIHC Parent Portal.\n\nClick the secure link below (valid for 10 minutes):\n\n$link\n\nIf you did not request this, please ignore this email.";

              $mail->send();
              echo '
                <div class="alert alert-success" role="alert">
                  ✅ <strong>Success:</strong> A secure login link has been sent to <strong>' . htmlspecialchars($email) . '</strong>.<br>
                  Please check your inbox (and Spam folder).
                </div>';
          } catch (Exception $e) {
              error_log("PHPMailer Error: " . $mail->ErrorInfo);
              echo '
                <div class="alert alert-danger" role="alert">
                  ❌ <strong>Error:</strong> There was a problem sending the email. Please try again or contact support.
                </div>';
          }
      } else {
          echo '
            <div class="alert alert-warning" role="alert">
              ⚠️ <strong>Warning:</strong> We could not find a player associated with <strong>' . htmlspecialchars($email) . '</strong>.
            </div>';
      }
      ?>
      <a href="parent-login.php" class="btn btn-primary mt-3">⬅ Back to Login</a>
    </div>
  </div>
</div>
<?php } ?>
