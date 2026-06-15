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
            tbody.innerHTML = `<tr><td colspan="${canEdit ? 9 : 8}"><div class="empty-state"><h3>Chưa có học viên</h3><p>Nhấn "Thêm học viên" để bắt đầu</p></div></td></tr>`;
        } else {
            tbody.innerHTML = filtered.map((s, i) => `<tr>
                ${canEdit ? `<td><input type="checkbox" class="student-cb" value="${s.id}" onchange="StudentsPage.toggleBulk()"></td>` : ''}
                <td>${i + 1}</td>
                <td><strong>${s.name || ''}</strong></td>
                <td>${s.grade || '—'}</td>
                <td>${s.school || '—'}</td>
                <td>${s.parentPhone || '—'}</td>
                <td>${getClassNames(s.classIds)}</td>
                <td><span class="badge badge-${s.status === 'active' ? 'success' : 'danger'}">${s.status === 'active' ? 'Đang học' : 'Nghỉ học'}</span></td>
                <td>
                    <div class="table-actions">
                        ${isOwnerAdmin ? `<button class="btn-icon" title="Báo cáo học tập" onclick="StudentsPage.showReport('${s.id}')"><i data-lucide="line-chart"></i></button>` : ''}
                        ${canEdit ? `
                            <button class="btn-icon" title="Sửa" onclick="StudentsPage.edit('${s.id}')"><i data-lucide="pencil"></i></button>
                            <button class="btn-icon" title="Xóa" onclick="StudentsPage.remove('${s.id}', '${(s.name || '').replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>`).join('');
        }
        if (window.lucide) lucide.createIcons();
        
        // Update select all state
        if (canEdit) {
            const allCb = document.getElementById('selectAll-cb');
            const cbs = document.querySelectorAll('.student-cb');
            if (allCb && cbs.length > 0) {
                allCb.checked = Array.from(cbs).every(c => c.checked);
            } else if (allCb) {
                allCb.checked = false;
            }
        }
    }

        const isOwnerAdmin = Auth.hasAnyRole('owner', 'admin', 'staff');
        const totalStudents = students.length;
        const gradeCounts = {};
        const schoolCounts = {};

        students.forEach(s => {
            const grade = s.grade || 'Chưa phân khối';
            gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
            if (s.school) {
                const school = s.school.trim();
                schoolCounts[school] = (schoolCounts[school] || 0) + 1;
            }
        });

        const topSchools = Object.entries(schoolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        let dashboardHTML = '<div class="stats-grid mb-6" style="grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));">';
        if (isOwnerAdmin) {
            dashboardHTML += `
                <div class="stat-card">
                    <div class="stat-label">Tổng học viên toàn trung tâm</div>
                    <div class="stat-value" style="font-size:2rem;color:var(--primary-600);">${totalStudents}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label mb-2" style="font-weight:600;color:var(--text-color);">Học viên theo khối</div>
                    <div style="max-height:100px;overflow-y:auto;font-size:13px;padding-right:8px;">
                        ${Object.entries(gradeCounts).sort((a,b)=>b[1]-a[1]).map(([g, count]) => `
                            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);">
                                <span>${g}</span><strong>${count}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        dashboardHTML += `
            <div class="stat-card">
                <div class="stat-label mb-2" style="font-weight:600;color:var(--text-color);">Top 5 Trường (Đông nhất)</div>
                <div style="max-height:100px;overflow-y:auto;font-size:13px;padding-right:8px;">
                    ${topSchools.length > 0 ? topSchools.map(([school, count], idx) => `
                        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);">
                            <span>${idx + 1}. ${school}</span><strong>${count} hs</strong>
                        </div>
                    `).join('') : '<div class="text-secondary">Chưa có dữ liệu</div>'}
                </div>
            </div>
        </div>`;

        container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="users"></i> Quản lý Học viên</h1>
                <p class="page-subtitle">${students.length} học viên trong hệ thống</p>
            </div>
            <div class="page-actions" style="display:flex;gap:8px;">
                ${canEdit ? `
                    <button class="btn btn-secondary" onclick="StudentsPage.showImportOldYear()"><i data-lucide="history"></i> Nhập từ năm cũ</button>
                    <button class="btn btn-secondary" onclick="StudentsPage.showImportExcel()"><i data-lucide="file-spreadsheet"></i> Nhập từ Excel</button>
                    <button class="btn btn-primary" onclick="StudentsPage.showAdd()"><i data-lucide="plus"></i> Thêm học viên</button>
                ` : ''}
            </div>
        </div>

        ${dashboardHTML}

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

        <div id="bulk-toolbar" style="display:none; padding:12px; background:var(--bg-glass); border-radius:var(--radius-md); margin-bottom:16px; align-items:center; justify-content:space-between; border:1px solid var(--border-color);">
            <div><strong id="bulk-count" style="color:var(--primary-600);">0</strong> học viên được chọn</div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="StudentsPage.bulkUpdateClass()"><i data-lucide="book-open"></i> Sửa Lớp</button>
                <button class="btn btn-secondary btn-sm" onclick="StudentsPage.bulkUpdateStatus()"><i data-lucide="toggle-left"></i> Sửa Trạng thái</button>
                <button class="btn btn-danger btn-sm" onclick="StudentsPage.bulkDelete()"><i data-lucide="trash-2"></i> Xóa</button>
            </div>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead><tr>
                        ${canEdit ? `<th style="width:40px;"><input type="checkbox" id="selectAll-cb" onchange="StudentsPage.toggleAll(this.checked)"></th>` : ''}
                        <th>STT</th><th>Họ tên</th><th>Khối</th><th>Trường</th><th>SĐT Phụ huynh</th><th>Lớp</th><th>Trạng thái</th><th>Thao tác</th>
                    </tr></thead>
                    <tbody id="students-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    renderTable();

    window.StudentsPage = {
        search(val) { searchTerm = val; renderTable(); },
        filterByClass(val) { filterClass = val; renderTable(); },

        // === BULK ACTIONS ===
        toggleBulk() {
            const checked = document.querySelectorAll('.student-cb:checked');
            const toolbar = document.getElementById('bulk-toolbar');
            if (toolbar) {
                if (checked.length > 0) {
                    toolbar.style.display = 'flex';
                    document.getElementById('bulk-count').textContent = checked.length;
                } else {
                    toolbar.style.display = 'none';
                }
            }
        },
        toggleAll(checked) {
            document.querySelectorAll('.student-cb').forEach(cb => cb.checked = checked);
            this.toggleBulk();
        },
        async bulkUpdateClass() {
            const checked = Array.from(document.querySelectorAll('.student-cb:checked')).map(c => c.value);
            if (checked.length === 0) return;
            
            Modal.show({
                title: 'Cập nhật lớp hàng loạt',
                content: `
                    <p style="margin-bottom:12px;font-size:13px;color:var(--text-secondary);">Bạn đang chọn <strong>${checked.length}</strong> học viên. Chọn các lớp muốn gán cho họ (Lớp cũ của họ sẽ bị thay thế bằng danh sách mới này):</p>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;" id="bulk-classes">
                        ${classes.map(c => `<label class="checkbox-label"><input type="checkbox" value="${c.id}"> ${c.name}</label>`).join('')}
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                         <button class="btn btn-primary" onclick="StudentsPage.saveBulkClass()">Cập nhật</button>`
            });
        },
        async saveBulkClass() {
            const checkedIds = Array.from(document.querySelectorAll('.student-cb:checked')).map(c => c.value);
            const selectedClassIds = Array.from(document.querySelectorAll('#bulk-classes input:checked')).map(c => c.value);
            
            Toast.info('Đang cập nhật...');
            try {
                const batch = window.db.batch();
                checkedIds.forEach(id => {
                    const ref = window.db.collection('students').doc(id);
                    batch.update(ref, { classIds: selectedClassIds });
                });
                await batch.commit();
                Modal.close();
                Toast.success(`Đã cập nhật lớp cho ${checkedIds.length} học viên`);
                students = await DB.getStudents();
                renderTable();
                this.toggleBulk();
                document.getElementById('selectAll-cb').checked = false;
            } catch(e) { Toast.error('Lỗi', e.message); }
        },
        bulkUpdateStatus() {
            const checked = Array.from(document.querySelectorAll('.student-cb:checked')).map(c => c.value);
            if (checked.length === 0) return;
            
            Modal.show({
                title: 'Đổi trạng thái hàng loạt',
                content: `
                    <div class="form-group">
                        <label class="form-label">Chọn trạng thái mới cho ${checked.length} học viên</label>
                        <select class="select" id="bulk-status">
                            <option value="active">Đang học</option>
                            <option value="inactive">Nghỉ học</option>
                        </select>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                         <button class="btn btn-primary" onclick="StudentsPage.saveBulkStatus()">Cập nhật</button>`
            });
        },
        async saveBulkStatus() {
            const checkedIds = Array.from(document.querySelectorAll('.student-cb:checked')).map(c => c.value);
            const status = document.getElementById('bulk-status').value;
            
            Toast.info('Đang cập nhật...');
            try {
                const batch = window.db.batch();
                checkedIds.forEach(id => {
                    const ref = window.db.collection('students').doc(id);
                    batch.update(ref, { status });
                });
                await batch.commit();
                Modal.close();
                Toast.success('Đã cập nhật trạng thái');
                students = await DB.getStudents();
                renderTable();
                this.toggleBulk();
                document.getElementById('selectAll-cb').checked = false;
            } catch(e) { Toast.error('Lỗi', e.message); }
        },
        bulkDelete() {
            const checked = Array.from(document.querySelectorAll('.student-cb:checked')).map(c => c.value);
            if (checked.length === 0) return;
            
            Modal.confirm({
                title: 'Xóa hàng loạt',
                message: `Bạn chắc chắn muốn xóa vĩnh viễn <strong>${checked.length}</strong> học viên đã chọn? Hành động này không thể hoàn tác.`,
                confirmText: 'Xóa tất cả',
                danger: true
            });
            Modal.bindConfirm(async () => {
                try {
                    const batch = window.db.batch();
                    checked.forEach(id => {
                        const ref = window.db.collection('students').doc(id);
                        batch.delete(ref);
                    });
                    await batch.commit();
                    Toast.success(`Đã xóa ${checked.length} học viên`);
                    students = await DB.getStudents();
                    renderTable();
                    this.toggleBulk();
                    document.getElementById('selectAll-cb').checked = false;
                } catch(e) { Toast.error('Lỗi', e.message); }
            });
        },

        // === IMPORT OLD YEAR ===
        async showImportOldYear() {
            Modal.show({ title: 'Lấy học viên từ năm cũ', content: `<div class="empty-state"><div class="spinner"></div></div>` });
            
            const snap = await window.db.collection('students').get();
            const year = window.currentAcademicYear || '2026-2027';
            const oldStudents = snap.docs
                .map(d => ({ academicYear: '2025-2026', ...d.data(), id: d.id }))
                .filter(d => d.academicYear !== year);

            if (oldStudents.length === 0) {
                Modal.show({ title: 'Lấy học viên từ năm cũ', content: `<div class="empty-state"><p>Không có học viên ở các năm học khác.</p></div>` });
                return;
            }

            const currentKeys = students.map(s => (s.name||'').toLowerCase() + (s.parentPhone || ''));
            const available = oldStudents.filter(s => !currentKeys.includes((s.name||'').toLowerCase() + (s.parentPhone || '')));

            Modal.show({
                title: 'Lấy học viên từ năm cũ',
                content: `
                    <p style="margin-bottom:12px;color:var(--text-secondary);font-size:13px;">Chọn các học viên cũ để copy sang năm học <strong>${year}</strong>. Lớp học sẽ được bỏ trống để bạn tự xếp lại.</p>
                    <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;padding:8px;">
                        ${available.length === 0 ? '<p class="text-center text-secondary py-4">Tất cả học viên cũ đã có mặt ở năm nay.</p>' : 
                        available.map(s => `
                            <label class="checkbox-label" style="display:flex;width:100%;margin-bottom:8px;padding:8px;">
                                <input type="checkbox" class="import-old-cb" value="${s.id}"> 
                                <div style="margin-left:8px;">
                                    <strong>${s.name}</strong> - Khối ${s.grade || '?'} - SĐT: ${s.parentPhone || '—'}
                                </div>
                            </label>
                        `).join('')}
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    ${available.length > 0 ? `<button class="btn btn-primary" onclick="StudentsPage.importOldYear()">Chuyển sang ${year}</button>` : ''}
                `
            });
            window.StudentsPage._oldStudentsData = available;
        },

        async importOldYear() {
            const checkboxes = document.querySelectorAll('.import-old-cb:checked');
            if (checkboxes.length === 0) { Toast.warning('Chưa chọn học viên'); return; }
            
            const selectedIds = Array.from(checkboxes).map(c => c.value);
            const toImport = window.StudentsPage._oldStudentsData.filter(s => selectedIds.includes(s.id));
            
            const newData = toImport.map(s => {
                const { id, classIds, academicYear, createdAt, updatedAt, ...rest } = s;
                return { ...rest, classIds: [] };
            });

            Toast.info('Đang copy...');
            try {
                await DB.addStudentsBatch(newData);
                Modal.close();
                Toast.success(`Đã chuyển ${newData.length} học viên sang năm ${window.currentAcademicYear || '2026-2027'}`);
                students = await DB.getStudents();
                Router.navigate(Router.currentPage);
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

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
            const predefSubjects = ['Toán', 'Văn', 'Anh Văn', 'Hóa', 'Lý', 'Sử', 'Địa', 'KHTN', 'KHXH', 'AV giao tiếp', 'IELTS'];
            
            Modal.show({
                title: 'Thêm học viên mới',
                size: 'lg',
                content: `
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Họ tên *</label><input type="text" class="input" id="s-name" required></div>
                        <div class="form-group"><label class="form-label">SĐT Phụ huynh</label><input type="tel" class="input" id="s-phone"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Khối / Lớp</label><input type="text" class="input" id="s-grade" placeholder="VD: Lớp 12, Tiền tiểu học" oninput="StudentsPage.autoFillFees()"></div>
                        <div class="form-group"><label class="form-label">Trường</label><input type="text" class="input" id="s-school"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Ngày nhập học</label><input type="date" class="input" id="s-enrollment-date" value="${DB.today()}"></div>
                        <div class="form-group"><label class="form-label">Giới tính</label>
                            <select class="select" id="s-gender">
                                <option value="">Chưa xác định</option>
                                <option value="male">Nam</option>
                                <option value="female">Nữ</option>
                            </select>
                        </div>
                        <div class="form-group"><label class="form-label">Trạng thái</label>
                            <select class="select" id="s-status">
                                <option value="active">Đang học</option>
                                <option value="pending">Chờ sắp lớp</option>
                            </select>
                        </div>
                    </div>
                    <hr style="margin:16px 0;border:none;border-top:1px solid var(--border-color);">
                    <div class="form-group">
                        <label class="form-label" style="display:flex;justify-content:space-between;">
                            <span>Môn học đăng ký</span>
                            <button class="btn btn-ghost btn-sm" onclick="StudentsPage.addCustomSubject()"><i data-lucide="plus"></i> Thêm môn</button>
                        </label>
                        <div id="s-subjects-container" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
                            ${predefSubjects.map((sub, i) => `
                                <div style="display:flex;align-items:center;gap:8px;background:var(--bg-glass);padding:8px;border-radius:6px;border:1px solid var(--border-color);">
                                    <label class="checkbox-label" style="margin:0;min-width:100px;">
                                        <input type="checkbox" class="subj-cb" value="${sub}" onchange="StudentsPage.toggleSubject(this, 'fee-${i}')"> ${sub}
                                    </label>
                                    <input type="number" class="input subj-fee" id="fee-${i}" placeholder="Học phí gốc" style="display:none;flex:1;padding:4px 8px;font-size:13px;" oninput="StudentsPage.calcTuition()">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-row" style="margin-top:16px;background:var(--primary-50);padding:12px;border-radius:8px;">
                        <div class="form-group">
                            <label class="form-label">Ưu đãi học phí</label>
                            <select class="select" id="s-discount" onchange="StudentsPage.calcTuition()">
                                <option value="0">Không có ưu đãi</option>
                                <option value="0.05">Ưu đãi HP 5% khi đăng ký 2 môn</option>
                                <option value="0.10">Ưu đãi HP 10% khi đăng ký từ 3 môn</option>
                                <option value="0.05">Ưu đãi nhóm 5% khi đăng ký từ 3 HS</option>
                                <option value="0.20">Ưu đãi nhóm 20% khi đăng ký từ 5 HS</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Thành tiền cần thu (VNĐ)</label>
                            <input type="text" class="input" id="s-total" readonly style="background:var(--bg-color);font-weight:bold;color:var(--primary-600);">
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:16px;"><label class="form-label">Ghi chú</label><textarea class="textarea" id="s-notes" rows="2"></textarea></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="StudentsPage.saveNew()">Lưu học viên</button>`
            });
            if (window.lucide) lucide.createIcons();
        },

        addCustomSubject() {
            const container = document.getElementById('s-subjects-container');
            const name = prompt('Nhập tên môn học mới:');
            if (!name) return;
            const idx = Date.now();
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;align-items:center;gap:8px;background:var(--bg-glass);padding:8px;border-radius:6px;border:1px solid var(--border-color);';
            div.innerHTML = `
                <label class="checkbox-label" style="margin:0;min-width:100px;">
                    <input type="checkbox" class="subj-cb" value="${name}" checked onchange="StudentsPage.toggleSubject(this, 'fee-${idx}')"> ${name}
                </label>
                <input type="number" class="input subj-fee" id="fee-${idx}" placeholder="Học phí gốc" style="flex:1;padding:4px 8px;font-size:13px;" oninput="StudentsPage.calcTuition()">
            `;
            container.appendChild(div);
        },

        toggleSubject(cb, feeId) {
            const input = document.getElementById(feeId);
            if (input) {
                input.style.display = cb.checked ? 'block' : 'none';
                if (!cb.checked) {
                    input.value = '';
                } else {
                    const gradeText = (document.getElementById('s-grade')?.value || '').trim();
                    const grade = gradeText.replace(/lớp/i, '').trim();
                    const className = `${cb.value} ${grade}`.trim();
                    const cls = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
                    if (cls && cls.fee) {
                        input.value = cls.fee;
                    }
                }
                this.calcTuition();
            }
        },

        autoFillFees() {
            const gradeText = document.getElementById('s-grade').value.trim();
            const grade = gradeText.replace(/lớp/i, '').trim();
            if (!grade) return;
            
            document.querySelectorAll('.subj-cb:checked').forEach(cb => {
                const feeInput = cb.parentElement.nextElementSibling;
                const className = `${cb.value} ${grade}`.trim();
                const cls = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
                if (cls && cls.fee) {
                    feeInput.value = cls.fee;
                }
            });
            this.calcTuition();
        },

        calcTuition() {
            let total = 0;
            document.querySelectorAll('.subj-fee').forEach(inp => {
                if (inp.style.display !== 'none' && inp.value) {
                    total += parseInt(inp.value) || 0;
                }
            });
            const discountRate = parseFloat(document.getElementById('s-discount').value) || 0;
            const finalAmount = Math.round(total * (1 - discountRate));
            document.getElementById('s-total').value = DB.formatCurrency(finalAmount);
            document.getElementById('s-total').dataset.val = finalAmount;
        },

        async saveNew() {
            const name = document.getElementById('s-name').value.trim();
            if (!name) { Toast.warning('Vui lòng nhập họ tên'); return; }
            
            const gradeText = document.getElementById('s-grade').value.trim();
            if (!gradeText) { Toast.warning('Vui lòng nhập Khối/Lớp'); return; }
            
            const grade = gradeText.replace(/lớp/i, '').trim();

            const selectedSubjects = [];
            document.querySelectorAll('.subj-cb:checked').forEach(cb => {
                const feeInput = cb.parentElement.nextElementSibling;
                selectedSubjects.push({
                    name: cb.value,
                    fee: parseInt(feeInput.value) || 0
                });
            });

            if (selectedSubjects.length === 0) {
                Toast.warning('Vui lòng chọn ít nhất 1 môn học'); return;
            }

            try {
                // Create classes if missing
                const classIds = [];
                const classNames = [];
                for (const subj of selectedSubjects) {
                    const className = `${subj.name} ${grade}`.trim();
                    let cls = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
                    if (!cls) {
                        const newCls = await DB.addClass({ name: className, subject: subj.name, fee: subj.fee, room: '', notes: '', status: 'active', teacherIds: [] });
                        cls = { id: newCls.id, name: className, fee: subj.fee };
                        classes.push(cls);
                    }
                    classIds.push(cls.id);
                    classNames.push(className);
                }

                // Add student
                const student = await DB.addStudent({
                    name, 
                    school: document.getElementById('s-school').value.trim(),
                    grade: gradeText,
                    parentPhone: document.getElementById('s-phone').value || '', 
                    enrollmentDate: document.getElementById('s-enrollment-date').value,
                    gender: document.getElementById('s-gender').value,
                    status: document.getElementById('s-status').value, 
                    classIds, 
                    notes: document.getElementById('s-notes').value || '' 
                });

                // Add tuition
                const finalAmount = parseInt(document.getElementById('s-total').dataset.val) || 0;
                if (finalAmount > 0) {
                    const discountText = document.getElementById('s-discount').options[document.getElementById('s-discount').selectedIndex].text;
                    const discountNote = discountText !== 'Không có ưu đãi' ? ` (${discountText})` : '';
                    await DB.addTuition({
                        studentId: student.id, // wait, addStudent doesn't return id? Let's check firestore.js
                        studentName: name,
                        classId: 'Nhiều môn',
                        amount: finalAmount,
                        dueDate: DB.today(), // Default due today
                        status: 'pending',
                        note: `ĐK môn: ${classNames.join(', ')}${discountNote}`
                    });
                }

                Modal.close();
                Toast.success('Đã thêm học viên', name);
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
                        <div class="form-group"><label class="form-label">SĐT Phụ huynh</label><input type="tel" class="input" id="s-phone" value="${s.parentPhone || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Khối / Lớp</label><input type="text" class="input" id="s-grade" value="${s.grade || ''}" placeholder="VD: Lớp 12, Tiền tiểu học"></div>
                        <div class="form-group"><label class="form-label">Trường</label><input type="text" class="input" id="s-school" value="${s.school || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Ngày nhập học</label><input type="date" class="input" id="s-enrollment-date" value="${s.enrollmentDate || DB.today()}"></div>
                        <div class="form-group"><label class="form-label">Giới tính</label>
                            <select class="select" id="s-gender">
                                <option value="" ${!s.gender ? 'selected' : ''}>Chưa xác định</option>
                                <option value="male" ${s.gender === 'male' ? 'selected' : ''}>Nam</option>
                                <option value="female" ${s.gender === 'female' ? 'selected' : ''}>Nữ</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Trạng thái</label>
                            <select class="select" id="s-status">
                                <option value="active" ${s.status === 'active' ? 'selected' : ''}>Đang học</option>
                                <option value="pending" ${s.status === 'pending' ? 'selected' : ''}>Chờ sắp lớp</option>
                                <option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Nghỉ học</option>
                            </select>
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
                await DB.updateStudent(id, { 
                    name, 
                    school: document.getElementById('s-school').value.trim(),
                    grade: document.getElementById('s-grade').value.trim(),
                    parentPhone: document.getElementById('s-phone').value || '', 
                    enrollmentDate: document.getElementById('s-enrollment-date').value,
                    gender: document.getElementById('s-gender').value,
                    status: document.getElementById('s-status').value, 
                    classIds, 
                    notes: document.getElementById('s-notes').value || '' 
                });
                Modal.close();
                Toast.success('Đã cập nhật');
                students = await DB.getStudents();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        // === DELETE ===
        remove(id, name) {
            Modal.confirm({ title: 'Xóa học viên', message: `Bạn có chắc muốn xóa học viên <strong>${name}</strong>?`, confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                try {
                    await DB.deleteStudent(id);
                    students = await DB.getStudents();
                    renderTable();
                    Toast.success('Đã xóa học viên');
                } catch(e) { Toast.error('Lỗi', e.message); }
            });
        },

        async showReport(id) {
            const s = students.find(st => st.id === id);
            if (!s || !s.classIds || s.classIds.length === 0) {
                Toast.warning('Học viên chưa có lớp học nào');
                return;
            }

            Modal.show({
                title: `Báo cáo học tập: ${s.name}`,
                size: 'lg',
                content: `<div style="text-align:center;padding:32px;"><div class="spinner"></div><p>Đang tải dữ liệu điểm số...</p></div>`,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Đóng</button>`
            });

            try {
                const allGrades = [];
                for (const cid of s.classIds) {
                    const classGrades = await DB.getGrades(cid);
                    allGrades.push(...classGrades.map(g => ({...g, className: getClassNames([cid])})));
                }

                const studentExams = allGrades.filter(g => g.scores && g.scores[s.id] !== undefined);

                if (studentExams.length === 0) {
                    const mBody = document.getElementById('active-modal')?.querySelector('.modal-body');
                    if(mBody) mBody.innerHTML = `<div class="empty-state"><p>Chưa có dữ liệu điểm số nào.</p></div>`;
                    return;
                }

                const subjectStats = {};
                studentExams.forEach(g => {
                    const cname = g.className;
                    if (!subjectStats[cname]) subjectStats[cname] = [];
                    subjectStats[cname].push({
                        examName: g.examName,
                        date: g.date,
                        score: parseFloat(g.scores[s.id]),
                        maxScore: g.maxScore || 10,
                        comment: g.comments ? (g.comments[s.id] || '') : ''
                    });
                });

                let html = '<div style="max-height:60vh;overflow-y:auto;padding-right:8px;">';

                for (const [subj, exams] of Object.entries(subjectStats)) {
                    exams.sort((a,b) => new Date(a.date) - new Date(b.date));
                    
                    let progressText = 'Chưa đủ dữ liệu đánh giá';
                    let progressColor = 'var(--text-secondary)';
                    
                    const majorExams = exams.filter(e => ['GK1','CK1','GK2','CK2'].some(k => e.examName.includes(k)));
                    if (majorExams.length >= 2) {
                        const first = majorExams[0];
                        const last = majorExams[majorExams.length - 1];
                        const firstPct = first.score / first.maxScore;
                        const lastPct = last.score / last.maxScore;
                        if (lastPct - firstPct >= 0.1) { progressText = '📈 Có tiến bộ'; progressColor = 'var(--success-500)'; }
                        else if (lastPct - firstPct <= -0.1) { progressText = '📉 Sa sút, cần chú ý'; progressColor = 'var(--danger-500)'; }
                        else { progressText = '➡️ Phong độ ổn định'; progressColor = 'var(--info-500)'; }
                    }

                    html += `
                        <div class="card mb-4" style="background:var(--bg-glass);">
                            <div class="card-header" style="padding:12px 16px;background:var(--bg-color);border-bottom:1px solid var(--border-color);">
                                <h4 style="margin:0;font-size:15px;display:flex;justify-content:space-between;">
                                    <span>${subj}</span>
                                    <span style="font-size:13px;font-weight:normal;color:${progressColor}">${progressText}</span>
                                </h4>
                            </div>
                            <div class="table-container" style="border:none;">
                                <table style="margin:0;">
                                    <thead><tr><th style="padding:8px 16px;">Kỳ thi</th><th style="padding:8px 16px;">Điểm</th><th style="padding:8px 16px;">Nhận xét của GV</th></tr></thead>
                                    <tbody>
                                        ${exams.map(e => {
                                            const isTN = e.examName.includes('Tại TN') || e.examName.includes('Làm bài tại TN');
                                            const scoreColor = (e.score/e.maxScore) >= 0.8 ? 'var(--success-500)' : (e.score/e.maxScore) >= 0.5 ? 'var(--warning-500)' : 'var(--danger-500)';
                                            return `
                                            <tr style="${isTN ? 'opacity:0.8;' : 'font-weight:500;'}">
                                                <td style="padding:8px 16px;">${e.examName} <br><small style="color:var(--text-secondary);font-weight:normal;">${DB.formatDate(e.date)}</small></td>
                                                <td style="padding:8px 16px;color:${scoreColor};">${e.score}/${e.maxScore}</td>
                                                <td style="padding:8px 16px;font-size:13px;">${e.comment || '—'}</td>
                                            </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
                html += '</div>';

                const modalBody = document.getElementById('active-modal').querySelector('.modal-body');
                if (modalBody) modalBody.innerHTML = html;

            } catch (e) {
                console.error(e);
                const mBody = document.getElementById('active-modal')?.querySelector('.modal-body');
                if(mBody) mBody.innerHTML = `<div class="empty-state"><p class="text-danger">Lỗi tải dữ liệu: ${e.message}</p></div>`;
            }
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
                            Cột A: Họ tên | Cột B: Khối | Cột C: Trường | Cột D trở đi: Các môn học | Cột chứa chữ "SĐT": SĐT Phụ huynh<br>
                            <em>Dữ liệu học viên bắt đầu từ dòng 3 (2 dòng đầu là tiêu đề môn học). Hệ thống tự động ghép môn và khối để tạo lớp.</em>
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

                    if (rows.length < 3) {
                        Toast.warning('File không hợp lệ', 'File Excel phải có ít nhất 2 dòng tiêu đề và 1 dòng dữ liệu');
                        return;
                    }

                    // Map subjects dynamically from Row 2 (index 1)
                    // We assume columns D (index 3) onwards are subjects, until we hit "SĐT" column or end of data
                    const row1 = rows[0] || [];
                    const row2 = rows[1] || [];
                    
                    // Find phone column index
                    let phoneColIdx = -1;
                    for (let i = 0; i < row1.length; i++) {
                        if (String(row1[i]).toLowerCase().includes('sđt')) { phoneColIdx = i; break; }
                    }
                    if (phoneColIdx === -1) {
                        for (let i = 0; i < row2.length; i++) {
                            if (String(row2[i]).toLowerCase().includes('sđt')) { phoneColIdx = i; break; }
                        }
                    }
                    if (phoneColIdx === -1) phoneColIdx = row2.length; // fallback

                    const subjectsMap = []; // { index, name }
                    for (let i = 3; i < phoneColIdx; i++) {
                        if (row2[i]) subjectsMap.push({ index: i, name: String(row2[i]).trim() });
                    }

                    // Parse data from Row 3 (index 2)
                    const data = rows.slice(2).filter(r => r[0]).map(r => {
                        const name = String(r[0] || '').trim();
                        const gradeText = String(r[1] || '').trim();
                        let grade = gradeText.replace(/lớp/i, '').trim(); // "Lớp 3" -> "3", "Tiền tiểu học" -> "Tiền tiểu học"
                        const school = String(r[2] || '').trim();
                        const phone = r[phoneColIdx] ? String(r[phoneColIdx]).trim() : '';

                        const registeredClasses = [];
                        subjectsMap.forEach(subj => {
                            if (r[subj.index]) {
                                // e.g. "Toán" + "12" = "Toán 12"
                                // If grade is text like "Tiền tiểu học", it becomes "AV giao tiếp Tiền tiểu học"
                                const className = `${subj.name} ${grade}`.trim();
                                registeredClasses.push(className);
                            }
                        });

                        return {
                            name, school, grade: gradeText,
                            parentPhone: phone,
                            registeredClasses
                        };
                    });

                    this._importData = data;

                    const preview = document.getElementById('excel-preview');
                    preview.innerHTML = `
                        <p style="font-size:13px;color:var(--success-400);margin-bottom:8px;">✅ Tìm thấy <strong>${data.length}</strong> học viên</p>
                        <div class="table-container" style="max-height:300px;overflow-y:auto;">
                            <table>
                                <thead><tr><th>Họ tên</th><th>Trường</th><th>SĐT</th><th>Đăng ký lớp</th></tr></thead>
                                <tbody>${data.slice(0, 50).map(d => `<tr>
                                    <td>${d.name}</td>
                                    <td>${d.school}</td>
                                    <td>${d.parentPhone}</td>
                                    <td class="text-sm">${d.registeredClasses.map(c => `<span class="badge badge-info">${c}</span>`).join(' ')}</td>
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
                // 1. Gather all required classes and create missing ones
                const allRequiredClasses = new Set();
                this._importData.forEach(d => d.registeredClasses.forEach(c => allRequiredClasses.add(c)));
                
                const existingClassNames = classes.map(c => c.name.toLowerCase());
                const classesToCreate = Array.from(allRequiredClasses).filter(c => !existingClassNames.includes(c.toLowerCase()));
                
                for (const className of classesToCreate) {
                    await DB.addClass({ name: className, subject: className.split(' ')[0], fee: 0, room: '', notes: 'Tạo tự động từ Excel', status: 'active', teacherIds: [] });
                }
                
                // Refresh classes list
                if (classesToCreate.length > 0) classes = await DB.getClasses();

                // 2. Prepare students data
                const studentsToAdd = this._importData.map(d => {
                    const classIds = [];
                    d.registeredClasses.forEach(className => {
                        const cls = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
                        if (cls) classIds.push(cls.id);
                    });
                    return { 
                        name: d.name, 
                        school: d.school,
                        grade: d.grade,
                        parentPhone: d.parentPhone, 
                        classIds, 
                        status: 'active',
                        dateOfBirth: '',
                        notes: d.school ? `Trường: ${d.school}` : ''
                    };
                });

                // 3. Batch add (Firestore batch limit = 500)
                for (let i = 0; i < studentsToAdd.length; i += 450) {
                    const chunk = studentsToAdd.slice(i, i + 450);
                    await DB.addStudentsBatch(chunk);
                }

                Modal.close();
                Toast.success('Thành công', `Đã nhập ${studentsToAdd.length} học viên và tạo ${classesToCreate.length} lớp mới.`);
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
