// ============================================
// HEADER COMPONENT
// ============================================

window.currentAcademicYear = localStorage.getItem('academicYear') || '2026-2027';

const Header = {
    render() {
        const header = document.getElementById('header');
        const today = new Date();
        const dateStr = today.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const years = ['2023-2024', '2024-2025', '2025-2026', '2026-2027', '2027-2028'];

        header.innerHTML = `
            <div class="header-left">
                <button class="mobile-menu-btn" onclick="Sidebar.toggleMobile()">
                    <i data-lucide="menu"></i>
                </button>
                <div class="header-breadcrumb">
                    <span id="breadcrumb-text">Tổng quan</span>
                </div>
            </div>
            <div class="header-right" style="display: flex; align-items: center; gap: 16px;">
                <div class="header-year">
                    <select class="select" id="global-academic-year" onchange="Header.changeAcademicYear(this.value)" style="padding: 6px 12px; font-weight: bold; border-color: var(--primary-500); color: var(--primary-600); background-color: var(--primary-50); border-radius: var(--radius-md); cursor: pointer;">
                        ${years.map(y => `<option value="${y}" ${y === window.currentAcademicYear ? 'selected' : ''}>Năm học ${y}</option>`).join('')}
                    </select>
                </div>
                <div class="header-date">
                    <i data-lucide="calendar"></i>
                    ${dateStr}
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    },

    changeAcademicYear(year) {
        window.currentAcademicYear = year;
        localStorage.setItem('academicYear', year);
        if (Router.currentPage) {
            Router.navigate(Router.currentPage);
        }
    },

    updateBreadcrumb(page) {
        const el = document.getElementById('breadcrumb-text');
        if (el) {
            el.textContent = Router.getPageName(page);
        }
    }
};

// Mobile sidebar toggle
Sidebar.toggleMobile = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('open');
    
    if (!overlay) {
        const ov = document.createElement('div');
        ov.className = 'sidebar-overlay' + (sidebar.classList.contains('open') ? ' active' : '');
        ov.onclick = () => {
            sidebar.classList.remove('open');
            ov.classList.remove('active');
        };
        document.getElementById('app-shell').appendChild(ov);
    } else {
        overlay.classList.toggle('active');
    }
};

window.Header = Header;
