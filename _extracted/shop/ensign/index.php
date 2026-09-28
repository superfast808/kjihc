<?php
// ensign-ewart.php

// Composer autoloader (assuming this file lives in /ensign/ and vendor is one level up)
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Dompdf\Dompdf;
use Dompdf\Options;

// ---- DB CONFIG ----
$host = 'localhost';
$db   = 'join_xv445';
$user = 'DB_USERNAME_HERE';     // TODO: set DB username
$pass = 'DB_PASSWORD_HERE';     // TODO: set DB password

$successMessage = '';
$errorMessage   = '';

/**
 * Generate PDF of the entry
 */
function generateEnsignPDF(array $data): string
{
    $options = new Options();
    $options->set('isRemoteEnabled', true);
    $dompdf = new Dompdf($options);

    // Make everything HTML-safe + preserve newlines
    $safe = [];
    foreach ($data as $k => $v) {
        $safe[$k] = nl2br(htmlspecialchars((string)$v));
    }

    $html = "
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; }
        h1 { font-size: 22px; margin-bottom: 10px; }
        h2 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; }
        p { margin: 2px 0; }
        .section { margin-bottom: 12px; }
        .label { font-weight: bold; }
    </style>

    <h1>Ensign Ewart 2026 – Team Entry</h1>
    <p><small>Generated on " . date('d M Y H:i') . "</small></p>

    <div class='section'>
        <h2>Entry Details</h2>
        <p><span class='label'>Age Group:</span> {$safe['age_group']}</p>
        <p><span class='label'>Club Name:</span> {$safe['club_name']}</p>
        <p><span class='label'>Team Name:</span> {$safe['team_name']}</p>
        <p><span class='label'>Shirt Colour (Home):</span> {$safe['shirt_colour_home']}</p>
        <p><span class='label'>Shirt Colour (Away):</span> {$safe['shirt_colour_away']}</p>
        <p><span class='label'>Coaches / Team Officials:</span> {$safe['num_coaches_officials']}</p>
    </div>

    <div class='section'>
        <h2>Senior Club Contact</h2>
        <p><span class='label'>Name:</span> {$safe['senior_contact_name']}</p>
        <p><span class='label'>Phone &amp; Email:</span> {$safe['senior_contact_phone_email']}</p>
    </div>

    <div class='section'>
        <h2>Booking Contact</h2>
        <p><span class='label'>Name:</span> {$safe['booking_contact_name']}</p>
        <p><span class='label'>Phone:</span> {$safe['booking_contact_phone']}</p>
        <p><span class='label'>Email:</span> {$safe['booking_contact_email']}</p>
    </div>

    <div class='section'>
        <h2>Manager Contact</h2>
        <p><span class='label'>Name:</span> {$safe['manager_name']}</p>
        <p><span class='label'>Phone:</span> {$safe['manager_phone']}</p>
        <p><span class='label'>Email:</span> {$safe['manager_email']}</p>
    </div>

    <div class='section'>
        <h2>Remarks / Special Requirements</h2>
        <p>{$safe['remarks']}</p>
    </div>

    <div class='section'>
        <h2>Declaration</h2>
        <p><span class='label'>Signature:</span> {$safe['signature']}</p>
        <p><span class='label'>Print Name:</span> {$safe['print_name']}</p>
        <p><span class='label'>Position in Club:</span> {$safe['position_in_club']}</p>
        <p><span class='label'>Date Signed:</span> {$safe['date_signed']}</p>
    </div>
    ";

    $dompdf->loadHtml($html);
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();

    return $dompdf->output();
}

/**
 * Send notification email to chairperson with PDF + optional team list
 */
