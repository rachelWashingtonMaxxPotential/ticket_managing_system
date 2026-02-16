// script.js - Frontend CSV upload handler

let uploadedCSVData = null;

document.getElementById('uploadButton').addEventListener('click', function() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();

        reader.onload = function(event) {
            uploadedCSVData = event.target.result;
            
            const uploadStatus = document.getElementById('uploadStatus');
            uploadStatus.textContent = `✓ File "${file.name}" uploaded successfully!`;
            uploadStatus.style.display = 'block';
            
            const calculateButton = document.getElementById('calculateButton');
            calculateButton.style.display = 'block';
        };

        reader.readAsText(file);
    } else {
        alert('Please select a CSV file first.');
    }
});

document.getElementById('calculateButton').addEventListener('click', function() {
    if (uploadedCSVData) {
        // Store CSV data in sessionStorage and navigate to metrics page
        sessionStorage.setItem('csvData', uploadedCSVData);
        window.location.href = '/metrics.html';
    }
});
