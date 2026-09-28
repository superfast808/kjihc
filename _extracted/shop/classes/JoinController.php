<?php
session_start();
class JoinController {
	public $name;
	private $mysqli;

function __construct($name) {
	$this->name=$name;
	$this->mysqli = new mysqli("localhost", "join_xv446", "o3De@460p", "join_xv445");
}
function get_name(){
	return $this->name;
}
	public function esc($input){
	return mysqli_real_escape_string($input);
	}
public function step1(){
?>
<div class="container d-flex justify-content-center align-items-center" style="min-height: 300px; min-width:400px; margin-top:150px;">
  <div class="card p-4" style="min-width: 400px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div class="text-center"><img class="text-center mb-3" src="img/KJIHC_beta.png" style="width:200px;"/></div>
	  <div class="text-center mb-3">
		  <h2>Welcome to Kilmarnock Junior Ice Hockey Club</h2>
      <p>Welcome to the Kilmarnock Junior Ice Hockey Club (KJIHC) family! We're absolutely thrilled to have you and your child join our vibrant and passionate ice hockey community. We know you're child will be eager to get started, and we're here to make the enrollment process as smooth and straightforward as possible. This panel is designed to guide you through the necessary steps to provide us with your child's details, ensuring they're placed in the appropriate level within the club. Your accurate information helps us tailor our training and development programs to best suit your child's age, skill level, and aspirations.</p>
<p>
We believe that ice hockey is more than just a sport; it's a fantastic opportunity for young athletes to develop valuable life skills, build lasting friendships, and foster a strong sense of teamwork and dedication. By completing the information in this panel, you're taking the first step in your child's exciting journey with KJIHC. We're committed to providing a safe, supportive, and fun environment where every child can thrive and reach their full potential. If you have any questions or require assistance at any point, please don't hesitate to reach out to our dedicated team. We're here to help!</p>
    </div>
    <div class="d-flex justify-content-end">
           <button id="movetostep2" class="btn-lg btn-primary">Next Step</button>
    </div>
  </div>
</div>
	
<?php	
}
public function step2(){
?>
<div class="container d-flex justify-content-center align-items-center" style="min-height: 300px; min-width:400px; margin-top:150px;">
  <div class="card p-4">
	   <div class="text-center"><img class="text-center mb-3" src="img/KJIHC_beta.png" style="width:200px;"/></div>
    <h3 class="card-title mb-3">Player Information</h3>
	  <p>We gather player information to help us understand your child, and to ensure the correct care and development plan is available to them during their time at our club.</p>
    <div class="table-responsive">
	  <table style="table-layout:fixed;" class="table table-striped">
<form id="playerData">
  <tbody>
    <tr>
      <th scope="row">Player Name</th>
      <td><input type="text" class="form-control" id="firstName" name="firstName" placeholder="Enter Player Name" required></td>
    </tr>
    <tr>
      <th scope="row">Date of Birth</th>
      <td><input type="date" class="form-control" id="dob" name="dob" required></td>
    </tr>
    <tr>
      <th scope="row">Parent Name</th>
      <td><input type="text" class="form-control" id="parentName" name="parentName" placeholder="Parent Name" required></td>
    </tr>
    <tr>
      <th scope="row">Address Line 1</th>
      <td><input type="text" class="form-control" id="addressLine1" name="addressLine1" placeholder="Address Line 1" required></td>
    </tr>
    <tr>
      <th scope="row">Address Line 2</th>
      <td><input type="text" class="form-control" id="addressLine2" name="addressLine2" placeholder="Address Line 2 (optional)"></td>
    </tr>
    <tr>
      <th scope="row">City</th>
      <td><input type="text" class="form-control" id="city" name="city" placeholder="City" required></td>
    </tr>
    <tr>
      <th scope="row">Postcode</th>
      <td><input type="text" class="form-control" id="postcode" name="postcode" placeholder="Postcode" required></td>
    </tr>
    <tr>
      <th scope="row">Contact Number</th>
      <td><input type="tel" class="form-control" id="contactNumber" name="contactNumber" placeholder="Enter Contact Number" required></td>
    </tr>
    <tr>
      <th scope="row">Email Address</th>
      <td><input type="email" class="form-control" id="emailAddress" name="emailAddress" placeholder="Enter Email Address" required></td>
    </tr>
    <tr>
      <th scope="row">Level/Group.</th>
      <td>
        <!--<select id="playerlevel" name="playerlevel" class="form-select" required>
          <option selected value="">Select Level/Group</option>
          <option value="novice">Learn to Play: Novice Skater</option>
          <option value="LTP">Learn to Play: Confident Skater</option>
          <option value="u10">U10</option>
          <option value="u12">U12</option>
          <option value="u14">U14</option>
          <option value="u16">U16</option>
          <option value="u19">U19</option>
        </select> -->
		  
<div id="playerlevel-radios">
  <label class="toggle">
    <input type="radio" name="playerlevel" value="LTP" onchange="radioChange();">
    <span class="slider">LTP - Beginner</span>
  </label>
  <label class="toggle">
    <input type="radio" name="playerlevel" value="u10" onchange="radioChange();">
    <span class="slider">U10 with XIce</span>
  </label>
  <label class="toggle">
    <input type="radio" name="playerlevel" value="u12" onchange="radioChange();">
    <span class="slider">U12</span>
  </label>
  <label class="toggle">
    <input type="radio" name="playerlevel" value="u14" onchange="radioChange();">
    <span class="slider">U14</span>
  </label>
  <label class="toggle">
    <input type="radio" name="playerlevel" value="u16" onchange="radioChange();">
    <span class="slider">U16</span>
  </label>
  <label class="toggle">
    <input type="radio" name="playerlevel" value="u19" onchange="radioChange();">
    <span class="slider">U19</span>
  </label>
	  <label class="toggle">
    <input type="radio" name="playerlevel" value="lightning" onchange="radioChange();">
    <span class="slider">Lightning - Girls</span>
  </label>
</div>


		  <script>
  // Add active class on radio button change
  document.querySelectorAll('#playerlevel-radios input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.querySelectorAll('#playerlevel-radios label').forEach(label => {
        label.classList.remove('active', 'btn-success');
      });
      if (this.checked) {
        this.parentElement.classList.add('active', 'btn-success');
      }
    });
  });

  //set the first radio button to selected initially.
  document.querySelectorAll('#playerlevel-radios input[type="radio"]')[0].checked = true;
  document.querySelectorAll('#playerlevel-radios label')[0].classList.add('active','btn-success');

