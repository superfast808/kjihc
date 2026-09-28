<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login with MFA</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <style>
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: #f8f9fa;
        }

        .card {
            width: 400px; /* Adjust as needed */
        }
        .microsoft-login-button {
            background-color: #0078d4; /* Microsoft blue */
            color: white;
            border: none;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            margin: 10px 0;
            cursor: pointer;
            border-radius: 5px;
            width: 100%; /* Make button full width */
        }

        .microsoft-login-button:hover {
            background-color: #005a9e; /* Darker blue on hover */
        }
    </style>
</head>
<body>

    <div class="card">
        <div class="card-body">
            <h5 class="card-title text-center">Login</h5>
            <form method="post" action="classes/loginprocess.php">
                <div class="form-group">
                    <label for="staff_email">Email Address</label>
                    <input type="text" class="form-control" name="staff_email" id="staff_email" placeholder="Enter username">
                </div>
                <div class="form-group">
                    <label for="staff_password">Password</label>
                    <input type="password" class="form-control" name="staff_password" id="staff_password" placeholder="Password">
                </div>
                <button type="submit" class="btn btn-primary btn-block">Login</button>
            </form>
            <div class="text-center mt-3">
                <button class="microsoft-login-button" onclick="location.href='classes/azureprocess.php'; return false;">Login with Microsoft</button>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
</body>
</html>