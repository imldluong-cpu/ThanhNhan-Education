// ============================================
// ATTENDANCE PAGE - Fixed student display
// ============================================

Router.register('attendance', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'teacher');
    let classes = [];
    try {
        classes = Auth.isTeacher() ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
    } catch(e) { console.warn(e); }

    let selectedClassId = '', selectedDate = DB.today();
    let students = [], attendance = [];

    async function loadData() {
        if (!selectedClassId) { students = []; attendance = []; return; }
        try {
            students = await DB.getStudentsByClass(selectedClassId);
            const att = await DB.getAttendance(selectedClassId, selectedDate);
            attendance = att.length > 0 ? att[0].records || [] : [];
        } catch(e) { console.warn('Load attendance error:', e); }
    }

    function getStatus(studentId) {
        const record = attendance.find(r => r.studentId === studentId);
        return record ? record.status : '';
    }

    function render() {
        const area = document.getElementById('att-area');
        if (!area) return;

        if (!selectedClassId) {
            area.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><p>Vui lòng chọn lớp</p></div></div></div>';
            return;
        }

        if (students.length === 0) {
            area.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><h3>Lớp chưa có học viên</h3><p>Vào mục Học viên để thêm học viên vào lớp này</p></div></div></div>';
            return;
        }

        area.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div class="attendance-grid">
                        ${students.map(s => {
                            const status = getStatus(s.id);
                            return `<div class="attendance-item">
                                <div class="att-student-name">${s.name}</div>
                                <div class="att-buttons">
                                    <button class="status-btn ${status === 'present' ? 'active-present' : ''}" onclick="AttendancePage.setStatus('${s.id}', 'present')" title="Có mặt">✓</button>
                                    <button class="status-btn ${status === 'absent' ? 'active-absent' : ''}" onclick="AttendancePage.setStatus('${s.id}', 'absent')" title="Vắng">✗</button>
                                    <button class="status-btn ${status === 'late' ? 'active-late' : ''}" onclick="AttendancePage.setStatus('${s.id}', 'late')" title="Trễ">⏰</button>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    ${canEdit ? `
                        <div style="margin-top:var(--space-6);display:flex;justify-content:center;">
                            <button class="btn btn-primary btn-lg" onclick="AttendancePage.save()"><i data-lucide="save"></i> Lưu điểm danh</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="check-square"></i> Điểm danh học viên</h1></div>
        </div>
        <div class="filter-bar">
            <select class="select" style="max-width:250px;" onchange="AttendancePage.selectClass(this.value)">
                <option value="">Chọn lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
            <input type="date" class="input" style="max-width:180px;" value="${selectedDate}" onchange="AttendancePage.selectDate(this.value)">
        </div>
        <div id="att-area"></div>
    `;
    render();

    // Local state for attendance records being edited
    let localRecords = {};

    window.AttendancePage = {
        async selectClass(id) {
            selectedClassId = id;
            await loadData();
            // Initialize local records from loaded attendance
            localRecords = {};
            attendance.forEach(r => { localRecords[r.studentId] = r.status; });
            render();
        },

        async selectDate(date) {
            selectedDate = date;
            await loadData();
            localRecords = {};
            attendance.forEach(r => { localRecords[r.studentId] = r.status; });
            render();
        },

        setStatus(studentId, status) {
            // Toggle off if clicking same status
            if (localRecords[studentId] === status) {
                delete localRecords[studentId];
            } else {
                localRecords[studentId] = status;
            }
            // Update buttons visually without re-rendering everything
            const items = document.querySelectorAll('.attendance-item');
            items.forEach(item => {
                const btns = item.querySelectorAll('.status-btn');
                const name = item.querySelector('.att-student-name').textContent;
                const student = students.find(s => s.name === name);
                if (student && student.id === studentId) {
                    btns.forEach(btn => {
                        btn.classList.remove('active-present', 'active-absent', 'active-late');
                    });
                    const st = localRecords[studentId];
                    if (st === 'present') btns[0].classList.add('active-present');
                    else if (st === 'absent') btns[1].classList.add('active-absent');
                    else if (st === 'late') btns[2].classList.add('active-late');
                }
            });
        },

        async save() {
            if (!selectedClassId) return;
            const records = Object.entries(localRecords).map(([studentId, status]) => ({ studentId, status }));
            if (records.length === 0) { Toast.warning('Chưa điểm danh ai'); return; }
            try {
                await DB.saveAttendance({ classId: selectedClassId, date: selectedDate, records });
                const present = records.filter(r => r.status === 'present').length;
                const absent = records.filter(r => r.status === 'absent').length;
                const late = records.filter(r => r.status === 'late').length;
                Toast.success('Đã lưu điểm danh', `✓ ${present} có mặt, ✗ ${absent} vắng, ⏰ ${late} trễ`);
            } catch(e) { Toast.error('Lỗi lưu', e.message); }
        }
    };
});