</script>
		  
		  <input type="hidden" value="" id="hiddenfee" name="hiddenfee" />
        <p class="small" style="margin-top:5px;">Note, if a novice skater/never played before, your details will be shared with our partner club, known as "Galleon Figure Skating Club" who provide hockey based skating lessons to beginners. If you are unsure of this, please do ask the manager who provided you with this form who will be happy to help.</p>
      </td>
    </tr>
    <tr>
      <th scope="row">Medical Information</th>
      <td><textarea id="medicalinfo" name="medicalinfo" class="form-control" rows="3" placeholder="Enter Medical Information"></textarea></td>
    </tr>
    <tr>
      <th scope="row">Medication</th>
      <td><textarea id="medication" name="medication" class="form-control" rows="3" placeholder="Enter Medication (if any)"></textarea></td>
    </tr>
<tr>
	<td><strong>Code of Conduct</strong></td><td>
    <a href="resources/KJIHCCOC.docx" target="_blank" class="btn btn-success">
  <i class="bi bi-cloud-download"></i> Download
</a>
  </td>
</tr>
<tr>
  <th scope="row">Confirm Code of Conduct</th>
  <td>
    <div class="form-check">
      <label class="toggle-switch">
        <input class="form-check-input" type="checkbox" id="codeOfConductCheckbox" name="codeOfConductCheckbox" value="1" required>
        <span class="toggle-slider"></span>
      </label>
      <label class="form-check-label" for="codeOfConductCheckbox">
        My child and I have read, understood and agree to the Club Code of Conduct.
      </label>
    </div>
  </td>
</tr>

