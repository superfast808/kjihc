<?php
session_start();
class StaffController {
	public $name;
	private $mysqli;

function __construct($name) {
	$this->name=$name;
	$this->mysqli = new mysqli("localhost", "join_xv446", "o3De@460p", "join_xv445");
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

public function signIn(){
?>
<link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>

<div class="container mt-4">
    <div class="card">
        <div class="card-header">
            <h2><i class="bi bi-check-circle"></i> Player Sign-In</h2>
        </div>
        <div class="card-body">
            <form id="filterForm">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label for="training_session" class="form-label">Training Session</label>
                        <select class="form-select" id="training_session" name="training_session" required>
                            <option value="">Select...</option>
                            <option value="LTP">LTP</option>
                            <option value="U12">U12</option>
                            <option value="U14">U14</option>
                            <option value="U16">U16</option>
                            <option value="U19">U19</option>
                            <option value="Lightning">Lightning</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label for="session_date" class="form-label">Session Date</label>
                        <input type="date" class="form-control" id="session_date" name="session_date" value="<?= date('Y-m-d'); ?>" required>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Load Players</button>
            </form>

            <div id="playerList" class="mt-4"></div>
            <div id="confirmation" class="alert alert-success mt-3 d-none">Sign-ins submitted successfully!</div>
        </div>
    </div>
</div>

<script>
$(document).ready(function() {
    $('#filterForm').on('submit', function(e) {
        e.preventDefault();
        const session = $('#training_session').val();
        const date = $('#session_date').val();

        if (!session || !date) return;

        $.ajax({
            url: 'classes/load_players.php',
            method: 'GET',
            data: { age_group: session },
            success: function(data) {
                const players = JSON.parse(data);
                let html = '<form id="attendanceForm">';
                players.forEach(player => {
                    html += `
                        <div class="card mb-3">
                            <div class="card-body">
                                <h5>${player.player_name}</h5>
                                <input type="hidden" name="entries[][player_id]" value="${player.player_id}">
                                <input type="hidden" name="entries[][training_session]" value="${session}">
                                <input type="hidden" name="entries[][session_date]" value="${date}">
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input yes-radio" type="radio" name="entries[][status_${player.player_id}]" value="yes" required>
                                    <label class="form-check-label">Yes</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input no-radio" type="radio" name="entries[][status_${player.player_id}]" value="no">
                                    <label class="form-check-label">No</label>
                                </div>
                                <div class="mt-2 miss-reason d-none">
                                    <label>Reason for absence:</label>
                                    <input type="text" name="entries[][miss_reason]" class="form-control">
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '<button type="submit" class="btn btn-success">Submit Attendance</button></form>';
                $('#playerList').html(html);
            }
        });
    });

    // Toggle miss reason box
    $(document).on('change', '.yes-radio, .no-radio', function() {
        const card = $(this).closest('.card');
        if ($(this).val() === 'no') {
            card.find('.miss-reason').removeClass('d-none');
        } else {
            card.find('.miss-reason').addClass('d-none');
        }
    });

    // Handle attendance submission
    $(document).on('submit', '#attendanceForm', function(e) {
        e.preventDefault();
        $.ajax({
            url: 'classes/submit_attendance.php',
            method: 'POST',
            data: $(this).serialize(),
            success: function(response) {
                $('#confirmation').removeClass('d-none').fadeIn();
                setTimeout(() => $('#confirmation').fadeOut(), 3000);
                $('#playerList').html('');
            },
            error: function() {
                alert('Submission failed. Please try again.');
            }
        });
    });
});
</script>

<?php
}


function reportSignIns(){
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

<!-- Core DataTables -->
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>

<!-- Responsive Extension -->
<link rel="stylesheet" href="https://cdn.datatables.net/responsive/2.5.0/css/responsive.dataTables.min.css" />
<script src="https://cdn.datatables.net/responsive/2.5.0/js/dataTables.responsive.min.js"></script>


<div class="container mt-4">
    <div class="card">
        <div class="card-header">
            <h2><i class="bi bi-clipboard-data"></i> Training Sign-In Report</h2>
        </div>
        <div class="card-body">

            <!-- Filter Controls -->
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

            <!-- Tabs: Table & Charts -->
            <ul class="nav nav-tabs mb-3" id="reportTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="table-tab" data-bs-toggle="tab" data-bs-target="#tableView" type="button" role="tab">Table View</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="chart-tab" data-bs-toggle="tab" data-bs-target="#chartView" type="button" role="tab">Charts</button>
                </li>
            </ul>

            <div class="tab-content" id="reportTabContent">
                <!-- Table Tab -->
                <div class="tab-pane fade show active" id="tableView" role="tabpanel">
                    <table id="reportTable" class="display nowrap table table-striped" style="width:100%">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Player</th>
                                <th>Session</th>
								<th>Time</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>

                <!-- Charts Tab -->
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

    if (chart) chart.destroy(); // Destroy existing chart if present

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
            // When loading the table, update the chart
            drawChart(json.data);
			 drawChartByDate(json.data);
            return json.data;
        }
    },
    columns: [
        { data: 'niceDate' },
        { data: 'training_session' },
        { data: 'player_name' },
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
}
}
	
}

?>