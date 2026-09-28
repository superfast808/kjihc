<?php
require_once 'header.php';
require_once 'classes/Database.php';

$token = $_GET['token'] ?? '';
$db = new Database();

$stmt = $db->prepare("SELECT email FROM parent_tokens WHERE token = ? AND expires_at > NOW()");
$stmt->execute([$token]);
$row = $stmt->fetch();

// Styled error for invalid/expired tokens
if (!$row) {
    echo '
    <div class="container mt-4">
        <div class="alert alert-danger" role="alert">
            <strong>Error:</strong> Your login link is invalid or has expired. Please request a new one.
        </div>
    </div>';
    exit;
}

$email = $row['email'];
$children = $db->prepare("SELECT * FROM kjihc_members WHERE player_email = ?");
$children->execute([$email]);
$children = $children->fetchAll();
?>

<div class="container mt-4">
  <div class="text-center mb-4">
    <h2 class="mb-2">KJIHC Parent Dashboard</h2>
    <p class="text-muted">Update your child(ren)’s details and reconfirm agreements.</p>
  </div>

  <!-- ✅ Monthly Fees Panel -->
  <div class="card mb-4">
    <div class="card-header bg-primary text-white">
      <strong>Monthly Fees Information</strong>
    </div>
    <div class="card-body">
      <ul class="list-group">
        <li class="list-group-item d-flex justify-content-between align-items-center">
          Beginners (LTP without X Ice)
          <span class="badge badge-primary badge-pill">£35</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center">
          U10 and LTP with X Ice
          <span class="badge badge-primary badge-pill">£55</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center">
          U12 - U19
          <span class="badge badge-primary badge-pill">£75</span>
        </li>
      </ul>
      <small class="text-muted d-block mt-2">Fees must be paid before the 5th of each month.</small>
    </div>
  </div>

  <!-- ✅ Child Tabs -->
  <ul class="nav nav-tabs" role="tablist">
    <?php foreach ($children as $i => $child): ?>
      <li class="nav-item">
        <a class="nav-link <?php echo $i==0 ? 'active' : ''; ?>" data-toggle="tab" href="#child<?php echo $i; ?>">
          <?php echo htmlspecialchars($child['player_name']); ?>
        </a>
      </li>
    <?php endforeach; ?>
  </ul>

  <div class="tab-content">
    <?php foreach ($children as $i => $child): ?>
    <div class="tab-pane container <?php echo $i==0 ? 'active show' : 'fade'; ?> mt-3" id="child<?php echo $i; ?>">
      <div class="card">
        <div class="card-body">
          <h5 class="card-title">Editing: <?php echo htmlspecialchars($child['player_name']); ?></h5>
          <form method="post" action="update_parent_child.php" class="mt-3">
            <input type="hidden" name="id" value="<?php echo $child['player_id']; ?>">

            <!-- Name & DOB -->
            <div class="form-group">
              <label><strong>Full Name</strong></label>
              <input type="text" name="player_name" class="form-control" value="<?php echo htmlspecialchars($child['player_name']); ?>" required>
            </div>
            <div class="form-group">
              <label><strong>Date of Birth</strong></label>
<?php
// Convert dd/mm/yyyy to yyyy-mm-dd for HTML date input
$dobFormatted = '';
if (!empty($child['player_dob']) && strpos($child['player_dob'], '/') !== false) {
    $parts = explode('/', $child['player_dob']); // [0]=dd, [1]=mm, [2]=yyyy
    if (count($parts) === 3) {
        $dobFormatted = $parts[2] . '-' . $parts[1] . '-' . $parts[0];
    }
} else {
    $dobFormatted = $child['player_dob']; // already in correct format?
}
?>
<input type="date" name="player_dob" class="form-control" value="<?php echo htmlspecialchars($dobFormatted); ?>" required>
            </div>

            <!-- Address -->
            <div class="form-group">
              <label><strong>Address Line 1</strong></label>
              <input type="text" name="player_address1" class="form-control" value="<?php echo htmlspecialchars($child['player_address1']); ?>">
            </div>
            <div class="form-group">
              <label><strong>Address Line 2</strong></label>
              <input type="text" name="player_address2" class="form-control" value="<?php echo htmlspecialchars($child['player_address2']); ?>">
            </div>
            <div class="form-group">
              <label><strong>City</strong></label>
              <input type="text" name="player_city" class="form-control" value="<?php echo htmlspecialchars($child['player_city']); ?>">
            </div>
            <div class="form-group">
              <label><strong>Postcode</strong></label>
              <input type="text" name="player_post" class="form-control" value="<?php echo htmlspecialchars($child['player_post']); ?>">
            </div>

            <!-- Contact & Medical -->
            <div class="form-group">
              <label><strong>Guardian Contact Number</strong></label>
              <input type="text" name="guardian_phone" class="form-control" value="<?php echo htmlspecialchars($child['player_contacttel']); ?>">
            </div>
            <div class="form-group">
              <label><strong>Emergency Contact</strong></label>
              <input type="text" name="emergency_contact" class="form-control" value="<?php echo htmlspecialchars($child['player_parent']); ?>">
            </div>
            <div class="form-group">
              <label><strong>Medical Info</strong></label>
              <textarea name="medical_info" class="form-control" rows="3"><?php echo htmlspecialchars($child['player_medicalnotes']); ?></textarea>
            </div>
            <div class="form-group">
              <label><strong>Medication (if any)</strong></label>
              <input type="text" name="player_medication" class="form-control" value="<?php echo htmlspecialchars($child['player_medication']); ?>">
            </div>

<!-- Agreements -->
<div class="mb-3 p-2 bg-light rounded">
  <p class="mb-2">
    Please review the <a href="/resources/KJIHCCOC.docx" target="_blank">
    <strong>Club Code of Conduct</strong></a> before confirming below.
  </p>

  <div class="form-check mb-2">
    <input type="checkbox" name="agree_fee" class="form-check-input" required>
    <label class="form-check-label">
      I agree to the monthly fee of <strong>£<?php echo $child['player_fee']; ?></strong> to be paid before the 5th of each month.
    </label>
  </div>

  <div class="form-check mb-2">
    <input type="checkbox" name="agree_gdpr" class="form-check-input" required>
    <label class="form-check-label">
      I agree to KJIHC storing this information in line with GDPR.
    </label>
  </div>

  <div class="form-check mb-3">
    <input type="checkbox" name="agree_photo" class="form-check-input">
    <label class="form-check-label">
      I consent to photographs of my child being used in club promotions.
    </label>
  </div>
			  
			    <div class="form-check mb-3">
    <input type="checkbox" name="agree_code" class="form-check-input">
    <label class="form-check-label">
      I agree to the KJIHC Code of Conduct.
    </label>
  </div>
</div>


<button type="submit" class="btn btn-success btn-block">💾 Save Changes</button>

          </form>
        </div>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
</div>