<tr>
  <th scope="row">GDPR</th>
  <td>
    <div class="form-check">
      <label class="toggle-switch">
        <input class="form-check-input" type="checkbox" id="gdprcheck" name="gdprcheck" value="1" required>
        <span class="toggle-slider"></span>
      </label>
      <label class="form-check-label" for="gdprcheck">
        I understand that KJIHC will retain my data for a period covering only the time my child is a member and such data will be be deleted upon leaving the club.
      </label>
    </div>
  </td>
</tr>

<tr>
  <th scope="row">Photography</th>
  <td>
    <div class="form-check">
      <label class="toggle-switch">
        <input class="form-check-input" type="checkbox" id="photocheck" name="photocheck" value="1">
        <span class="toggle-slider"></span>
      </label>
      <label class="form-check-label" for="photocheck">
        I am happy for my child to be in club photography which may be used on Social Media for the purposes of event promotion.
      </label>
    </div>
  </td>
</tr>

<tr>
  <th scope="row">Confirm Happy to Pay Monthly Fee of</th>
  <td>
    <div class="form-check">
      <label class="toggle-switch">
        <input class="form-check-input" type="checkbox" id="feeCheckbox" name="feeCheckbox" value="1" required>
        <span class="toggle-slider"></span>
      </label>
      <label class="form-check-label" for="feeCheckbox" id="feelabel">
        <br />I agree to pay the fee of
      </label>
    </div>
  </td>
</tr>
  </tbody>
</form>
		</table></div>
    <div class="d-flex justify-content-end">
		<button id="movetostep3" class="btn-lg btn-primary">Submit and Move to Step 3</button>
		
    </div>
	  


  </div>
</div>
<?php
}
public function step3(){



?>
<div class="container d-flex justify-content-center align-items-center" style="min-height: 300px; min-width:400px; margin-top:150px;">
  <div class="card p-4" style="min-width: 400px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div class="text-center"><img class="text-center mb-3" src="img/KJIHC_beta.png" style="width:200px;"/></div>
	  	   <h2 class="text-left">SIHA Registration</h2>
	  <div class="text-center mb-3">
		  <?php
	
	if($_SERVER['REMOTE_ADDR']=="81.101.187.145"){
	$_SESSION['step2complete']=1;
	}
							if($_SESSION['step2complete']!='1'){
						echo ' <p>You have yet to complete step 2. Please go back and complete this step.</p>';
						echo '</div>';
						echo '<div class="d-flex justify-content-start">';
        				echo '<button id="movetostep2" class="btn-lg btn-secondary">Go to Step 2</button>';
						echo '</div>';
						echo '</div>';
						echo '</div>';
						return;
						} else {
	?>
		  
      <p class="text-left">Thank you for completing the player information for <strong><?php echo $_SESSION['playerName']; ?></strong>. We are delighted to be welcoming them to our club. You indicated their joining level as <strong><?php echo $_SESSION['playerlevel']; ?></strong></p>
		  <p class="text-left">As you have provided your details <?php if ($this->isWithinHockeySeason()) {
    echo "within the registration window, we ask that you complete and send the the following to <strong>registrations@kjihc.org</strong>. Do not send the form or fee to SIHA, ensure the form is sent to the address noted in this paragraph, and the fee is sent to the KJIHC club account - details outlined in step 5 of this process:";
		?>
		  <ol class="text-left">
			  <li>SIHA Registration Form. Click <strong><a href="resources/regform.docx" target="_blank">here</a></strong> to download a copy of the form.</li>
			  <li>A passport style photo on a plain background</li>
			  <li>A form of player ID - such as a passport information page or birth certificate</li>
			  <li>The appropriate reigstration fee detailed by the form above, to also be sent to the club account. You will find these details in step 5 of the sign up process. It is expected that, unless an absolute beginner, all players should opt for the full fee. You should use the reference "PlayernameAgeGroupReg"</li>
			  <li><strong>Important</strong> If you are joining us from another club, our Chairperson will need to contact your previous club chairperson to ensure no ice hockey fees are outstanding. This is a standard part of the process.</li>
			  <li>By continuing you confirm you will send the appropriate documentations and completed form to registrations@kjihc.org, and send the appropriate fee to the KJIHC club account.</li>
		  </ol></p>
		  <?php
} else {
    echo "outwith the registration window, registration will not take place again until 1st August 2025 at which point everyone will be messaged from the club communication channel. You may now proceed to the next step.";
} ?> 
<?php

								if($_SESSION['playerlevel']=="novice"){
								?>
	  							<p class="text-left">During your submission you selected your child as being of novice level. To make the best possible start in ice hockey we have a partnership with the Galleon Skating Club. For this, we'll arrange for the skate club to contact you with details of the next session, whilst our learn to play coordinator will keep you up to date with your child's pathway at the hockey club.</p>
	  
	  
	  <?php
								}
								
	  
	  ?>
	  
    </div>
    <div class="d-flex justify-content-end">
		<button id="movetostep4" class="btn-lg btn-primary">Next Step</button>
    </div>
  </div>
</div>
	
<?php	
							}
}	
	
