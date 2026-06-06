// ============================================
// HEADER COMPONENT
// ============================================

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

        header.innerHTML = `
            <div class="header-left">
                <button class="mobile-menu-btn" onclick="Sidebar.toggleMobile()">
                    <i data-lucide="menu"></i>
                </button>
                <div class="header-breadcrumb">
                    <span id="breadcrumb-text">Tổng quan</span>
                </div>
            </div>
            <div class="header-right">
                <div class="header-date">
                    <i data-lucide="calendar"></i>
                    ${dateStr}
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
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
        document.body.appendChild(ov);
    } else {
        overlay.classList.toggle('active');
    }
};

window.Header = Header;
