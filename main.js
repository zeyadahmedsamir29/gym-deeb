const STORAGE_KEY = 'gymMembers';
const ADMIN_EMAIL = 'admin@gym.com';
const ADMIN_PASSWORD = '123456';

const addMemberModal = new bootstrap.Modal(document.getElementById('addMemberModal'));
const renewModal = new bootstrap.Modal(document.getElementById('renewModal'));
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
const toastInstance = new bootstrap.Toast(document.getElementById('successToast'));

const DARK_MODE_KEY = 'gymDarkMode';
let members = loadMembers();
let secureOpen = localStorage.getItem('gymSecureOpen') === 'true';
let darkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
let editingMemberId = null;

window.addEventListener('DOMContentLoaded', () => {
    renderTable();
    document.getElementById('searchInput').addEventListener('input', ({ target }) => renderTable(target.value));
    updateSecureUI();
    applyDarkMode();
    document.getElementById('mDate').valueAsDate = new Date();
});

function loadMembers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveMembers() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

function showToast(message) {
    document.getElementById('toastMessage').innerText = message;
    toastInstance.show();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getInitials(name) {
    return name
        .split(' ')
        .filter(part => part.trim())
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();
}

async function readImageFile(file) {
    return new Promise(resolve => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

async function handleAddMember(event) {
    event.preventDefault();

    const name = document.getElementById('mName').value.trim();
    const phone = document.getElementById('mPhone').value.trim();
    const startDate = document.getElementById('mDate').value;
    const pkg = document.getElementById('mPackage');
    const price = parseFloat(pkg.value);
    const months = parseInt(pkg.options[pkg.selectedIndex].dataset.months || '1', 10);

    if (!name || !phone || !startDate || Number.isNaN(price)) {
        showToast('Please fill all fields correctly');
        return;
    }

    const imageFile = document.getElementById('mImage').files[0];
    const imageData = await readImageFile(imageFile);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    if (editingMemberId) {
        const member = members.find(item => item.id === Number(editingMemberId));
        if (!member) {
            showToast('Member not found');
            return;
        }

        member.name = name;
        member.phone = phone;
        member.startDate = new Date(startDate).toISOString();
        member.endDate = endDate.toISOString();
        if (imageData) member.imageData = imageData;

        saveMembers();
        renderTable(document.getElementById('searchInput').value);
        addMemberModal.hide();
        resetMemberForm();
        showToast('Member updated successfully');
        return;
    }

    members.push({
        id: Date.now(),
        name,
        phone,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate.toISOString(),
        totalPaid: price,
        imageData
    });

    saveMembers();
    renderTable();
    addMemberModal.hide();
    resetMemberForm();
    showToast('Member added successfully');
}

document.getElementById('addForm').addEventListener('submit', handleAddMember);

document.getElementById('addMemberModal').addEventListener('hidden.bs.modal', resetMemberForm);

function resetMemberForm() {
    editingMemberId = null;
    document.getElementById('addForm').reset();
    document.getElementById('mDate').valueAsDate = new Date();
    document.getElementById('editMemberId').value = '';
    document.getElementById('memberModalTitle').innerText = 'Add New Member';
    document.getElementById('memberSubmitButton').innerText = 'Save Member';
}

function openEditModal(id) {
    const member = members.find(item => item.id === id);
    if (!member) return;

    editingMemberId = id;
    document.getElementById('editMemberId').value = id;
    document.getElementById('memberModalTitle').innerText = 'Edit Member';
    document.getElementById('memberSubmitButton').innerText = 'Save Changes';
    document.getElementById('mName').value = member.name;
    document.getElementById('mPhone').value = member.phone;
    document.getElementById('mDate').value = new Date(member.startDate).toISOString().slice(0, 10);

    const packageSelect = document.getElementById('mPackage');
    const durationMonths = Math.round((new Date(member.endDate) - new Date(member.startDate)) / (1000 * 60 * 60 * 24 * 30));
    const matchOption = Array.from(packageSelect.options).find(opt => Number(opt.dataset.months) === durationMonths);
    packageSelect.value = matchOption ? matchOption.value : '350';
    addMemberModal.show();
}

function renderTable(search = '') {
    const query = search.trim().toLowerCase();
    const tbody = document.getElementById('tableBody');
    const now = new Date();

    const filtered = members.filter(member => {
        if (!query) return true;
        return [member.name, member.phone].some(value => value.toLowerCase().includes(query));
    });

    tbody.innerHTML = filtered.map(member => {
        const endDate = new Date(member.endDate);
        const expired = endDate < now;
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        const statusText = expired ? 'Expired' : daysLeft <= 7 ? `Expires in ${daysLeft} days` : 'Active';
        const statusClass = expired ? 'bg-danger' : daysLeft <= 7 ? 'bg-warning text-dark' : 'bg-success';
        const status = `<span class="badge ${statusClass}">${statusText}</span>`;
        const avatar = member.imageData
            ? `<img src="${member.imageData}" alt="Avatar" class="member-avatar">`
            : `<div class="avatar-placeholder">${getInitials(member.name)}</div>`;

        return `
            <tr class="animate-row ${expired ? 'table-danger-custom' : ''}">
                <td>${avatar}</td>
                <td>${member.name}</td>
                <td>${member.phone}</td>
                <td>${formatDate(member.endDate)}</td>
                <td class="secure-data text-warning fw-bold">${member.totalPaid} EGP</td>
                <td>${status}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal(${member.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-success me-1" onclick="openRenewModal(${member.id})"><i class="bi bi-arrow-clockwise"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteMember(${member.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    }).join('');

    updateStats();
}

function updateStats() {
    const now = new Date();
    const totalCount = members.length;
    const activeCount = members.filter(member => new Date(member.endDate) >= now).length;
    const expiredCount = members.filter(member => new Date(member.endDate) < now).length;
    const expiringCount = members.filter(member => {
        const diffDays = Math.ceil((new Date(member.endDate) - now) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
    }).length;
    const totalRevenue = members.reduce((sum, member) => sum + member.totalPaid, 0);

    document.getElementById('totalCount').innerText = totalCount;
    document.getElementById('activeCount').innerText = activeCount;
    document.getElementById('expiredCount').innerText = expiredCount;
    document.getElementById('expiringCount').innerText = expiringCount;
    document.getElementById('totalRevenue').innerText = totalRevenue;
}

function deleteMember(id) {
    if (!confirm('Are you sure you want to delete this member?')) return;
    members = members.filter(member => member.id !== id);
    saveMembers();
    renderTable(document.getElementById('searchInput').value);
    showToast('Member deleted successfully');
}

function openRenewModal(id) {
    const member = members.find(item => item.id === id);
    if (!member) return;
    document.getElementById('renewName').innerText = member.name;
    document.getElementById('renewId').value = id;
    renewModal.show();
}

function confirmRenew() {
    const id = Number(document.getElementById('renewId').value);
    const member = members.find(item => item.id === id);
    if (!member) return;

    const pkg = document.getElementById('renewPackage');
    const price = parseFloat(pkg.value);
    const months = parseInt(pkg.options[pkg.selectedIndex].dataset.months || '1', 10);
    const newEndDate = new Date(member.endDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    member.endDate = newEndDate.toISOString();
    member.totalPaid += price;
    saveMembers();
    renderTable(document.getElementById('searchInput').value);
    renewModal.hide();
    showToast('Subscription renewed successfully');
}

function toggleAuth() {
    if (secureOpen) {
        setSecureOpen(false);
        updateSecureUI();
        showToast('Finance panel closed');
        return;
    }
    loginModal.show();
}

function checkLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const errorEl = document.getElementById('loginError');

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        errorEl.classList.add('d-none');
        setSecureOpen(true);
        updateSecureUI();
        loginModal.hide();
        showToast('Finance panel opened');
        return;
    }

    errorEl.classList.remove('d-none');
}

function setSecureOpen(value) {
    secureOpen = value;
    localStorage.setItem('gymSecureOpen', value.toString());
}

function setDarkMode(value) {
    darkMode = value;
    localStorage.setItem(DARK_MODE_KEY, value.toString());
    applyDarkMode();
}

function toggleDarkMode() {
    setDarkMode(!darkMode);
    showToast(darkMode ? 'Dark mode activated' : 'Light mode activated');
}

function applyDarkMode() {
    document.body.classList.toggle('dark-mode', darkMode);
    updateDarkModeButton();
}

function updateDarkModeButton() {
    const btn = document.getElementById('darkModeBtn');
    if (!btn) return;
    btn.innerHTML = darkMode
        ? '<i class="bi bi-sun-fill"></i> Light Mode'
        : '<i class="bi bi-moon-stars"></i> Dark Mode';
}

function updateSecureUI() {
    document.querySelectorAll('.secure-data').forEach(el => {
        el.style.display = secureOpen ? '' : 'none';
    });
    document.getElementById('authBtn').innerHTML = secureOpen
        ? '<i class="bi bi-lock-fill"></i> Close Finance'
        : '<i class="bi bi-lock-fill"></i> Finance Panel';
    updateFinancePanel();
}

function updateFinancePanel() {
    const panel = document.getElementById('financePanel');
    const financeBody = document.getElementById('financeBody');
    const financeTotalLabel = document.getElementById('financeTotalLabel');
    if (!panel || !financeBody || !financeTotalLabel) return;

    panel.style.display = secureOpen ? '' : 'none';
    if (!secureOpen) {
        financeBody.innerHTML = '';
        financeTotalLabel.innerText = 'Total Paid: 0 EGP';
        return;
    }

    if (!members.length) {
        financeBody.innerHTML = '<tr><td colspan="3">No financial data yet</td></tr>';
        financeTotalLabel.innerText = 'Total Paid: 0 EGP';
        return;
    }

    const rows = members.map(member => `
        <tr>
            <td>${member.name}</td>
            <td>${member.phone}</td>
            <td>${member.totalPaid} EGP</td>
        </tr>`).join('');

    financeBody.innerHTML = rows;
    const totalRevenue = members.reduce((sum, member) => sum + member.totalPaid, 0);
    financeTotalLabel.innerText = `Total Paid: ${totalRevenue} EGP`;
}

function exportToCSV() {
    if (!members.length) {
        showToast('No data to export');
        return;
    }

    const csvRows = [
        ['Name', 'Phone', 'Start Date', 'End Date', 'Paid', 'Status'],
        ...members.map(member => {
            const endDate = new Date(member.endDate);
            const status = endDate < new Date() ? 'Expired' : 'Active';
            return [
                member.name,
                member.phone,
                new Date(member.startDate).toLocaleDateString('en-GB'),
                endDate.toLocaleDateString('en-GB'),
                member.totalPaid,
                status
            ];
        })
    ];

    const csvContent = csvRows.map(row => row.map(value => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gym-members.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('CSV file created successfully');
}

window.exportToCSV = exportToCSV;
window.deleteMember = deleteMember;
window.openEditModal = openEditModal;
window.openRenewModal = openRenewModal;
window.confirmRenew = confirmRenew;
window.checkLogin = checkLogin;
window.toggleAuth = toggleAuth;
window.toggleDarkMode = toggleDarkMode;
