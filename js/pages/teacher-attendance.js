// ============================================
// TEACHER ATTENDANCE (CHẤM CÔNG) PAGE
// ============================================

Router.register('teacher-attendance', async (container) => {
    const isOwner = Auth.isOwner();
    const isTeacher = Auth.isTeacher();
    let teachers = [], records = [], classes = [];
    let selectedMonth = DB.currentMonth();

    try {
        teachers = await DB.getTeachers();
        classes = await DB.getClasses();
        records = await DB.getTeacherAttendance(selectedMonth);
    } catch(e) { console.warn(e); }

    // Teachers see only their own
    if (isTeacher) {
        records = records.filter(r => r.teacherId === window.currentUser.id);
    }

    function getTeacherName(id) {
        const t = teachers.find(te => te.id === id);
        return t ? (t.displayName || t.email) : '—';
    }

    function getTeacherPhoto(id) {
        const t = teachers.find(te => te.id === id);
        return t?.photoURL || '';
    }

    function getClassName(id) {
        const c = classes.find(cl => cl.id === id);
        return c ? c.name : '—';
    }

    function getShiftLabel(shift) {
        const labels = { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối', custom: 'Tùy chỉnh' };
        return labels[shift] || shift;
    }

    function getTeacherSummary() {
        const summaries = {};
        const teacherList = isTeacher ? [{ id: window.currentUser.id }] : teachers;

        teacherList.forEach(t => {
            summaries[t.id] = { totalSessions: 0, totalHours: 0, morning: 0, afternoon: 0, evening: 0 };
        });

        records.forEach(r => {
            if (!summaries[r.teacherId]) return;
            summaries[r.teacherId].totalSessions++;
            summaries[r.teacherId].totalHours += (r.hours || 0);
            if (r.shift === 'morning') summaries[r.teacherId].morning++;
            else if (r.shift === 'afternoon') summaries[r.teacherId].afternoon++;
            else if (r.shift === 'evening') summaries[r.teacherId].evening++;
        });

        return summaries;
    }

    function renderContent() {
        const content = document.getElementById('ta-content');
        if (!content) return;

        const summaries = getTeacherSummary();
        const teacherList = isTeacher ? [{ id: window.currentUser.id, displayName: window.currentUser.displayName, photoURL: window.currentUser.photoURL }] : teachers;

        content.innerHTML = `
            <div class="timesheet-grid mb-8">
                ${teacherList.map(t => {
                    const s = summaries[t.id] || { totalSessions: 0, totalHours: 0, morning: 0, afternoon: 0, evening: 0 };
                    const photo = t.photoURL || getTeacherPhoto(t.id);
                    const name = t.displayName || getTeacherName(t.id);
                    return `
                        <div class="timesheet-card">
                            <div class="timesheet-header">
                                ${photo ? `<img src="${photo}" class="timesheet-avatar" referrerpolicy="no-referrer">` :
                                `<div class="timesheet-avatar" style="background:var(--primary-600);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">${name.charAt(0)}</div>`}
                                <div>
                                    <div class="timesheet-name">${name}</div>
                                    <div class="timesheet-subject">Tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}</div>
                                </div>
                            </div>
                            <div class="timesheet-details">
                                <div class="timesheet-detail">
                                    <div class="timesheet-detail-value">${s.totalSessions}</div>
                                    <div class="timesheet-detail-label">Buổi dạy</div>
                                </div>
                                <div class="timesheet-detail">
                                    <div class="timesheet-detail-value">${s.totalHours.toFixed(1)}</div>
                                    <div class="timesheet-detail-label">Tổng giờ</div>
                                </div>
                                <div class="timesheet-detail">
                                    <div class="timesheet-detail-value">${s.morning}/${s.afternoon}/${s.evening}</div>
                                    <div class="timesheet-detail-label">S / C / T</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="card">
                <div class="card-header"><h3>Chi tiết chấm công</h3></div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                ${!isTeacher ? '<th>Giáo viên</th>' : ''}
                                <th>Ca</th>
                                <th>Thời gian</th>
                                <th>Lớp</th>
                                <th>Số giờ</th>
                                <th>Ghi chú</th>
                                ${isOwner ? '<th>Thao tác</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${records.length === 0 ? `<tr><td colspan="8"><div class="empty-state"><p>Chưa có dữ liệu chấm công tháng này</p></div></td></tr>` :
                            records.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => `<tr>
                                <td>${DB.formatDate(r.date)}</td>
                                ${!isTeacher ? `<td><strong>${getTeacherName(r.teacherId)}</strong></td>` : ''}
                                <td><span class="badge badge-${r.shift === 'morning' ? 'info' : r.shift === 'afternoon' ? 'warning' : 'primary'}">${getShiftLabel(r.shift)}</span></td>
                                <td>${r.startTime || ''} - ${r.endTime || ''}</td>
                                <td>${getClassName(r.classId)}</td>
                                <td><strong>${r.hours || 0}h</strong></td>
                                <td class="text-sm text-muted">${r.note || ''}</td>
                                ${isOwner ? `<td>
                                    <div class="table-actions">
                                        <button class="btn-icon" title="Xóa" onclick="TeacherAttPage.remove('${r.id}')"><i data-lucide="trash-2"></i></button>
                                    </div>
                                </td>` : ''}
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="clock"></i> Chấm công Giáo viên</h1>
            </div>
            <div class="page-actions">
                ${isOwner ? '<button class="btn btn-primary" onclick="TeacherAttPage.showAdd()"><i data-lucide="plus"></i> Thêm chấm công</button>' : ''}
            </div>
        </div>

        <div class="filter-bar">
            <input type="month" class="input" id="ta-month" value="${selectedMonth}" style="max-width:200px;" onchange="TeacherAttPage.changeMonth(this.value)">
        </div>

        <div id="ta-content"></div>
    `;

    renderContent();

    window.TeacherAttPage = {
        async changeMonth(val) {
            selectedMonth = val;
            try {
                records = await DB.getTeacherAttendance(selectedMonth);
                if (isTeacher) records = records.filter(r => r.teacherId === window.currentUser.id);
            } catch(e) { console.warn(e); }
            renderContent();
        },

        showAdd() {
            const shiftTimes = {
                morning: { start: '07:00', end: '11:30' },
                afternoon: { start: '13:00', end: '17:30' },
                evening: { start: '18:00', end: '21:00' }
            };

            Modal.show({
                title: 'Thêm chấm công',
                content: `
                    <div class="form-group">
                        <label class="form-label">Giáo viên *</label>
                        <select class="select" id="ta-teacher">
                            ${teachers.map(t => `<option value="${t.id}">${t.displayName || t.email}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Ngày *</label>
                            <input type="date" class="input" id="ta-date" value="${DB.today()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ca *</label>
                            <select class="select" id="ta-shift" onchange="TeacherAttPage.onShiftChange()">
                                <option value="morning">Sáng (07:00-11:30)</option>
                                <option value="afternoon">Chiều (13:00-17:30)</option>
                                <option value="evening">Tối (18:00-21:00)</option>
                                <option value="custom">Tùy chỉnh giờ</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Giờ vào</label>
                            <input type="time" class="input" id="ta-start" value="07:00">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Giờ ra</label>
                            <input type="time" class="input" id="ta-end" value="11:30">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lớp dạy</label>
                        <select class="select" id="ta-class">
                            <option value="">Không chọn</option>
                            ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <input type="text" class="input" id="ta-note">
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="TeacherAttPage.saveNew()">Lưu</button>
                `
            });
        },

        onShiftChange() {
            const shift = document.getElementById('ta-shift').value;
            const times = {
                morning: { start: '07:00', end: '11:30' },
                afternoon: { start: '13:00', end: '17:30' },
                evening: { start: '18:00', end: '21:00' }
            };
            if (times[shift]) {
                document.getElementById('ta-start').value = times[shift].start;
                document.getElementById('ta-end').value = times[shift].end;
            }
        },

        async saveNew() {
            const teacherId = document.getElementById('ta-teacher').value;
            const date = document.getElementById('ta-date').value;
            const shift = document.getElementById('ta-shift').value;
            const startTime = document.getElementById('ta-start').value;
            const endTime = document.getElementById('ta-end').value;

            if (!teacherId || !date) { Toast.warning('Thiếu thông tin'); return; }

            // Calculate hours
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const hours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;

            try {
                await DB.addTeacherAttendanceRecord({
                    teacherId,
                    date,
                    shift,
                    startTime,
                    endTime,
                    classId: document.getElementById('ta-class').value || '',
                    hours: hours > 0 ? hours : 0,
                    note: document.getElementById('ta-note').value || '',
                    month: date.substring(0, 7)
                });
                Modal.close();
                Toast.success('Thành công', 'Đã thêm chấm công');
                records = await DB.getTeacherAttendance(selectedMonth);
                if (isTeacher) records = records.filter(r => r.teacherId === window.currentUser.id);
                renderContent();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        remove(id) {
            Modal.confirm({ title: 'Xóa chấm công', message: 'Xóa bản ghi chấm công này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                await DB.deleteTeacherAttendanceRecord(id);
                Toast.success('Đã xóa');
                records = await DB.getTeacherAttendance(selectedMonth);
                renderContent();
            });
        }
    };
});
