<?php
include("header.php");
include("classes/JoinController.php");

?>
<body style="background:#f5f5f5;">
<?php
$controller=new joinController("KJIHC");
	$controller->steps();
?>
</body>
</html>
