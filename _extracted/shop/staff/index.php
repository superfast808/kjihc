<?php
include("header.php");
include("classes/StaffController.php");
include("classes/loginprocess.php");
if (!is_logged_in()) {
    header('Location: login.php');
    exit;
}
?>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<body style="background:#f5f5f5;">
    <nav class="navbar navbar-expand-lg navbar-light bg-dark" data-bs-theme="dark">
        <a class="navbar-brand" href="#">
            <img src="img/KJIHC_beta.png" style="width: 150px;" alt="Logo">
        </a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ml-auto">
                <li class="nav-item active">
                    <a class="nav-link" href="#"><i class="bi bi-house"></i> Home <span class="sr-only">(current)</span></a>
                </li>
				
				  <li class="nav-item">
                    <a class="nav-link" href="index.php?page=player"><i class="bi bi-people"></i> Player Management</a>
                </li>
									  <li class="nav-item">
                    <a class="nav-link" href="index.php?page=signin"><i class="bi bi-file-earmark-richtext"></i> Training Signin</a>
                </li>
				<?php
				if(isSuperUser()){
				?>
												  <li class="nav-item">
                    <a class="nav-link" href="index.php?page=signreports"><i class="bi bi-bar-chart-fill"></i> Attendance Reports</a>
                </li>
				
                <li class="nav-item">
                    <a class="nav-link" href="index.php?page=staff"><i class="bi bi-person-bounding-box"></i> Manage Staff</a>
                </li>
					
			<?php	}
				
				?>
							  <li class="nav-item">
                    <a class="nav-link" href="index.php?page=documents"><i class="bi bi-file-earmark-richtext"></i> Useful Documents</a>
                </li>
								  <li class="nav-item">
                    <a class="nav-link" href="index.php?page=ensign"><i class="bi bi-file-earmark-richtext"></i> Ensign Entries</a>
                </li>
				
                <li class="nav-item">
                    <a class="nav-link" href="classes/logout.php"><i class="bi bi-box-arrow-right"></i> Logout</a>
                </li>
            </ul>
        </div>
    </nav>
<?php
$controller=new StaffController("KJIHC");
	$controller->pages();
?>
</body>
</html>
