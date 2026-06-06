// ============================================
// STUDENTS PAGE - With Excel Import & Quick Class Create
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

    function renderClassCheckboxes(selectedIds) {
        const ids = selectedIds || [];
        return `
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="s-classes">
                ${classes.map(c => `<label class="checkbox-label"><input type="checkbox" value="${c.id}" ${ids.includes(c.id) ? 'checked' : ''}> ${c.name}</label>`).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-2" onclick="StudentsPage.quickAddClass()" style="font-size:12px;">
                <i data-lucide="plus" style="width:14px;height:14px;"></i> Tạo lớp mới
            </button>
        `;
    }

    function renderTable() {
        const filtered = getFiltered();
        const tbody = document.getElementById('students-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>Chưa có học viên</h3><p>Nhấn "Thêm học viên" để bắt đầu</p></div></td></tr>`;
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
            <div class="page-actions" style="display:flex;gap:8px;">
                ${canEdit ? `
                    <button class="btn btn-secondary" onclick="StudentsPage.showImportExcel()"><i data-lucide="file-spreadsheet"></i> Nhập từ Excel</button>
                    <button class="btn btn-primary" onclick="StudentsPage.showAdd()"><i data-lucide="plus"></i> Thêm học viên</button>
                ` : ''}
            </div>
        </div>

        <div class="filter-bar">
            <div class="search-box">
                <i data-lucide="search"></i>
                <input type="text" class="input" placeholder="Tìm theo tên, SĐT..." oninput="StudentsPage.search(this.value)">
            </div>
            <select class="select" style="max-width:200px;" onchange="StudentsPage.filterByClass(this.value)">
                <option value="">Tất cả lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead><tr><th>STT</th><th>Họ tên</th><th>Ngày sinh</th><th>SĐT Phụ huynh</th><th>Lớp</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                    <tbody id="students-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    renderTable();

    window.StudentsPage = {
        search(val) { searchTerm = val; renderTable(); },
        filterByClass(val) { filterClass = val; renderTable(); },

        // === QUICK ADD CLASS ===
        quickAddClass() {
            const container = document.getElementById('s-classes');
            if (!container) return;
            // Insert inline form
            const existing = document.getElementById('quick-class-form');
            if (existing) { existing.remove(); return; }

            const form = document.createElement('div');
            form.id = 'quick-class-form';
            form.style.cssText = 'width:100%;display:flex;gap:8px;align-items:center;margin-top:8px;padding:8px;background:rgba(99,102,241,0.1);border-radius:8px;';
            form.innerHTML = `
                <input type="text" class="input" id="quick-class-name" placeholder="Tên lớp" style="flex:1;padding:6px 10px;font-size:13px;">
                <input type="text" class="input" id="quick-class-subject" placeholder="Môn" style="width:80px;padding:6px 10px;font-size:13px;">
                <button class="btn btn-primary btn-sm" onclick="StudentsPage.saveQuickClass()">Tạo</button>
            `;
            container.parentElement.insertBefore(form, container.nextSibling.nextSibling);
        },

        async saveQuickClass() {
            const name = document.getElementById('quick-class-name').value.trim();
            if (!name) { Toast.warning('Nhập tên lớp'); return; }
            try {
                const result = await DB.addClass({
                    name,
                    subject: document.getElementById('quick-class-subject').value.trim() || '',
                    fee: 0, room: '', notes: ''
                });
                classes = await DB.getClasses();
                // Add checkbox for new class
                const container = document.getElementById('s-classes');
                if (container) {
                    const label = document.createElement('label');
                    label.className = 'checkbox-label';
                    label.innerHTML = `<input type="checkbox" value="${result.id}" checked> ${name}`;
                    container.appendChild(label);
                }
                document.getElementById('quick-class-form')?.remove();
                Toast.success('Đã tạo lớp ' + name);
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        // === ADD STUDENT ===
        showAdd() {
            Modal.show({
                title: 'Thêm học viên mới',
                content: `
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Họ tên *</label><input type="text" class="input" id="s-name" required></div>
                        <div class="form-group"><label class="form-label">Ngày sinh</label><input type="date" class="input" id="s-dob"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">SĐT Phụ huynh</label><input type="tel" class="input" id="s-phone"></div>
                        <div class="form-group"><label class="form-label">Trạng thái</label>
                            <select class="select" id="s-status"><option value="active">Đang học</option><option value="inactive">Nghỉ học</option></select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lớp học</label>
                        ${renderClassCheckboxes([])}
                    </div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><textarea class="textarea" id="s-notes" rows="2"></textarea></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="StudentsPage.saveNew()">Lưu</button>`
            });
            if (window.lucide) lucide.createIcons();
        },

        async saveNew() {
            const name = document.getElementById('s-name').value.trim();
            if (!name) { Toast.warning('Vui lòng nhập họ tên'); return; }
            const classIds = Array.from(document.querySelectorAll('#s-classes input:checked')).map(cb => cb.value);
            try {
                await DB.addStudent({ name, dateOfBirth: document.getElementById('s-dob').value || '', parentPhone: document.getElementById('s-phone').value || '', status: document.getElementById('s-status').value, classIds, notes: document.getElementById('s-notes').value || '' });
                Modal.close();
                Toast.success('Đã thêm học viên ' + name);
                students = await DB.getStudents();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        // === EDIT STUDENT ===
        async edit(id) {
            const s = students.find(st => st.id === id);
            if (!s) return;
            Modal.show({
                title: 'Sửa thông tin học viên',
                content: `
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Họ tên *</label><input type="text" class="input" id="s-name" value="${s.name || ''}"></div>
                        <div class="form-group"><label class="form-label">Ngày sinh</label><input type="date" class="input" id="s-dob" value="${s.dateOfBirth || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">SĐT Phụ huynh</label><input type="tel" class="input" id="s-phone" value="${s.parentPhone || ''}"></div>
                        <div class="form-group"><label class="form-label">Trạng thái</label>
                            <select class="select" id="s-status"><option value="active" ${s.status === 'active' ? 'selected' : ''}>Đang học</option><option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Nghỉ học</option></select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lớp học</label>
                        ${renderClassCheckboxes(s.classIds)}
                    </div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><textarea class="textarea" id="s-notes" rows="2">${s.notes || ''}</textarea></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="StudentsPage.saveEdit('${id}')">Cập nhật</button>`
            });
            if (window.lucide) lucide.createIcons();
        },

        async saveEdit(id) {
            const name = document.getElementById('s-name').value.trim();
            if (!name) { Toast.warning('Vui lòng nhập họ tên'); return; }
            const classIds = Array.from(document.querySelectorAll('#s-classes input:checked')).map(cb => cb.value);
            try {
                await DB.updateStudent(id, { name, dateOfBirth: document.getElementById('s-dob').value || '', parentPhone: document.getElementById('s-phone').value || '', status: document.getElementById('s-status').value, classIds, notes: document.getElementById('s-notes').value || '' });
                Modal.close();
                Toast.success('Đã cập nhật');
                students = await DB.getStudents();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        // === DELETE ===
        remove(id, name) {
            Modal.confirm({ title: 'Xóa học viên', message: `Xóa <strong>${name}</strong>?`, confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                await DB.deleteStudent(id);
                Toast.success('Đã xóa');
                students = await DB.getStudents();
                renderTable();
            });
        },

        // === EXCEL IMPORT ===
        showImportExcel() {
            Modal.show({
                title: '📥 Nhập học viên từ Excel',
                size: 'lg',
                content: `
                    <div style="padding:16px;background:rgba(99,102,241,0.08);border-radius:var(--radius-md);margin-bottom:16px;">
                        <p style="font-size:13px;color:var(--text-secondary);margin:0;">
                            <strong>📋 Định dạng file Excel:</strong><br>
                            Cột A: Họ tên | Cột B: Ngày sinh | Cột C: SĐT Phụ huynh | Cột D: Tên lớp | Cột E: Ghi chú<br>
                            <em>Hàng 1 là tiêu đề (sẽ bỏ qua). Tên lớp phải trùng với lớp đã tạo trong hệ thống.</em>
                        </p>
                    </div>
                    <div style="border:2px dashed var(--neutral-600);border-radius:var(--radius-lg);padding:32px;text-align:center;cursor:pointer;" id="excel-drop-zone" onclick="document.getElementById('excel-file-input').click()">
                        <i data-lucide="upload" style="width:40px;height:40px;color:var(--primary-400);margin-bottom:12px;"></i>
                        <p style="font-size:14px;color:var(--text-secondary);">Kéo thả file Excel hoặc nhấn để chọn</p>
                        <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" style="display:none;" onchange="StudentsPage.handleExcelFile(this.files[0])">
                    </div>
                    <div id="excel-preview" style="margin-top:16px;"></div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" id="btn-import-excel" disabled onclick="StudentsPage.doImport()">Nhập học viên</button>
                `
            });
            if (window.lucide) lucide.createIcons();
        },

        _importData: [],

        handleExcelFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'binary' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

                    // Skip header row
                    const data = rows.slice(1).filter(r => r[0]).map(r => ({
                        name: String(r[0] || '').trim(),
                        dateOfBirth: r[1] ? String(r[1]).trim() : '',
                        parentPhone: r[2] ? String(r[2]).trim() : '',
                        className: r[3] ? String(r[3]).trim() : '',
                        notes: r[4] ? String(r[4]).trim() : ''
                    }));

                    this._importData = data;

                    const preview = document.getElementById('excel-preview');
                    preview.innerHTML = `
                        <p style="font-size:13px;color:var(--success-400);margin-bottom:8px;">✅ Tìm thấy <strong>${data.length}</strong> học viên</p>
                        <div class="table-container" style="max-height:300px;overflow-y:auto;">
                            <table>
                                <thead><tr><th>Họ tên</th><th>Ngày sinh</th><th>SĐT</th><th>Lớp</th><th>Ghi chú</th></tr></thead>
                                <tbody>${data.slice(0, 50).map(d => `<tr>
                                    <td>${d.name}</td><td>${d.dateOfBirth}</td><td>${d.parentPhone}</td>
                                    <td>${d.className ? `<span class="badge ${classes.find(c => c.name === d.className) ? 'badge-success' : 'badge-warning'}">${d.className}</span>` : '—'}</td>
                                    <td class="text-sm">${d.notes}</td>
                                </tr>`).join('')}</tbody>
                            </table>
                        </div>
                        ${data.length > 50 ? `<p class="text-sm text-muted mt-2">... và ${data.length - 50} học viên nữa</p>` : ''}
                    `;

                    document.getElementById('btn-import-excel').disabled = false;
                } catch(err) {
                    Toast.error('Lỗi đọc file', err.message);
                }
            };
            reader.readAsBinaryString(file);
        },

        async doImport() {
            if (this._importData.length === 0) return;
            const btn = document.getElementById('btn-import-excel');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Đang nhập...';

            try {
                const studentsToAdd = this._importData.map(d => {
                    const classIds = [];
                    if (d.className) {
                        const cls = classes.find(c => c.name.toLowerCase() === d.className.toLowerCase());
                        if (cls) classIds.push(cls.id);
                    }
                    return { name: d.name, dateOfBirth: d.dateOfBirth, parentPhone: d.parentPhone, classIds, notes: d.notes, status: 'active' };
                });

                // Batch add (Firestore batch limit = 500)
                for (let i = 0; i < studentsToAdd.length; i += 450) {
                    const chunk = studentsToAdd.slice(i, i + 450);
                    await DB.addStudentsBatch(chunk);
                }

                Modal.close();
                Toast.success('Thành công', `Đã nhập ${studentsToAdd.length} học viên`);
                students = await DB.getStudents();
                renderTable();
                this._importData = [];
            } catch(e) {
                Toast.error('Lỗi nhập dữ liệu', e.message);
                btn.disabled = false;
                btn.innerHTML = 'Nhập học viên';
            }
        }
    };
});
