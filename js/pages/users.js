// ============================================
// USERS PAGE - Fixed Salary Config
// ============================================

Router.register('users', async (container) => {
    let users = [];
    try {
        users = await DB.getUsers();
    } catch(e) { console.warn(e); }

    function render() {
        const area = document.getElementById('users-area');
        if (!area) return;

        area.innerHTML = `<div class="card"><div class="table-container"><table>
            <thead><tr><th>Avatar</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>${users.map(u => {
                const initial = u.displayName ? u.displayName.charAt(0) : u.email.charAt(0).toUpperCase();
                const isOwner = u.role === 'owner';
                const isMe = u.id === window.currentUser.id;
                
                return `<tr>
                    <td><div style="width:36px;height:36px;border-radius:50%;background:var(--primary-100);color:var(--primary-600);display:flex;align-items:center;justify-content:center;font-weight:bold;">${initial}</div></td>
                    <td><strong>${u.displayName || '—'}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-${u.role === 'owner' ? 'primary' : u.role === 'teacher' ? 'info' : u.role === 'staff' ? 'success' : 'warning'}">${Auth.getRoleDisplay(u.role)}</span></td>
                    <td><span class="badge badge-${u.status === 'active' ? 'success' : 'danger'}">${u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td>
                    <td><div class="table-actions">
                        ${!isOwner && !isMe ? `
                            <button class="btn btn-secondary btn-sm" onclick="UsersPage.editRole('${u.id}')">Phân quyền</button>
                            <button class="btn btn-${u.status === 'active' ? 'danger' : 'success'} btn-sm" onclick="UsersPage.toggleStatus('${u.id}', '${u.status}')">${u.status === 'active' ? 'Khóa' : 'Mở khóa'}</button>
                            ${u.role === 'teacher' ? `<button class="btn btn-info btn-sm" onclick="UsersPage.editSalary('${u.id}')">💰 Cài lương</button>` : ''}
                        ` : (isOwner && !isMe ? `<span class="text-sm text-muted">Không thể sửa Chủ TT</span>` : '')}
                    </div></td>
                </tr>`;
            }).join('')}</tbody>
        </table></div></div>`;
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="shield"></i> Quản lý Người dùng & Phân quyền</h1></div>
        </div>
        <div id="users-area"></div>
    `;
    render();

    window.UsersPage = {
        editRole(id) {
            const u = users.find(x => x.id === id);
            if (!u) return;
            Modal.show({
                title: 'Phân quyền: ' + (u.displayName || u.email),
                content: `
                    <div class="form-group"><label class="form-label">Vai trò</label>
                        <select class="select" id="u-role">
                            <option value="pending" ${u.role === 'pending' ? 'selected' : ''}>Chờ duyệt (Không có quyền)</option>
                            <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>Giáo viên</option>
                            <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Học vụ</option>
                            <option value="owner" ${u.role === 'owner' ? 'selected' : ''}>Chủ trung tâm</option>
                        </select>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="UsersPage.saveRole('${id}')">Cập nhật</button>`
            });
        },

        async saveRole(id) {
            const role = document.getElementById('u-role').value;
            try {
                await DB.updateUserRole(id, role);
                Modal.close();
                Toast.success('Đã cập nhật vai trò');
                users = await DB.getUsers();
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async toggleStatus(id, currentStatus) {
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            try {
                await DB.updateUserStatus(id, newStatus);
                Toast.success('Đã cập nhật trạng thái');
                users = await DB.getUsers();
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        editSalary(id) {
            const u = users.find(x => x.id === id);
            if (!u) return;
            const s = u.salaryConfig || {};
            Modal.show({
                title: 'Cài đặt mức lương: ' + (u.displayName || u.email),
                content: `
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Lương Ca Sáng (VNĐ)</label><input type="number" class="input" id="sal-morning" value="${s.morning || 0}"></div>
                        <div class="form-group"><label class="form-label">Lương Ca Chiều (VNĐ)</label><input type="number" class="input" id="sal-afternoon" value="${s.afternoon || 0}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Lương Ca Tối (VNĐ)</label><input type="number" class="input" id="sal-evening" value="${s.evening || 0}"></div>
                        <div class="form-group"><label class="form-label">Lương Theo Giờ (VNĐ/h)</label><input type="number" class="input" id="sal-hourly" value="${s.hourly || 0}"></div>
                    </div>
                    <div class="form-group" style="margin-top:16px;">
                        <label class="checkbox-label" style="background:var(--warning-100);border-color:var(--warning-200);color:var(--warning-800);">
                            <input type="checkbox" id="sal-apply-past"> 
                            <strong>Áp dụng mức lương mới cho các buổi đã dạy trong tháng này</strong>
                        </label>
                        <p style="font-size:12px;color:var(--text-muted);margin-top:4px;">Nếu không chọn, mức lương mới chỉ áp dụng cho các buổi chấm công từ bây giờ trở đi.</p>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="UsersPage.saveSalary('${id}')">Lưu mức lương</button>`
            });
        },

        async saveSalary(id) {
            const salaryConfig = {
                morning: parseInt(document.getElementById('sal-morning').value) || 0,
                afternoon: parseInt(document.getElementById('sal-afternoon').value) || 0,
                evening: parseInt(document.getElementById('sal-evening').value) || 0,
                hourly: parseInt(document.getElementById('sal-hourly').value) || 0
            };
            const applyPast = document.getElementById('sal-apply-past').checked;

            try {
                await DB.updateUserSalary(id, salaryConfig);
                if (applyPast) {
                    await DB.updateTeacherAttendanceSalaries(id, DB.currentMonth(), salaryConfig);
                }
                Modal.close();
                Toast.success('Đã lưu mức lương');
                users = await DB.getUsers();
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        }
    };
});