public function step4(){

	if ($this->mysqli->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$sql = "SELECT code_group, code_code FROM heja_codes";
$result = $this->mysqli->query($sql);


?>
<div class="container d-flex justify-content-center align-items-center" style="min-height: 300px; min-width:400px; margin-top:150px;">
  <div class="card p-4" style="min-width: 400px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div class="text-center"><img class="text-center mb-3" src="img/KJIHC_beta.png" style="width:200px;"/></div>
	   <h2 class="text-left">Club Communication</h2>
	  <div class="text-center mb-3">
		  <?php
							if($_SESSION['step2complete']!='1'){
						echo ' <p>You have yet to complete step 2. Please go back and complete this step.</p>';
						echo '</div>';
						echo '<div class="d-flex justify-content-start">';
        				echo '<button id="movetostep2" class="btn-lg btn-secondary">Go to Step 2</button>';
						echo '</div>';
						echo '</div>';
						echo '</div>';
						return;
						} else {
	?>
		  
      <p class="text-left">You are now at step 4 where we require you to download and install the Heja app to your phone. We use Heja to to communicate about events, activities, training and for general club messaging.</p>
		  
		  <p class="text-left">You indicated <strong><?php echo $_SESSION['playerName']; ?></strong> is joining KJIHC at this level: <strong><?php echo $_SESSION['playerlevel']; ?></strong></p>
		  
		        <p class="text-left">Please join the appropriate Heja age group community. Once you install Heja, the codes below can be used to join specific teams. Please only join the team level inidicated in step 2, or as advised by the manager who provided you with a link to this onboarding system. <strong>Please also join the club wide Heja community</strong></p>
		  
    <div class="table-responsive">
			<h2 class="text-left">Download Heja</h2>
		<p class="text-left">Use the buttons below to download the Heja app for your device type.</p>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Platform</th>
                    <th>Download</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Android</td>
                    <td>
                        <a href="https://play.google.com/store/apps/details?id=com.heja.app" target="_blank" class="btn btn-success">
                            <i class="fab fa-android"></i> Google Play
                        </a>
                    </td>
                </tr>
                <tr>
                    <td>Apple iOS</td>
                    <td>
                        <a href="https://apps.apple.com/app/heja-team-management/id1060965319" target="_blank" class="btn btn-info">
                            <i class="fab fa-apple"></i> App Store
                        </a>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
	<?php	  
		  if ($result->num_rows > 0) {

    echo '    <div class="container mt-5">';
    echo '        <h2 class="text-left">Heja Codes</h2>';
	echo '		<p class="text-left">Use the codes below to join the appropriate Heja age group community or communities</p>';
    echo '        <table class="table table-striped">';
    echo '            <thead>';
    echo '                <tr>';
    echo '                    <th style:"width:50%;">Group</th>';
    echo '                    <th>Code</th>';
    echo '                </tr>';
    echo '            </thead>';
    echo '            <tbody>';

    // output data of each row
    while($row = $result->fetch_assoc()) {
        echo '                <tr>';
        echo '                    <td>' . $row["code_group"]. '</td>';
        echo '                    <td><strong>' . $row["code_code"]. '</strong></td>';
        echo '                </tr>';
    }

    echo '            </tbody>';
    echo '        </table>';
    echo '    </div>';

} else {
    echo "0 results";
}
$this->mysqli->close();
		  ?>
    </div>
	  		  		           <div class="container mt-5">
 <p class="text-left">Please only proceed to the final step when you have downloaded, installed, and joined the appropriate age group Heja communities</p>
	  </div>
    <div class="d-flex justify-content-end">
		<button id="movetostep5" class="btn-lg btn-primary">Proceed to Final Step</button>
    </div>
  </div>
</div>
	
<?php	
							}
}	
	
	
public function step5(){

	if ($this->mysqli->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$sql = "SELECT fee_group, fee_amount FROM kjihc_fees";
$result = $this->mysqli->query($sql);


?>
<div class="container d-flex justify-content-center align-items-center" style="min-height: 300px; min-width:400px; margin-top:150px;">
  <div class="card p-4" style="min-width: 400px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div class="text-center"><img class="text-center mb-3" src="img/KJIHC_beta.png" style="width:200px;"/></div>
	   <h2 class="text-left">Club Bank Details and Technical Pack</h2>
	  <div class="text-center mb-3">
		  <?php
							if($_SESSION['step2complete']!='1'){
						echo ' <p>You have yet to complete step 2. Please go back and complete this step.</p>';
						echo '</div>';
						echo '<div class="d-flex justify-content-start">';
        				echo '<button id="movetostep2" class="btn-lg btn-secondary">Go to Step 2</button>';
						echo '</div>';
						echo '</div>';
						echo '</div>';
						return;
						} else {
	?>
		  
      <p class="text-left">You are now at the final step. In this step we detail how to ensure you are paying the appropriate fees and to the correct account. We also now give you the opportunity to download the club Technical Pack which was produced by the Club's Head Coach</p>
		  
		  <p class="text-left">You indicated <strong><?php echo $_SESSION['playerName']; ?></strong> is joining KJIHC at this level: <strong><?php echo $_SESSION['playerlevel']; ?></strong></p>
		  
	<?php	  
		  if ($result->num_rows > 0) {

    echo '    <div class="text-center mb-3">';
    echo '        <h2 class="text-left">Club Fees</h2>';
	echo '		<p class="text-left">Please see the club fee structure below.</p>';
    echo '        <table class="table table-striped">';
    echo '            <thead>';
    echo '                <tr>';
    echo '                    <th style:"width:50%;">Age Group</th>';
    echo '                    <th>Monthly Fee</th>';
    echo '                </tr>';
    echo '            </thead>';
    echo '            <tbody>';

    // output data of each row
    while($row = $result->fetch_assoc()) {
        echo '                <tr>';
        echo '                    <td>' . $row["fee_group"]. '</td>';
        echo '                    <td>&pound;' . $row["fee_amount"]. '</td>';
        echo '                </tr>';
    }

    echo '            </tbody>';
    echo '        </table>';
    echo '    </div>';

} else {
    echo "0 results";
}
$this->mysqli->close();
								
								echo '    <div class="table-responsive">';
echo '        <h2 class="text-left">Bank Details</h2>';
echo '        <p class="text-left">Please ensure you use the bank details below when paying fees, alongside the reference shown. For novice skaters who require skate lessons, the skating club will confirm the fees due to them. You should then begin paying fees with our club once you have joined our Learn to Play programme following at least 2 blocks of skating lessons. As a reminder, fees are due on or before the <strong>5th</strong> of each month.</p>';
echo '        <table class="table table-bordered">';
echo '            <thead>';
echo '                <tr>';
echo '                    <th>Account Name</th>';
echo '                    <th>Sort Code</th>';
echo '                    <th>Account Number</th>';
echo '                    <th>Payment Reference</th>';								
echo '                </tr>';
echo '            </thead>';
echo '            <tbody>';

$rowColor = false; // Initialize row color toggle
$reference=''.$_SESSION["playerName"].''.$_SESSION["playerlevel"];
$bankDetails = [
    [
        "Name" => "Kilmarnock Junior Ice Hockey Club",
        "Sort Code" => "80-08-53",
        "Account Number" => "06028757",
		"Reference Number" => $reference
    ],
];
foreach ($bankDetails as $row) {
    echo '                <tr ' . ($rowColor ? 'class="table-light"' : '') . '>'; // Alternate row colors
    echo '                    <td>' . $row["Name"] . '</td>';
    echo '                    <td>' . $row["Sort Code"] . '</td>';
    echo '                    <td>' . $row["Account Number"] . '</td>';
	echo '                 <td>' . $row["Reference Number"] . '</td>';
    echo '                </tr>';
    $rowColor = !$rowColor; // Toggle row color
}

echo '            </tbody>';
echo '        </table>';
echo '    </div>';
								
					
								
		  ?>
		      <div class="">
        <h2 class="text-left">Download Club Technical Pack</h2>
				  <p class="text-left">The club technical pack has been produced by our head coach and allows you and your child to understand the Ice Hockey philosophy of KJIHC and to build knowledge of the way we play and the way we train. 
        <form action="resources/techpack.pdf" method="get">
            <button type="submit" class="btn btn-primary btn-lg btn-success">
                <i class="fas fa-download"></i> Download Technical Pack
            </button>
        </form>
    </div>
		  
		  
	  		  		           <div class="text-center mb-3">
 <p class="text-left">If you require to amend any information, come back to this form at any time in the future and the system will update the information for you. You will require to enter the correct post code, child name, email address, and telephone number for any update to be successful.</p></div>

    <div class="d-flex justify-content-between">
				<button id="movetokit" class="btn-lg btn-info">View Kit Requirements</button>

		<button id="movetocomplete" class="btn-lg btn-success">Finish Sign Up</button>
    </div>
  </div>
</div>
	
<?php	
							}
}	
	
	
	
public function isWithinHockeySeason() {
    $today = new DateTime();
    $currentYear = (int) $today->format('Y');

    // Determine the start and end dates of the hockey season
    $startDate = new DateTime($currentYear . '-07-01'); // August 1st of the current year
    $endDate = new DateTime(($currentYear + 1) . '-01-25'); // January 25th of the next year

    // Adjust for the edge case where the current date is in January (of the current year).
    // In that case, the start date is the previous year.
    if($today->format('m') == 1 && $today->format('d') < 25){
        $startDate = new DateTime(($currentYear - 1) . '-08-01');
    }

    // Check if today is within the season
    return ($today >= $startDate && $today < $endDate);
}
public function step6(){
	?>
<div class="container d-flex justify-content-center align-items-center" style="min-height: 600px; min-width:400px; margin-top:50px;">
  <div class="card p-4" style="min-width: 400px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div class="text-center mb-3">
			   <div class="text-center"><img class="text-center mb-3" src="img/KJIHC_beta.png" style="width:200px;"/></div>

      <h2>Ice Hockey Kit Essentials</h2>
      <p>Here's a breakdown of the essential ice hockey kit. Whilst the club can provide a loan of certain kit items, our supply is limited, and we allow a loan for a maximum of 8 weeks. We understand kit can be expensive and would also encourage purchasing used equipment to help keep your costs low.</p>
    </div>
    <div class="row">
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/helmet.avif" alt="Helmet" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Helmet</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/neck.webp" alt="Neck Guard" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Neck Guard</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/chest.avif" alt="Chest Protector" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Chest Protector</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/shorts.avif" alt="Hockey Shorts" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Hockey Shorts</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/elbow.avif" alt="Elbow Guards" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Elbow Guards</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/shin.avif" alt="Shin Guards" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Shin Guards</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/socks.webp" alt="Hockey Socks" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Hockey Socks</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/skates.avif" alt="Skates" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Skates</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/stick.avif" alt="Stick" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Stick</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/gloves.avif" alt="Gloves" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Gloves</p>
        </div>
      </div>
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="text-center">
          <img src="img/jersey.avif" alt="Jersey" class="img-fluid" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
          <p>Jersey</p>
        </div>
      </div>
    </div>
  </div>
</div>
	<?php
}
public function steps(){
switch($_GET['step']){
	default:
		$this->step1();
		break;
	case 2:
		$this->step2();
		break;
	case 3:
		$this->step3();
		break;
			case 4:
		$this->step4();
		break;
					case 5:
		$this->step5();
		break;
	case 6:
		$this->step6();
		break;
}
}
	
}

?>