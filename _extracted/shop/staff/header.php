<html>
	<head>
		<title>Admin Portal - Kilmarnock Junior Ice Hockey Club</title>
		<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
				<script src="https://cdn.datatables.net/2.2.2/js/dataTables.min.js"></script>
		<script src="https://cdn.datatables.net/responsive/3.0.4/js/dataTables.responsive.min.js"></script>

		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdn.datatables.net/responsive/3.0.4/css/responsive.dataTables.min.css">

		<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
		    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.5.0/font/bootstrap-icons.css">

		
		
		<!-- Styles -->
		
    <style>
.navbar-light .navbar-nav .nav-link {
    color: white !important;
}

        .navbar-dark .navbar-nav .nav-link:hover,
        .navbar-dark .navbar-nav .nav-link:focus {
            color: #169fe6 !important; /* Brighter text on hover/focus */
        }

        .navbar-dark .navbar-brand {
            color: white;
        }
		.dt-paging-button {
    margin: 10px 3px;  /* Adds space between buttons */
    padding: 5px 10px; /* Adjust button padding */
    display: inline-block; /* Ensures proper spacing */
}
		select {
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 8px 12px;
    font-size: 16px;
    background-color: white;
    color: #333;
}

select:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
}
		.success-highlight {
    background-color: #c8e6c9 !important; /* Light green background */
    transition: background-color 2s ease; /* Fade transition */
}
        .dt-search input {
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 8px 12px;
            font-size: 16px;
            width: 250px; /* Adjust as needed */
            transition: border-color 0.3s ease;
 margin: 10px 0 20px 0;
        }

        .dataTables_filter input:focus {
            outline: none;
            border-color: #007bff; /* Highlight color on focus */
            box-shadow: 0 0 5px rgba(0, 123, 255, 0.5); /* Optional: add a subtle shadow */
        }
    </style>
		
		
    <style>
		
		
        .expand-row {
            cursor: pointer;
        }
        .medical-info {
            display: none;
        }
        .card-container {
            margin-top: 20px;
        }
    </style>

		
		
	</head>
