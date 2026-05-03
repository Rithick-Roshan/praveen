/* =============================================================
   Qatar Foundation Admin Portal – admin.js
   Connects the existing HTML/CSS UI to the Flask backend API.
   The UI markup and CSS remain completely unchanged.
   ============================================================= */

const API = window.location.origin + "/api";   // adjust if server runs elsewhere

// ─────────────────────────────────────────────────────────────
// CAPTCHA
// ─────────────────────────────────────────────────────────────
const captchas = { login: '', signup: '', forgot: '' };

function generateCaptcha(type) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    captchas[type] = code;
    document.getElementById(type + 'CaptchaText').textContent = code;
}
generateCaptcha('login');
generateCaptcha('signup');
generateCaptcha('forgot');

// ─────────────────────────────────────────────────────────────
// PAGE NAVIGATION
// ─────────────────────────────────────────────────────────────
function showPage(pageId) {
    document.querySelectorAll('.form-page').forEach(p => p.classList.remove('active'));
    setTimeout(() => document.getElementById(pageId).classList.add('active'), 50);
    document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('input').forEach(i => i.classList.remove('error'));
}

function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass
        ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function showError(id, msg) {
    const el = document.getElementById(id);
    if (msg) el.querySelector('span').textContent = msg;
    el.classList.add('show');
}
function clearAllErrors(formId) {
    document.querySelectorAll('#' + formId + ' .error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('#' + formId + ' input').forEach(i => i.classList.remove('error'));
}
function shakeForm(formId) {
    const form = document.getElementById(formId);
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 400);
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    document.getElementById('toast').classList.add('show');
    setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}

function checkStrength(val) {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const labels  = ['', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    const classes = ['', 'weak', 'medium', 'strong', 'very-strong'];
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById('str' + i);
        bar.className = 'strength-bar';
        if (i <= score) bar.classList.add(classes[score]);
    }
    document.getElementById('strengthLabel').textContent = val.length > 0 ? labels[score] : '';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD SHOW / HIDE
// ─────────────────────────────────────────────────────────────
function showDashboard(adminName, adminEmail) {
    document.getElementById('authWrapper').style.display = 'none';
    document.getElementById('dashboardWrapper').classList.add('active');
    document.body.style.alignItems = 'stretch';

    const name = adminName || adminEmail.split('@')[0];
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById('dashName').textContent = displayName;
    document.getElementById('dashAvatar').textContent = displayName.substring(0, 2).toUpperCase();

    if (window.innerWidth <= 768) {
        document.getElementById('menuToggle').style.display = 'flex';
    }

    // Load opportunities for this admin
    loadOpportunities();
}

function handleLogout() {
    fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
        .finally(() => {
            document.getElementById('dashboardWrapper').classList.remove('active');
            document.getElementById('authWrapper').style.display = 'flex';
            document.body.style.alignItems = '';
            showToast('Signed out successfully');
            showPage('loginPage');
        });
}

// ─────────────────────────────────────────────────────────────
// NAV ITEMS
// ─────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', function () {
        const page = this.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));

        const map = {
            dashboard:    ['dashboardSection',   'Dashboard'],
            learner:      ['learnerSection',     'Learner Management'],
            verifier:     ['verifierSection',    'Verifier Management'],
            collaborator: ['collaboratorSection','Collaborator Management'],
            opportunity:  ['opportunitySection', 'Opportunity Management'],
            reports:      ['reportsSection',     'Reports and Analytics'],
        };
        if (map[page]) {
            document.getElementById(map[page][0]).classList.add('active');
            document.getElementById('pageTitle').textContent = map[page][1];
        }

        // Refresh opportunities whenever the tab is opened
        if (page === 'opportunity') loadOpportunities();
    });
});

