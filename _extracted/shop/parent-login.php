<?php
require_once 'header.php';
$logo = "img/KJIHC_beta.png";
?>

<div class="container mt-4" style="max-width:600px;">
  <div class="card shadow">
    <div class="card-body text-center">
      <img src="<?php echo $logo; ?>" alt="KJIHC Logo" style="max-width:150px; margin-bottom:15px;">
      <h3 class="mb-3">Parent Portal Login</h3>
      <p class="text-muted">Enter your email to receive a secure login link.</p>

      <form method="post" action="send_parent_link.php" class="text-left">
        <div class="form-group">
          <label><strong>Email Address</strong></label>
          <input type="email" name="email" class="form-control" placeholder="you@example.com" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block mt-3">📩 Send Login Link</button>
      </form>

      <hr>
      <small class="text-muted">Your secure login link will be valid for 10 minutes.</small>
    </div>
  </div>
</div>
