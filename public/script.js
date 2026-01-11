async function fetchOtps() {
    const input = document.getElementById('accountInput').value.trim();
    if (!input) return;

    const lines = input.split('\n');
    const tbody = document.getElementById('resultsBody');
    const loader = document.getElementById('loader');

    tbody.innerHTML = '';
    loader.classList.remove('hidden');

    for (const line of lines) {
        if (!line.trim()) continue;

        // Format: email|password|refresh_token|client_id
        const parts = line.split('|');
        if (parts.length < 4) {
            addErrorRow(line, "Invalid Format");
            continue;
        }

        const [email, password, refresh_token, client_id] = parts.map(p => p.trim());

        try {
            const response = await fetch('/api/fetch-otps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, refresh_token, client_id })
            });

            const data = await response.json();

            if (data.success && data.otps.length > 0) {
                // Determine the "best" OTP - likely the most recent one
                const latestOtp = data.otps[0]; // Assuming API returns sorted or we just take first for now
                addRow(latestOtp);
            } else if (data.success && data.otps.length === 0) {
                addErrorRow(email, "No OTPs found");
            } else {
                addErrorRow(email, data.error || "Failed");
            }

        } catch (err) {
            addErrorRow(email, "Network Error");
        }
    }

    loader.classList.add('hidden');
}

function addRow(otpData) {
    const tbody = document.getElementById('resultsBody');
    const tr = document.createElement('tr');

    // Format date
    const date = new Date(otpData.receivedAt).toLocaleString();

    tr.innerHTML = `
        <td>${otpData.email}</td>
        <td class="code-cell">${otpData.code}</td>
        <td>${otpData.subject}</td>
        <td>${otpData.sender}</td>
        <td>${date}</td>
    `;
    tbody.appendChild(tr);
}

function addErrorRow(item, msg) {
    const tbody = document.getElementById('resultsBody');
    const tr = document.createElement('tr');
    tr.style.opacity = "0.6";

    // Logic to distinguish if item is a full line or just email
    const displayLabel = item.includes('|') ? item.split('|')[0] : item;

    tr.innerHTML = `
        <td>${displayLabel}</td>
        <td class="code-cell" style="color: #ff7675">-</td>
        <td colspan="3" style="color: #ff7675">${msg}</td>
    `;
    tbody.appendChild(tr);
}