function sendEnsignNotificationEmail(array $data, ?string $pdf = null, ?array $teamListFile = null): void
{
    $mail = new PHPMailer(true);

    try {
        // SMTP server settings (copy your working settings from staff_management.php)
        $mail->isSMTP();
        $mail->Host       = 'smtp.office365.com';          // TODO: your SMTP server
        $mail->SMTPAuth   = true;
        $mail->Username   = 'secretary@kjihc.org';    // TODO: SMTP username
        $mail->Password   = 'Magnumf0rce!';        // TODO: SMTP password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        // From / To
        $mail->setFrom('secretary@kjihc.org', 'KJIHC Website');
        $mail->addAddress('chairperson@kjihc.org', 'KJIHC Chairperson');

        $club     = $data['club_name']   ?? '';
        $team     = $data['team_name']   ?? '';
        $age      = $data['age_group']   ?? '';
        $manager  = $data['manager_name'] ?? '';
        $mEmail   = $data['manager_email'] ?? '';

        $mail->isHTML(false);
        $mail->Subject = "New Ensign Ewart entry: {$club} ({$age})";

        $body  = "A new Ensign Ewart entry has been received.\n\n";
        $body .= "Age Group: {$age}\n";
        $body .= "Club: {$club}\n";
        $body .= "Team: {$team}\n\n";
        $body .= "Manager: {$manager}\n";
        $body .= "Manager Email: {$mEmail}\n\n";
        $body .= "This is an automated notification from the KJIHC website.\n";

        $mail->Body = $body;

        // Attach PDF
        if ($pdf) {
            $mail->addStringAttachment($pdf, "Ensign_Ewart_Entry.pdf", 'base64', 'application/pdf');
        }

        // Attach team list file if provided
        if ($teamListFile && isset($teamListFile['tmp_name'], $teamListFile['name']) && is_file($teamListFile['tmp_name'])) {
            $mail->addAttachment($teamListFile['tmp_name'], $teamListFile['name']);
        }

        $mail->send();
    } catch (Exception $e) {
        error_log("Ensign Ewart notification failed: {$mail->ErrorInfo}");
    }
}

