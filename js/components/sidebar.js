// ============================================
// SIDEBAR COMPONENT
// ============================================

const Sidebar = {
    render() {
        const sidebar = document.getElementById('sidebar');
        const user = window.currentUser;
        if (!user) return;

        const role = user.role;
        const isOwner = role === 'owner';
        const isTeacher = role === 'teacher';
        const isStaff = role === 'staff';

        const menuItems = [];

        // Dashboard - everyone
        menuItems.push({ icon: 'layout-dashboard', label: 'Tổng quan', page: 'dashboard' });

        // Students - owner + staff
        if (isOwner || isStaff) {
            menuItems.push({ icon: 'users', label: 'Học viên', page: 'students' });
        }

        // Classes - everyone
        menuItems.push({ icon: 'school', label: 'Lớp học', page: 'classes' });

        // Schedule - everyone
        menuItems.push({ icon: 'calendar-days', label: 'Thời khóa biểu', page: 'schedule' });

        // Attendance - owner + teacher + staff(view)
        menuItems.push({ icon: 'clipboard-check', label: 'Điểm danh', page: 'attendance' });

        // Grades - owner + teacher
        if (isOwner || isTeacher) {
            menuItems.push({ icon: 'file-text', label: 'Điểm số', page: 'grades' });
        }

        // Tuition - owner + staff
        if (isOwner || isStaff) {
            menuItems.push({ icon: 'wallet', label: 'Học phí', page: 'tuition' });
        }

        // Teacher attendance - owner + teacher(own)
        if (isOwner || isTeacher) {
            menuItems.push({ icon: 'clock', label: 'Chấm công', page: 'teacher-attendance' });
        }

        // Finance - owner only
        if (isOwner) {
            menuItems.push({ icon: 'trending-up', label: 'Tài chính', page: 'finance' });
        }

        // Users - owner only
        if (isOwner) {
            menuItems.push({ icon: 'shield-check', label: 'Người dùng', page: 'users' });
        }

        const menuHTML = menuItems.map(item => `
            <button class="sidebar-item" data-page="${item.page}" onclick="Router.navigate('${item.page}')">
                <i data-lucide="${item.icon}"></i>
                <span>${item.label}</span>
                ${item.badge ? `<span class="item-badge">${item.badge}</span>` : ''}
            </button>
        `).join('');

        const photoURL = Auth.currentUser?.photoURL || '';
        const displayName = user.displayName || user.email;
        const roleDisplay = Auth.getRoleDisplay(user.role);
        const avatarHTML = photoURL 
            ? `<img src="${photoURL}" alt="" class="sidebar-user-avatar" referrerpolicy="no-referrer">`
            : `<div class="sidebar-user-avatar" style="background:var(--primary-600);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">${displayName.charAt(0).toUpperCase()}</div>`;

        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <div class="sidebar-brand-icon" style="width: 36px; height: 36px; display: flex; justify-content: center; align-items: center;">
                    <img src="assets/images/logo.png" alt="Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
                <div class="sidebar-brand-text">
                    <h2>Thành Nhân</h2>
                    <p>Education Center</p>
                </div>
            </div>

            <nav class="sidebar-nav">
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Menu chính</div>
                    ${menuHTML}
                </div>
            </nav>

            <div class="sidebar-user">
                <div class="sidebar-user-info">
                    ${avatarHTML}
                    <div class="sidebar-user-details">
                        <div class="sidebar-user-name">${displayName}</div>
                        <div class="sidebar-user-role">${roleDisplay}</div>
                    </div>
                </div>
                <button class="sidebar-logout-btn" onclick="App.logout()">
                    <i data-lucide="log-out"></i>
                    Đăng xuất
                </button>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    }
};

window.Sidebar = Sidebar;