// ─────────────────────────────────────────────────────────────
// TABS / CHART
// ─────────────────────────────────────────────────────────────
function changeChartPeriod(period) {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === period) btn.classList.add('active');
    });
    const chartData = {
        daily:     'M0,120 Q50,110 100,90 T200,70 T300,50 T400,40',
        weekly:    'M0,110 Q50,95 100,85 T200,65 T300,45 T400,35',
        monthly:   'M0,100 Q50,85 100,75 T200,55 T300,40 T400,30',
        quarterly: 'M0,90 Q50,75 100,65 T200,50 T300,35 T400,25',
        yearly:    'M0,80 Q50,65 100,55 T200,40 T300,30 T400,20'
    };
    const path = chartData[period];
    document.getElementById('linePath').setAttribute('d', path);
    document.getElementById('lineArea').setAttribute('d', path + ' L400,150 L0,150 Z');
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
function toggleNotifications() {
    document.getElementById('notificationDropdown').classList.toggle('active');
}
function markAllRead() {
    document.querySelectorAll('.notif-item.unread').forEach(item => item.classList.remove('unread'));
    showToast('All notifications marked as read');
}
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('notificationDropdown');
    const btn = document.getElementById('notifBtn');
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) dropdown.classList.remove('active');
});

// ─────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    const icon = document.getElementById('themeIcon');
    if (newTheme === 'dark') {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
    }
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────
function openSearch() {
    document.getElementById('searchContainer').classList.add('active');
    document.getElementById('searchInput').focus();
}
function closeSearch() { document.getElementById('searchContainer').classList.remove('active'); }
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeSearch();
        closeCourseModal();
        closeOpportunityModal();
        closeOpportunityDetailsModal();
        closeEditModal();
        closeCollaboratorCoursesModal();
        closeQuickAddModal();
        closeBulkUploadModal();
        closeQuickAddVerifierModal();
        closeBulkUploadVerifierModal();
        closeVerifierDetailsModal();
    }
});
document.getElementById('searchContainer').addEventListener('click', function (e) {
    if (e.target === this) closeSearch();
});

// ─────────────────────────────────────────────────────────────
// COURSE MODAL
// ─────────────────────────────────────────────────────────────
function openCourseDetails(courseName, stats) {
    document.getElementById('modalCourseTitle').textContent = courseName;
    document.getElementById('modalEnrolled').textContent = stats.enrolled;
    document.getElementById('modalCompleted').textContent = stats.completed;
    document.getElementById('modalInProgress').textContent = stats.inProgress;
    document.getElementById('modalHalfDone').textContent = stats.halfDone;
    document.getElementById('courseModal').classList.add('active');
}
function closeCourseModal() { document.getElementById('courseModal').classList.remove('active'); }
document.getElementById('courseModal').addEventListener('click', function (e) { if (e.target === this) closeCourseModal(); });

// ─────────────────────────────────────────────────────────────
// OPPORTUNITY DETAILS MODAL (view-only)
// ─────────────────────────────────────────────────────────────
function openOpportunityDetails(title, details) {
    document.getElementById('opportunityDetailTitle').textContent = title;
    document.getElementById('opportunityDetailDuration').textContent = details.duration;
    document.getElementById('opportunityDetailStartDate').textContent = details.startDate;
    document.getElementById('opportunityDetailApplicants').textContent = details.applicants || 'N/A';
    document.getElementById('opportunityDetailDescription').textContent = details.description;
    document.getElementById('opportunityDetailFuture').textContent = details.futureOpportunities;
    document.getElementById('opportunityDetailPrereqs').textContent = details.prerequisites || '';

    const skillsContainer = document.getElementById('opportunityDetailSkills');
    skillsContainer.innerHTML = '';
    (details.skills || []).forEach(skill => {
        const tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.textContent = skill;
        skillsContainer.appendChild(tag);
    });
    document.getElementById('opportunityDetailsModal').classList.add('active');
}
function closeOpportunityDetailsModal() { document.getElementById('opportunityDetailsModal').classList.remove('active'); }
function applyToOpportunity() { showToast('Application submitted successfully!'); closeOpportunityDetailsModal(); }
document.getElementById('opportunityDetailsModal').addEventListener('click', function (e) { if (e.target === this) closeOpportunityDetailsModal(); });

