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

        async editSalary(id) {
            const u = users.find(x => x.id === id);
            if (!u) return;
            const s = u.salaryConfig || {};

            let teacherClasses = [];
            try {
                teacherClasses = await DB.getClassesByTeacher(id);
            } catch(e) { console.warn(e); }

            if (teacherClasses.length === 0) {
                Toast.warning('Giáo viên này chưa được phân công lớp nào. Hãy phân lớp trước.');
                return;
            }

            let classesHtml = teacherClasses.map(c => {
                const classConf = s[c.id] || {};
                return `
                    <div style="margin-bottom:16px;padding:12px;background:var(--bg-glass);border:1px solid var(--border-color);border-radius:8px;">
                        <h4 style="margin-bottom:8px;color:var(--primary-500);font-size:14px;">${c.name}</h4>
                        <div class="form-row">
                            <div class="form-group"><label class="form-label">Lương theo ca (VNĐ/ca)</label><input type="number" class="input sal-shift" data-cid="${c.id}" value="${classConf.perShift || 0}"></div>
                            <div class="form-group"><label class="form-label">Số buổi tiêu chuẩn</label><input type="number" class="input sal-hourly" data-cid="${c.id}" value="${classConf.perHour || 0}"></div>
                        </div>
                    </div>
                `;
            }).join('');

            Modal.show({
                title: 'Cài đặt mức lương: ' + (u.displayName || u.email),
                size: 'lg',
                content: `
                    <div style="max-height:60vh;overflow-y:auto;padding-right:8px;">
                        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Cài đặt mức lương cho từng lớp mà giáo viên này phụ trách.</p>
                        ${classesHtml}
                        <div class="form-group" style="margin-top:16px;">
                            <label class="checkbox-label" style="background:var(--warning-100);border-color:var(--warning-200);color:var(--warning-800);">
                                <input type="checkbox" id="sal-apply-past"> 
                                <strong>Áp dụng mức lương mới cho các buổi đã dạy trong tháng này</strong>
                            </label>
                            <p style="font-size:12px;color:var(--text-muted);margin-top:4px;">Nếu không chọn, mức lương mới chỉ áp dụng cho các buổi chấm công từ bây giờ trở đi.</p>
                        </div>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="UsersPage.saveSalary('${id}')">Lưu mức lương</button>`
            });
        },

        async saveSalary(id) {
            const salaryConfig = {};
            const shiftInputs = document.querySelectorAll('.sal-shift');
            const hourlyInputs = document.querySelectorAll('.sal-hourly');

            shiftInputs.forEach(inp => {
                const cid = inp.dataset.cid;
                if (!salaryConfig[cid]) salaryConfig[cid] = {};
                salaryConfig[cid].perShift = parseInt(inp.value) || 0;
            });
            hourlyInputs.forEach(inp => {
                const cid = inp.dataset.cid;
                if (!salaryConfig[cid]) salaryConfig[cid] = {};
                salaryConfig[cid].perHour = parseInt(inp.value) || 0;
            });

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
