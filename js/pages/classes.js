// ============================================
// CLASSES PAGE
// ============================================

Router.register('classes', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'staff');
    const isTeacher = Auth.isTeacher();
    let classes = [], teachers = [];

    try {
        if (isTeacher) {
            classes = await DB.getClassesByTeacher(window.currentUser.id);
        } else {
            classes = await DB.getClasses();
        }
        teachers = await DB.getTeachers();
    } catch(e) { console.warn(e); }

    function getTeacherNames(teacherIds) {
        if (!teacherIds || teacherIds.length === 0) return 'Chưa phân công';
        return teacherIds.map(id => {
            const t = teachers.find(te => te.id === id);
            return t ? t.displayName || t.email : '';
        }).filter(Boolean).join(', ') || 'Chưa phân công';
    }

    function renderCards() {
        const grid = document.getElementById('classes-grid');
        if (!grid) return;

        if (classes.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="school"></i><h3>Chưa có lớp học</h3><p>${canEdit ? 'Nhấn "Thêm lớp" để tạo lớp mới' : 'Bạn chưa được phân công lớp nào'}</p></div>`;
        } else {
            grid.innerHTML = classes.map(c => `
                <div class="card" style="border-top:3px solid ${c.status === 'active' ? 'var(--primary-500)' : 'var(--neutral-600)'};">
                    <div class="card-body">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-4);">
                            <div>
                                <h3 style="font-size:var(--font-size-lg);font-weight:700;margin-bottom:4px;">${c.name}</h3>
                                <span class="badge badge-${c.status === 'active' ? 'success' : 'neutral'}">${c.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'}</span>
                            </div>
                            ${canEdit ? `<div class="table-actions">
                                <button class="btn-icon" title="Sửa" onclick="ClassesPage.edit('${c.id}')"><i data-lucide="pencil"></i></button>
                                ${Auth.isOwner() ? `<button class="btn-icon" title="Xóa" onclick="ClassesPage.remove('${c.id}', '${(c.name||'').replace(/'/g,"\\'")}')"><i data-lucide="trash-2"></i></button>` : ''}
                            </div>` : ''}
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;font-size:var(--font-size-sm);color:var(--text-secondary);">
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="book-open" style="width:16px;height:16px;color:var(--primary-400);"></i> ${c.subject || 'Chưa rõ'}</div>
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="user" style="width:16px;height:16px;color:var(--accent-400);"></i> ${getTeacherNames(c.teacherIds)}</div>
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="map-pin" style="width:16px;height:16px;color:var(--success-400);"></i> ${c.room || 'Chưa có phòng'}</div>
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="wallet" style="width:16px;height:16px;color:var(--warning-400);"></i> ${c.fee ? DB.formatCurrency(c.fee) + '/tháng' : 'Chưa cập nhật'}</div>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('attendance')"><i data-lucide="clipboard-check"></i> Điểm danh</button>
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('schedule')"><i data-lucide="calendar-days"></i> Lịch học</button>
                    </div>
                </div>
            `).join('');
        }
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="school"></i> Quản lý Lớp học</h1>
                <p class="page-subtitle">${classes.length} lớp trong hệ thống</p>
            </div>
            <div class="page-actions">
                ${Auth.isOwner() ? '<button class="btn btn-secondary" onclick="window.open(\'assets/docs/QuyDinhTaiChinh_ThanhNhanEducation.pdf\', \'_blank\')"><i data-lucide="file-text"></i> Xem quy định</button>' : ''}
                ${canEdit ? '<button class="btn btn-primary" onclick="ClassesPage.showAdd()"><i data-lucide="plus"></i> Thêm lớp</button>' : ''}
            </div>
        </div>

        <div id="classes-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-6);"></div>
    `;

    renderCards();

    window.ClassesPage = {
        suggestFee(name) {
            if (!name) return;
            const feeInput = document.getElementById('c-fee');
            if (!feeInput) return;
            
            const lowerName = name.toLowerCase();
            const isOneOnOne = lowerName.includes('1:1') || lowerName.includes('1 kèm 1') || lowerName.includes('kèm riêng');
            const match = lowerName.match(/(?:lớp|khối|\s|^|a|b|c)(\d{1,2})(?:\s|$|[a-z])/i);
            if (!match) return;
            
            const grade = parseInt(match[1]);
            if (grade < 1 || grade > 12) return;

            let fee = 0;
            if (isOneOnOne) {
                if (grade >= 1 && grade <= 5) fee = 1300000;
                else if (grade >= 6 && grade <= 8) fee = 1400000;
                else if (grade >= 9 && grade <= 11) fee = 1500000;
                else if (grade === 12) fee = 1800000;
            } else {
                if (grade >= 1 && grade <= 5) fee = 500000;
                else if (grade === 6) fee = 525000;
                else if (grade === 7) fee = 550000;
                else if (grade === 8) fee = 575000;
                else if (grade === 9) fee = 600000;
                else if (grade === 10) fee = 625000;
                else if (grade === 11) fee = 650000;
                else if (grade === 12) fee = 675000;
            }
            if (fee > 0) feeInput.value = fee;
        },

        showAdd() {
            const teacherCheckboxes = teachers.map(t => `
                <label class="checkbox-label"><input type="checkbox" value="${t.id}"> ${t.displayName || t.email}</label>
            `).join('') || '<span class="text-muted text-sm">Chưa có giáo viên nào</span>';

            Modal.show({
                title: 'Thêm lớp học mới',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Tên lớp *</label>
                            <input type="text" class="input" id="c-name" placeholder="VD: Toán 12A" oninput="ClassesPage.suggestFee(this.value)">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Môn học</label>
                            <input type="text" class="input" id="c-subject" placeholder="VD: Toán, Lý, Hóa...">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Học phí/tháng (VNĐ)</label>
                            <input type="number" class="input" id="c-fee" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phòng học</label>
                            <input type="text" class="input" id="c-room" placeholder="VD: P.01">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Giáo viên phụ trách</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="c-teachers">${teacherCheckboxes}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Trạng thái</label>
                        <select class="select" id="c-status">
                            <option value="active">Đang hoạt động</option>
                            <option value="inactive">Tạm ngưng</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="textarea" id="c-notes" rows="2"></textarea>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="ClassesPage.saveNew()">Lưu</button>
                `
            });
        },

        async saveNew() {
            const name = document.getElementById('c-name').value.trim();
            if (!name) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập tên lớp'); return; }

            const teacherIds = Array.from(document.querySelectorAll('#c-teachers input:checked')).map(cb => cb.value);
            const fee = parseInt(document.getElementById('c-fee').value) || 0;

            try {
                await DB.addClass({
                    name,
                    subject: document.getElementById('c-subject').value || '',
                    fee,
                    room: document.getElementById('c-room').value || '',
                    teacherIds,
                    status: document.getElementById('c-status').value,
                    notes: document.getElementById('c-notes').value || ''
                });
                Modal.close();
                Toast.success('Thành công', 'Đã thêm lớp ' + name);
                classes = await DB.getClasses();
                renderCards();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        async edit(id) {
            const c = classes.find(cl => cl.id === id);
            if (!c) return;

            const teacherCheckboxes = teachers.map(t => `
                <label class="checkbox-label"><input type="checkbox" value="${t.id}" ${(c.teacherIds || []).includes(t.id) ? 'checked' : ''}> ${t.displayName || t.email}</label>
            `).join('') || '<span class="text-muted text-sm">Chưa có giáo viên</span>';

            Modal.show({
                title: 'Sửa lớp học',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Tên lớp *</label>
                            <input type="text" class="input" id="c-name" value="${c.name || ''}" oninput="ClassesPage.suggestFee(this.value)">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Môn học</label>
                            <input type="text" class="input" id="c-subject" value="${c.subject || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Học phí/tháng (VNĐ)</label>
                            <input type="number" class="input" id="c-fee" value="${c.fee || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phòng học</label>
                            <input type="text" class="input" id="c-room" value="${c.room || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Giáo viên phụ trách</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="c-teachers">${teacherCheckboxes}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Trạng thái</label>
                        <select class="select" id="c-status">
                            <option value="active" ${c.status === 'active' ? 'selected' : ''}>Đang hoạt động</option>
                            <option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>Tạm ngưng</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="textarea" id="c-notes" rows="2">${c.notes || ''}</textarea>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="ClassesPage.saveEdit('${id}')">Cập nhật</button>
                `
            });
        },

        async saveEdit(id) {
            const name = document.getElementById('c-name').value.trim();
            if (!name) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập tên lớp'); return; }

            const teacherIds = Array.from(document.querySelectorAll('#c-teachers input:checked')).map(cb => cb.value);
            const fee = parseInt(document.getElementById('c-fee').value) || 0;

            try {
                await DB.updateClass(id, {
                    name,
                    subject: document.getElementById('c-subject').value || '',
                    fee,
                    room: document.getElementById('c-room').value || '',
                    teacherIds,
                    status: document.getElementById('c-status').value,
                    notes: document.getElementById('c-notes').value || ''
                });
                Modal.close();
                Toast.success('Thành công', 'Đã cập nhật lớp');
                classes = isTeacher ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
                renderCards();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        remove(id, name) {
            Modal.confirm({
                title: 'Xóa lớp học',
                message: `Bạn có chắc muốn xóa lớp <strong>${name}</strong>?`,
                confirmText: 'Xóa',
                danger: true
            });
            Modal.bindConfirm(async () => {
                await DB.deleteClass(id);
                Toast.success('Đã xóa', 'Lớp đã được xóa');
                classes = await DB.getClasses();
                renderCards();
            });
        }
    };
});