// ─────────────────────────────────────────────────────────────
// COLLABORATOR MODAL
// ─────────────────────────────────────────────────────────────
function openCollaboratorCourses(name, role) {
    document.getElementById('collaboratorName').textContent = name + "'s Submitted Courses";
    document.getElementById('collaboratorRole').textContent = 'Role: ' + role;
    document.getElementById('collaboratorCoursesModal').classList.add('active');
}
function closeCollaboratorCoursesModal() { document.getElementById('collaboratorCoursesModal').classList.remove('active'); }
function approveCourse(courseName) { showToast(courseName + ' has been approved!'); }
function rejectCourse(courseName) { showToast(courseName + ' has been rejected.'); }
function viewCourseDetails(courseName) { showToast('Viewing details for ' + courseName); }
document.getElementById('collaboratorCoursesModal').addEventListener('click', function (e) { if (e.target === this) closeCollaboratorCoursesModal(); });

// ─────────────────────────────────────────────────────────────
// QUICK ADD / BULK UPLOAD – STUDENT
// ─────────────────────────────────────────────────────────────
function openQuickAddModal() { document.getElementById('quickAddModal').classList.add('active'); }
function closeQuickAddModal() { document.getElementById('quickAddModal').classList.remove('active'); }
document.getElementById('quickAddModal').addEventListener('click', function (e) { if (e.target === this) closeQuickAddModal(); });
document.getElementById('quickAddForm').addEventListener('submit', function (e) {
    e.preventDefault();
    showToast('Student added successfully! Email invitation sent.');
    closeQuickAddModal(); this.reset();
});

function openBulkUploadModal() { document.getElementById('bulkUploadModal').classList.add('active'); }
function closeBulkUploadModal() { document.getElementById('bulkUploadModal').classList.remove('active'); }
document.getElementById('bulkUploadModal').addEventListener('click', function (e) { if (e.target === this) closeBulkUploadModal(); });
document.getElementById('bulkUploadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!document.getElementById('csvFileInput').files.length) { showToast('Please select a CSV file'); return; }
    showToast('Students uploaded successfully! Email invitations sent.');
    closeBulkUploadModal(); this.reset(); document.getElementById('fileName').textContent = '';
});
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) document.getElementById('fileName').textContent = '✓ Selected: ' + file.name;
}
function downloadSampleCSV() {
    const csv = 'First Name,Last Name,Email\nJohn,Doe,john.doe@example.com\nJane,Smith,jane.smith@example.com';
    const a   = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'sample_students.csv' });
    a.click();
}

// ─────────────────────────────────────────────────────────────
// QUICK ADD / BULK UPLOAD – VERIFIER
// ─────────────────────────────────────────────────────────────
function openQuickAddVerifierModal() { document.getElementById('quickAddVerifierModal').classList.add('active'); }
function closeQuickAddVerifierModal() { document.getElementById('quickAddVerifierModal').classList.remove('active'); }
document.getElementById('quickAddVerifierModal').addEventListener('click', function (e) { if (e.target === this) closeQuickAddVerifierModal(); });
document.getElementById('quickAddVerifierForm').addEventListener('submit', function (e) {
    e.preventDefault();
    showToast('Verifier added successfully! Email invitation sent.');
    closeQuickAddVerifierModal(); this.reset();
});

function openBulkUploadVerifierModal() { document.getElementById('bulkUploadVerifierModal').classList.add('active'); }
function closeBulkUploadVerifierModal() { document.getElementById('bulkUploadVerifierModal').classList.remove('active'); }
document.getElementById('bulkUploadVerifierModal').addEventListener('click', function (e) { if (e.target === this) closeBulkUploadVerifierModal(); });
document.getElementById('bulkUploadVerifierForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!document.getElementById('csvVerifierFileInput').files.length) { showToast('Please select a CSV file'); return; }
    showToast('Verifiers uploaded successfully! Email invitations sent.');
    closeBulkUploadVerifierModal(); this.reset(); document.getElementById('verifierFileName').textContent = '';
});
function handleVerifierFileSelect(event) {
    const file = event.target.files[0];
    if (file) document.getElementById('verifierFileName').textContent = '✓ Selected: ' + file.name;
}
function downloadSampleVerifierCSV() {
    const csv = 'First Name,Last Name,Email,Subject\nDr. John,Doe,john.doe@qf.edu.qa,Mathematics\nProf. Jane,Smith,jane.smith@qf.edu.qa,Physics';
    const a   = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'sample_verifiers.csv' });
    a.click();
}

