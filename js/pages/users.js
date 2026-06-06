// ============================================
// USERS PAGE (Owner only)
// ============================================

Router.register('users', async (container) => {
    if (!Auth.isOwner()) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="lock"></i><h3>Không có quyền truy cập</h3><p>Chỉ Chủ trung tâm mới quản lý người dùng</p></div>';
        if (window.lucide) lucide.createIcons();
        return;
    }

    let users = [];
    try { users = await DB.getUsers(); } catch(e) { console.warn(e); }

    const pendingCount = users.filter(u => u.role === 'pending').length;

    function getRoleBadge(role) {
        const map = {
            owner: { label: 'Chủ TT', class: 'primary' },
            teacher: { label: 'Giáo viên', class: 'info' },
            staff: { label: 'Học vụ', class: 'success' },
            pending: { label: 'Chờ duyệt', class: 'warning' }
        };
        return map[role] || { label: role, class: 'neutral' };
    }

    function renderTable() {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        tbody.innerHTML = users.map(u => {
            const role = getRoleBadge(u.role);
            const isCurrentUser = u.id === window.currentUser.id;
            const isOwnerEmail = u.email?.toLowerCase() === window.OWNER_EMAIL.toLowerCase();
            const avatar = u.photoURL
                ? `<img src="${u.photoURL}" class="avatar avatar-sm" referrerpolicy="no-referrer">`
                : `<div class="avatar avatar-sm" style="background:var(--primary-600);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;">${(u.displayName || u.email || '?').charAt(0).toUpperCase()}</div>`;

            return `<tr style="${u.role === 'pending' ? 'background:rgba(245,158,11,0.05);' : ''}">
                <td>${avatar}</td>
                <td><strong>${u.displayName || '—'}</strong></td>
                <td class="text-sm">${u.email || '—'}</td>
                <td><span class="badge badge-${role.class}">${role.label}</span></td>
                <td><span class="badge badge-${u.status === 'active' ? 'success' : 'danger'}">${u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td>
                <td class="text-sm text-muted">${u.lastLogin ? DB.formatDateTime(u.lastLogin) : '—'}</td>
                <td>
                    <div class="table-actions">
                        ${u.role === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="UsersPage.approve('${u.id}', '${(u.displayName||u.email||'').replace(/'/g,"\\'")}')">Duyệt</button>` : ''}
                        ${!isOwnerEmail && !isCurrentUser ? `
                            <button class="btn-icon" title="Đổi vai trò" onclick="UsersPage.changeRole('${u.id}', '${u.role}', '${(u.displayName||'').replace(/'/g,"\\'")}')"><i data-lucide="shield"></i></button>
                            <button class="btn-icon" title="${u.status === 'active' ? 'Khóa' : 'Mở khóa'}" onclick="UsersPage.toggleStatus('${u.id}', '${u.status}')">
                                <i data-lucide="${u.status === 'active' ? 'lock' : 'unlock'}"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="shield-check"></i> Quản lý Người dùng</h1>
                <p class="page-subtitle">${users.length} tài khoản${pendingCount > 0 ? ` — <span style="color:var(--warning-400);">${pendingCount} chờ duyệt</span>` : ''}</p>
            </div>
        </div>

        ${pendingCount > 0 ? `
        <div style="padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-md);margin-bottom:var(--space-6);display:flex;align-items:center;gap:12px;">
            <i data-lucide="alert-circle" style="color:var(--warning-400);width:20px;height:20px;flex-shrink:0;"></i>
            <span style="font-size:var(--font-size-sm);color:var(--warning-400);">Có <strong>${pendingCount}</strong> tài khoản đang chờ duyệt. Vui lòng gán vai trò để họ có thể sử dụng hệ thống.</span>
        </div>` : ''}

        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width:50px;"></th>
                            <th>Họ tên</th>
                            <th>Email</th>
                            <th>Vai trò</th>
                            <th>Trạng thái</th>
                            <th>Đăng nhập cuối</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    renderTable();

    window.UsersPage = {
        approve(id, name) {
            Modal.show({
                title: 'Duyệt tài khoản',
                content: `
                    <p class="text-sm text-muted mb-4">Gán vai trò cho <strong>${name}</strong></p>
                    <div class="form-group">
                        <label class="form-label">Vai trò *</label>
                        <select class="select" id="u-role">
                            <option value="teacher">Giáo viên</option>
                            <option value="staff">Học vụ</option>
                        </select>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="UsersPage.saveApprove('${id}')">Duyệt</button>
                `
            });
        },

        async saveApprove(id) {
            const role = document.getElementById('u-role').value;
            try {
                await DB.updateUserRole(id, role);
                Modal.close();
                Toast.success('Đã duyệt', `Đã gán vai trò ${Auth.getRoleDisplay(role)}`);
                users = await DB.getUsers();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        changeRole(id, currentRole, name) {
            Modal.show({
                title: 'Đổi vai trò',
                content: `
                    <p class="text-sm text-muted mb-4">Đổi vai trò cho <strong>${name}</strong></p>
                    <div class="form-group">
                        <label class="form-label">Vai trò mới</label>
                        <select class="select" id="u-role">
                            <option value="teacher" ${currentRole === 'teacher' ? 'selected' : ''}>Giáo viên</option>
                            <option value="staff" ${currentRole === 'staff' ? 'selected' : ''}>Học vụ</option>
                            <option value="owner" ${currentRole === 'owner' ? 'selected' : ''}>Chủ trung tâm</option>
                        </select>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="UsersPage.saveRole('${id}')">Cập nhật</button>
                `
            });
        },

        async saveRole(id) {
            const role = document.getElementById('u-role').value;
            try {
                await DB.updateUserRole(id, role);
                Modal.close();
                Toast.success('Đã cập nhật', `Vai trò: ${Auth.getRoleDisplay(role)}`);
                users = await DB.getUsers();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async toggleStatus(id, currentStatus) {
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            const action = newStatus === 'inactive' ? 'khóa' : 'mở khóa';

            Modal.confirm({
                title: `${newStatus === 'inactive' ? 'Khóa' : 'Mở khóa'} tài khoản`,
                message: `Bạn có chắc muốn ${action} tài khoản này?`,
                confirmText: newStatus === 'inactive' ? 'Khóa' : 'Mở khóa',
                danger: newStatus === 'inactive'
            });
            Modal.bindConfirm(async () => {
                await DB.updateUserStatus(id, newStatus);
                Toast.success('Đã ' + action);
                users = await DB.getUsers();
                renderTable();
            });
        }
    };
});
