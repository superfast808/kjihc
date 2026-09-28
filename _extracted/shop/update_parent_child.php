<?php
require_once 'classes/Database.php';
require_once 'header.php';

$db = new Database();

// Basic validation
if (!empty($_POST['id'])) {
    try {
        // Agreement values (checkboxes return only if checked)
        $agree_fee = isset($_POST['agree_fee']) ? 1 : 0;
        $agree_gdpr = isset($_POST['agree_gdpr']) ? 1 : 0;
        $agree_photo = isset($_POST['agree_photo']) ? 1 : 0;

        // Update all relevant fields
        $stmt = $db->prepare("
            UPDATE kjihc_members 
            SET 
                player_name = ?,
                player_dob = ?,
                player_address1 = ?,
                player_address2 = ?,
                player_city = ?,
                player_post = ?,
                player_contacttel = ?,
                player_parent = ?,
                player_medicalnotes = ?,
                player_medication = ?,
                agree_fee = ?,
                agree_gdpr = ?,
                agree_photo = ?,
                read_code = ?
            WHERE player_id = ?
        ");
$readcode=1;
        $stmt->execute([
            $_POST['player_name'],
            $_POST['player_dob'],
            $_POST['player_address1'],
            $_POST['player_address2'],
            $_POST['player_city'],
            $_POST['player_post'],
            $_POST['guardian_phone'],
            $_POST['emergency_contact'],
            $_POST['medical_info'],
            $_POST['player_medication'],
            $agree_fee,
            $agree_gdpr,
            $agree_photo,
			$readcode,
            $_POST['id']
        ]);

        echo '
        <div class="container mt-4">
            <div class="alert alert-success" role="alert">
                ✅ <strong>Success:</strong> Details updated successfully. 
                <a href="javascript:history.back()" class="alert-link">Go back to Dashboard</a>
            </div>
        </div>';

    } catch (Exception $e) {
        echo '
        <div class="container mt-4">
            <div class="alert alert-danger" role="alert">
                ❌ <strong>Error:</strong> There was an issue saving the details. Please try again or contact support.
            </div>
        </div>';
        error_log("Parent Update Error: " . $e->getMessage());
    }
} else {
    echo '
    <div class="container mt-4">
        <div class="alert alert-warning" role="alert">
            ⚠️ <strong>Warning:</strong> No valid child ID provided.
        </div>
    </div>';
}
?>