// ─────────────────────────────────────────────────────────────
// VERIFIER DETAILS MODAL
// ─────────────────────────────────────────────────────────────
function openVerifierDetails(name, stats) {
    document.getElementById('verifierName').textContent = name;
    document.getElementById('verifierTotalStudents').textContent = stats.totalStudents;
    document.getElementById('verifierCertified').textContent = stats.certified;
    document.getElementById('verifierInProgress').textContent = stats.inProgress;
    const container = document.getElementById('subjectsContainer');
    container.innerHTML = '';
    stats.subjects.forEach(subject => {
        const div = document.createElement('div');
        div.className = 'subject-item';
        div.innerHTML = `<span class="subject-name">${subject.name}</span><span class="subject-students">${subject.students} students</span>`;
        container.appendChild(div);
    });
    document.getElementById('verifierDetailsModal').classList.add('active');
}
function closeVerifierDetailsModal() { document.getElementById('verifierDetailsModal').classList.remove('active'); }
document.getElementById('verifierDetailsModal').addEventListener('click', function (e) { if (e.target === this) closeVerifierDetailsModal(); });

// ─────────────────────────────────────────────────────────────
// STUDENT / VERIFIER FILTERS (unchanged UI logic)
// ─────────────────────────────────────────────────────────────
function filterStudents() {
    const statusFilter = document.getElementById('statusFilter').value;
    document.querySelectorAll('#studentsTableBody tr').forEach(row => {
        row.style.display = (statusFilter === 'all' || row.getAttribute('data-status') === statusFilter) ? '' : 'none';
    });
}
function filterVerifiers() {
    const statusFilter = document.getElementById('verifierStatusFilter').value;
    document.querySelectorAll('#verifiersTableBody tr').forEach(row => {
        row.style.display = (statusFilter === 'all' || row.getAttribute('data-status') === statusFilter) ? '' : 'none';
    });
}

// =============================================================
// ██████╗  █████╗  ██████╗██╗  ██╗███████╗███╗   ██╗██████╗
// ██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝████╗  ██║██╔══██╗
// ██████╔╝███████║██║     █████╔╝ █████╗  ██╔██╗ ██║██║  ██║
// ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══╝  ██║╚██╗██║██║  ██║
// ██████╔╝██║  ██║╚██████╗██║  ██╗███████╗██║ ╚████║██████╔╝
// Backend-connected OPPORTUNITY MANAGEMENT
// =============================================================

let _editingOppId = null;   // null = creating, number = editing

// ── Open "Add New Opportunity" modal ──────────────────────────────────────────
function openOpportunityModal() {
    _editingOppId = null;
    document.getElementById('opportunityForm').reset();
    document.querySelector('#opportunityModal .modal-header h3').textContent = 'Add New Opportunity';
    document.getElementById('opportunityModal').classList.add('active');
}
function closeOpportunityModal() { document.getElementById('opportunityModal').classList.remove('active'); }
document.getElementById('opportunityModal').addEventListener('click', function (e) { if (e.target === this) closeOpportunityModal(); });

// ── Edit modal (reuses the same #opportunityModal) ────────────────────────────
function closeEditModal() { closeOpportunityModal(); }

function openEditModal(opp) {
    _editingOppId = opp.id;
    document.querySelector('#opportunityModal .modal-header h3').textContent = 'Edit Opportunity';

    document.getElementById('oppName').value          = opp.name;
    document.getElementById('oppDuration').value      = opp.duration;
    document.getElementById('oppStartDate').value     = opp.start_date;
    document.getElementById('oppDescription').value   = opp.description;
    document.getElementById('oppSkills').value        = Array.isArray(opp.skills) ? opp.skills.join(', ') : opp.skills;
    document.getElementById('oppCategory').value      = opp.category;
    document.getElementById('oppFuture').value        = opp.future_opportunities;
    document.getElementById('oppMaxApplicants').value = opp.max_applicants || '';

    document.getElementById('opportunityModal').classList.add('active');
}

