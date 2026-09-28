function radioChange(){

	var selectedLevel = $('input[name="playerlevel"]:checked').val();
    var fee = "";

    switch (selectedLevel) {
      case "novice":
        fee = "35";
        break;
		case "LTP":
        fee = "55";
        break;
      case "u10":
        fee = "75";
        break;
      case "u12":
      case "u14":
		case "u16":
		case "u19":
			
        fee = "75";
        break;
		case "lightning":
			fee="30";
			break;
    }
	$("#feelabel").html("I agree to pay a monthly fee of <strong>"+fee+"</strong> on or before the 5th of each calendar month");
	$("#hiddenfee").val(fee);


}
$(document).ready(function(){

	

	

	
$("#movetostep2").click(function(){

location.href="https://join.shopkillieicehockey.com/?step=2";
});
$("#movetostep4").click(function(){

location.href="https://join.shopkillieicehockey.com/?step=4";
});	
	$("#movetocomplete").click(function(){
alert("You have now completed the join process for your child. The form will now return to step 1 in case you require to complete it again for another of your children");
location.href="https://join.shopkillieicehockey.com/?step=1";
});	
$("#movetostep5").click(function(){

location.href="https://join.shopkillieicehockey.com/?step=5";
});		
$("#movetokit").click(function(){

window.open(
  'https://join.shopkillieicehockey.com/?step=6',
  '_blank' // <- This is what makes it open in a new window.
);
});
$(".btn-secondary").click(function(){
var step=getUrlParameter('step');
var newstep=step-1;
location.href="https://join.shopkillieicehockey.com/?step="+newstep;
});	
$("#movetostep3").click(function(){

var str=$("#playerData").serialize();

	var formData = {
      playerName: $('#firstName').val(),
      parentName: $('#parentName').val(),
      dob: $('#dob').val(),
      addressLine1: $('#addressLine1').val(),
      addressLine2: $('#addressLine2').val(),
      city: $('#city').val(),
      postcode: $('#postcode').val(),
      contactNumber: $('#contactNumber').val(),
      emailAddress: $('#emailAddress').val(),
playerlevel: $('input[name="playerlevel"]:checked').val(),
      medicalinfo: $('#medicalinfo').val(),
      medication: $('#medication').val(),
		hiddenfee: $("#hiddenfee").val(),
		      parentname: $('#parentname').val(),
      codeOfConductCheckbox: $('#codeOfConductCheckbox').is(':checked') ? 1 : 0, // Convert checkbox to 1 or 0
		feeCheckbox: $('#feeCheckbox').is(':checked') ? 1 : 0, // Convert checkbox to 1 or 0
			gdprcheck: $('#gdprcheck').is(':checked') ? 1 : 0, // Convert checkbox to 1 or 0
		photocheck: $('#photocheck').is(':checked') ? 1 : 0 // Convert checkbox to 1 or 0
    };
$("#movetostep3").val("Processing. Please wait");
    // Send the data to your server using AJAX
    $.ajax({
      type: 'POST',
      url: 'classes/processData.php', // Your server-side script
      data: formData,
      dataType: 'json', // Expect JSON response
      success: function(response) {
        // Handle successful response
        console.log('Server response:', response);
        if (response.status === 'success') {
            alert('Data submitted successfully!');
			location.href="https://join.shopkillieicehockey.com/?step="+3;

            // Optionally, clear the form or redirect
            //$('#playerForm')[0].reset(); // clear the form.
        } else {
            alert('Error: ' + response.message);
        }

      },
      error: function(error) {
        // Handle errors
        console.error('Error:', error);
        alert('An error occurred during submission.');
      }
    });

});
	
	
});


var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
    return false;
};