// -------------------------------------------------------------------------
// Handle form submission
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Helper for sanitisation
    $field = function ($name) {
        return isset($_POST[$name]) ? trim((string)$_POST[$name]) : '';
    };

    $age_group                   = $field('age_group');
    $club_name                   = $field('club_name');
    $team_name                   = $field('team_name');
    $shirt_colour_home           = $field('shirt_colour_home');
    $shirt_colour_away           = $field('shirt_colour_away');
    $num_coaches_officials       = $field('num_coaches_officials');

    $senior_contact_name         = $field('senior_contact_name');
    $senior_contact_phone_email  = $field('senior_contact_phone_email');

    $booking_contact_name        = $field('booking_contact_name');
    $booking_contact_phone       = $field('booking_contact_phone');
    $booking_contact_email       = $field('booking_contact_email');

    $manager_name                = $field('manager_name');
    $manager_phone               = $field('manager_phone');
    $manager_email               = $field('manager_email');

    $remarks                     = $field('remarks');

    $signature                   = $field('signature');
    $print_name                  = $field('print_name');
    $position_in_club            = $field('position_in_club');
    $date_signed                 = $field('date_signed');

    // Optional Team List file
    $teamListFile = $_FILES['team_list_file'] ?? null;
    $teamListOk   = null;

    if ($teamListFile && $teamListFile['error'] !== UPLOAD_ERR_NO_FILE) {
        if ($teamListFile['error'] === UPLOAD_ERR_OK) {
            $maxSize = 5 * 1024 * 1024; // 5MB
            if ($teamListFile['size'] <= $maxSize) {
                $allowedExt = ['pdf','doc','docx','xls','xlsx','csv','odt','ods','txt'];
                $ext = strtolower(pathinfo($teamListFile['name'], PATHINFO_EXTENSION));

                if (in_array($ext, $allowedExt, true)) {
                    $teamListOk = $teamListFile;
                } else {
                    $errorMessage = 'Team list file type is not allowed.';
                }
            } else {
                $errorMessage = 'Team list file is too large (max 5MB).';
            }
        } else {
            $errorMessage = 'There was a problem uploading the team list file.';
        }
    }

    // Required fields check
    if ($errorMessage === '') {
        $required = [
            'age_group'                   => $age_group,
            'club_name'                   => $club_name,
            'team_name'                   => $team_name,
            'shirt_colour_home'           => $shirt_colour_home,
            'shirt_colour_away'           => $shirt_colour_away,
            'num_coaches_officials'       => $num_coaches_officials,
            'senior_contact_name'         => $senior_contact_name,
            'senior_contact_phone_email'  => $senior_contact_phone_email,
            'booking_contact_name'        => $booking_contact_name,
            'booking_contact_phone'       => $booking_contact_phone,
            'booking_contact_email'       => $booking_contact_email,
            'manager_name'                => $manager_name,
            'manager_phone'               => $manager_phone,
            'manager_email'               => $manager_email,
            'signature'                   => $signature,
            'print_name'                  => $print_name,
            'position_in_club'            => $position_in_club,
            'date_signed'                 => $date_signed,
        ];

        foreach ($required as $k => $v) {
            if ($v === '') {
                $errorMessage = 'Please complete all required fields.';
                break;
            }
        }
    }

    if ($errorMessage === '') {
        try {
            $dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

            $sql = "INSERT INTO ensign_ewart_entries (
                        age_group, club_name, team_name,
                        shirt_colour_home, shirt_colour_away, num_coaches_officials,
                        senior_contact_name, senior_contact_phone_email,
                        booking_contact_name, booking_contact_phone, booking_contact_email,
                        manager_name, manager_phone, manager_email,
                        remarks,
                        signature, print_name, position_in_club, date_signed
                    ) VALUES (
                        :age_group, :club_name, :team_name,
                        :shirt_colour_home, :shirt_colour_away, :num_coaches_officials,
                        :senior_contact_name, :senior_contact_phone_email,
                        :booking_contact_name, :booking_contact_phone, :booking_contact_email,
                        :manager_name, :manager_phone, :manager_email,
                        :remarks,
                        :signature, :print_name, :position_in_club, :date_signed
                    )";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':age_group'                 => $age_group,
                ':club_name'                 => $club_name,
                ':team_name'                 => $team_name,
                ':shirt_colour_home'         => $shirt_colour_home,
                ':shirt_colour_away'         => $shirt_colour_away,
                ':num_coaches_officials'     => $num_coaches_officials,
                ':senior_contact_name'       => $senior_contact_name,
                ':senior_contact_phone_email'=> $senior_contact_phone_email,
                ':booking_contact_name'      => $booking_contact_name,
                ':booking_contact_phone'     => $booking_contact_phone,
                ':booking_contact_email'     => $booking_contact_email,
                ':manager_name'              => $manager_name,
                ':manager_phone'             => $manager_phone,
                ':manager_email'             => $manager_email,
                ':remarks'                   => $remarks,
                ':signature'                 => $signature,
                ':print_name'                => $print_name,
                ':position_in_club'          => $position_in_club,
                ':date_signed'               => $date_signed,
            ]);

            // Generate PDF for email
            $pdfData = generateEnsignPDF([
                'age_group'                 => $age_group,
                'club_name'                 => $club_name,
                'team_name'                 => $team_name,
                'shirt_colour_home'         => $shirt_colour_home,
                'shirt_colour_away'         => $shirt_colour_away,
                'num_coaches_officials'     => $num_coaches_officials,
                'senior_contact_name'       => $senior_contact_name,
                'senior_contact_phone_email'=> $senior_contact_phone_email,
                'booking_contact_name'      => $booking_contact_name,
                'booking_contact_phone'     => $booking_contact_phone,
                'booking_contact_email'     => $booking_contact_email,
                'manager_name'              => $manager_name,
                'manager_phone'             => $manager_phone,
                'manager_email'             => $manager_email,
                'remarks'                   => $remarks,
                'signature'                 => $signature,
                'print_name'                => $print_name,
                'position_in_club'          => $position_in_club,
                'date_signed'               => $date_signed,
            ]);

            // Send notification email (with PDF + optional team list attached)
            sendEnsignNotificationEmail([
                'age_group'                 => $age_group,
                'club_name'                 => $club_name,
                'team_name'                 => $team_name,
                'manager_name'              => $manager_name,
                'manager_email'             => $manager_email,
            ], $pdfData, $teamListOk);

            $successMessage = 'Thank you – your application has been submitted.';
            // Clear POST so form resets
            $_POST = [];

        } catch (PDOException $e) {
            $errorMessage = 'There was a problem saving your entry. Please try again later.';
            // For debug only, uncomment:
            // $errorMessage .= ' ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Ensign Ewart 2026 – Registration of Interest</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        *, *::before, *::after {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #000;
            color: #111;
        }
        .hero {
            width: 100%;
            background: #000;
        }
        .hero img {
            width: 100%;
            height: auto;
            display: block;
        }
        .form-section {
            background: #111;
            padding: 3rem 1.5rem 4rem;
        }
        .form-container {
            max-width: 1100px;
            margin: 0 auto;
            background: #f9c533;
            border-radius: 16px;
            padding: 2.5rem 2rem;
            box-shadow: 0 20px 45px rgba(0,0,0,0.45);
        }
        .form-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .form-header h1 {
            margin: 0;
            font-size: 2rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .form-header p {
            margin: 0.5rem 0 0;
            font-size: 0.95rem;
        }

        .messages {
            margin-bottom: 1rem;
        }
        .msg-success, .msg-error {
            padding: 0.75rem 1rem;
            border-radius: 6px;
            font-size: 0.95rem;
        }
        .msg-success {
            background: #0f7b3f;
            color: #fff;
        }
        .msg-error {
            background: #c0392b;
            color: #fff;
        }

        form {
            display: grid;
            gap: 1.25rem 1.5rem;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        .full-width {
            grid-column: 1 / -1;
        }
        label {
            display: block;
            font-weight: 600;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.35rem;
        }
        label span.note {
            text-transform: none;
            letter-spacing: normal;
            font-weight: 400;
            font-size: 0.85rem;
            display: block;
            margin-top: 0.15rem;
        }
        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="date"],
        select,
        textarea,
        input[type="file"] {
            width: 100%;
            padding: 0.6rem 0.7rem;
            border-radius: 8px;
            border: 1px solid #d1a820;
            font-size: 0.95rem;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
            background: #fffef5;
        }
        textarea {
            min-height: 110px;
            resize: vertical;
        }
        input:focus,
        select:focus,
        textarea:focus {
            border-color: #ff7a00;
            box-shadow: 0 0 0 3px rgba(255,122,0,0.35);
            background: #ffffff;
        }

        .submit-row {
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            flex-wrap: wrap;
            margin-top: 0.5rem;
        }
        .submit-row button {
            border: none;
            padding: 0.75rem 1.6rem;
            border-radius: 999px;
            font-size: 0.95rem;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
            background: #111;
            color: #f9c533;
            transition: transform 0.1s, box-shadow 0.1s, background 0.15s, color 0.15s;
        }
        .submit-row button:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(0,0,0,0.35);
            background: #ff7a00;
            color: #111;
        }
        .submit-row button[type="reset"] {
            background: transparent;
            color: #111;
            border: 1px solid #111;
        }
        .submit-row button[type="reset"]:hover {
            background: #111;
            color: #f9c533;
        }

        @media (max-width: 720px) {
            .form-container {
                padding: 1.75rem 1.25rem 2.25rem;
            }
            .form-header h1 {
                font-size: 1.6rem;
            }
        }
    </style>
