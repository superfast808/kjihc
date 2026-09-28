<?php
require_once 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function safe($field) {
    return htmlspecialchars($_POST[$field] ?? '', ENT_QUOTES);
}

// Format email body
$body = "<h2>New Parent Survey Submission</h2>";
$body .= "<p><strong>Player Name(s):</strong> " . safe('player_names') . "</p>";

$roles = isset($_POST['roles']) ? implode(', ', $_POST['roles']) : 'None';
$body .= "<p><strong>Roles Volunteered:</strong> $roles</p>";
$body .= "<p><strong>Volunteer Reason:</strong> " . nl2br(safe('volunteer_reason')) . "</p>";
$body .= "<p><strong>Would Volunteer in Future:</strong> " . safe('volunteer_future') . "</p>";
$body .= "<p><strong>Matchday Rating:</strong> " . safe('matchday_rating') . "</p>";

$body .= "<h4>Facilities</h4>";
$body .= "<p><strong>Feedback:</strong> " . nl2br(safe('facilities_feedback')) . "</p>";
$body .= "<p><strong>Support Fundraising:</strong> " . safe('support_fundraising') . "</p>";

$body .= "<h4>Communication & Social Media</h4>";
$body .= "<p><strong>How You Stay Informed:</strong> " . safe('club_news_source') . "</p>";
$body .= "<p><strong>Communication Rating:</strong> " . safe('comm_rating') . "</p>";
$body .= "<p><strong>Suggestions:</strong> " . nl2br(safe('social_feedback')) . "</p>";

$body .= "<h4>Thunder (SNL Team)</h4>";
$body .= "<p><strong>Attend Games:</strong> " . safe('thunder_attend') . "</p>";
$body .= "<p><strong>Why Not:</strong> " . nl2br(safe('thunder_reason')) . "</p>";
$body .= "<p><strong>Experience Feedback:</strong> " . nl2br(safe('thunder_feedback')) . "</p>";

$body .= "<h4>General</h4>";
$body .= "<p><strong>What KJIHC Does Well:</strong> " . nl2br(safe('positive_feedback')) . "</p>";
$body .= "<p><strong>One Improvement:</strong> " . nl2br(safe('improvement_suggestion')) . "</p>";
$body .= "<p><strong>Suggestions for Welcoming Parents:</strong> " . nl2br(safe('onboarding_ideas')) . "</p>";

// Setup PHPMailer
$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = 'smtp.office365.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'secretary@kjihc.org';
    $mail->Password = 'Magnumf0rce!';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;

    $mail->setFrom('secretary@kjihc.org', 'KJIHC Survey');
    $mail->addAddress('chairperson@kjihc.org');
    $mail->Subject = 'New Parent Survey Response';
    $mail->isHTML(true);
    $mail->Body = $body;

    $mail->send();

    echo "<div class='container mt-4' style='max-width:600px;'>
            <div class='card shadow'>
              <div class='card-body text-center'>
                <img src='img/KJIHC_beta.png' alt='KJIHC Logo' style='max-width:120px; margin-bottom:15px;'>
                <h3 class='text-success'>✅ Thank you!</h3>
                <p>Your feedback has been submitted successfully.</p>
                <a href='/' class='btn btn-primary mt-2'>Return Home</a>
              </div>
            </div>
          </div>";
} catch (Exception $e) {
    error_log("Survey mail error: " . $mail->ErrorInfo);
    echo "<div class='container mt-4'><div class='alert alert-danger'>❌ There was an error sending your feedback. Please try again later.</div></div>";
}
?>