// staff_management.js


/*
document.addEventListener('DOMContentLoaded', getStaffAccess);        
function filterButtons(staffAccess) {
            const buttonGroup = document.querySelector('.btn-group');
            const buttons = buttonGroup.querySelectorAll('.filter-age');

            if (staffAccess === '1') {
                buttons.forEach(button => button.style.display = 'block');
                return;
            }

            const accessGroups = staffAccess.split(',');

            buttons.forEach(button => {
                const dataAge = button.getAttribute('data-age');

                if (dataAge && accessGroups.includes(dataAge)) {
                    button.style.display = '';
                } else if(!accessGroups.includes(dataAge)){
                    button.style.display = 'none';
                }else if(!dataAge){
                    button.style.display = '';
                }
            });
        }
		*/

        function getStaffAccess() {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'classes/getAccess.php', true); // Replace with your PHP file's name
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = JSON.parse(xhr.responseText);
					//alert(xhr.responseText);
                    filterButtons(response.staffAccess);
                } else {
                    console.error('Request failed with status:', xhr.status);
                }
            };
            xhr.onerror = function() {
                console.error('Network error occurred.');
            };
            xhr.send();
        }

function applyPagingButtonStyles() {
    setTimeout(function() {
        console.log("Applying paging button styles");
        console.log($('.dt-paging-button'));
        $('.dt-paging-button').addClass('btn btn-sm btn-outline-secondary');
        $('.dt-paging-button').filter(function() {
            return $(this).text().trim() === 'Previous' || $(this).text().trim() === 'Next';
        }).addClass('btn-primary');
        $('.dt-paging-button current').addClass('btn btn-primary');
    }, 100);
}