</head>
<body>

<section class="hero">
    <!-- Replace src with the path to your poster image -->
    <img src="assets/ee.png" alt="Ensign Ewart 2026 Tournament Poster">
</section>

<section class="form-section">
    <div class="form-container">
        <div class="form-header">
            <h1>Ensign Ewart 2026 – Team Application</h1>
            <p>Please complete the form below to register your interest.</p>
        </div>

        <div class="messages">
            <?php if ($successMessage): ?>
                <div class="msg-success"><?= htmlspecialchars($successMessage) ?></div>
            <?php elseif ($errorMessage): ?>
                <div class="msg-error"><?= htmlspecialchars($errorMessage) ?></div>
            <?php endif; ?>
        </div>

        <form method="post" action="" enctype="multipart/form-data">
            <!-- Age group -->
            <div class="full-width">
                <label for="age_group">Age Group</label>
                <select id="age_group" name="age_group" required>
                    <option value="">Please select</option>
                    <option value="U10 - 14 June 2026" <?= (($_POST['age_group'] ?? '')==='U10 - 14 June 2026')?'selected':''; ?>>
                        U10 – Saturday 14 June 2026
                    </option>
                    <option value="U12 - 16 May 2026" <?= (($_POST['age_group'] ?? '')==='U12 - 16 May 2026')?'selected':''; ?>>
                        U12 – Saturday 16 May 2026
                    </option>
                    <option value="U14 - 7 June 2026" <?= (($_POST['age_group'] ?? '')==='U14 - 7 June 2026')?'selected':''; ?>>
                        U14 – Saturday 7 June 2026
                    </option>
                </select>
            </div>

            <!-- Club / team -->
            <div>
                <label for="club_name">Club Name</label>
                <input type="text" id="club_name" name="club_name" required
                       value="<?= htmlspecialchars($_POST['club_name'] ?? '') ?>">
            </div>
            <div>
                <label for="team_name">Team Name</label>
                <input type="text" id="team_name" name="team_name" required
                       value="<?= htmlspecialchars($_POST['team_name'] ?? '') ?>">
            </div>

            <div>
                <label for="shirt_colour_home">Shirt Colour (Home)</label>
                <input type="text" id="shirt_colour_home" name="shirt_colour_home" required
                       value="<?= htmlspecialchars($_POST['shirt_colour_home'] ?? '') ?>">
            </div>
            <div>
                <label for="shirt_colour_away">Shirt Colour (Away)</label>
                <input type="text" id="shirt_colour_away" name="shirt_colour_away" required
                       value="<?= htmlspecialchars($_POST['shirt_colour_away'] ?? '') ?>">
            </div>

            <div class="full-width">
                <label for="num_coaches_officials">
                    Number of Coaches / Team Officials
                    <span class="note">(Minimum 1 x Level 2 &amp; 1 x Level 1)</span>
                </label>
                <input type="text" id="num_coaches_officials" name="num_coaches_officials" required
                       value="<?= htmlspecialchars($_POST['num_coaches_officials'] ?? '') ?>">
            </div>

            <!-- Senior contact -->
            <div class="full-width">
                <h3 style="margin:1.5rem 0 0.25rem; font-size:1.1rem; text-transform:uppercase; letter-spacing:0.12em;">Senior Contact for Club</h3>
            </div>
            <div>
                <label for="senior_contact_name">Name</label>
                <input type="text" id="senior_contact_name" name="senior_contact_name" required
                       value="<?= htmlspecialchars($_POST['senior_contact_name'] ?? '') ?>">
            </div>
            <div>
                <label for="senior_contact_phone_email">Phone &amp; Email Address</label>
                <input type="text" id="senior_contact_phone_email" name="senior_contact_phone_email" required
                       value="<?= htmlspecialchars($_POST['senior_contact_phone_email'] ?? '') ?>">
            </div>

            <!-- Booking contact -->
            <div class="full-width">
                <h3 style="margin:1.5rem 0 0.25rem; font-size:1.1rem; text-transform:uppercase; letter-spacing:0.12em;">Booking Contact</h3>
            </div>
            <div>
                <label for="booking_contact_name">Name</label>
                <input type="text" id="booking_contact_name" name="booking_contact_name" required
                       value="<?= htmlspecialchars($_POST['booking_contact_name'] ?? '') ?>">
            </div>
            <div>
                <label for="booking_contact_phone">Phone</label>
                <input type="tel" id="booking_contact_phone" name="booking_contact_phone" required
                       value="<?= htmlspecialchars($_POST['booking_contact_phone'] ?? '') ?>">
            </div>
            <div>
                <label for="booking_contact_email">Email Address</label>
                <input type="email" id="booking_contact_email" name="booking_contact_email" required
                       value="<?= htmlspecialchars($_POST['booking_contact_email'] ?? '') ?>">
            </div>

            <!-- Manager contact -->
            <div class="full-width">
                <h3 style="margin:1.5rem 0 0.25rem; font-size:1.1rem; text-transform:uppercase; letter-spacing:0.12em;">Manager Contact</h3>
                <p style="margin:0 0 1rem; font-size:0.9rem;">
                    This is the person to whom <strong>all correspondence</strong> will be directed and who will be
                    responsible for and accompanying the team during the tournament.
                </p>
            </div>
            <div>
                <label for="manager_name">Name</label>
                <input type="text" id="manager_name" name="manager_name" required
                       value="<?= htmlspecialchars($_POST['manager_name'] ?? '') ?>">
            </div>
            <div>
                <label for="manager_phone">Phone</label>
                <input type="tel" id="manager_phone" name="manager_phone" required
                       value="<?= htmlspecialchars($_POST['manager_phone'] ?? '') ?>">
            </div>
            <div>
                <label for="manager_email">Email Address</label>
                <input type="email" id="manager_email" name="manager_email" required
                       value="<?= htmlspecialchars($_POST['manager_email'] ?? '') ?>">
            </div>

            <!-- Team list upload -->
            <div class="full-width">
                <label for="team_list_file">
                    Team List (optional)
                    <span class="note">Word, Excel, PDF, CSV, etc. You can also send this later.</span>
                </label>
                <input
                    type="file"
                    id="team_list_file"
                    name="team_list_file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.odt,.ods,.txt"
                >
            </div>

            <!-- Remarks -->
            <div class="full-width">
                <label for="remarks">Remarks / Special Requirements</label>
                <textarea id="remarks" name="remarks"><?= htmlspecialchars($_POST['remarks'] ?? '') ?></textarea>
            </div>

            <!-- Declaration -->
            <div class="full-width">
                <p style="font-size:0.9rem; margin-top:0.75rem;">
                    I hereby confirm our application to your tournament as detailed above. I understand entry to the
                    Mini-League will be allocated on a <strong>first-come, first-served</strong> basis, secured by a deposit
                    or payment in full.
                </p>
            </div>

            <div>
                <label for="signature">Signature</label>
                <input type="text" id="signature" name="signature" required
                       value="<?= htmlspecialchars($_POST['signature'] ?? '') ?>">
            </div>
            <div>
                <label for="print_name">Print Name</label>
                <input type="text" id="print_name" name="print_name" required
                       value="<?= htmlspecialchars($_POST['print_name'] ?? '') ?>">
            </div>
            <div>
                <label for="position_in_club">Position in Club</label>
                <input type="text" id="position_in_club" name="position_in_club" required
                       value="<?= htmlspecialchars($_POST['position_in_club'] ?? '') ?>">
            </div>
            <div>
                <label for="date_signed">Date</label>
                <input type="date" id="date_signed" name="date_signed" required
                       value="<?= htmlspecialchars($_POST['date_signed'] ?? '') ?>">
            </div>

            <div class="submit-row full-width">
                <button type="reset">Clear</button>
                <button type="submit">Submit Application</button>
            </div>
        </form>
    </div>
</section>

</body>
</html>
