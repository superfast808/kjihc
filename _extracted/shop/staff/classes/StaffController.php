<?php
session_start();
class StaffController {
	public $name;
	private $mysqli;
private $pdo;

public function connectPDO()
{
    try {
        $dsn = "mysql:host=localhost;dbname=join_xv445;charset=utf8mb4";

        $this->pdo = new PDO($dsn, "join_xv446", "o3De@460p", [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false
        ]);

        return $this->pdo;

    } catch (PDOException $e) {
        die("PDO connection failed: " . $e->getMessage());
    }
}

function __construct($name) {
	$this->name=$name;
	$this->mysqli = new mysqli("localhost", "join_xv446", "o3De@460p", "join_xv445");
	
	 // New PDO connection
    $this->connectPDO();
}
function get_name(){
	return $this->name;
}
public function welcomeGreeting(){

	if($_SESSION['staff_email']=="microsoft"){
		
		echo 'Welcome <strong>'.$_SESSION['user']['name'].'</strong>';
	} else {
			echo 'Welcome <strong>'.$_SESSION['staff_email'].'</strong>';

	}
	
}
public function esc($input){
	return mysqli_real_escape_string($input);
}
public function listMembers(){
?>
    <style>
        .expand-row {
            cursor: pointer;
        }
        .medical-info {
            display: none;
        }
    </style>
		<script src="js/scripts.js"></script>
<div class="container mt-4 table-responsive">
    <div class="card">
        <div class="card-header">
            <h2><i class="bi bi-people-fill"></i> Player Management</h2>
        </div>
		
        <div class="card-body">
			<p class="text-left"><?php $this->welcomeGreeting(); ?></p>
			<p class="text-left">Use this panel to check player information and to reassign age groups, fees or to call the contact number</p>
            <div class="mb-3">
<div class="row">
    <div class="col-12">
        <div class="btn-group btn-group-sm d-flex flex-wrap justify-content-center gap-2" role="group" aria-label="Age Group Filters">
            <button type="button" class="btn filter-age active" data-age="" style="background-color: #f0e6ef; color: #333; border: 1px solid #ddd;">All</button>
            <button type="button" class="btn filter-age" data-age="novice" style="background-color: #e6f0e6; color: #333; border: 1px solid #ddd;">Novice (Skate Club)</button>
            <button type="button" class="btn filter-age" data-age="LTP" style="background-color: #e6eef0; color: #333; border: 1px solid #ddd;">LTP</button>
            <button type="button" class="btn filter-age" data-age="u10" style="background-color: #f0e6e6; color: #333; border: 1px solid #ddd;">U10</button>
            <button type="button" class="btn filter-age" data-age="u12" style="background-color: #f0f0e6; color: #333; border: 1px solid #ddd;">U12</button>
            <button type="button" class="btn filter-age" data-age="u14" style="background-color: #e6f0f0; color: #333; border: 1px solid #ddd;">U14</button>
            <button type="button" class="btn filter-age" data-age="u16" style="background-color: #efe6f0; color: #333; border: 1px solid #ddd;">U16</button>
            <button type="button" class="btn filter-age" data-age="u19" style="background-color: #f0efe6; color: #333; border: 1px solid #ddd;">U19</button>
            <button type="button" class="btn filter-age" data-age="lightning" style="background-color: #f0efe6; color: #333; border: 1px solid #ddd;">Lightning Girls</button>
        </div>
    </div>
</div>

            </div>

            <table id="playerTable" class="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>DOB</th>
                        <th>Age Group</th>
                        <th>Parent</th>
                        <th>Contact Tel</th>
                        <th>Email</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
    </div>
</div>

<?php
}
	public function ensignEwartEntries()
{
    $pdo = $this->pdo;

    // Who can edit payment status?
    $canEdit = (
        (isset($_SESSION['staff_level']) && (int)$_SESSION['staff_level'] === 1) ||
        (isset($_SESSION['staff_email']) && $_SESSION['staff_email'] === "microsoft")
    );

    $stmt = $pdo->query("SELECT * FROM ensign_ewart_entries ORDER BY created_at DESC");
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    ?>
    <!-- Ensign Ewart Entries -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>

    <style>
        .payment-pills .btn {
            border-radius: 999px;
            font-size: 0.75rem;
            padding: 0.25rem 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .payment-pills .btn.active {
            color: #fff;
        }
        .payment-pill-pending.active {
            background-color: #6c757d;
            border-color: #6c757d;
        }
        .payment-pill-deposit.active {
            background-color: #fd7e14;
            border-color: #fd7e14;
        }
        .payment-pill-paid.active {
            background-color: #198754;
            border-color: #198754;
        }
		/* Mobile-friendly payment pills */
@media (max-width: 576px) {
    .payment-pills {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 6px;
    }

    .payment-pills .btn {
        width: 100%;
        text-align: center;
        font-size: 0.8rem;
        padding: 0.45rem 0.75rem;
    }
}

    </style>

    <div class="container mt-4">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="mb-0">
                    <i class="bi bi-list-ul"></i> Ensign Ewart 2026 – Team Entries
                </h2>
                <div class="d-flex gap-2">
                    <select id="ageFilter" class="form-select form-select-sm">
                        <option value="">All Age Groups</option>
                        <option value="U10">U10</option>
                        <option value="U12">U12</option>
                        <option value="U14">U14</option>
                    </select>
                </div>
            </div>
            <div class="card-body">

                <?php if (empty($entries)): ?>
                    <div class="alert alert-info mb-0">
                        No entries have been received yet.
                    </div>
                <?php else: ?>

                    <div id="entriesList">
                        <?php foreach ($entries as $entry): ?>
                            <?php
                                $id   = (int)$entry['id'];
                                $age  = htmlspecialchars($entry['age_group'] ?? '');
                                $ageTag = '';
                                if (stripos($age, 'U10') !== false) $ageTag = 'U10';
                                elseif (stripos($age, 'U12') !== false) $ageTag = 'U12';
                                elseif (stripos($age, 'U14') !== false) $ageTag = 'U14';

                                $paymentStatus = (int)($entry['payment_status'] ?? 0);
                            ?>
                            <div class="card mb-3 ee-entry" data-age="<?= $ageTag ?>" data-id="<?= $id ?>">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <div>
                                        <span class="badge bg-dark me-2"><?= $age ?></span>
                                        <strong><?= htmlspecialchars($entry['club_name']) ?></strong>
                                        <?php if (!empty($entry['team_name'])): ?>
                                            – <?= htmlspecialchars($entry['team_name']) ?>
                                        <?php endif; ?>
                                    </div>

                                    <!-- Payment pills / status -->
                                    <div>
                                        <?php if ($canEdit): ?>
                                            <div class="btn-group btn-group-sm payment-pills" data-entry-id="<?= $id ?>">
                                                <button type="button"
                                                        class="btn btn-outline-secondary payment-pill payment-pill-pending <?= $paymentStatus === 0 ? 'active' : '' ?>"
                                                        data-status="0">
                                                    Pending
                                                </button>
                                                <button type="button"
                                                        class="btn btn-outline-warning payment-pill payment-pill-deposit <?= $paymentStatus === 1 ? 'active' : '' ?>"
                                                        data-status="1">
                                                    Deposit Paid
                                                </button>
                                                <button type="button"
                                                        class="btn btn-outline-success payment-pill payment-pill-paid <?= $paymentStatus === 2 ? 'active' : '' ?>"
                                                        data-status="2">
                                                    Paid
                                                </button>
												<button class="btn btn-sm btn-outline-secondary toggle-details">Details</button>
                                            </div>
                                        <?php else: ?>
                                            <?php
                                                $labelClass = 'bg-secondary';
                                                $labelText  = 'Pending';
                                                if ($paymentStatus === 1) {
                                                    $labelClass = 'bg-warning text-dark';
                                                    $labelText  = 'Deposit Paid';
                                                } elseif ($paymentStatus === 2) {
                                                    $labelClass = 'bg-success';
                                                    $labelText  = 'Paid';
                                                }
                                            ?>
                                            <span class="badge <?= $labelClass ?>"><?= $labelText ?></span>
                                        <?php endif; ?>
                                    </div>
                                </div>

                                <div class="card-body d-none">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <h6>Team Details</h6>
                                            <p class="mb-1"><strong>Club:</strong> <?= htmlspecialchars($entry['club_name']) ?></p>
                                            <p class="mb-1"><strong>Team:</strong> <?= htmlspecialchars($entry['team_name']) ?></p>
                                            <p class="mb-1"><strong>Shirt Colour (Home):</strong> <?= htmlspecialchars($entry['shirt_colour_home']) ?></p>
                                            <p class="mb-1"><strong>Shirt Colour (Away):</strong> <?= htmlspecialchars($entry['shirt_colour_away']) ?></p>
                                            <p class="mb-3"><strong>Coaches / Officials:</strong> <?= htmlspecialchars($entry['num_coaches_officials']) ?></p>

                                            <h6>Remarks / Special Requirements</h6>
                                            <p><?= nl2br(htmlspecialchars($entry['remarks'] ?? '')) ?: '<em>None provided</em>' ?></p>
                                        </div>
                                        <div class="col-md-6">
                                            <h6>Senior Contact for Club</h6>
                                            <p class="mb-1"><strong>Name:</strong> <?= htmlspecialchars($entry['senior_contact_name']) ?></p>
                                            <p class="mb-3"><strong>Phone &amp; Email:</strong> <?= htmlspecialchars($entry['senior_contact_phone_email']) ?></p>

                                            <h6>Booking Contact</h6>
                                            <p class="mb-1"><strong>Name:</strong> <?= htmlspecialchars($entry['booking_contact_name']) ?></p>
                                            <p class="mb-1"><strong>Phone:</strong> <?= htmlspecialchars($entry['booking_contact_phone']) ?></p>
                                            <p class="mb-3"><strong>Email:</strong> <?= htmlspecialchars($entry['booking_contact_email']) ?></p>

                                            <h6>Manager Contact</h6>
                                            <p class="mb-1"><strong>Name:</strong> <?= htmlspecialchars($entry['manager_name']) ?></p>
                                            <p class="mb-1"><strong>Phone:</strong> <?= htmlspecialchars($entry['manager_phone']) ?></p>
                                            <p class="mb-3"><strong>Email:</strong> <?= htmlspecialchars($entry['manager_email']) ?></p>

                                            <h6>Declaration</h6>
                                            <p class="mb-1"><strong>Signature:</strong> <?= htmlspecialchars($entry['signature']) ?></p>
                                            <p class="mb-1"><strong>Print Name:</strong> <?= htmlspecialchars($entry['print_name']) ?></p>
                                            <p class="mb-1"><strong>Position in Club:</strong> <?= htmlspecialchars($entry['position_in_club']) ?></p>
                                            <p class="mb-1">
                                                <strong>Date Signed:</strong>
                                                <?= htmlspecialchars($entry['date_signed']) ?>
                                            </p>
                                            <p class="mb-0 text-muted">
                                                <small>Submitted: <?= htmlspecialchars($entry['created_at']) ?></small>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>

                <?php endif; ?>

            </div>
        </div>
    </div>

    <script>
    $(function () {
        // Toggle card details
        $(document).on('click', '.card-header .toggle-details', function () {
            const body = $(this).closest('.card').find('.card-body');
            body.toggleClass('d-none');
            $(this).text(body.hasClass('d-none') ? 'Details' : 'Hide');
        });

        // Age group filter
        $('#ageFilter').on('change', function () {
            const selected = $(this).val();
            $('.ee-entry').each(function () {
                const age = $(this).data('age');
                if (!selected || selected === age) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });

        // Payment status pills (admins / Microsoft only, UI already hidden otherwise)
        $(document).on('click', '.payment-pill', function () {
            const btn       = $(this);
            const group     = btn.closest('.payment-pills');
            const entryId   = group.data('entry-id');
            const newStatus = btn.data('status');

            // Optimistic UI
            group.find('.payment-pill').removeClass('active');
            btn.addClass('active');

            $.post('classes/update_ensign_payment.php', {
                id: entryId,
                status: newStatus
            }, function (resp) {
                if (resp !== 'ok') {
                    alert('Failed to update payment status.');
                }
            }).fail(function () {
                alert('Failed to update payment status.');
            });
        });
    });
    </script>
    <?php
}

	public function ensignEwarstEntries()
{
    // If your PDO is global instead of $this->pdo, swap this line:
    $pdo = $this->pdo;

    // Fetch entries
    $stmt = $pdo->query("SELECT * FROM ensign_ewart_entries ORDER BY created_at DESC");
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    ?>
    <!-- Ensign Ewart Entries -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>

    <div class="container mt-4">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="mb-0">
                    <i class="bi bi-list-ul"></i> Ensign Ewart 2026 – Team Entries
                </h2>
                <div class="d-flex gap-2">
                    <select id="ageFilter" class="form-select form-select-sm">
                        <option value="">All Age Groups</option>
                        <option value="U10">U10</option>
                        <option value="U12">U12</option>
                        <option value="U14">U14</option>
                    </select>
                </div>
            </div>
            <div class="card-body">

                <?php if (empty($entries)): ?>
                    <div class="alert alert-info mb-0">
                        No entries have been received yet.
                    </div>
                <?php else: ?>

                    <div id="entriesList">
                        <?php foreach ($entries as $entry): ?>
                            <?php
                                $id   = (int)$entry['id'];
                                $age  = htmlspecialchars($entry['age_group'] ?? '');
                                // Rough age-tag (since we stored full text like "U10 - 14 June 2026")
                                $ageTag = '';
                                if (stripos($age, 'U10') !== false) $ageTag = 'U10';
                                elseif (stripos($age, 'U12') !== false) $ageTag = 'U12';
                                elseif (stripos($age, 'U14') !== false) $ageTag = 'U14';
                            ?>
                            <div class="card mb-3 ee-entry" data-age="<?= $ageTag ?>">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <div>
                                        <span class="badge bg-dark me-2"><?= htmlspecialchars($age) ?></span>
                                        <strong><?= htmlspecialchars($entry['club_name']) ?></strong>
                                        <?php if (!empty($entry['team_name'])): ?>
                                            – <?= htmlspecialchars($entry['team_name']) ?>
                                        <?php endif; ?>
                                    </div>
                                    <button class="btn btn-sm btn-outline-secondary toggle-details">
                                        Details
                                    </button>
                                </div>
                                <div class="card-body d-none">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <h6>Team Details</h6>
                                            <p class="mb-1"><strong>Club:</strong> <?= htmlspecialchars($entry['club_name']) ?></p>
                                            <p class="mb-1"><strong>Team:</strong> <?= htmlspecialchars($entry['team_name']) ?></p>
                                            <p class="mb-1"><strong>Shirt Colour (Home):</strong> <?= htmlspecialchars($entry['shirt_colour_home']) ?></p>
                                            <p class="mb-1"><strong>Shirt Colour (Away):</strong> <?= htmlspecialchars($entry['shirt_colour_away']) ?></p>
                                            <p class="mb-3"><strong>Coaches / Officials:</strong> <?= htmlspecialchars($entry['num_coaches_officials']) ?></p>

                                            <h6>Remarks / Special Requirements</h6>
                                            <p><?= nl2br(htmlspecialchars($entry['remarks'] ?? '')) ?: '<em>None provided</em>' ?></p>
                                        </div>
                                        <div class="col-md-6">
                                            <h6>Senior Contact for Club</h6>
                                            <p class="mb-1"><strong>Name:</strong> <?= htmlspecialchars($entry['senior_contact_name']) ?></p>
                                            <p class="mb-3"><strong>Phone &amp; Email:</strong> <?= htmlspecialchars($entry['senior_contact_phone_email']) ?></p>

                                            <h6>Booking Contact</h6>
                                            <p class="mb-1"><strong>Name:</strong> <?= htmlspecialchars($entry['booking_contact_name']) ?></p>
                                            <p class="mb-1"><strong>Phone:</strong> <?= htmlspecialchars($entry['booking_contact_phone']) ?></p>
                                            <p class="mb-3"><strong>Email:</strong> <?= htmlspecialchars($entry['booking_contact_email']) ?></p>

                                            <h6>Manager Contact</h6>
                                            <p class="mb-1"><strong>Name:</strong> <?= htmlspecialchars($entry['manager_name']) ?></p>
                                            <p class="mb-1"><strong>Phone:</strong> <?= htmlspecialchars($entry['manager_phone']) ?></p>
                                            <p class="mb-3"><strong>Email:</strong> <?= htmlspecialchars($entry['manager_email']) ?></p>

                                            <h6>Declaration</h6>
                                            <p class="mb-1"><strong>Signature:</strong> <?= htmlspecialchars($entry['signature']) ?></p>
                                            <p class="mb-1"><strong>Print Name:</strong> <?= htmlspecialchars($entry['print_name']) ?></p>
                                            <p class="mb-1"><strong>Position in Club:</strong> <?= htmlspecialchars($entry['position_in_club']) ?></p>
                                            <p class="mb-1">
                                                <strong>Date Signed:</strong>
                                                <?= htmlspecialchars($entry['date_signed']) ?>
                                            </p>
                                            <p class="mb-0 text-muted">
                                                <small>Submitted: <?= htmlspecialchars($entry['created_at']) ?></small>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>

                <?php endif; ?>

            </div>
        </div>
    </div>

    <script>
    $(function () {
        // Toggle card details
        $(document).on('click', '.toggle-details', function () {
            const body = $(this).closest('.card').find('.card-body');
            body.toggleClass('d-none');
            $(this).text(body.hasClass('d-none') ? 'Details' : 'Hide');
        });

        // Age group filter
        $('#ageFilter').on('change', function () {
            const selected = $(this).val();
            $('.ee-entry').each(function () {
                const age = $(this).data('age');
                if (!selected || selected === age) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });
    });
    </script>
    <?php
}

public function manageStaff(){
if (!isSuperUser()) {
    ?>
    <div class="container mt-5">
        <div class="card border-danger shadow">
            <div class="card-header bg-danger text-white">
                <h4 class="mb-0"><i class="bi bi-shield-exclamation"></i> Access Denied</h4>
            </div>
            <div class="card-body">
                <p class="card-text">You are not authorised to view this page. Please contact an administrator if you believe this is a mistake.</p>
                <a href="index.php" class="btn btn-outline-danger"><i class="bi bi-arrow-left"></i> Return to Dashboard</a>
            </div>
        </div>
    </div>
    <?php
    exit;
}
?>
		<script src="js/staff_scripts.js"></script>
  <div class="container mt-4 table-responsive">
        <div class="card">
            <div class="card-header">
                <h2><i class="bi bi-people-fill"></i> Staff Management</h2>
            </div>
            <div class="card-body">
				
                <p class="text-left">Use this panel to manage staff information.</p>
				<button type="button" class="btn btn-primary" id="addStaffButton" style="margin-bottom:10px;">Add Staff Member</button>

<div class="modal fade" id="editStaffModal" tabindex="-1" role="dialog" aria-labelledby="editStaffModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="editStaffModalLabel">Edit Staff</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="editId">
                <div class="form-group">
                    <label for="editEmail">Email</label>
                    <input type="text" class="form-control" id="editEmail">
                </div>
                <div class="form-group">
                    <label for="editName">Name</label>
                    <input type="text" class="form-control" id="editName">
                </div>
                <div id="editStaffLevelContainer">
                    </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="saveEditStaff">Save changes</button>
            </div>
        </div>
    </div>
</div>
				<div class="modal fade" id="addStaffModal" tabindex="-1" role="dialog" aria-labelledby="addStaffModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addStaffModalLabel">Add Staff Member</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="addEmail">Email</label>
                    <input type="email" class="form-control" id="addEmail">
                </div>
                <div class="form-group">
                    <label for="addName">Name</label>
                    <input type="text" class="form-control" id="addName">
                </div>
                <div class="form-group">
                    <label for="addPassword">Password</label>
                    <input type="password" class="form-control" id="addPassword">
                </div>
                <div id="addStaffLevelContainer">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="saveAddStaff">Add Staff</button>
            </div>
        </div>
    </div>
</div>
				
                <table id="staffTable" class="table table-striped table-bordered">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Email</th>
                            <th>Name</th>
                        <th>Level</th>
                       <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
				
            </div>
        </div>
    </div>
	
<?php 
 }
public function docs(){
?>
<div class="container mt-4 table-responsive">
    <div class="card">
        <div class="card-header">
            <h2><i class="bi bi-file-earmark-richtext"></i> Useful Documents</h2>
        </div>

        <div class="card-body">
            <p class="text-left"><?php $this->welcomeGreeting(); ?></p>
            <p class="text-left">Use this panel to view or download useful documents.</p>

            <div class="mb-3">
                <div class="row">
                    </div>
            </div>

            <div class="mt-4">
                <h3>Document Downloads</h3>
                <table class="table table-striped table-bordered">
                    <thead>
                        <tr>
                            <th>Document Name</th>
                            <th>Description</th>
                            <th>Download</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>SIHA Registration Form</td>
                            <td>Form for new player registration.</td>
                            <td><a href="#" class="btn btn-primary btn-sm" target="_blank">Download</a></td>
                        </tr>
                        <tr>
                            <td>Code of Conduct</td>
                            <td>Document detailing club rules and regulations.</td>
                            <td><a href="../../resources/KJIHCCOC.docx" class="btn btn-primary btn-sm" target="_blank">Download</a></td>
                        </tr>
                        <tr>
                            <td>Technical Pack</td>
                            <td>The club technical pack.</td>
                            <td><a href="../../resources/techpack.pdf" class="btn btn-primary btn-sm" target="_blank">Download</a></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            </div>
    </div>
</div>
<?php
					  }
public function signIn()
{
?>
<!-- Player Sign-In -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>

<div class="container mt-4">
    <div class="card">
        <div class="card-header">
            <h2><i class="bi bi-check-circle"></i> Player Sign-In</h2>
        </div>
        <div class="card-body">
            <form id="groupSigninForm">
                <div class="mb-3">
                    <label for="sessionSelect" class="form-label">Select Age Group</label>
                    <select id="sessionSelect" name="training_session" class="form-control">
                        <option value="">-- Select --</option>
                        <option value="LTP">LTP</option>
                        <option value="U12">U12</option>
                        <option value="U14">U14</option>
                        <option value="U16">U16</option>
                        <option value="U19">U19</option>
                        <option value="Lightning">Lightning</option>
                    </select>
                </div>

                <div class="mb-3">
                    <label for="sessionDate" class="form-label">Session Date</label>
                    <input type="date" id="sessionDate" name="session_date" class="form-control" value="<?= date('Y-m-d'); ?>" />
                </div>

                <div id="playersContainer"></div>

                <button type="submit" class="btn btn-success mt-3">Submit Attendance</button>
                <div id="confirmation" class="mt-3 alert alert-success d-none">Attendance recorded successfully!</div>
            </form>
        </div>
    </div>
</div>

<script>
$(function() {
    $('#sessionSelect').on('change', function() {
        const group = $(this).val();
        $('#playersContainer').html('<p>Loading players...</p>');

        $.get('classes/load_players_by_group.php', { session: group }, function(players) {
            let html = '';
            players.forEach(player => {
                html += `
                    <div class="card mb-2">
                        <div class="card-body">
                            <strong>${player.player_name}</strong>
                            <div class="btn-group btn-group-sm ms-3" role="group">
                                <input type="hidden" name="status[${player.player_id}]" value="">
                                <button type="button" class="btn btn-outline-success" onclick="setStatus(${player.player_id}, 'yes', this)">Yes</button>
                                <button type="button" class="btn btn-outline-danger" onclick="setStatus(${player.player_id}, 'no', this)">No</button>
                                <button type="button" class="btn btn-outline-secondary" onclick="setStatus(${player.player_id}, 'n/a', this)">N/A</button>
                            </div>
                            <div class="mt-2 reason-group d-none" id="reason-${player.player_id}">
                                <label>Reason for absence:</label>
                                <input type="text" name="reason[${player.player_id}]" class="form-control">
                            </div>
                        </div>
                    </div>
                `;
            });
            $('#playersContainer').html(html);
        }, 'json');
    });

    window.setStatus = function(playerId, status, el) {
        const group = $(el).closest('.card-body');
        group.find('.btn').removeClass('active');
        $(el).addClass('active');
        group.find(`input[name='status[${playerId}]']`).val(status);
        if (status === 'no') {
            group.find(`#reason-${playerId}`).removeClass('d-none');
        } else {
            group.find(`#reason-${playerId}`).addClass('d-none');
        }
    }

    $('#groupSigninForm').on('submit', function(e) {
        e.preventDefault();
        $.post('classes/submit_signin_group.php', $(this).serialize(), function(resp) {
            if (resp === 'success') {
                $('#confirmation').removeClass('d-none').fadeIn();
                setTimeout(() => location.reload(), 2000);
            } else {
                alert('Something went wrong.');
            }
        });
    });
});
</script>
<?php
} // End of signIn
public function reportSignIns(){
    if (!isSuperUser()) {
        ?>
        <div class="container mt-5">
            <div class="card border-danger shadow">
                <div class="card-header bg-danger text-white">
                    <h4 class="mb-0"><i class="bi bi-shield-exclamation"></i> Access Denied</h4>
                </div>
                <div class="card-body">
                    <p class="card-text">You are not authorised to view this page. Please contact an administrator if you believe this is a mistake.</p>
                    <a href="index.php" class="btn btn-outline-danger"><i class="bi bi-arrow-left"></i> Return to Dashboard</a>
                </div>
            </div>
        </div>
        <?php
        exit;
    }
?>
<link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
<link href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" rel="stylesheet" />
<link href="https://cdn.datatables.net/buttons/2.4.1/css/buttons.dataTables.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/buttons/2.4.1/js/dataTables.buttons.min.js"></script>
<script src="https://cdn.datatables.net/buttons/2.4.1/js/buttons.html5.min.js"></script>
<script src="https://cdn.datatables.net/buttons/2.4.1/js/buttons.print.min.js"></script>
<link rel="stylesheet" href="https://cdn.datatables.net/responsive/2.5.0/css/responsive.dataTables.min.css" />
<script src="https://cdn.datatables.net/responsive/2.5.0/js/dataTables.responsive.min.js"></script>

<div class="container mt-4">
    <div class="card">
        <div class="card-header">
            <h2><i class="bi bi-clipboard-data"></i> Training Sign-In Report</h2>
        </div>
        <div class="card-body">
            <div class="row align-items-end g-3 mb-4">
                <div class="col-md-3">
                    <label for="filterDate" class="form-label">Session Date</label>
                    <input type="date" id="filterDate" class="form-control">
                </div>
                <div class="col-md-3">
                    <label for="filterSession" class="form-label">Training Session</label>
                    <select id="filterSession" class="form-select">
                        <option value="">All</option>
                        <option value="LTP">LTP</option>
                        <option value="U12">U12</option>
                        <option value="U14">U14</option>
                        <option value="U16">U16</option>
                        <option value="U19">U19</option>
                        <option value="Lightning">Lightning</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label for="filterPlayer" class="form-label">Player</label>
                    <select id="filterPlayer" class="form-select" style="width: 100%;"></select>
                </div>
                <div class="col-md-2">
                    <button class="btn btn-primary w-100 mt-2" id="applyFilters">Apply Filters</button>
                </div>
            </div>

            <ul class="nav nav-tabs mb-3" id="reportTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="table-tab" data-bs-toggle="tab" data-bs-target="#tableView" type="button" role="tab">Table View</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="chart-tab" data-bs-toggle="tab" data-bs-target="#chartView" type="button" role="tab">Charts</button>
                </li>
            </ul>

            <div class="tab-content" id="reportTabContent">
                <div class="tab-pane fade show active" id="tableView" role="tabpanel">
                    <table id="reportTable" class="display nowrap table table-striped" style="width:100%">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Session</th>
                                <th>Player</th>
                                <th>Status</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>

                <div class="tab-pane fade" id="chartView" role="tabpanel">
                    <h5 class="mt-3">Sign-ins by Session Group</h5>
                    <canvas id="chartArea" style="max-height: 400px;"></canvas>
                    <hr class="my-4">
                    <h5>Sign-ins by Date</h5>
                    <canvas id="chartByDate" style="max-height: 400px;"></canvas>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
let chartByDate;

function drawChartByDate(data) {
    const dateMap = {};
    data.forEach(row => {
        const date = row.niceDate;
        if (!dateMap[date]) {
            dateMap[date] = {
                count: 0,
                players: []
            };
        }
        dateMap[date].count++;
        dateMap[date].players.push(row.player_name);
    });

    const labels = Object.keys(dateMap);
    const counts = labels.map(date => dateMap[date].count);
    const tooltips = labels.map(date => dateMap[date].players.join(', '));

    if (chartByDate) chartByDate.destroy();

    const ctx = document.getElementById('chartByDate').getContext('2d');
    chartByDate = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sign-ins',
                data: counts,
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Sign-ins by Date'
                },
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            const index = context[0].dataIndex;
                            return 'Players: ' + tooltips[index];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    precision: 0
                }
            }
        }
    });
}

let chart;

function drawChart(data) {
    const counts = {};
    data.forEach(row => {
        const session = row.training_session;
        counts[session] = (counts[session] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);

    if (chart) chart.destroy();

    const ctx = document.getElementById('chartArea').getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sign-ins per Session',
                data: values,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Sign-Ins by Session Group' }
            },
            scales: {
                y: { beginAtZero: true, precision: 0 }
            }
        }
    });
}