$(document).ready(function() {
    getStaffAccess();
    let table = $('#playerTable').DataTable({
        responsive: true,
        pagingType: "full_numbers",
        "ajax": {
            "url": "classes/get_players.php",
            "dataSrc": ""
        },
        "columns": [
            { "data": "player_id" },
            { "data": "player_name" },
            { "data": "player_dob" },
            { "data": "player_agegroup" }, // Display age group as plain text
            { "data": "player_parent" },
            {
                "data": "player_contacttel",
                "render": function(data, type, row) {
                    if (type === 'display') {
                        if (data) {
                            const numbers = data.split('/');
                            let output = '';

                            numbers.forEach(number => {
                                const trimmedNumber = number.trim();
                                output += `<a href="tel:${trimmedNumber}" style="color:black; font-weight:bold;">${trimmedNumber}</a><br>`;
                            });

                            return output.trimEnd('<br>');
                        } else {
                            return '&#x260E; N/A';
                        }
                    }
                    return data;
                }
            },
            { "data": "player_email" },
            {
                "data": null,
                "render": function(data, type, row) {
                    return '<i class="bi bi-plus-circle expand-row" data-id="' + row.player_id + '"></i>';
                }
            },
            {
                "data": null,
                "render": function(data, type, row) {
                    return '<button class="btn btn-danger btn-sm delete-player" data-id="' + row.player_id + '">Delete</button>';
                }
            }
        ],
        "order": [[0, "asc"]]
    });

    applyPagingButtonStyles();

    $('.dt-search input').attr('placeholder', 'Enter search terms...');
    $('.dt-search label').contents().filter(function() {
        return (this.nodeType == 3);
    }).remove();

    $('#playerTable').on('draw.dt', function() {
        applyPagingButtonStyles();
    });

    // Corrected filtering logic to use age group from the data
    $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
        let filterAge = $('.filter-age.active').data('age'); // Ensure we get the correct data-age

        if (filterAge === "") {
            return true; // Show all if "All" is selected
        }

        let rowAgeGroup = data[3]; // The age group is now plain text, so we get it from the data array
        console.log("Filtering:", "Row:", dataIndex, "Row Age Group:", rowAgeGroup, "Filter Age:", filterAge);
        return rowAgeGroup === filterAge;
    });

    $('.filter-age').click(function() {
        $('.filter-age').removeClass('active');
        $(this).addClass('active');
        table.draw();
    })

    $('#playerTable tbody').on('click', '.expand-row', function() {
        let playerId = $(this).data('id');
        let row = $(this).closest('tr');
        let medicalRow = row.next('.medical-info');

        if (medicalRow.length) {
            medicalRow.remove();
        } else {
            $.ajax({
                url: 'classes/get_medical_info.php',
                type: 'GET',
                dataType: "json",
                data: { player_id: playerId },
                success: function(medicalData) {
                    let medicalHtml = '<tr class="medical-info"><td colspan="9">';
                    medicalHtml += '<div class="card"><div class="card-body"><div class="row">';

                    medicalHtml += '<div class="col-md-6">';
                    medicalHtml += '<strong>Address 1:</strong> ' + (medicalData.player_address1 || 'N/A') + '<br>';
                    medicalHtml += '<strong>Address 2:</strong> ' + (medicalData.player_address2 || 'N/A') + '<br>';
                    medicalHtml += '<strong>City:</strong> ' + (medicalData.player_city || 'N/A') + '<br>';
                    medicalHtml += '<strong>Postcode:</strong> ' + (medicalData.player_post || 'N/A') + '<br>';
                    medicalHtml += '</div>';

                    medicalHtml += '<div class="col-md-6">';
                    medicalHtml += '<strong>Medical Notes:</strong> ' + (medicalData.player_medicalnotes || 'N/A') + '<br>';
                    medicalHtml += '<strong>Medication:</strong> ' + (medicalData.player_medication || 'N/A') + '<br>';
                    medicalHtml += '<strong>Fee:</strong> ' + (medicalData.player_fee || 'N/A') + '<br>';
                    medicalHtml += '<strong>Read Code of Conduct:</strong> ' + (medicalData.read_code || 'N/A') + '<br>';
                    medicalHtml += '<strong>Agreed to Fee:</strong> ' + (medicalData.agree_fee || 'N/A') + '<br>';
                    medicalHtml += '<strong>Agreed to GDPR:</strong> ' + (medicalData.agree_gdpr || 'N/A') + '<br>';
                    medicalHtml += '<strong>Agreed to Photgraphy:</strong> ' + (medicalData.agree_photo || 'N/A') + '<br>';

                    // Add age group select box here
                    medicalHtml += '<br><strong>Change Age Group:</strong><br>';
                    medicalHtml += `<select class="age-group-select" data-id="${playerId}">
                                        <option value="novice" ${medicalData.player_agegroup === 'novice' ? 'selected' : ''}>Novice</option>
                                        <option value="beginner" ${medicalData.player_agegroup === 'LTP' ? 'selected' : ''}>LTP</option>
                                        <option value="u10" ${medicalData.player_agegroup === 'u10' ? 'selected' : ''}>u10</option>
                                        <option value="u12" ${medicalData.player_agegroup === 'u12' ? 'selected' : ''}>u12</option>
                                        <option value="u14" ${medicalData.player_agegroup === 'u14' ? 'selected' : ''}>u14</option>
                                        <option value="u16" ${medicalData.player_agegroup === 'u16' ? 'selected' : ''}>u16</option>
                                        <option value="u19" ${medicalData.player_agegroup === 'u19' ? 'selected' : ''}>u19</option>
                                    </select>`;

                    medicalHtml += '</div>';

                    medicalHtml += '</div></div></div></td></tr>';
                    row.after(medicalHtml);
                    row.next('.medical-info').css('display', 'table-row');
                },
                error: function() {
                    alert('Failed to load medical information.');
                }
            });
        }
    });

    $('#playerTable').on('change', '.age-group-select', function() {
        let playerId = $(this).data('id');
        let newAgeGroup = $(this).val();
        let row = $(this).closest('tr');

        $.ajax({
            url: 'classes/update_agegroup.php',
            method: 'POST',
            data: {
                player_id: playerId,
                age_group: newAgeGroup
            },
            success: function(response) {
                if (response === 'success') {
                    row.addClass('success-highlight');
                    setTimeout(function() {
                        row.removeClass('success-highlight');
                        table.ajax.reload();
                    }, 2000);
                } else {
                    alert('Failed to update age group.');
                }
            },
            error: function() {
                alert('An error occurred during the update.');
            }
        });
    });

    $('#playerTable tbody').on('click', '.delete-player', function() {
        let playerId = $(this).data('id');
        if (confirm("Are you sure you want to delete this player?")) {
            $.ajax({
                url: 'classes/delete_player.php',
                type: 'POST',
                data: { player_id: playerId },
                success: function(response) {
                    if (response === 'success') {
                        table.ajax.reload();
                        alert('Player deleted successfully.');
                    } else {
                        alert('Failed to delete player.');
                    }
                },
                error: function() {
                    alert('An error occurred during the deletion.');
                }
            });
        }
    });
	table.draw();
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