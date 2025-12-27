/**
 * Team Collaboration & Chat Logic
 * Handles Team Search and Company Channel management
 */

// ================== TEAM SEARCH ==================
const searchTeamInput = document.getElementById('search-team-input');
const searchResultsContainer = document.getElementById('search-team-results');

if (searchTeamInput && searchResultsContainer) {
    let debounceTimer;

    searchTeamInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            searchTeam(query);
        }, 500);
    });
}

async function searchTeam(query) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/team/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            renderSearchResults(data.users);
        }
    } catch (e) {
        console.error('Error searching users:', e);
    }
}

function renderSearchResults(users) {
    if (!users || users.length === 0) {
        searchResultsContainer.innerHTML = '<div class="p-2 text-muted">No users found</div>';
        searchResultsContainer.style.display = 'block';
        return;
    }

    searchResultsContainer.innerHTML = users.map(user => `
        <div class="search-result-item p-2 border-bottom d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <img src="${user.profile_picture_url || '/assets/images/faces/9.jpg'}" class="avatar avatar-sm rounded-circle me-2">
                <div>
                    <h6 class="mb-0 fs-14">${escapeHtml(user.full_name)}</h6>
                    <small class="text-muted">${escapeHtml(user.email)}</small>
                </div>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="inviteUser('${user.id}')">
                <i class="ri-user-add-line"></i> Invite
            </button>
        </div>
    `).join('');
    searchResultsContainer.style.display = 'block';
}

async function inviteUser(userId) {
    if(!confirm("Invite this user to your team?")) return;
    
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/team/invite', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ userId, role: 'member' }) // Default to member
        });
        const data = await res.json();
        
        if (data.success) {
            alert("User invited successfully!");
            searchTeamInput.value = '';
            searchResultsContainer.style.display = 'none';
            // Reload team list if function exists
            if(window.loadTeamMembers) window.loadTeamMembers();
        } else {
            alert(data.message || "Failed to invite user");
        }
    } catch (e) {
        console.error(e);
        alert("Error sending invitation");
    }
}


// ================== CHANNEL MANAGEMENT ==================

// "Add All Team Members" to Channel
async function addAllTeamToChannel() {
    // Assuming currentChatId is set globally when opening a channel
    if (!window.currentChatId || window.currentChatType !== 'channel') {
        return alert("Please select a channel first");
    }

    if (!confirm("Are you sure you want to add ALL team members to this channel?")) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/channels/${window.currentChatId}/add-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            alert(data.message);
            // Optionally refresh member list
        } else {
            alert(data.message || "Failed to add members");
        }
    } catch (e) {
        console.error(e);
        alert("Error processing request");
    }
}

// Helper to escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, (m) => map[m]);
}
