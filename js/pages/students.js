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
    let filterStatus = '';
    let searchTerm = '';

    function getFiltered() {
        let list = students;
        if (filterClass) list = list.filter(s => s.classIds && s.classIds.includes(filterClass));
        if (filterStatus === 'active_assigned') {
            list = list.filter(s => s.status === 'active' && s.classIds && s.classIds.length > 0);
        } else if (filterStatus === 'unassigned') {
            list = list.filter(s => s.status === 'pending' || (s.status !== 'inactive' && (!s.classIds || s.classIds.length === 0)));
        } else if (filterStatus === 'inactive') {
            list = list.filter(s => s.status === 'inactive');
        } else if (filterStatus === 'active') {
            list = list.filter(s => s.status === 'active');
        }
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.parentPhone || '').includes(q));
        }
        
        const sortedList = [...list];
        sortedList.sort((a, b) => {
            const getGradeNum = (str) => {
                if (!str) return 999;
                const match = str.match(/\d+/);
                return match ? parseInt(match[0], 10) : 999;
            };
            const gradeA = getGradeNum(a.grade);
            const gradeB = getGradeNum(b.grade);
            if (gradeA !== gradeB) return gradeA - gradeB;
            return (a.name || '').localeCompare(b.name || '');
        });
        return sortedList;
    }

    function getClassNames(classIds) {
        if (!classIds || classIds.length === 0) return '—';
        return classIds.map(id => {
            const c = classes.find(cl => cl.id === id);
            return c ? c.name : '';
        }).filter(Boolean).join(', ') || '—';
    }

    function renderClassCheckboxes(selectedIds, customFees = {}) {
        const ids = selectedIds || [];
        return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;" id="s-classes">
                ${classes.map(c => `
                    <div style="display:flex;align-items:center;gap:8px;background:var(--bg-glass);padding:8px;border-radius:6px;border:1px solid var(--border-color);">
                        <label class="checkbox-label" style="margin:0;min-width:100px;">
                            <input type="checkbox" class="edit-class-cb" value="${c.id}" ${ids.includes(c.id) ? 'checked' : ''} onchange="document.getElementById('edit-fee-${c.id}').style.display = this.checked ? 'block' : 'none'; StudentsPage.calcTuition();"> ${c.name}
                        </label>
                        <input type="number" class="input edit-class-fee" id="edit-fee-${c.id}" value="${customFees[c.id] !== undefined ? customFees[c.id] : (c.fee || 0)}" style="display:${ids.includes(c.id) ? 'block' : 'none'};flex:1;padding:4px 8px;font-size:13px;" placeholder="Học phí gốc" oninput="StudentsPage.calcTuition()">
                    </div>
                `).join('')}
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
            tbody.innerHTML = `<tr><td colspan="${canEdit ? 9 : 8}"><div class="empty-state"><h3>Chưa có học viên</h3><p>Nhấn "Thêm học viên" để bắt đầu hoặc chọn bộ lọc khác</p></div></td></tr>`;
        } else {
            tbody.innerHTML = filtered.map((s, i) => {
                const hasClass = s.classIds && s.classIds.length > 0;
                let statusBadge = '';
                if (s.status === 'inactive') {
                    statusBadge = '<span class="badge badge-danger">Nghỉ học</span>';
                } else if (s.status === 'pending' || !hasClass) {
                    statusBadge = '<span class="badge badge-warning" title="Chưa được gán vào lớp học nào">Chờ sắp lớp</span>';
                } else {
                    statusBadge = '<span class="badge badge-success">Đang học</span>';
                }

                return `<tr>
                    ${canEdit ? `<td><input type="checkbox" class="student-cb" value="${s.id}" onchange="StudentsPage.toggleBulk()"></td>` : ''}
                    <td>${i + 1}</td>
                    <td><strong>${s.name || ''}</strong></td>
                    <td>${s.grade || '—'}</td>
                    <td>${s.school || '—'}</td>
                    <td>${s.parentPhone || '—'}</td>
                    <td>${getClassNames(s.classIds)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="table-actions">
                            ${isOwnerAdmin ? `<button class="btn-icon" title="Báo cáo học tập" onclick="StudentsPage.showReport('${s.id}')"><i data-lucide="line-chart"></i></button>` : ''}
                            ${canEdit ? `
                                <button class="btn-icon" title="Sửa" onclick="StudentsPage.edit('${s.id}')"><i data-lucide="pencil"></i></button>
                                <button class="btn-icon" title="Xóa" onclick="StudentsPage.remove('${s.id}', '${(s.name || '').replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i></button>
                            ` : ''}
                        </div>
                    </td>
                </tr>`;
            }).join('');
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
    const studyingStudents = students.filter(s => s.status === 'active' && s.classIds && s.classIds.length > 0).length;
    const unassignedStudents = students.filter(s => s.status === 'pending' || (s.status !== 'inactive' && (!s.classIds || s.classIds.length === 0))).length;
    const inactiveStudents = students.filter(s => s.status === 'inactive').length;

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

    let dashboardHTML = '<div class="stats-grid mb-6" style="grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));">';
    if (isOwnerAdmin) {
        dashboardHTML += `
            <div class="stat-card" style="display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                    <div class="stat-label" style="font-weight:600;margin-bottom:2px;">Tổng học viên toàn trung tâm</div>
                    <div style="display:flex;align-items:baseline;gap:8px;">
                        <span class="stat-value" style="font-size:2rem;font-weight:800;color:var(--primary-600);">${totalStudents}</span>
                        <span style="font-size:13px;color:var(--text-muted);">trong hệ thống</span>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:${inactiveStudents > 0 ? 'repeat(3, 1fr)' : '1fr 1fr'};gap:6px;margin-top:12px;padding-top:10px;border-top:1px dashed var(--border-color);font-size:12px;">
                    <div style="background:rgba(34,197,94,0.08);padding:6px 8px;border-radius:6px;border-left:3px solid var(--success-500);cursor:pointer;transition:background 0.15s;" onclick="StudentsPage.filterByStatus('active_assigned')" title="Bấm để lọc danh sách đang học">
                        <span style="color:var(--text-muted);display:block;font-size:11px;">Đang học</span>
                        <strong style="font-size:14px;color:var(--success-600);">${studyingStudents} HV</strong>
                    </div>
                    <div style="background:rgba(245,158,11,0.08);padding:6px 8px;border-radius:6px;border-left:3px solid var(--warning-500);cursor:pointer;transition:background 0.15s;" onclick="StudentsPage.filterByStatus('unassigned')" title="Bấm để lọc danh sách chưa xếp lớp">
                        <span style="color:var(--text-muted);display:block;font-size:11px;">Chờ lớp</span>
                        <strong style="font-size:14px;color:var(--warning-600);">${unassignedStudents} HV</strong>
                    </div>
                    ${inactiveStudents > 0 ? `
                        <div style="background:rgba(239,68,68,0.08);padding:6px 8px;border-radius:6px;border-left:3px solid var(--danger-500);cursor:pointer;transition:background 0.15s;" onclick="StudentsPage.filterByStatus('inactive')" title="Bấm để lọc danh sách nghỉ học">
                            <span style="color:var(--text-muted);display:block;font-size:11px;">Đã nghỉ</span>
                            <strong style="font-size:14px;color:var(--danger-600);">${inactiveStudents} HV</strong>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-label mb-2" style="font-weight:600;color:var(--text-color);">Học viên theo khối</div>
                <div style="max-height:105px;overflow-y:auto;font-size:13px;padding-right:8px;">
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
            <div style="max-height:105px;overflow-y:auto;font-size:13px;padding-right:8px;">
                ${topSchools.length > 0 ? topSchools.map(([school, count], idx) => `
                    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);">
                        <span>${idx + 1}. ${school}</span><strong>${count} hs</strong>
                    </div>
                `).join('') : '<div class="text-secondary">Chưa có dữ liệu</div>'}
            </div>
        </div>
    </div>`;

    let subtitleParts = [`${studyingStudents} đang học (có lớp)`, `${unassignedStudents} chờ sắp lớp`];
    if (inactiveStudents > 0) subtitleParts.push(`${inactiveStudents} đã nghỉ`);
    const subtitleText = `${subtitleParts.join(' • ')} (Tổng: ${students.length} học viên)`;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="users"></i> Quản lý Học viên</h1>
                <p class="page-subtitle">${subtitleText}</p>
            </div>
            <div class="page-actions" style="display:flex;gap:8px;">
                <button class="btn btn-secondary" onclick="StudentsPage.showExportModal()"><i data-lucide="file-spreadsheet"></i> Xuất Excel</button>
                ${canEdit ? `
                    <button class="btn btn-secondary" onclick="StudentsPage.showImportOldYear()"><i data-lucide="history"></i> Nhập từ năm cũ</button>
                    <button class="btn btn-secondary" onclick="StudentsPage.showImportExcel()"><i data-lucide="upload"></i> Nhập từ Excel</button>
                    <button class="btn btn-primary" onclick="StudentsPage.showAdd()"><i data-lucide="plus"></i> Thêm học viên</button>
                ` : ''}
            </div>
        </div>

        ${dashboardHTML}

        <div class="filter-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <div class="search-box" style="flex:1;min-width:200px;">
                <i data-lucide="search"></i>
                <input type="text" class="input" placeholder="Tìm theo tên, SĐT..." oninput="StudentsPage.search(this.value)">
            </div>
            <select class="select" id="filter-status-select" style="max-width:210px;" onchange="StudentsPage.filterByStatus(this.value)">
                <option value="">Tất cả trạng thái (${totalStudents})</option>
                <option value="active_assigned">🟢 Đang học (Có lớp: ${studyingStudents})</option>
                <option value="unassigned">🟡 Chờ sắp lớp (${unassignedStudents})</option>
                ${inactiveStudents > 0 ? `<option value="inactive">🔴 Đã nghỉ học (${inactiveStudents})</option>` : ''}
            </select>
            <select class="select" style="max-width:200px;" onchange="StudentsPage.filterByClass(this.value)">
                <option value="">Tất cả lớp (${classes.length})</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
        </div>

        <div id="bulk-toolbar" style="display:none; padding:12px; background:var(--bg-glass); border-radius:var(--radius-md); margin-bottom:16px; align-items:center; justify-content:space-between; border:1px solid var(--border-color);">
            <div><strong id="bulk-count" style="color:var(--primary-600);">0</strong> học viên được chọn</div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="StudentsPage.bulkUpdateClass()"><i data-lucide="book-open"></i> Sửa Lớp</button>
                <button class="btn btn-secondary btn-sm" onclick="StudentsPage.bulkUpdateInfo()"><i data-lucide="edit"></i> Sửa Thông tin</button>
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
        filterByStatus(val) {
            filterStatus = val;
            const sel = document.getElementById('filter-status-select');
            if (sel) sel.value = val;
            renderTable();
        },

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
        bulkUpdateInfo() {
            const checked = Array.from(document.querySelectorAll('.student-cb:checked')).map(c => c.value);
            if (checked.length === 0) return;
            
            Modal.show({
                title: 'Cập nhật thông tin hàng loạt',
                content: `
                    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Đang chọn <strong>${checked.length}</strong> học viên. Bỏ trống hoặc chọn "Giữ nguyên" với thông tin không muốn thay đổi.</p>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Trạng thái mới</label>
                            <select class="select" id="bulk-status">
                                <option value="">-- Giữ nguyên --</option>
                                <option value="active">Đang học</option>
                                <option value="pending">Chờ sắp lớp</option>
                                <option value="inactive">Nghỉ học</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày nhập học</label>
                            <input type="date" class="input" id="bulk-enrollment-date">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Ưu đãi học phí</label>
                            <select class="select" id="bulk-discount">
                                <option value="">-- Giữ nguyên --</option>
                                <option value="0">Không có ưu đãi</option>
                                <option value="0.05">Ưu đãi 5% (Nhóm 2 HS hoặc 2 môn)</option>
                                <option value="0.10">Ưu đãi 10% (Nhóm 3 HS hoặc từ 3 môn)</option>
                                <option value="0.20">Ưu đãi 20% (Nhóm từ 5 HS)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Khối / Lớp</label>
                            <input type="text" class="input" id="bulk-grade" placeholder="Bỏ trống để giữ nguyên, vd: 8">
                        </div>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                         <button class="btn btn-primary" onclick="StudentsPage.saveBulkInfo()">Cập nhật</button>`
            });
        },
        async saveBulkInfo() {
            const checkedIds = Array.from(document.querySelectorAll('.student-cb:checked')).map(c => c.value);
            const status = document.getElementById('bulk-status').value;
            const enrollmentDate = document.getElementById('bulk-enrollment-date').value;
            const discountStr = document.getElementById('bulk-discount').value;
            const gradeText = document.getElementById('bulk-grade').value.trim();
            
            const updates = {};
            if (status) updates.status = status;
            if (enrollmentDate) updates.enrollmentDate = enrollmentDate;
            if (discountStr !== "") updates.discount = parseFloat(discountStr);
            if (gradeText) updates.grade = gradeText;
            
            if (Object.keys(updates).length === 0) {
                Modal.close();
                return;
            }

            Toast.info('Đang cập nhật...');
            try {
                const batch = window.db.batch();
                checkedIds.forEach(id => {
                    const ref = window.db.collection('students').doc(id);
                    batch.update(ref, updates);
                });
                await batch.commit();
                Modal.close();
                Toast.success('Đã cập nhật thông tin');
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
            const year = window.currentAcademicYear || '2026 - 2027';
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
                Toast.success(`Đã chuyển ${newData.length} học viên sang năm ${window.currentAcademicYear || '2026 - 2027'}`);
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
                        <div class="form-group"><label class="form-label">Số định danh / CCCD</label><input type="text" class="input" id="s-national-id" placeholder="Mã định danh học sinh"></div>
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
                                <option value="0.05">Ưu đãi 5% (Nhóm 2 HS hoặc 2 môn)</option>
                                <option value="0.10">Ưu đãi 10% (Nhóm 3 HS hoặc từ 3 môn)</option>
                                <option value="0.20">Ưu đãi 20% (Nhóm từ 5 HS)</option>
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

        getDefaultFee(gradeStr) {
            const match = gradeStr.match(/\d+/);
            if (!match) return 0;
            const g = parseInt(match[0]);
            if (g >= 1 && g <= 5) return 500000;
            if (g === 6) return 525000;
            if (g === 7) return 550000;
            if (g === 8) return 575000;
            if (g === 9) return 600000;
            if (g === 10) return 625000;
            if (g === 11) return 650000;
            if (g === 12) return 675000;
            return 0;
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
                    } else {
                        const defaultFee = StudentsPage.getDefaultFee(gradeText);
                        if (defaultFee > 0) input.value = defaultFee;
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
                } else {
                    const defaultFee = StudentsPage.getDefaultFee(gradeText);
                    if (defaultFee > 0) feeInput.value = defaultFee;
                }
            });
            this.calcTuition();
        },

        calcTuition() {
            let total = 0;
            document.querySelectorAll('.subj-fee, .edit-class-fee').forEach(inp => {
                if (inp.style.display !== 'none' && inp.value) {
                    total += parseInt(inp.value) || 0;
                }
            });
            const discountSelect = document.getElementById('s-discount');
            const discountRate = discountSelect ? parseFloat(discountSelect.value) || 0 : 0;
            let finalAmount = Math.round(total * (1 - discountRate));
            finalAmount = DB.roundTuition(finalAmount);
            const totalInput = document.getElementById('s-total');
            if (totalInput) {
                totalInput.value = DB.formatCurrency(finalAmount);
                totalInput.dataset.val = finalAmount;
            }
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
                    nationalId: document.getElementById('s-national-id')?.value.trim() || '',
                    parentPhone: document.getElementById('s-phone').value || '', 
                    enrollmentDate: document.getElementById('s-enrollment-date').value,
                    gender: document.getElementById('s-gender').value,
                    status: document.getElementById('s-status').value, 
                    discount: parseFloat(document.getElementById('s-discount').value) || 0,
                    classIds, 
                    notes: document.getElementById('s-notes').value || '' 
                });

                Modal.close();
                students = await DB.getStudents();
                renderTable();

                // Prompt to create tuition
                const finalAmount = parseInt(document.getElementById('s-total').dataset.val) || 0;
                if (finalAmount > 0) {
                    const discountText = document.getElementById('s-discount').options[document.getElementById('s-discount').selectedIndex].text;
                    const discountNote = discountText !== 'Không có ưu đãi' ? ` (${discountText})` : '';
                    StudentsPage.promptGenerateTuition(student.id, name, classNames, finalAmount, discountNote);
                } else {
                    Toast.success('Đã thêm học viên', name);
                }
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        promptGenerateTuition(studentId, studentName, classNames, amount, discountNote) {
            const currentMonth = DB.currentMonth();
            Modal.show({
                title: 'Tạo học phí cho Học viên',
                content: `
                    <div class="alert alert-success" style="margin-bottom:16px;background:var(--success-50);color:var(--success-700);border:1px solid var(--success-200);padding:12px;border-radius:6px;display:flex;gap:8px;">
                        <i data-lucide="check-circle" style="color:var(--success-500);"></i> 
                        <div>Đã lưu thông tin học viên <strong>${studentName}</strong> thành công!</div>
                    </div>
                    <p style="margin-bottom:12px;font-size:14px;">Bạn có muốn tạo phiếu thu học phí ngay cho học viên này không?</p>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Số tiền (đã giảm)</label>
                            <input type="text" class="input" value="${DB.formatCurrency(amount)}" disabled style="background:var(--bg-glass);font-weight:bold;color:var(--primary-600);">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hạn đóng</label>
                            <input type="date" class="input" id="p-due-date" value="${currentMonth}-15">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <input type="text" class="input" id="p-note" value="ĐK môn: ${classNames.join(', ')}${discountNote}">
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Không tạo</button>
                    <button class="btn btn-primary" onclick="StudentsPage.confirmGenerateTuition('${studentId}', '${studentName.replace(/'/g, "\\'")}', ${amount})"><i data-lucide="coins"></i> Tạo phiếu thu</button>
                `
            });
            if (window.lucide) lucide.createIcons();
        },

        async confirmGenerateTuition(studentId, studentName, amount) {
            const dueDate = document.getElementById('p-due-date').value;
            const note = document.getElementById('p-note').value;
            if (!dueDate) return;

            try {
                await DB.addTuition({
                    studentId: studentId,
                    studentName: studentName,
                    classId: 'Nhiều môn',
                    amount: amount,
                    dueDate: dueDate,
                    status: new Date(dueDate) < new Date() ? 'overdue' : 'pending',
                    reminderSent: false,
                    note: note
                });
                Modal.close();
                Toast.success('Đã tạo học phí thành công!');
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
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
                        <div class="form-group"><label class="form-label">Số định danh / CCCD</label><input type="text" class="input" id="s-national-id" value="${s.nationalId || s.studentCode || ''}" placeholder="Mã định danh học sinh"></div>
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
                        <div class="form-group"><label class="form-label">Ưu đãi học phí</label>
                            <select class="select" id="s-discount" onchange="StudentsPage.calcTuition()">
                                <option value="0" ${!s.discount ? 'selected' : ''}>Không có ưu đãi</option>
                                <option value="0.05" ${s.discount === 0.05 ? 'selected' : ''}>Ưu đãi 5% (Nhóm 2 HS hoặc 2 môn)</option>
                                <option value="0.10" ${s.discount === 0.1 ? 'selected' : ''}>Ưu đãi 10% (Nhóm 3 HS hoặc từ 3 môn)</option>
                                <option value="0.20" ${s.discount === 0.2 ? 'selected' : ''}>Ưu đãi 20% (Nhóm từ 5 HS)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lớp học</label>
                        ${renderClassCheckboxes(s.classIds, s.customFees)}
                    </div>
                    <div class="form-row" style="margin-top:16px;background:var(--primary-50);padding:12px;border-radius:8px;">
                        <div class="form-group" style="margin-bottom:0;flex:1;">
                            <label class="form-label">Thành tiền cần thu (VNĐ) <span style="font-weight:normal;color:var(--text-secondary);font-size:12px;">(Dự kiến)</span></label>
                            <input type="text" class="input" id="s-total" readonly style="background:var(--bg-color);font-weight:bold;color:var(--primary-600);">
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><textarea class="textarea" id="s-notes" rows="2">${s.notes || ''}</textarea></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="StudentsPage.saveEdit('${id}')">Cập nhật</button>`
            });
            if (window.lucide) lucide.createIcons();
            setTimeout(() => StudentsPage.calcTuition(), 50);
        },

        async saveEdit(id) {
            const name = document.getElementById('s-name').value.trim();
            if (!name) { Toast.warning('Vui lòng nhập họ tên'); return; }
            const classIds = [];
            const customFees = {};
            document.querySelectorAll('.edit-class-cb:checked').forEach(cb => {
                classIds.push(cb.value);
                const feeInput = document.getElementById('edit-fee-' + cb.value);
                if (feeInput && feeInput.value) {
                    customFees[cb.value] = parseInt(feeInput.value, 10) || 0;
                }
            });
            try {
                await DB.updateStudent(id, { 
                    name, 
                    school: document.getElementById('s-school').value.trim(),
                    grade: document.getElementById('s-grade').value.trim(),
                    nationalId: document.getElementById('s-national-id')?.value.trim() || '',
                    parentPhone: document.getElementById('s-phone').value || '', 
                    enrollmentDate: document.getElementById('s-enrollment-date').value,
                    gender: document.getElementById('s-gender').value,
                    status: document.getElementById('s-status').value, 
                    discount: parseFloat(document.getElementById('s-discount').value) || 0,
                    classIds, 
                    customFees,
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
                    let nationalIdColIdx = -1;
                    for (let i = 0; i < row1.length; i++) {
                        const cellStr = String(row1[i] || '').toLowerCase();
                        if (cellStr.includes('sđt') || cellStr.includes('điện thoại')) { phoneColIdx = i; }
                        if (cellStr.includes('định danh') || cellStr.includes('cccd') || cellStr.includes('mã định danh')) { nationalIdColIdx = i; }
                    }
                    if (phoneColIdx === -1 || nationalIdColIdx === -1) {
                        for (let i = 0; i < row2.length; i++) {
                            const cellStr = String(row2[i] || '').toLowerCase();
                            if (phoneColIdx === -1 && (cellStr.includes('sđt') || cellStr.includes('điện thoại'))) { phoneColIdx = i; }
                            if (nationalIdColIdx === -1 && (cellStr.includes('định danh') || cellStr.includes('cccd') || cellStr.includes('mã định danh'))) { nationalIdColIdx = i; }
                        }
                    }
                    if (phoneColIdx === -1) phoneColIdx = row2.length; // fallback

                    const subjectsMap = []; // { index, name }
                    for (let i = 3; i < phoneColIdx; i++) {
                        if (row2[i] && i !== nationalIdColIdx) subjectsMap.push({ index: i, name: String(row2[i]).trim() });
                    }

                    // Parse data from Row 3 (index 2)
                    const data = rows.slice(2).filter(r => r[0]).map(r => {
                        const name = String(r[0] || '').trim();
                        const gradeText = String(r[1] || '').trim();
                        let grade = gradeText.replace(/lớp/i, '').trim(); // "Lớp 3" -> "3", "Tiền tiểu học" -> "Tiền tiểu học"
                        const school = String(r[2] || '').trim();
                        const phone = phoneColIdx < r.length && r[phoneColIdx] ? String(r[phoneColIdx]).trim() : '';
                        const nationalId = nationalIdColIdx !== -1 && r[nationalIdColIdx] ? String(r[nationalIdColIdx]).trim() : '';

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
                            nationalId: nationalId,
                            registeredClasses
                        };
                    });

                    this._importData = data;

                    const preview = document.getElementById('excel-preview');
                    preview.innerHTML = `
                        <p style="font-size:13px;color:var(--success-400);margin-bottom:8px;">✅ Tìm thấy <strong>${data.length}</strong> học viên</p>
                        <div class="table-container" style="max-height:300px;overflow-y:auto;">
                            <table>
                                <thead><tr><th>Họ tên</th><th>Trường</th><th>SĐT</th><th>Số định danh</th><th>Đăng ký lớp</th></tr></thead>
                                <tbody>${data.slice(0, 50).map(d => `<tr>
                                    <td>${d.name}</td>
                                    <td>${d.school}</td>
                                    <td>${d.parentPhone}</td>
                                    <td>${d.nationalId || '—'}</td>
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
                        nationalId: d.nationalId || '',
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
        },

        // === EXPORT EXCEL MODAL & LOGIC ===
        showExportModal() {
            const curDate = new Date();
            const curMonth = String(curDate.getMonth() + 1).padStart(2, '0');
            const curYear = curDate.getFullYear();
            const defaultMonthYear = `${curMonth}/${curYear}`;

            // Unique grades
            const gradeSet = new Set();
            students.forEach(s => {
                const g = (s.grade || '').trim().replace(/^lớp\s*/i, '');
                if (g) gradeSet.add(g);
            });
            const gradesList = Array.from(gradeSet).sort((a, b) => {
                const numA = parseInt(a, 10) || 999;
                const numB = parseInt(b, 10) || 999;
                return numA !== numB ? numA - numB : a.localeCompare(b, 'vi');
            });

            Modal.show({
                title: 'Xuất danh sách học viên theo mẫu Excel',
                size: 'md',
                content: `
                    <div style="background:var(--bg-glass);padding:14px;border-radius:8px;border:1px solid var(--border-color);margin-bottom:16px;">
                        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;">
                            Xuất danh sách học sinh theo đúng cấu trúc mẫu: <strong>STT, Họ tên, Lớp, Các cột Môn học, Học phí dự kiến từng môn, Tổng học phí/tháng, Số định danh</strong> và hàng <strong>Tổng cộng</strong>.
                        </p>
                        <div class="form-group">
                            <label class="form-label">Tiêu đề Tháng / Năm trên bảng Excel *</label>
                            <input type="text" class="input" id="exp-month-year" value="${defaultMonthYear}" placeholder="MM/YYYY (VD: 06/2026)">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Trạng thái học viên</label>
                                <select class="select" id="exp-status">
                                    <option value="active">Chỉ học viên Đang học (active)</option>
                                    <option value="all">Tất cả học viên (Đang học + Chờ lớp)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Lọc theo khối lớp</label>
                                <select class="select" id="exp-grade">
                                    <option value="">Tất cả các khối lớp</option>
                                    ${gradesList.map(g => `<option value="${g}">Khối / Lớp ${g}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);line-height:1.5;">
                        💡 <em>File tải về định dạng chuẩn <code>.xlsx</code> với đầy đủ định dạng số tiền (VD: <code>475,000 đ</code>), hợp nhất ô tiêu đề và tự động tính toán tổng cộng.</em>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="StudentsPage.exportExcel()">
                        <i data-lucide="file-spreadsheet"></i> Tải file Excel (.xlsx)
                    </button>
                `
            });
            if (window.lucide) lucide.createIcons();
        },

        exportExcel() {
            if (typeof XLSX === 'undefined') {
                Toast.error('Lỗi', 'Thư viện Excel (XLSX) chưa được tải.');
                return;
            }

            const monthYearInput = (document.getElementById('exp-month-year')?.value || '').trim() || `${String(new Date().getMonth()+1).padStart(2,'0')}/${new Date().getFullYear()}`;
            const statusFilter = document.getElementById('exp-status')?.value || 'active';
            const gradeFilter = document.getElementById('exp-grade')?.value || '';

            // Filter students
            let targetStudents = students.slice();
            if (statusFilter === 'active') {
                targetStudents = targetStudents.filter(s => s.status === 'active');
            } else if (statusFilter !== 'all') {
                targetStudents = targetStudents.filter(s => s.status === statusFilter);
            }

            if (gradeFilter) {
                targetStudents = targetStudents.filter(s => {
                    const g = (s.grade || '').trim().replace(/^lớp\s*/i, '');
                    return g === gradeFilter || s.grade === gradeFilter;
                });
            }

            // Sort students by Grade ascending (1 to 12), then by Name alphabetically
            targetStudents.sort((a, b) => {
                const gradeAStr = (a.grade || '').trim();
                const gradeBStr = (b.grade || '').trim();
                const matchA = gradeAStr.match(/\d+/);
                const matchB = gradeBStr.match(/\d+/);
                const numA = matchA ? parseInt(matchA[0], 10) : 999;
                const numB = matchB ? parseInt(matchB[0], 10) : 999;

                if (numA !== numB) return numA - numB;
                return (a.name || '').localeCompare(b.name || '', 'vi');
            });

            if (targetStudents.length === 0) {
                Toast.warning('Không có học viên', 'Không tìm thấy học viên nào phù hợp với bộ lọc.');
                return;
            }

            // Standard subject columns matching user's template
            const standardSubjects = [
                { key: 'toan', shortName: 'Toán', fullName: 'Toán', keywords: ['toán', 'math'] },
                { key: 'van', shortName: 'Văn', fullName: 'Văn', keywords: ['văn', 'ngữ văn', 'tiếng việt'] },
                { key: 'av', shortName: 'AV', fullName: 'Anh Văn', keywords: ['anh văn', 'tiếng anh', 'av', 'english', 'ielts'] },
                { key: 'ly', shortName: 'Lý', fullName: 'Lý', keywords: ['lý', 'vật lý', 'vat ly', 'ly'] },
                { key: 'hoa', shortName: 'Hóa', fullName: 'Hoá', keywords: ['hóa', 'hoá', 'hoa'] },
                { key: 'av_gt', shortName: 'Anh Văn GT', fullName: 'Anh Văn GT', keywords: ['giao tiếp', 'anh văn gt', 'av gt', 'av giao tiếp'] },
                { key: 'ai', shortName: 'Khóa AI', fullName: 'Khóa AI Cơ...', keywords: ['ai', 'khóa ai', 'tin học', 'lập trình'] }
            ];

            // Detect any other subjects present in classes
            const extraSubjects = [];
            classes.forEach(c => {
                const subjName = (c.subject || c.name || '').trim();
                const isStandard = standardSubjects.some(s => s.keywords.some(kw => subjName.toLowerCase().includes(kw)));
                if (!isStandard && subjName) {
                    const short = subjName.split(' ')[0];
                    if (!extraSubjects.some(e => e.fullName.toLowerCase() === subjName.toLowerCase())) {
                        extraSubjects.push({
                            key: 'extra_' + extraSubjects.length,
                            shortName: short,
                            fullName: subjName,
                            keywords: [subjName.toLowerCase()]
                        });
                    }
                }
            });

            const allSubjectCols = [...standardSubjects, ...extraSubjects];
            const numSubjects = allSubjectCols.length;
            const totalCols = 3 + numSubjects * 2 + 2; // STT, Họ và tên, Lớp + N (Môn) + N (Học phí) + Tổng + Số định danh

            // Helper to match student class with subject
            function getStudentClassForSubject(student, subjectObj) {
                if (!student.classIds || student.classIds.length === 0) return null;
                for (const cid of student.classIds) {
                    const cls = classes.find(c => c.id === cid);
                    if (!cls) continue;
                    const cName = (cls.name || '').toLowerCase();
                    const cSubj = (cls.subject || '').toLowerCase();
                    
                    if (subjectObj.key === 'av_gt') {
                        if (cName.includes('giao tiếp') || cName.includes('gt') || cSubj.includes('giao tiếp') || cSubj.includes('gt')) {
                            return cls;
                        }
                        continue;
                    }
                    if (subjectObj.key === 'av') {
                        if (cName.includes('giao tiếp') || cName.includes('gt') || cSubj.includes('giao tiếp') || cSubj.includes('gt')) {
                            continue;
                        }
                        if (cName.startsWith('anh') || cName.startsWith('av') || cName.startsWith('tiếng anh') || cSubj.includes('anh')) {
                            return cls;
                        }
                        continue;
                    }
                    if (subjectObj.key === 'ai') {
                        if (cName.includes('ai') || cSubj.includes('ai') || cName.includes('tin') || cName.includes('lập trình')) {
                            return cls;
                        }
                        continue;
                    }
                    if (subjectObj.keywords.some(kw => cName.startsWith(kw) || cName.includes(kw) || cSubj.includes(kw))) {
                        return cls;
                    }
                }
                return null;
            }

            // Helper to calculate subject fee for student
            function calcSubjectFee(student, subjectObj) {
                const cls = getStudentClassForSubject(student, subjectObj);
                if (!cls) return 0;
                
                let baseFee = 0;
                if (student.customFees && student.customFees[cls.id] !== undefined && student.customFees[cls.id] !== null) {
                    baseFee = parseInt(student.customFees[cls.id], 10) || 0;
                } else if (cls.fee) {
                    baseFee = parseInt(cls.fee, 10) || 0;
                } else {
                    baseFee = StudentsPage.getDefaultFee(student.grade || '');
                }

                const discount = parseFloat(student.discount) || 0;
                if (discount > 0 && baseFee > 0) {
                    return Math.round(baseFee * (1 - discount));
                }
                return baseFee;
            }

            // Helper to format student grade
            function formatStudentGrade(student) {
                let g = (student.grade || '').trim();
                g = g.replace(/^lớp\s*/i, '').trim();
                if (!g) {
                    if (student.classIds && student.classIds.length > 0) {
                        const cls = classes.find(c => student.classIds.includes(c.id));
                        if (cls) {
                            const m = cls.name.match(/\d+/);
                            if (m) g = m[0];
                        }
                    }
                }
                return g || '—';
            }

            // Build Rows (Array of Arrays)
            const aoa = [];

            // 1. Title Row
            const titleRow = [`DANH SÁCH HỌC VIÊN THÁNG ${monthYearInput}`];
            for (let i = 1; i < totalCols; i++) titleRow.push('');
            aoa.push(titleRow);

            // 2. Header Row 1
            const headerRow1 = ['STT', 'Họ và tên', 'Lớp'];
            headerRow1.push('MÔN HỌC');
            for (let i = 1; i < numSubjects; i++) headerRow1.push('');
            headerRow1.push('HỌC PHÍ DỰ KIẾN');
            for (let i = 1; i < numSubjects; i++) headerRow1.push('');
            headerRow1.push('Tổng học phí/tháng');
            headerRow1.push('Số định danh');
            aoa.push(headerRow1);

            // 3. Header Row 2
            const headerRow2 = ['', '', ''];
            allSubjectCols.forEach(s => headerRow2.push(s.shortName));
            allSubjectCols.forEach(s => headerRow2.push(s.fullName));
            headerRow2.push('');
            headerRow2.push('');
            aoa.push(headerRow2);

            // 4. Data Rows
            targetStudents.forEach((st, idx) => {
                const row = [];
                row.push(idx + 1); // STT
                row.push(st.name || ''); // Họ và tên
                row.push(formatStudentGrade(st)); // Lớp
                
                // MÔN HỌC (x or blank)
                allSubjectCols.forEach(s => {
                    const cls = getStudentClassForSubject(st, s);
                    row.push(cls ? 'x' : '');
                });

                // HỌC PHÍ DỰ KIẾN
                let totalMonthly = 0;
                allSubjectCols.forEach(s => {
                    const fee = calcSubjectFee(st, s);
                    row.push(fee); // Numeric for excel format & calculations
                    totalMonthly += fee;
                });

                // Tổng học phí/tháng
                row.push(totalMonthly);

                // Số định danh
                const idCode = st.nationalId || st.studentCode || st.idNumber || st.cccd || '0';
                row.push(idCode);

                aoa.push(row);
            });

            // 5. Summary Row: "Tổng cộng"
            const summaryRow = ['Tổng cộng', '', ''];
            allSubjectCols.forEach(s => {
                const count = targetStudents.filter(st => getStudentClassForSubject(st, s) !== null).length;
                summaryRow.push(count);
            });

            let grandTotalFee = 0;
            allSubjectCols.forEach(s => {
                let sumFee = 0;
                targetStudents.forEach(st => {
                    sumFee += calcSubjectFee(st, s);
                });
                summaryRow.push(sumFee);
                grandTotalFee += sumFee;
            });

            summaryRow.push(grandTotalFee);
            summaryRow.push('');
            aoa.push(summaryRow);

            // Create Sheet
            const ws = XLSX.utils.aoa_to_sheet(aoa);

            // Merges
            const lastRowIdx = aoa.length - 1;
            ws['!merges'] = [
                // Title Row
                { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
                // STT
                { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
                // Họ và tên
                { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
                // Lớp
                { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
                // MÔN HỌC group
                { s: { r: 1, c: 3 }, e: { r: 1, c: 3 + numSubjects - 1 } },
                // HỌC PHÍ DỰ KIẾN group
                { s: { r: 1, c: 3 + numSubjects }, e: { r: 1, c: 3 + 2 * numSubjects - 1 } },
                // Tổng học phí/tháng
                { s: { r: 1, c: 3 + 2 * numSubjects }, e: { r: 2, c: 3 + 2 * numSubjects } },
                // Số định danh
                { s: { r: 1, c: 3 + 2 * numSubjects + 1 }, e: { r: 2, c: 3 + 2 * numSubjects + 1 } },
                // Summary row label "Tổng cộng" merged across col 0 to 2
                { s: { r: lastRowIdx, c: 0 }, e: { r: lastRowIdx, c: 2 } }
            ];

            // Column Widths
            const cols = [
                { wch: 6 },   // STT
                { wch: 25 },  // Họ và tên
                { wch: 14 }   // Lớp
            ];
            for (let i = 0; i < numSubjects; i++) cols.push({ wch: 10 });
            for (let i = 0; i < numSubjects; i++) cols.push({ wch: 15 });
            cols.push({ wch: 20 }); // Tổng học phí/tháng
            cols.push({ wch: 16 }); // Số định danh
            ws['!cols'] = cols;

            // Apply currency number format to Fee columns
            for (let R = 3; R <= lastRowIdx; R++) {
                // Subject fees columns
                for (let C = 3 + numSubjects; C < 3 + 2 * numSubjects; C++) {
                    const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
                        ws[cellAddr].z = '#,##0" đ"';
                    }
                }
                // Total column
                const totalCellAddr = XLSX.utils.encode_cell({ r: R, c: 3 + 2 * numSubjects });
                if (ws[totalCellAddr] && typeof ws[totalCellAddr].v === 'number') {
                    ws[totalCellAddr].z = '#,##0" đ"';
                }
            }

            // Create Workbook and Save
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học viên');
            
            const fileName = `Danh_Sach_Hoc_Vien_${monthYearInput.replace(/\//g, '_')}.xlsx`;
            XLSX.writeFile(wb, fileName);

            Modal.close();
            Toast.success('Xuất file thành công', `Đã tải xuống file ${fileName}`);
        }
    };
});
