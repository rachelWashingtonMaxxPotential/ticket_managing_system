// metrics.js - Display advanced metrics from uploaded CSV

document.addEventListener('DOMContentLoaded', function() {
    const csvData = sessionStorage.getItem('csvData');
    
    if (!csvData) {
        alert('No CSV data found. Please upload a CSV file first.');
        window.location.href = '/';
        return;
    }
    
    processCSV(csvData);
});

document.getElementById('backButton').addEventListener('click', function() {
    sessionStorage.removeItem('csvData');
    window.location.href = '/';
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

function processCSV(data) {
    const rows = data.split('\n');
    const metrics = calculateMetrics(rows);
    displayMetrics(metrics);
}

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    // Handle format: 2026-01-01 19:52:24 -0500 EST
    // JavaScript Date can parse this directly
    const parsed = new Date(dateStr.trim());
    return isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysDifference(date1, date2) {
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function calculateMetrics(lines) {
    const metrics = {
        totalTickets: 0,
        resolvedTickets: 0,
        resolutionRate: 0,
        volumeByInbox: {},
        volumeByClient: {},
        volumeByWeek: {},
        backlogByAge: {
            '0-2d': 0,
            '3-7d': 0,
            '8-14d': 0,
            '15+d': 0
        },
        avgFirstResponseTime: {
            overall: 0,
            byPriority: {}
        },
        avgTimeToClose: {
            overall: 0,
            byPriority: {}
        },
        tagCoverage: {
            ticketsWithTags: 0,
            ticketsWithPriority: 0,
            percentWithTags: 0,
            percentWithPriority: 0
        }
    };

    const tickets = [];
    const now = new Date();

    // CSV columns: ID, URL, Subject, Inbox, Status, Type, Source, Priority, Tagged, Agent, Company, Customer, Email, Happiness, Created, Time Tracked, Time Billed, Response Time, Resolution Time, Created at, Updated at
    // Indices:     0   1    2        3      4       5     6       7         8       9      10       11        12     13         14       15             16           17             18               19          20
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = parseCSVLine(line);
        if (columns.length < 2) continue;

        // Skip tickets without an assigned agent
        const agentValue = columns[9] ? columns[9].trim() : '';
        if (!agentValue || agentValue === '' || agentValue === 'Unknown') {
            continue; // Skip this ticket entirely from all calculations
        }

        const ticket = {
            id: columns[0] || '',
            category: columns[1] || 'Uncategorized',  // URL column
            subject: columns[2] || 'No Subject',       // Subject column
            inbox: columns[3] || '',                   // Inbox column
            status: columns[4] || 'open',              // Status column
            type: columns[5] || 'Unknown',             // Type column
            source: columns[6] || 'Unknown',           // Source column
            priority: columns[7] || '',                // Priority column - keep blank if not assigned
            tagged: columns[8] || 'false',             // Tagged column
            agent: agentValue,                         // Agent column
            company: columns[10] || 'Unknown',         // Company column
            client: columns[11] || 'Unknown',          // Customer column
            Email: columns[12] || 'Unknown',           // Email column
            happinesscomment: columns[13] || 'Unknown',       // Happiness column
            happiness: columns[14] || 'Unknown',       // Happiness ratingcolumn
            timeTracked: columns[15] || 'Unknown',     // Time Tracked column
            timeBilled: columns[16] || 'Unknown',      // Time Billed column
            responseTime: columns[17] || '',           // Response Time column (in minutes)
            resolutionTime: columns[18] || 'Unknown',   // Resolution Time column
            createdDate: parseDate(columns[19]),       // Created column
            updatedDate: parseDate(columns[20]), // updated column
        };

        if (!ticket.id) continue;

        tickets.push(ticket);
        metrics.totalTickets++;

        // Count resolved tickets - check for 'solved' status
        if (ticket.status.toLowerCase() === 'solved' || ticket.status.toLowerCase() === 'resolved' || ticket.status.toLowerCase() === 'closed') {
            metrics.resolvedTickets++;
        }
        
        // Tag coverage - check if ticket has tags
        if (ticket.tagged && ticket.tagged.trim() !== '' && ticket.tagged.toLowerCase() !== 'false') {
            metrics.tagCoverage.ticketsWithTags++;
        }
        
        // Priority coverage - check if ticket has assigned priority (low, medium, high - not blank)
        // Note: tickets without priority (blank/none) are still included in all other calculations
        if (ticket.priority && ticket.priority.trim() !== '') {
            metrics.tagCoverage.ticketsWithPriority++;
        }

        // Volume by inbox - only track if inbox has a value
        if (ticket.inbox && ticket.inbox.trim() !== '') {
            const inboxValue = ticket.inbox.trim();
            metrics.volumeByInbox[inboxValue] = (metrics.volumeByInbox[inboxValue] || 0) + 1;
        }

        // Volume by client (Customer)
        metrics.volumeByClient[ticket.client] = (metrics.volumeByClient[ticket.client] || 0) + 1;

        // Volume by week
        if (ticket.createdDate) {
            const weekNum = getWeekNumber(ticket.createdDate);
            const weekKey = `Week ${weekNum}`;
            metrics.volumeByWeek[weekKey] = (metrics.volumeByWeek[weekKey] || 0) + 1;
        }

        // Backlog age buckets (only for active or waiting on customer tickets)
        const statusLower = ticket.status.toLowerCase();
        if ((statusLower === 'active' || statusLower === 'waiting on customer') && ticket.createdDate) {
            const age = getDaysDifference(ticket.createdDate, now);
            if (age <= 2) {
                metrics.backlogByAge['0-2d']++;
            } else if (age <= 7) {
                metrics.backlogByAge['3-7d']++;
            } else if (age <= 14) {
                metrics.backlogByAge['8-14d']++;
            } else {
                metrics.backlogByAge['15+d']++;
            }
        }

        // First response time - use responseTime column value (in minutes)
        const responseTimeStr = ticket.responseTime;
        
        // Parse response time - value is in minutes, convert to hours for display
        const numValue = parseFloat(responseTimeStr);
        if (!isNaN(numValue) && numValue > 0) {
            const responseTimeInHours = numValue / 60; // Convert minutes to hours
            
            // Handle blank priority as 'none', otherwise use actual priority value
            const priorityKey = ticket.priority && ticket.priority.trim() !== '' ? ticket.priority.trim().toLowerCase() : 'none';
            
            
            if (!metrics.avgFirstResponseTime.byPriority[priorityKey]) {
                metrics.avgFirstResponseTime.byPriority[priorityKey] = { total: 0, count: 0 };
            }
            metrics.avgFirstResponseTime.byPriority[priorityKey].total += responseTimeInHours;
            metrics.avgFirstResponseTime.byPriority[priorityKey].count++;
        }

        // Time to close - use resolutionTime column value (in minutes) or calculate from dates, track by priority
        let timeToCloseValue = 0;
        
        if (ticket.resolutionTime && ticket.resolutionTime !== 'Unknown' && ticket.resolutionTime !== '') {
            const resolutionTimeMinutes = parseFloat(ticket.resolutionTime);
            if (!isNaN(resolutionTimeMinutes)) {
                // Convert minutes to days (60 minutes * 24 hours = 1440 minutes per day)
                timeToCloseValue = resolutionTimeMinutes / 1440;
            }
        } else if (ticket.createdDate && ticket.updatedDate && (ticket.status.toLowerCase() === 'solved' || ticket.status.toLowerCase() === 'closed' || ticket.status.toLowerCase() === 'resolved')) {
            // Fallback: calculate from created to updated date for closed tickets (already in days)
            timeToCloseValue = getDaysDifference(ticket.createdDate, ticket.updatedDate);
        }
        
        if (timeToCloseValue > 0) {
            // Track by priority
            const priorityKey = ticket.priority && ticket.priority.trim() !== '' ? ticket.priority.trim().toLowerCase() : 'none';
            
            if (!metrics.avgTimeToClose.byPriority[priorityKey]) {
                metrics.avgTimeToClose.byPriority[priorityKey] = { total: 0, count: 0 };
            }
            metrics.avgTimeToClose.byPriority[priorityKey].total += timeToCloseValue;
            metrics.avgTimeToClose.byPriority[priorityKey].count++;
        }
    }

    // Calculate resolution rate
    metrics.resolutionRate = metrics.totalTickets > 0 
        ? ((metrics.resolvedTickets / metrics.totalTickets) * 100).toFixed(2) 
        : 0;

    // Calculate average first response time overall (already in hours)
    let totalResponseTime = 0;
    let totalResponseCount = 0;
    for (const priority in metrics.avgFirstResponseTime.byPriority) {
        const data = metrics.avgFirstResponseTime.byPriority[priority];
        totalResponseTime += data.total;
        totalResponseCount += data.count;
        // Already in hours, just calculate average
        data.avgHours = (data.total / data.count).toFixed(1);
    }
    metrics.avgFirstResponseTime.overall = totalResponseCount > 0 
        ? (totalResponseTime / totalResponseCount).toFixed(1) 
        : 0;

    // Calculate average time to close overall and by priority
    let totalCloseTime = 0;
    let totalCloseCount = 0;
    for (const priority in metrics.avgTimeToClose.byPriority) {
        const data = metrics.avgTimeToClose.byPriority[priority];
        totalCloseTime += data.total;
        totalCloseCount += data.count;
        data.avgDays = (data.total / data.count).toFixed(1);
    }
    metrics.avgTimeToClose.overall = totalCloseCount > 0
        ? (totalCloseTime / totalCloseCount).toFixed(1) 
        : 0;

    // Calculate tag coverage percentages
    metrics.tagCoverage.percentWithTags = metrics.totalTickets > 0
        ? ((metrics.tagCoverage.ticketsWithTags / metrics.totalTickets) * 100).toFixed(1)
        : 0;
    metrics.tagCoverage.percentWithPriority = metrics.totalTickets > 0
        ? ((metrics.tagCoverage.ticketsWithPriority / metrics.totalTickets) * 100).toFixed(1)
        : 0;

    return metrics;
}

function displayMetrics(metrics) {
    const metricsDisplay = document.getElementById('metricsDisplay');
    
    // Build volume by inbox table
    let inboxRows = '';
    for (const [inbox, count] of Object.entries(metrics.volumeByInbox)) {
        inboxRows += `<tr><td>${inbox}</td><td class="text-end"><strong>${count}</strong></td></tr>`;
    }
    
    // Build volume by client table (Customer)
    let clientRows = '';
    for (const [client, count] of Object.entries(metrics.volumeByClient)) {
        clientRows += `<tr><td>${client}</td><td class="text-end"><strong>${count}</strong></td></tr>`;
    }
    
    // Build first response time by priority table - ensure order: none, low, medium, high
    const priorityOrder = ['none', 'low', 'medium', 'high'];
    let responseTimeRows = '';
    for (const priority of priorityOrder) {
        if (metrics.avgFirstResponseTime.byPriority[priority]) {
            const data = metrics.avgFirstResponseTime.byPriority[priority];
            const displayPriority = priority === 'none' ? 'None (Unassigned)' : priority.charAt(0).toUpperCase() + priority.slice(1);
            responseTimeRows += `<tr><td>${displayPriority}</td><td class="text-end"><strong>${data.avgHours} hours</strong></td></tr>`;
        }
    }
    
    // Build time to close by priority table - ensure order: none, low, medium, high
    let closeTimeRows = '';
    for (const priority of priorityOrder) {
        if (metrics.avgTimeToClose.byPriority[priority]) {
            const data = metrics.avgTimeToClose.byPriority[priority];
            const displayPriority = priority === 'none' ? 'None (Unassigned)' : priority.charAt(0).toUpperCase() + priority.slice(1);
            closeTimeRows += `<tr><td>${displayPriority}</td><td class="text-end"><strong>${data.avgDays} days</strong></td></tr>`;
        }
    }
    
    
    const totalBacklog = metrics.backlogByAge['0-2d'] + metrics.backlogByAge['3-7d'] + 
                         metrics.backlogByAge['8-14d'] + metrics.backlogByAge['15+d'];
    
    metricsDisplay.innerHTML = `
        <!-- Summary Cards -->
        <div class="row g-3 mb-4">
            <div class="col-md-3">
                <div class="card text-center bg-primary text-white">
                    <div class="card-body">
                        <h5 class="card-title">Total Tickets</h5>
                        <p class="display-4 mb-0">${metrics.totalTickets}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center bg-success text-white">
                    <div class="card-body">
                        <h5 class="card-title">Resolved Tickets</h5>
                        <p class="display-4 mb-0">${metrics.resolvedTickets}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center bg-warning text-dark">
                    <div class="card-body">
                        <h5 class="card-title">Open Backlog</h5>
                        <p class="display-4 mb-0">${totalBacklog}</p>
                        <small>Active + Waiting on Customer</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center bg-info text-white">
                    <div class="card-body">
                        <h5 class="card-title">Resolution Rate</h5>
                        <p class="display-4 mb-0">${metrics.resolutionRate}%</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Backlog Age Buckets - Prominent Display -->
        <div class="row g-3 mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-warning text-dark">
                        <h4 class="mb-0">📊 Backlog by Age (Active + Waiting on Customer)</h4>
                    </div>
                    <div class="card-body">
                        <div class="row text-center g-3">
                            <div class="col-md-3">
                                <div class="p-4 border rounded bg-light">
                                    <h6 class="text-muted mb-2">0-2 Days</h6>
                                    <h1 class="text-success mb-0">${metrics.backlogByAge['0-2d']}</h1>
                                    <small class="text-muted">Fresh tickets</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="p-4 border rounded bg-light">
                                    <h6 class="text-muted mb-2">3-7 Days</h6>
                                    <h1 class="text-info mb-0">${metrics.backlogByAge['3-7d']}</h1>
                                    <small class="text-muted">Recent</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="p-4 border rounded bg-light">
                                    <h6 class="text-muted mb-2">8-14 Days</h6>
                                    <h1 class="text-warning mb-0">${metrics.backlogByAge['8-14d']}</h1>
                                    <small class="text-muted">Aging</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="p-4 border rounded bg-light">
                                    <h6 class="text-muted mb-2">15+ Days</h6>
                                    <h1 class="text-danger mb-0">${metrics.backlogByAge['15+d']}</h1>
                                    <small class="text-muted">Critical</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Response Time and Time to Close -->
        <div class="row g-3 mb-4">
            <div class="col-md-6">
                <!-- Average First Response Time by Priority -->
                <div class="card mb-3">
                    <div class="card-header bg-success text-white">
                        <h5 class="mb-0">⏱️ Avg First Response Time by Priority</h5>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-success mb-3">
                            <strong>Overall Average:</strong> ${metrics.avgFirstResponseTime.overall} hours
                        </div>
                        <table class="table table-striped table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Priority</th>
                                    <th class="text-end">Avg Response Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${responseTimeRows || '<tr><td colspan="2" class="text-center text-muted">No data available</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Average Time to Close by Priority -->
                <div class="card mb-3">
                    <div class="card-header bg-warning text-dark">
                        <h5 class="mb-0">🕐 Avg Time to Close by Priority</h5>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-warning mb-3">
                            <strong>Overall Average:</strong> ${metrics.avgTimeToClose.overall} days
                        </div>
                        <table class="table table-striped table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Priority</th>
                                    <th class="text-end">Avg Time to Close</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${closeTimeRows || '<tr><td colspan="2" class="text-center text-muted">No data available</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Tag Coverage -->
                <div class="card">
                    <div class="card-header bg-secondary text-white">
                        <h5 class="mb-0">🏷️ Tag Coverage</h5>
                    </div>
                    <div class="card-body">
                        <div class="row text-center">
                            <div class="col-6">
                                <div class="p-3 border rounded bg-light">
                                    <h6 class="text-muted mb-2">Tickets with Tags</h6>
                                    <h2 class="text-primary mb-0">${metrics.tagCoverage.percentWithTags}%</h2>
                                    <small class="text-muted">${metrics.tagCoverage.ticketsWithTags} of ${metrics.totalTickets}</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-3 border rounded bg-light">
                                    <h6 class="text-muted mb-2">Assigned Priority</h6>
                                    <h2 class="text-success mb-0">${metrics.tagCoverage.percentWithPriority}%</h2>
                                    <small class="text-muted">${metrics.tagCoverage.ticketsWithPriority} of ${metrics.totalTickets}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0">� Ticket Volume</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-6">
                                <h6 class="text-muted">By Inbox</h6>
                                <table class="table table-sm table-hover mb-0">
                                    <tbody>
                                        ${inboxRows || '<tr><td colspan="2" class="text-center text-muted">No data</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                            <div class="col-6">
                                <h6 class="text-muted">By Customer</h6>
                                <table class="table table-sm table-hover mb-0">
                                    <tbody>
                                        ${clientRows || '<tr><td colspan="2" class="text-center text-muted">No data</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
