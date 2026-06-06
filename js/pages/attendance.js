// ============================================
// ATTENDANCE PAGE
// ============================================

Router.register('attendance', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'teacher');
    const isTeacher = Auth.isTeacher();
    const isStaff = Auth.isStaff();
    let classes = [];

    try {
        classes = isTeacher ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
    } catch(e) { console.warn(e); }

    let selectedClass = '';
    let selectedDate = DB.today();
    let students = [];
    let attendanceData = {};
    let activeTab = 'mark';

    async function loadAttendance() {
        if (!selectedClass) return;
        students = await DB.getStudentsByClass(selectedClass);
        const existing = await DB.getAttendance(selectedClass, selectedDate);
        attendanceData = {};
        if (existing.length > 0 && existing[0].records) {
            existing[0].records.forEach(r => {
                attendanceData[r.studentId] = r.status;
            });
        }
        renderContent();
    }

    function renderContent() {
        const content = document.getElementById('attendance-content');
        if (!content) return;

        if (activeTab === 'mark') {
            renderMarkTab(content);
        } else {
            renderHistoryTab(content);
        }
    }

    function renderMarkTab(content) {
        if (!selectedClass) {
            content.innerHTML = '<div class="empty-state"><i data-lucide="clipboard-check"></i><h3>Chọn lớp để điểm danh</h3><p>Vui lòng chọn lớp và ngày từ bộ lọc phía trên</p></div>';
            if (window.lucide) lucide.createIcons();
            return;
        }

        if (students.length === 0) {
            content.innerHTML = '<div class="empty-state"><i data-lucide="users"></i><h3>Lớp chưa có học viên</h3></div>';
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Summary
        const present = Object.values(attendanceData).filter(v => v === 'present').length;
        const absent = Object.values(attendanceData).filter(v => v === 'absent').length;
        const late = Object.values(attendanceData).filter(v => v === 'late').length;

        content.innerHTML = `
            ${isStaff ? '<div style="padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-md);margin-bottom:var(--space-4);font-size:var(--font-size-sm);color:var(--warning-400);">⚠️ Bạn chỉ có quyền xem, không thể chỉnh sửa điểm danh</div>' : ''}
            <div class="stats-grid" style="margin-bottom:var(--space-6);">
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--success-400);">${present}</div>
                    <div class="stat-label">Có mặt</div>
                </div>
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--danger-400);">${absent}</div>
                    <div class="stat-label">Vắng</div>
                </div>
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--warning-400);">${late}</div>
                    <div class="stat-label">Trễ</div>
                </div>
            </div>

            <div class="attendance-grid">
                ${students.map(s => {
                    const status = attendanceData[s.id] || '';
                    return `
                        <div class="attendance-item ${status}" id="att-${s.id}">
                            <div class="student-name">${s.name}</div>
                            <div class="status-select">
                                <button class="status-btn ${status === 'present' ? 'active-present' : ''}" 
                                    onclick="AttendancePage.setStatus('${s.id}', 'present')" title="Có mặt" ${!canEdit ? 'disabled' : ''}>✓</button>
                                <button class="status-btn ${status === 'absent' ? 'active-absent' : ''}" 
                                    onclick="AttendancePage.setStatus('${s.id}', 'absent')" title="Vắng" ${!canEdit ? 'disabled' : ''}>✗</button>
                                <button class="status-btn ${status === 'late' ? 'active-late' : ''}" 
                                    onclick="AttendancePage.setStatus('${s.id}', 'late')" title="Trễ" ${!canEdit ? 'disabled' : ''}>⏰</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            ${canEdit ? `
            <div style="margin-top:var(--space-6);display:flex;gap:var(--space-3);justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="AttendancePage.markAll('present')">✓ Tất cả có mặt</button>
                <button class="btn btn-primary" onclick="AttendancePage.save()"><i data-lucide="save"></i> Lưu điểm danh</button>
            </div>` : ''}
        `;
        if (window.lucide) lucide.createIcons();
    }

    async function renderHistoryTab(content) {
        if (!selectedClass) {
            content.innerHTML = '<div class="empty-state"><p>Chọn lớp để xem lịch sử</p></div>';
            return;
        }

        // Get last 30 days
        const endDate = DB.today();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const startStr = startDate.toISOString().split('T')[0];

        let history = [];
        try {
            history = await DB.getAttendanceByDateRange(selectedClass, startStr, endDate);
        } catch(e) { console.warn(e); }

        if (history.length === 0) {
            content.innerHTML = '<div class="empty-state"><p>Chưa có dữ liệu điểm danh</p></div>';
            return;
        }

        content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead><tr><th>Ngày</th><th>Có mặt</th><th>Vắng</th><th>Trễ</th><th>Tổng</th></tr></thead>
                    <tbody>
                        ${history.map(h => {
                            const records = h.records || [];
                            const p = records.filter(r => r.status === 'present').length;
                            const a = records.filter(r => r.status === 'absent').length;
                            const l = records.filter(r => r.status === 'late').length;
                            return `<tr>
                                <td>${DB.formatDate(h.date)}</td>
                                <td><span class="text-success font-bold">${p}</span></td>
                                <td><span class="text-danger font-bold">${a}</span></td>
                                <td><span class="text-warning font-bold">${l}</span></td>
                                <td>${records.length}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="clipboard-check"></i> Điểm danh Học viên</h1>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-item active" onclick="AttendancePage.switchTab('mark', this)">Điểm danh</button>
            <button class="tab-item" onclick="AttendancePage.switchTab('history', this)">Lịch sử</button>
        </div>

        <div class="filter-bar">
            <select class="select" id="att-class" style="max-width:220px;" onchange="AttendancePage.selectClass(this.value)">
                <option value="">Chọn lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
            <input type="date" class="input" id="att-date" value="${selectedDate}" style="max-width:180px;" onchange="AttendancePage.selectDate(this.value)">
        </div>

        <div id="attendance-content"></div>
    `;

    renderContent();

    window.AttendancePage = {
        selectClass(val) {
            selectedClass = val;
            loadAttendance();
        },
        selectDate(val) {
            selectedDate = val;
            loadAttendance();
        },
        setStatus(studentId, status) {
            if (attendanceData[studentId] === status) {
                delete attendanceData[studentId];
            } else {
                attendanceData[studentId] = status;
            }
            renderContent();
        },
        markAll(status) {
            students.forEach(s => { attendanceData[s.id] = status; });
            renderContent();
        },
        async save() {
            if (!selectedClass) { Toast.warning('Chọn lớp', 'Vui lòng chọn lớp trước'); return; }

            const records = students.map(s => ({
                studentId: s.id,
                status: attendanceData[s.id] || 'present'
            }));

            try {
                await DB.saveAttendance({
                    classId: selectedClass,
                    date: selectedDate,
                    records
                });
                const p = records.filter(r => r.status === 'present').length;
                const a = records.filter(r => r.status === 'absent').length;
                const l = records.filter(r => r.status === 'late').length;
                Toast.success('Đã lưu', `Có mặt: ${p}, Vắng: ${a}, Trễ: ${l}`);
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },
        switchTab(tab, el) {
            activeTab = tab;
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            renderContent();
        }
    };
});
