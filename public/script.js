document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('accountInput');
    if (input) {
        input.addEventListener('input', parseInput);
        // Also parse on load if there's content (e.g. browser autofill or back nav)
        if (input.value) parseInput();
    }
});

let isPasswordVisible = false;

function parseInput() {
    const input = document.getElementById('accountInput').value;
    const parsedSection = document.getElementById('parsedDataSection');
    const fetchBtn = document.getElementById('fetchBtn');
    const warning = document.getElementById('inputWarning');

    // Check if input matches format: email|password|refresh_token|client_id
    // allowing for surrounding whitespace
    const lines = input.split('\n').filter(line => line.trim() !== '');

    // We'll just take the first valid line for the preview if multiple are pasted
    // Or if handling single account paste
    if (lines.length > 0) {
        const parts = lines[0].split('|');
        if (parts.length >= 4) {
            const [email, password, refresh_token, client_id] = parts.map(p => p.trim());

            document.getElementById('previewEmail').textContent = email;
            document.getElementById('previewEmail').title = email; // Tooltip for long emails

            document.getElementById('previewPassword').textContent = isPasswordVisible ? password : '••••••••';
            document.getElementById('previewPassword').dataset.realValue = password;

            document.getElementById('previewClientId').textContent = client_id;
            document.getElementById('previewClientId').title = client_id;

            parsedSection.classList.remove('hidden');
            fetchBtn.style.display = 'none'; // Hide generic button
            warning.classList.add('hidden'); // Hide warning
            return;
        }
    }

    // If not valid or empty
    parsedSection.classList.add('hidden');

    if (input.trim().length > 0) {
        // Has content but didn't parse correctly -> Show Warning, Hide Button
        fetchBtn.style.display = 'none';
        warning.classList.remove('hidden');
    } else {
        // Empty -> Hide everything
        fetchBtn.style.display = 'none';
        warning.classList.add('hidden');
    }
}

function togglePasswordVisibility() {
    isPasswordVisible = !isPasswordVisible;
    const passSpan = document.getElementById('previewPassword');
    const eyeIcon = document.getElementById('passEyeIcon');
    const realValue = passSpan.dataset.realValue || '';

    if (isPasswordVisible) {
        passSpan.textContent = realValue;
        passSpan.classList.remove('password-mask');
        // Change icon to 'eye-off'
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        passSpan.textContent = '••••••••';
        passSpan.classList.add('password-mask');
        // Change icon back to 'eye'
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

function copyText(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const text = elementId === 'previewPassword'
        ? (element.dataset.realValue || element.textContent)
        : element.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.activeElement.closest('button');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            setTimeout(() => {
                btn.innerHTML = originalHtml;
            }, 2000);
        }
    }).catch(console.error);
}

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
        <td data-label="Email">${otpData.email}</td>
        <td data-label="OTP Code" class="code-cell">
            ${otpData.code}
            <button class="copy-btn" onclick="copyOtp('${otpData.code}', this)" title="Copy Code">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            </button>
        </td>
        <td data-label="Subject">${otpData.subject}</td>
        <td data-label="Sender">${otpData.sender}</td>
        <td data-label="Time">${date}</td>
    `;
    tbody.appendChild(tr);
}

function copyOtp(code, btn) {
    navigator.clipboard.writeText(code).then(() => {
        // Visual feedback
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#55efc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function addErrorRow(item, msg) {
    const tbody = document.getElementById('resultsBody');
    const tr = document.createElement('tr');
    tr.style.opacity = "0.6";

    // Logic to distinguish if item is a full line or just email
    const displayLabel = item.includes('|') ? item.split('|')[0] : item;

    tr.innerHTML = `
        <td data-label="Email">${displayLabel}</td>
        <td data-label="OTP Code" class="code-cell" style="color: #ff7675">-</td>
        <td data-label="Status" colspan="3" style="color: #ff7675">${msg}</td>
    `;
    tbody.appendChild(tr);
}
