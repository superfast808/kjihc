

$(document).ready(function() {
	console.log("DataTables init starting");
    let table = $('#staffTable').DataTable({
        responsive: true,
        pagingType: "full_numbers",
        "ajax": {
            "url": "classes/staff_management.php?action=getStaff",
            "dataSrc": "",
			dataType: "json",
            "beforeSend": function() {
                console.log("AJAX request sent to getStaff");
            },
                        "success": function(data) {
                console.log("AJAX data received:", data);
                table.clear().rows.add(data).draw(); // Force re-render
            },
            "error": function(xhr, status, error) {
                console.error("AJAX request failed:", status, error, xhr);
            }
        },
        "columns": [
         { "data": "staff_id" },
            { "data": "staff_email" },
            { "data": "staff_name" },
         { "data": "staff_level",
                "render": function(data, type, row){
                    if (type === 'display' || type === 'filter'){
                        return renderStaffLevel(data);
                    }
                    return data;
                }
            },
          {
                "data": null,
                "render": function(data, type, row) {
                    return '<button class="btn btn-primary btn-sm edit-staff" data-id="' + row.staff_id + '">Edit</button> <button class="btn btn-danger btn-sm delete-staff" data-id="' + row.staff_id + '">Delete</button> <button class="btn btn-warning btn-sm reset-password" data-id="' + row.staff_id + '" data-email="' + row.staff_email + '">Reset Password</button>';
                }
            } 
        ],
        "order": [[0, "asc"]],
		        data: [{"staff_id":1,"staff_email":"test@test.com","staff_name":"test name","staff_level":"1"}]

    });
console.log("DataTables init finished");
    function renderStaffLevel(level){
        if(level === "1"){
            return "Superuser";
        }

        const ageGroups = ['novice', 'LTP', 'u10', 'u12', 'u14', 'u16', 'u19', 'lightning'];
        let output = "";
        ageGroups.forEach(group => {
            const checked = level.includes(group) ? "checked" : "";
            output += `<div class="toggle-container"><label class="toggle"><input type="checkbox" ${checked} disabled><span class="slider round"></span></label> ${group}</div>`;
        });
        return output;
    }

    $('#addStaffForm').submit(function(e) {
        e.preventDefault();
        let email = $('#email').val();
        let name = $('#name').val();
        let level = getStaffLevel();

        $.ajax({
            url: 'classes/staff_management.php?action=addStaff',
            method: 'POST',
            data: { email: email, name: name, level: level },
            success: function() {
                table.ajax.reload();
                $('#addStaffModal').modal('hide');
            }
        });
    });

$('#staffTable').on('click', '.edit-staff', function() {
    let id = $(this).data('id');
    $.ajax({
        url: 'classes/staff_management.php?action=getStaff',
        method: 'GET',
        dataType: "json",
        data: { id: id },
        success: function(data) {
            console.log("Edit Staff AJAX Response:", data);
            console.log("Immediate data object:", data);
            console.log("staff level:", data.staff_level);
            // generate the checkboxes
            $('#editStaffLevelContainer').html(setStaffLevel(data.staff_level, 'edit'));
            $('#editId').val(data.staff_id);
            $('#editEmail').val(data.staff_email);
            $('#editName').val(data.staff_name);
            $('#editStaffModal').modal('show');
        }
    });
});

$('#saveEditStaff').click(function(event) {
    event.preventDefault();
    let id = $('#editId').val();
    let email = $('#editEmail').val();
    let name = $('#editName').val();
    let level = getStaffLevel('edit');

    console.log('Level before AJAX:', level); // Add this line

    $.ajax({
        url: 'classes/staff_management.php?action=updateStaff',
        method: 'POST',
        data: { id: id, email: email, name: name, level: level },
        success: function() {
            table.ajax.reload();
            $('#editStaffModal').modal('hide');
        }
    });
});

    $('#staffTable').on('click', '.delete-staff', function() {
        let id = $(this).data('id');
        $.ajax({
            url: 'classes/staff_management.php?action=deleteStaff',
            method: 'POST',
            data: { id: id },
            success: function() {
                table.ajax.reload();
            }
        });
    });

    $('#staffTable').on('click', '.reset-password', function() {
        let email = $(this).data('email');
		let id = $(this).data('id');
		console.log("email"+email);
		console.log("id"+id);
        $.ajax({
            url: 'classes/staff_management.php?action=resetPassword',
            method: 'POST',
            data: { email: email, id: id },
            success: function(response) {
				//alert(response);
                alert(response === 'true' ? 'Password reset and emailed.' : 'Failed to reset password.');
            },
			 error: function(xhr, status, err) {
            console.error("AJAX Error:", status, err, xhr);
        }
        });
    });

function getStaffLevel(prefix = '') {
    const ageGroups = ['novice', 'LTP', 'u10', 'u12', 'u14', 'u16', 'u19', 'lightning'];
    let level = [];

    console.log("getStaffLevel called with prefix:", prefix);

    ageGroups.forEach(group => {
        let checkboxId = `#${prefix}${group}`;
        if(typeof prefix !== "string"){
            console.error("Prefix is not a string:", prefix);
            return;
        }
        let isChecked = $(checkboxId).is(':checked');

        console.log("Checkbox:", checkboxId, "Checked:", isChecked);

        if (isChecked) {
            level.push(group);
        }
    });

    console.log("getStaffLevel returning:", level.join(','));

    return level.join(',');
}

function setStaffLevel(level, prefix = '') {
    if (level === undefined || level === null) {
        return ""; // Return an empty string if level is undefined or null
    }

    const ageGroups = ['novice', 'LTP', 'u10', 'u12', 'u14', 'u16', 'u19'];
    let output = "";
    ageGroups.forEach(group => {
        const checked = level.includes(group) ? "checked" : "";
        output += `<div class="toggle-container"><label class="toggle"><input type="checkbox" id="${prefix}${group}" ${checked}><span class="slider round"></span></label> ${group}</div>`;
    });
    return output;
}
	$('#addStaffButton').click(function() {
	
    $('#addStaffLevelContainer').html(setStaffLevel('', 'add'));
    $('#addStaffModal').modal('show');
});

$('#saveAddStaff').click(function(event) {
    event.preventDefault();

    let email = $('#addEmail').val();
    let name = $('#addName').val();
    let password = $('#addPassword').val();
    let level = getStaffLevel('add');

    $.ajax({
        url: 'classes/staff_management.php?action=addStaff',
        method: 'POST',
        data: { email: email, name: name, password: password, level: level },
        success: function() {
            table.ajax.reload();
            $('#addStaffModal').modal('hide');
            $('#addEmail').val('');
            $('#addName').val('');
            $('#addPassword').val('');
        },
        error: function(xhr, status, error) {
            console.error("AJAX Error:", status, error, xhr);
        }
    });
});
});