<html>
	<head>
		<title>Join Us - Kilmarnock Junior Ice Hockey Club</title>
		<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
		<script src="js/scripts.js"></script>
		<meta name="viewport" content="width=device-width, initial-scale=1">

		<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
		    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css">
		<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css">

		
		
		<!-- Styles -->

<style>
	.toggle-switch {
  position: relative;
  display: inline-block;
  width: 60px; /* Adjust as needed */
  height: 34px; /* Adjust as needed */
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 26px; /* Adjust as needed */
  width: 26px; /* Adjust as needed */
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #2196F3; /* Change to your desired active color */
}

input:focus + .toggle-slider {
  box-shadow: 0 0 1px #2196F3;
}

input:checked + .toggle-slider:before {
  transform: translateX(26px); /* Adjust as needed */
}

.form-check-label {
  margin-left: 10px; /* Space between toggle and label */
}
	/* Hide the radio buttons */
.toggle input {
  display: none;
}

/* Toggle styling */
.toggle {
  display: block;
  position: relative;
  width: 100%;
  height: 40px;
  margin-bottom: 10px;
  cursor: pointer;
  border-radius: 20px;
  background-color: #ddd;
  transition: background 0.3s ease;
}

/* Slider text inside toggle */
.slider {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border-radius: 20px;
  font-weight: bold;
  color: white;
  background: #666;
  transition: background 0.3s ease, transform 0.3s ease;
}

/* Active state when selected */
.toggle input:checked + .slider {
  background: #007bff;
  transform: translateX(0);
}

		</style>

		
		
	</head>
