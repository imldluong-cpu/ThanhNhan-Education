// ============================================
// STUDENTS PAGE
// ============================================

Router.register('students', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'staff');
    let students = [], classes = [];
    try {
        students = await DB.getStudents();
        classes = await DB.getClasses();
    } catch(e) { console.warn(e); }

    let filterClass = '';
    let searchTerm = '';

    function getFiltered() {
        let list = students;
        if (filterClass) list = list.filter(s => s.classIds && s.classIds.includes(filterClass));
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.parentPhone || '').includes(q));
        }
        return list;
    }

    function getClassNames(classIds) {
        if (!classIds || classIds.length === 0) return '—';
        return classIds.map(id => {
            const c = classes.find(cl => cl.id === id);
            return c ? c.name : '';
        }).filter(Boolean).join(', ') || '—';
    }

    function renderTable() {
        const filtered = getFiltered();
        const tbody = document.getElementById('students-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i data-lucide="users"></i><h3>Chưa có học viên</h3><p>Nhấn "Thêm học viên" để bắt đầu</p></div></td></tr>`;
        } else {
            tbody.innerHTML = filtered.map((s, i) => `<tr>
                <td>${i + 1}</td>
                <td><strong>${s.name || ''}</strong></td>
                <td>${s.dateOfBirth || '—'}</td>
                <td>${s.parentPhone || '—'}</td>
                <td>${getClassNames(s.classIds)}</td>
                <td><span class="badge badge-${s.status === 'active' ? 'success' : 'danger'}">${s.status === 'active' ? 'Đang học' : 'Nghỉ học'}</span></td>
                <td>
                    <div class="table-actions">
                        ${canEdit ? `
                            <button class="btn-icon" title="Sửa" onclick="StudentsPage.edit('${s.id}')"><i data-lucide="pencil"></i></button>
                            <button class="btn-icon" title="Xóa" onclick="StudentsPage.remove('${s.id}', '${(s.name || '').replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>`).join('');
        }
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="users"></i> Quản lý Học viên</h1>
                <p class="page-subtitle">${students.length} học viên trong hệ thống</p>
            </div>
            <div class="page-actions">
                ${canEdit ? '<button class="btn btn-primary" onclick="StudentsPage.showAdd()"><i data-lucide="plus"></i> Thêm học viên</button>' : ''}
            </div>
        </div>

        <div class="filter-bar">
            <div class="search-box">
                <i data-lucide="search"></i>
                <input type="text" class="input" id="student-search" placeholder="Tìm theo tên, SĐT..." oninput="StudentsPage.search(this.value)">
            </div>
            <select class="select" id="student-class-filter" style="max-width:200px;" onchange="StudentsPage.filterByClass(this.value)">
                <option value="">Tất cả lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Họ tên</th>
                            <th>Ngày sinh</th>
                            <th>SĐT Phụ huynh</th>
                            <th>Lớp</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="students-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    renderTable();

    // Page methods
    window.StudentsPage = {
        search(val) { searchTerm = val; renderTable(); },
        filterByClass(val) { filterClass = val; renderTable(); },

        showAdd() {
            const classCheckboxes = classes.map(c => `
                <label class="checkbox-label"><input type="checkbox" value="${c.id}"> ${c.name}</label>
            `).join('');

            Modal.show({
                title: 'Thêm học viên mới',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Họ tên *</label>
                            <input type="text" class="input" id="s-name" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày sinh</label>
                            <input type="date" class="input" id="s-dob">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">SĐT Phụ huynh</label>
                            <input type="tel" class="input" id="s-phone">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Trạng thái</label>
                            <select class="select" id="s-status">
                                <option value="active">Đang học</option>
                                <option value="inactive">Nghỉ học</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lớp học</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="s-classes">${classCheckboxes || '<span class="text-muted text-sm">Chưa có lớp nào</span>'}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="textarea" id="s-notes" rows="2"></textarea>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="StudentsPage.saveNew()">Lưu</button>
                `
            });
        },

        async saveNew() {
            const name = document.getElementById('s-name').value.trim();
            if (!name) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập họ tên'); return; }

            const classIds = Array.from(document.querySelectorAll('#s-classes input:checked')).map(cb => cb.value);

            try {
                await DB.addStudent({
                    name,
                    dateOfBirth: document.getElementById('s-dob').value || '',
                    parentPhone: document.getElementById('s-phone').value || '',
                    status: document.getElementById('s-status').value,
                    classIds,
                    notes: document.getElementById('s-notes').value || ''
                });
                Modal.close();
                Toast.success('Thành công', 'Đã thêm học viên ' + name);
                students = await DB.getStudents();
                renderTable();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        async edit(id) {
            const s = students.find(st => st.id === id);
            if (!s) return;

            const classCheckboxes = classes.map(c => `
                <label class="checkbox-label"><input type="checkbox" value="${c.id}" ${(s.classIds || []).includes(c.id) ? 'checked' : ''}> ${c.name}</label>
            `).join('');

            Modal.show({
                title: 'Sửa thông tin học viên',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Họ tên *</label>
                            <input type="text" class="input" id="s-name" value="${s.name || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày sinh</label>
                            <input type="date" class="input" id="s-dob" value="${s.dateOfBirth || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">SĐT Phụ huynh</label>
                            <input type="tel" class="input" id="s-phone" value="${s.parentPhone || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Trạng thái</label>
                            <select class="select" id="s-status">
                                <option value="active" ${s.status === 'active' ? 'selected' : ''}>Đang học</option>
                                <option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Nghỉ học</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lớp học</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="s-classes">${classCheckboxes || '<span class="text-muted text-sm">Chưa có lớp</span>'}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="textarea" id="s-notes" rows="2">${s.notes || ''}</textarea>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="StudentsPage.saveEdit('${id}')">Cập nhật</button>
                `
            });
        },

        async saveEdit(id) {
            const name = document.getElementById('s-name').value.trim();
            if (!name) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập họ tên'); return; }

            const classIds = Array.from(document.querySelectorAll('#s-classes input:checked')).map(cb => cb.value);

            try {
                await DB.updateStudent(id, {
                    name,
                    dateOfBirth: document.getElementById('s-dob').value || '',
                    parentPhone: document.getElementById('s-phone').value || '',
                    status: document.getElementById('s-status').value,
                    classIds,
                    notes: document.getElementById('s-notes').value || ''
                });
                Modal.close();
                Toast.success('Thành công', 'Đã cập nhật học viên');
                students = await DB.getStudents();
                renderTable();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        remove(id, name) {
            Modal.confirm({
                title: 'Xóa học viên',
                message: `Bạn có chắc muốn xóa học viên <strong>${name}</strong>? Hành động này không thể hoàn tác.`,
                confirmText: 'Xóa',
                danger: true
            });
            Modal.bindConfirm(async () => {
                await DB.deleteStudent(id);
                Toast.success('Đã xóa', 'Học viên đã được xóa');
                students = await DB.getStudents();
                renderTable();
            });
        }
    };
});
