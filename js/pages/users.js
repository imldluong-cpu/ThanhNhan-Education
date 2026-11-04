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
                    <td><div class="table-actions" style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${!isOwner && !isMe ? `
                            <button class="btn btn-secondary btn-sm" onclick="UsersPage.editRole('${u.id}')">Phân quyền</button>
                            <button class="btn btn-${u.status === 'active' ? 'warning' : 'success'} btn-sm" onclick="UsersPage.toggleStatus('${u.id}', '${u.status}')">${u.status === 'active' ? 'Khóa' : 'Mở khóa'}</button>
                            ${u.role === 'teacher' ? `<button class="btn btn-info btn-sm" onclick="UsersPage.editSalary('${u.id}')">💰 Cài lương</button>` : ''}
                            <button class="btn btn-danger btn-sm" title="Xóa tài khoản" onclick="UsersPage.remove('${u.id}', '${(u.displayName || u.email).replace(/'/g, "\\'")}')">🗑️ Xóa</button>
                        ` : (isOwner && !isMe ? `<span class="text-sm text-muted">Chủ TT (Bảo vệ)</span>` : '<span class="text-sm text-muted">Tài khoản của bạn</span>')}
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

        remove(id, name) {
            Modal.confirm({
                title: 'Xóa người dùng',
                message: `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản <strong>${name}</strong> khỏi hệ thống?<br><br><span style="color:var(--danger-500);font-size:13px;">⚠️ Hành động này không thể hoàn tác.</span>`,
                confirmText: 'Xóa người dùng',
                danger: true
            });
            Modal.bindConfirm(async () => {
                try {
                    await DB.deleteUser(id);
                    Toast.success('Đã xóa người dùng thành công');
                    users = await DB.getUsers();
                    render();
                } catch(e) {
                    Toast.error('Lỗi', e.message);
                }
            });
        },

        // Tự động nhận diện bậc lương theo khối/lớp (từ tháng 11/2026):
        // - Lớp 1-5:   Lương CS 90.000đ  + 6.000đ / HS thêm (từ HS thứ 4)
        // - Lớp 6-7:   Lương CS 100.000đ + 7.000đ / HS thêm (từ HS thứ 4)
        // - Lớp 8-9:   Lương CS 115.000đ + 8.000đ / HS thêm (từ HS thứ 4)
        // - Lớp 10-11: Lương CS 125.000đ + 9.000đ / HS thêm (từ HS thứ 4)
        // - Lớp 12:    Lương CS 140.000đ + 10.000đ / HS thêm (từ HS thứ 4)
        getSalaryTierForClass(cls) {
            const rawText = `${cls?.name || ''} ${cls?.subject || ''}`.toLowerCase();
            const cleaned = rawText
                .replace(/1\s*:\s*1/g, ' ')
                .replace(/1\s*kèm\s*1/g, ' ')
                .replace(/1\s*-\s*1/g, ' ');

            let match = cleaned.match(/(?:lớp|khối|toán|lý|lí|hóa|hoá|anh|văn|khtn|sinh|sử|địa|tin|việt|bài)\s*(1[0-2]|[1-9])(?![0-9])/i);
            if (!match) {
                match = cleaned.match(/(?:[^0-9]|^)(1[0-2]|[1-9])(?![0-9])/);
            }
            if (!match) return null;

            const grade = parseInt(match[1], 10);
            if (grade >= 1 && grade <= 5) {
                return { grade, tierLabel: 'Lớp 1–5', baseSalary: 90000, bonusPerStudent: 6000 };
            }
            if (grade >= 6 && grade <= 7) {
                return { grade, tierLabel: 'Lớp 6–7', baseSalary: 100000, bonusPerStudent: 7000 };
            }
            if (grade >= 8 && grade <= 9) {
                return { grade, tierLabel: 'Lớp 8–9', baseSalary: 115000, bonusPerStudent: 8000 };
            }
            if (grade >= 10 && grade <= 11) {
                return { grade, tierLabel: 'Lớp 10–11', baseSalary: 125000, bonusPerStudent: 9000 };
            }
            if (grade === 12) {
                return { grade, tierLabel: 'Lớp 12', baseSalary: 140000, bonusPerStudent: 10000 };
            }
            return null;
        },

        recalcClassSalary(cid) {
            const baseInput = document.querySelector(`.sal-base[data-cid="${cid}"]`);
            const stuInput = document.querySelector(`.sal-students[data-cid="${cid}"]`);
            const shiftInput = document.querySelector(`.sal-shift[data-cid="${cid}"]`);
            const bonusDisplay = document.getElementById(`sal-bonus-display-${cid}`);
            const summaryEl = document.getElementById(`sal-summary-${cid}`);

            if (!baseInput || !stuInput || !shiftInput) return;

            const baseSalary = parseInt(baseInput.value, 10) || 0;
            const bonusRate = parseInt(stuInput.dataset.bonus, 10) || 0;
            const rawStudents = stuInput.value.trim();
            const studentCount = rawStudents === '' ? 0 : Math.max(0, parseInt(rawStudents, 10) || 0);
            const extraStudents = Math.max(0, studentCount - 3);
            const bonusAmount = extraStudents * bonusRate;
            const officialSalary = baseSalary + bonusAmount;

            shiftInput.value = officialSalary;

            if (bonusDisplay) {
                bonusDisplay.value = bonusAmount > 0 ? `+${DB.formatCurrency(bonusAmount)} (${extraStudents} HS × ${DB.formatCurrency(bonusRate)})` : '0 ₫ (1–3 HS)';
            }
            if (summaryEl) {
                if (extraStudents > 0) {
                    summaryEl.innerHTML = `➝ Lương chính thức: <strong>${DB.formatCurrency(baseSalary)}</strong> (CS) + <strong style="color:var(--primary-500);">${DB.formatCurrency(bonusAmount)}</strong> (${extraStudents} HS thêm × ${DB.formatCurrency(bonusRate)}) = <strong style="color:var(--success-600);font-size:14px;">${DB.formatCurrency(officialSalary)}/buổi</strong>`;
                } else {
                    summaryEl.innerHTML = `➝ Lương chính thức: <strong>${DB.formatCurrency(baseSalary)}</strong> (Lương cơ sở 1–3 HS) = <strong style="color:var(--success-600);font-size:14px;">${DB.formatCurrency(officialSalary)}/buổi</strong>`;
                }
            }
        },

        async editSalary(id) {
            const u = users.find(x => x.id === id);
            if (!u) return;
            const s = u.salaryConfig || {};

            let teacherClasses = [];
            let allStudents = [];
            try {
                [teacherClasses, allStudents] = await Promise.all([
                    DB.getClassesByTeacher(id),
                    DB.getStudents().catch(() => [])
                ]);
            } catch(e) { console.warn(e); }

            if (teacherClasses.length === 0) {
                Toast.warning('Giáo viên này chưa được phân công lớp nào. Hãy phân lớp trước.');
                return;
            }

            let classesHtml = teacherClasses.map(c => {
                const classConf = s[c.id] || {};
                const activeStudentCount = allStudents.filter(st => st.status === 'active' && (st.classIds || []).includes(c.id)).length;
                const tier = this.getSalaryTierForClass(c);
                const defaultBase = tier ? tier.baseSalary : (classConf.baseSalary || classConf.perShift || 0);
                const baseSalary = classConf.baseSalary !== undefined ? classConf.baseSalary : defaultBase;
                const bonusRate = classConf.bonusPerStudent !== undefined ? classConf.bonusPerStudent : (tier ? tier.bonusPerStudent : 0);
                const hasSavedStudentCount = classConf.studentCount !== undefined && classConf.studentCount !== null && classConf.studentCount !== '';
                const studentCountVal = hasSavedStudentCount ? classConf.studentCount : '';
                const studentCountNum = hasSavedStudentCount ? Math.max(0, parseInt(classConf.studentCount, 10) || 0) : 0;
                const extraStudents = Math.max(0, studentCountNum - 3);
                const bonusAmount = extraStudents * bonusRate;
                const officialSalary = hasSavedStudentCount
                    ? (baseSalary + bonusAmount)
                    : (classConf.perShift && !tier ? classConf.perShift : (baseSalary + bonusAmount));

                const tierBadge = tier
                    ? `<span class="badge badge-info" style="font-size:11px;">${tier.tierLabel}: CS ${DB.formatCurrency(tier.baseSalary)} + ${DB.formatCurrency(tier.bonusPerStudent)}/HS (từ HS thứ 4)</span>`
                    : `<span class="badge badge-neutral" style="font-size:11px;">Tùy chỉnh</span>`;

                const bonusText = bonusAmount > 0
                    ? `+${DB.formatCurrency(bonusAmount)} (${extraStudents} HS × ${DB.formatCurrency(bonusRate)})`
                    : '0 ₫ (1–3 HS)';

                const summaryHtml = extraStudents > 0
                    ? `➝ Lương chính thức: <strong>${DB.formatCurrency(baseSalary)}</strong> (CS) + <strong style="color:var(--primary-500);">${DB.formatCurrency(bonusAmount)}</strong> (${extraStudents} HS thêm × ${DB.formatCurrency(bonusRate)}) = <strong style="color:var(--success-600);font-size:14px;">${DB.formatCurrency(officialSalary)}/buổi</strong>`
                    : `➝ Lương chính thức: <strong>${DB.formatCurrency(baseSalary)}</strong> (Lương cơ sở 1–3 HS) = <strong style="color:var(--success-600);font-size:14px;">${DB.formatCurrency(officialSalary)}/buổi</strong>`;

                return `
                    <div style="margin-bottom:16px;padding:14px;background:var(--bg-glass);border:1px solid var(--border-color);border-radius:10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                            <h4 style="margin:0;color:var(--primary-500);font-size:15px;">📚 ${c.name} <span style="color:var(--text-secondary);font-weight:600;">(${activeStudentCount} HS)</span></h4>
                            ${tierBadge}
                        </div>
                        <div class="form-row" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:12px;">Lương cơ sở (1–3 HS)</label>
                                <input type="number" class="input sal-base" data-cid="${c.id}" value="${baseSalary}" oninput="UsersPage.recalcClassSalary('${c.id}')">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:12px;">Số học sinh *</label>
                                <input type="number" min="0" class="input sal-students" data-cid="${c.id}" data-bonus="${bonusRate}" value="${studentCountVal}" placeholder="VD: 5" oninput="UsersPage.recalcClassSalary('${c.id}')">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:12px;">Phụ cấp (từ HS thứ 4)</label>
                                <input type="text" class="input" id="sal-bonus-display-${c.id}" value="${bonusText}" readonly style="background:var(--bg-elevated);color:var(--primary-600);font-weight:600;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:12px;">Lương chính thức (VNĐ/buổi)</label>
                                <input type="number" class="input sal-shift" data-cid="${c.id}" value="${officialSalary}" style="font-weight:700;color:var(--success-600);">
                            </div>
                        </div>
                        <input type="hidden" class="sal-hourly" data-cid="${c.id}" value="${classConf.perHour || 0}">
                        <div id="sal-summary-${c.id}" style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border-color);font-size:12.5px;color:var(--text-secondary);">
                            ${summaryHtml}
                        </div>
                    </div>
                `;
            }).join('');

            Modal.show({
                title: 'Cài đặt mức lương: ' + (u.displayName || u.email),
                size: 'lg',
                content: `
                    <div style="max-height:68vh;overflow-y:auto;padding-right:8px;">
                        <div style="margin-bottom:14px;padding:10px 12px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:8px;font-size:12px;line-height:1.5;color:var(--text-secondary);">
                            <div style="font-weight:700;color:var(--primary-600);margin-bottom:4px;">📌 Công thức lương áp dụng từ tháng 11/2026:</div>
                            <div><strong>Lương = Lương cơ sở (1–3 HS) + Phụ cấp theo đầu HS (tính từ HS thứ 4 trở đi)</strong></div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px;">
                                <span>• Lớp 1–5: <strong>90k</strong> + 6k/HS</span>
                                <span>• Lớp 6–7: <strong>100k</strong> + 7k/HS</span>
                                <span>• Lớp 8–9: <strong>115k</strong> + 8k/HS</span>
                                <span>• Lớp 10–11: <strong>125k</strong> + 9k/HS</span>
                                <span>• Lớp 12: <strong>140k</strong> + 10k/HS</span>
                            </div>
                        </div>
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
            const baseInputs = document.querySelectorAll('.sal-base');
            const stuInputs = document.querySelectorAll('.sal-students');
            const hourlyInputs = document.querySelectorAll('.sal-hourly');

            shiftInputs.forEach(inp => {
                const cid = inp.dataset.cid;
                if (!salaryConfig[cid]) salaryConfig[cid] = {};
                salaryConfig[cid].perShift = parseInt(inp.value, 10) || 0;
            });
            baseInputs.forEach(inp => {
                const cid = inp.dataset.cid;
                if (!salaryConfig[cid]) salaryConfig[cid] = {};
                salaryConfig[cid].baseSalary = parseInt(inp.value, 10) || 0;
            });
            stuInputs.forEach(inp => {
                const cid = inp.dataset.cid;
                if (!salaryConfig[cid]) salaryConfig[cid] = {};
                const rawVal = inp.value.trim();
                salaryConfig[cid].studentCount = rawVal === '' ? null : Math.max(0, parseInt(rawVal, 10) || 0);
                salaryConfig[cid].bonusPerStudent = parseInt(inp.dataset.bonus, 10) || 0;
            });
            hourlyInputs.forEach(inp => {
                const cid = inp.dataset.cid;
                if (!salaryConfig[cid]) salaryConfig[cid] = {};
                salaryConfig[cid].perHour = parseInt(inp.value, 10) || 0;
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