// ─────────────────────────────────────────────────────────────
// LOAD OPPORTUNITIES FROM BACKEND  (US-2.1 / US-2.3)
// ─────────────────────────────────────────────────────────────
async function loadOpportunities() {
    const grid = document.querySelector('.opportunities-grid');
    if (!grid) return;

    // Show spinner while loading
    grid.innerHTML = '<p style="color:var(--qf-text-light);padding:24px;">Loading opportunities…</p>';

    try {
        const res  = await fetch(`${API}/opportunities/`, { credentials: 'include' });
        const data = await res.json();

        if (!res.ok || !data.success) {
            grid.innerHTML = '<p style="color:var(--qf-text-light);padding:24px;">Could not load opportunities. Please try again.</p>';
            return;
        }

        const opps = data.opportunities;

        if (opps.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--qf-text-light);">
                    <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:var(--qf-border);fill:none;stroke-width:1.5;margin-bottom:16px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                    </svg>
                    <p style="font-size:16px;font-weight:600;margin-bottom:8px;">No opportunities yet</p>
                    <p style="font-size:13px;">Click <strong>Add New Opportunity</strong> to create your first one.</p>
                </div>`;
            return;
        }

        grid.innerHTML = '';
        opps.forEach(opp => grid.appendChild(buildOpportunityCard(opp)));

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="color:var(--qf-red);padding:24px;">Network error – is the backend running?</p>';
    }
}

// ─────────────────────────────────────────────────────────────
// BUILD CARD DOM FROM OPPORTUNITY OBJECT
// ─────────────────────────────────────────────────────────────
function buildOpportunityCard(opp) {
    const card = document.createElement('div');
    card.className = 'opportunity-card';
    card.dataset.id = opp.id;

    const skills = Array.isArray(opp.skills) ? opp.skills : [];
    const skillTags = skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');
    const applicantsLabel = opp.max_applicants ? `${opp.max_applicants} max applicants` : '0 applicants';

    card.innerHTML = `
        <div class="opportunity-card-header">
            <h5>${escapeHtml(opp.name)}</h5>
            <div class="opportunity-meta">
                <span>
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${escapeHtml(opp.duration)}
                </span>
                <span>
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ${escapeHtml(opp.start_date)}
                </span>
                <span style="background:var(--qf-mint-pale);padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;color:var(--qf-green-dark);text-transform:capitalize;">
                    ${escapeHtml(opp.category)}
                </span>
            </div>
        </div>
        <p class="opportunity-description">${escapeHtml(opp.description)}</p>
        <div class="opportunity-skills">
            <div class="opportunity-skills-label">Skills You'll Gain</div>
            <div class="skills-tags">${skillTags}</div>
        </div>
        <div class="opportunity-footer">
            <span class="applicants-count">${escapeHtml(applicantsLabel)}</span>
            <div style="display:flex;gap:8px;">
                <button class="view-course-btn opp-view-btn" style="width:auto;padding:8px 14px;">View Details</button>
                <button class="view-course-btn opp-edit-btn" style="width:auto;padding:8px 14px;background:var(--qf-green-dark);">Edit</button>
                <button class="view-course-btn opp-delete-btn" style="width:auto;padding:8px 14px;background:var(--qf-red);">Delete</button>
            </div>
        </div>
    `;

    // Wire buttons
    card.querySelector('.opp-view-btn').addEventListener('click', () => {
        openOpportunityDetails(opp.name, {
            duration:            opp.duration,
            startDate:           opp.start_date,
            description:         opp.description,
            skills:              skills,
            applicants:          opp.max_applicants || 0,
            futureOpportunities: opp.future_opportunities,
            prerequisites:       '',
        });
    });

    card.querySelector('.opp-edit-btn').addEventListener('click', () => openEditModal(opp));

    card.querySelector('.opp-delete-btn').addEventListener('click', () => deleteOpportunity(opp.id, card));

    return card;
}

// ─────────────────────────────────────────────────────────────
// FORM SUBMIT – CREATE or UPDATE  (US-2.2 / US-2.5)
// ─────────────────────────────────────────────────────────────
document.getElementById('opportunityForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const payload = {
        name:                 document.getElementById('oppName').value.trim(),
        duration:             document.getElementById('oppDuration').value.trim(),
        start_date:           document.getElementById('oppStartDate').value,
        description:          document.getElementById('oppDescription').value.trim(),
        skills:               document.getElementById('oppSkills').value.trim(),
        category:             document.getElementById('oppCategory').value,
        future_opportunities: document.getElementById('oppFuture').value.trim(),
        max_applicants:       document.getElementById('oppMaxApplicants').value.trim() || null,
    };

    const isEditing = _editingOppId !== null;
    const url       = isEditing ? `${API}/opportunities/${_editingOppId}` : `${API}/opportunities/`;
    const method    = isEditing ? 'PUT' : 'POST';

    try {
        const res  = await fetch(url, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            const msg = data.errors
                ? Object.values(data.errors).join(' ')
                : (data.message || 'Validation failed. Check all required fields.');
            showToast(msg);
            return;
        }

        showToast(isEditing ? 'Opportunity updated successfully!' : 'Opportunity created successfully!');
        closeOpportunityModal();
        this.reset();

        // Update UI immediately without full page reload (US-2.2 / US-2.5)
        const grid = document.querySelector('.opportunities-grid');
        if (isEditing) {
            const existingCard = grid.querySelector(`[data-id="${_editingOppId}"]`);
            if (existingCard) existingCard.replaceWith(buildOpportunityCard(data.opportunity));
        } else {
            // Remove empty-state placeholder if present
            const placeholder = grid.querySelector('div[style*="grid-column"]');
            if (placeholder) placeholder.remove();
            grid.prepend(buildOpportunityCard(data.opportunity));
        }

    } catch (err) {
        console.error(err);
        showToast('Network error – could not save opportunity.');
    }
});

// ─────────────────────────────────────────────────────────────
// DELETE OPPORTUNITY  (US-2.6)
// ─────────────────────────────────────────────────────────────
async function deleteOpportunity(oppId, cardEl) {
    if (!confirm('Are you sure you want to permanently delete this opportunity? This action cannot be undone.')) return;

    try {
        const res  = await fetch(`${API}/opportunities/${oppId}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();

        if (!res.ok || !data.success) {
            showToast(data.message || 'Could not delete opportunity.');
            return;
        }

        showToast('Opportunity deleted successfully.');
        cardEl.remove();

        // Show empty state if no cards remain
        const grid  = document.querySelector('.opportunities-grid');
        const cards = grid.querySelectorAll('.opportunity-card');
        if (cards.length === 0) loadOpportunities();   // re-render empty state

    } catch (err) {
        console.error(err);
        showToast('Network error – could not delete opportunity.');
    }
}