$(document).ready(function() {
    $('#filterPlayer').select2({
        placeholder: "All players",
        allowClear: true,
        ajax: {
            url: 'classes/load_players.php',
            dataType: 'json',
            delay: 250,
            processResults: function (data) {
                return {
                    results: data.map(player => ({
                        id: player.player_id,
                        text: player.player_name
                    }))
                };
            }
        }
    });

    const table = $('#reportTable').DataTable({
        ajax: {
            url: 'classes/fetch_signin_report.php',
            type: 'POST',
            data: function(d) {
                d.date = $('#filterDate').val();
                d.session = $('#filterSession').val();
                d.player_id = $('#filterPlayer').val();
            },
            dataSrc: function(json) {
                drawChart(json.data);
                drawChartByDate(json.data);
                return json.data;
            }
        },
        columns: [
            { data: 'niceDate' },
            { data: 'training_session' },
            { data: 'player_name' },
            { 
                data: 'miss_reason',
                render: function(data) {
                    if (data === null) return 'Yes';
                    if (data.toLowerCase() === 'n/a') return 'N/A';
                    return 'No – ' + data;
                }
            },
            { data: 'time' }
        ],
        dom: 'Bfrtip',
        buttons: ['print', 'csvHtml5', 'excelHtml5'],
        responsive: true
    });

    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        table.columns.adjust().responsive.recalc();
    });

    $('#applyFilters').on('click', function() {
        table.ajax.reload();
    });
});
</script>
<?php
}

public function pages(){
switch($_GET['page']){
	default:
		$this->listMembers();
		break;
		case "documents":
		$this->docs();
		break;
		case "staff":
		$this->manageStaff();
		break;
		case "signin":
		$this->signIn();
		break;
		case "signreports":
		$this->reportSignIns();
		break;
				case "ensign":
		$this->ensignEwartEntries();
		break;
}
}
	
}

?>