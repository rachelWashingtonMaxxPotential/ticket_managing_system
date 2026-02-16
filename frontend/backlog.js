document.addEventListener('DOMContentLoaded', function() {
    const csvData = sessionStorage.getItem('csvData');
    
    if (!csvData) {
        document.getElementById('backlogDisplay').innerHTML = '<p class="text-center text-danger">No data available. Please upload a CSV file first.</p>';
        return;
    }
    
    processBacklog(csvData);
});

document.getElementById('backButton').addEventListener('click', function() {
    window.location.href = '/metrics.html';
});

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    
    const cleanedDateStr = dateStr.trim().replace(/ -\d{4} [A-Z]{3}$/, '');
    const date = new Date(cleanedDateStr);
    
    return isNaN(date.getTime()) ? null : date;
}

function getDaysDifference(date1, date2) {
    const diffTime = Math.abs(date2 - date1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function processBacklog(data) {
    const rows = data.split('\n');
    const backlogTickets = [];
    const now = new Date();

    for (let i = 1; i < rows.length; i++) {
        const line = rows[i].trim();
        if (!line) continue;

        const columns = parseCSVLine(line);
        if (columns.length < 2) continue;

        // Skip tickets without an assigned agent
        const agentValue = columns[9] ? columns[9].trim() : '';
        if (!agentValue || agentValue === '' || agentValue === 'Unknown') {
            continue;
        }

        const ticket = {
            id: columns[0] || '',
            url: columns[1] || 'N/A',
            subject: columns[2] || 'No Subject',
            inbox: columns[3] || 'N/A',
            status: columns[4] || 'open',
            agent: agentValue,
            createdDate: parseDate(columns[19])
        };

        if (!ticket.id) continue;

        // Only include non-resolved tickets
        const statusLower = ticket.status.toLowerCase();
        const isResolved = statusLower === 'solved' || statusLower === 'resolved' || statusLower === 'closed';
        
        if (!isResolved && ticket.createdDate) {
            ticket.daysOpen = getDaysDifference(ticket.createdDate, now);
            backlogTickets.push(ticket);
        }
    }

    displayBacklog(backlogTickets);
}

function displayBacklog(tickets) {
    const backlogDisplay = document.getElementById('backlogDisplay');
    
    if (tickets.length === 0) {
        backlogDisplay.innerHTML = '<p class="text-center text-muted">No open backlog tickets found.</p>';
        return;
    }

    // Sort by days open (oldest first)
    tickets.sort((a, b) => b.daysOpen - a.daysOpen);

    let tableHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>Ticket ID</th>
                        <th>URL</th>
                        <th>Subject</th>
                        <th>Inbox</th>
                        <th>Assigned Agent</th>
                        <th>Status</th>
                        <th class="text-end">Days Open</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const ticket of tickets) {
        const rowClass = ticket.daysOpen > 14 ? 'table-danger' : ticket.daysOpen > 7 ? 'table-warning' : '';
        const urlLink = ticket.url !== 'N/A' ? `<a href="${ticket.url}" target="_blank" rel="noopener noreferrer">${ticket.url}</a>` : 'N/A';
        tableHTML += `
            <tr class="${rowClass}">
                <td><strong>${ticket.id}</strong></td>
                <td>${urlLink}</td>
                <td>${ticket.subject}</td>
                <td>${ticket.inbox}</td>
                <td>${ticket.agent}</td>
                <td><span class="badge bg-secondary">${ticket.status}</span></td>
                <td class="text-end"><strong>${ticket.daysOpen} days</strong></td>
            </tr>
        `;
    }

    tableHTML += `
                </tbody>
            </table>
        </div>
        <div class="mt-3">
            <p class="text-muted">
                <strong>Total Open Tickets:</strong> ${tickets.length} | 
                <span class="text-danger">■</span> Critical (15+ days) | 
                <span class="text-warning">■</span> Aging (8-14 days)
            </p>
        </div>
    `;

    backlogDisplay.innerHTML = tableHTML;
}