// =============================================================
// AUTH FORMS
// =============================================================

// ── LOGIN ────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors('loginForm');
    let valid = true;

    const email       = document.getElementById('loginEmail').value.trim();
    const password    = document.getElementById('loginPassword').value;
    const rememberMe  = document.querySelector('#loginForm .remember-me input[type="checkbox"]').checked;
    const captchaInput = document.getElementById('loginCaptchaInput').value.trim();

    if (!email || !isValidEmail(email)) {
        showError('loginEmailErr');
        document.getElementById('loginEmail').classList.add('error');
        valid = false;
    }
    if (!password) {
        showError('loginPasswordErr', 'Please enter your password');
        document.getElementById('loginPassword').classList.add('error');
        valid = false;
    }
    if (!captchaInput) {
        showError('loginCaptchaErr', 'Please enter the captcha code');
        valid = false;
    } else if (captchaInput !== captchas.login) {
        showError('loginCaptchaErr', 'Captcha does not match. Please try again.');
        generateCaptcha('login');
        valid = false;
    }

    if (!valid) { shakeForm('loginForm'); return; }

    try {
        const res  = await fetch(`${API}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, remember_me: rememberMe }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            const msg = data.errors?.general || 'Invalid email or password.';
            showError('loginEmailErr', msg);
            showError('loginPasswordErr', ' ');
            document.getElementById('loginEmail').classList.add('error');
            document.getElementById('loginPassword').classList.add('error');
            shakeForm('loginForm');
            generateCaptcha('login');
            return;
        }

        showToast('Login successful! Redirecting…');
        generateCaptcha('login');
        setTimeout(() => showDashboard(data.admin.full_name, data.admin.email), 1200);

    } catch (err) {
        console.error(err);
        showToast('Network error – is the backend running?');
    }
});

// ── SIGNUP ───────────────────────────────────────────────────
document.getElementById('signupForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors('signupForm');
    let valid = true;

    const full_name        = document.getElementById('signupName').value.trim();
    const email            = document.getElementById('signupEmail').value.trim();
    const password         = document.getElementById('signupPassword').value;
    const confirm_password = document.getElementById('signupConfirmPassword').value;
    const captchaInput     = document.getElementById('signupCaptchaInput').value.trim();

    if (!full_name) { showError('signupNameErr'); document.getElementById('signupName').classList.add('error'); valid = false; }
    if (!email || !isValidEmail(email)) { showError('signupEmailErr'); document.getElementById('signupEmail').classList.add('error'); valid = false; }
    if (!password || password.length < 8) { showError('signupPasswordErr'); document.getElementById('signupPassword').classList.add('error'); valid = false; }
    if (!confirm_password || password !== confirm_password) { showError('signupConfirmPasswordErr'); document.getElementById('signupConfirmPassword').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('signupCaptchaErr', 'Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.signup) { showError('signupCaptchaErr', 'Captcha does not match.'); generateCaptcha('signup'); valid = false; }

    if (!valid) { shakeForm('signupForm'); return; }

    try {
        const res  = await fetch(`${API}/auth/signup`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, password, confirm_password }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            const errors = data.errors || {};
            if (errors.email)    { showError('signupEmailErr', errors.email); document.getElementById('signupEmail').classList.add('error'); }
            if (errors.password) { showError('signupPasswordErr', errors.password); }
            shakeForm('signupForm');
            return;
        }

        showToast('Account created successfully!');
        generateCaptcha('signup');
        this.reset(); checkStrength('');
        setTimeout(() => showPage('loginPage'), 1500);

    } catch (err) {
        console.error(err);
        showToast('Network error – is the backend running?');
    }
});

// ── FORGOT PASSWORD ──────────────────────────────────────────
document.getElementById('forgotForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors('forgotForm');
    let valid = true;

    const email        = document.getElementById('forgotEmail').value.trim();
    const captchaInput = document.getElementById('forgotCaptchaInput').value.trim();

    if (!email || !isValidEmail(email)) { showError('forgotEmailErr'); document.getElementById('forgotEmail').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('forgotCaptchaErr', 'Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.forgot) { showError('forgotCaptchaErr', 'Captcha does not match.'); generateCaptcha('forgot'); valid = false; }

    if (!valid) { shakeForm('forgotForm'); return; }

    try {
        await fetch(`${API}/auth/forgot-password`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        // Always show the same message (US-1.3 – privacy)
        showToast('If that email is registered, a reset link has been sent.');
        generateCaptcha('forgot');
        this.reset();

    } catch (err) {
        console.error(err);
        // Still show success to not leak email existence
        showToast('If that email is registered, a reset link has been sent.');
        generateCaptcha('forgot');
        this.reset();
    }
});

// ─────────────────────────────────────────────────────────────
// CLEAR ERRORS ON INPUT
// ─────────────────────────────────────────────────────────────
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function () {
        this.classList.remove('error');
        const err = this.closest('.form-group')?.querySelector('.error-msg');
        if (err) err.classList.remove('show');
    });
});

// ─────────────────────────────────────────────────────────────
// RESPONSIVE SIDEBAR
// ─────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
});

// ─────────────────────────────────────────────────────────────
// AUTO-RESTORE SESSION ON PAGE LOAD  (US-2.3 – persist after login)
// ─────────────────────────────────────────────────────────────
(async function checkSession() {
    try {
        const res  = await fetch(`${API}/auth/me`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.success) {
            showDashboard(data.admin.full_name, data.admin.email);
        }
    } catch (_) {
        // No active session – stay on login page
    }
})();