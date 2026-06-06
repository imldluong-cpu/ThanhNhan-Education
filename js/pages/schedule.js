// ============================================
// SCHEDULE PAGE
// ============================================

Router.register('schedule', async (container) => {
    const canEdit = Auth.isOwner();
    const isTeacher = Auth.isTeacher();
    let classes = [], schedules = [];

    try {
        classes = isTeacher ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
        schedules = await DB.getSchedules();
    } catch(e) { console.warn(e); }

    // Filter schedules for teacher
    if (isTeacher) {
        const myClassIds = classes.map(c => c.id);
        schedules = schedules.filter(s => myClassIds.includes(s.classId));
    }

    let filterClassId = '';

    const days = [
        { value: 2, label: 'Thứ 2' },
        { value: 3, label: 'Thứ 3' },
        { value: 4, label: 'Thứ 4' },
        { value: 5, label: 'Thứ 5' },
        { value: 6, label: 'Thứ 6' },
        { value: 7, label: 'Thứ 7' },
        { value: 8, label: 'CN' }
    ];

    const timeSlots = [
        '07:00 - 08:30', '08:30 - 10:00', '10:00 - 11:30',
        '13:00 - 14:30', '14:30 - 16:00', '16:00 - 17:30',
        '18:00 - 19:30', '19:30 - 21:00'
    ];

    function getClassName(classId) {
        const c = classes.find(cl => cl.id === classId);
        return c ? c.name : '—';
    }

    function getClassInfo(classId) {
        return classes.find(cl => cl.id === classId);
    }

    function getSchedulesForSlot(day, timeSlot) {
        const startTime = timeSlot.split(' - ')[0];
        let filtered = schedules.filter(s => s.dayOfWeek === day && s.startTime === startTime);
        if (filterClassId) filtered = filtered.filter(s => s.classId === filterClassId);
        return filtered;
    }

    function renderGrid() {
        const grid = document.getElementById('schedule-grid');
        if (!grid) return;

        let html = '';
        // Header row
        html += '<div class="schedule-header schedule-cell">Giờ</div>';
        days.forEach(d => { html += `<div class="schedule-header schedule-cell">${d.label}</div>`; });

        // Time slot rows
        timeSlots.forEach(slot => {
            html += `<div class="schedule-cell schedule-time">${slot}</div>`;
            days.forEach(d => {
                const events = getSchedulesForSlot(d.value, slot);
                html += '<div class="schedule-cell">';
                events.forEach(ev => {
                    const cls = getClassInfo(ev.classId);
                    html += `
                        <div class="schedule-event" onclick="SchedulePage.viewEvent('${ev.id}')" title="${getClassName(ev.classId)}">
                            <div class="event-name">${getClassName(ev.classId)}</div>
                            <div class="event-info">${ev.room || ''} ${ev.startTime}-${ev.endTime}</div>
                        </div>
                    `;
                });
                html += '</div>';
            });
        });

        grid.innerHTML = html;
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="calendar-days"></i> Thời khóa biểu</h1>
                <p class="page-subtitle">Lịch học toàn trung tâm</p>
            </div>
            <div class="page-actions">
                ${canEdit ? '<button class="btn btn-primary" onclick="SchedulePage.showAdd()"><i data-lucide="plus"></i> Thêm lịch học</button>' : ''}
            </div>
        </div>

        <div class="filter-bar">
            <select class="select" id="schedule-class-filter" style="max-width:220px;" onchange="SchedulePage.filterByClass(this.value)">
                <option value="">Tất cả lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;overflow-x:auto;">
                <div id="schedule-grid" class="schedule-grid"></div>
            </div>
        </div>
    `;

    renderGrid();

    window.SchedulePage = {
        filterByClass(val) {
            filterClassId = val;
            renderGrid();
        },

        showAdd() {
            Modal.show({
                title: 'Thêm lịch học',
                content: `
                    <div class="form-group">
                        <label class="form-label">Lớp *</label>
                        <select class="select" id="sch-class">
                            <option value="">Chọn lớp</option>
                            ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Thứ *</label>
                            <select class="select" id="sch-day">
                                ${days.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phòng</label>
                            <input type="text" class="input" id="sch-room" placeholder="VD: P.01">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Giờ bắt đầu *</label>
                            <select class="select" id="sch-start">
                                <option value="07:00">07:00</option>
                                <option value="08:30">08:30</option>
                                <option value="10:00">10:00</option>
                                <option value="13:00">13:00</option>
                                <option value="14:30">14:30</option>
                                <option value="16:00">16:00</option>
                                <option value="18:00">18:00</option>
                                <option value="19:30">19:30</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Giờ kết thúc *</label>
                            <select class="select" id="sch-end">
                                <option value="08:30">08:30</option>
                                <option value="10:00">10:00</option>
                                <option value="11:30">11:30</option>
                                <option value="14:30">14:30</option>
                                <option value="16:00">16:00</option>
                                <option value="17:30">17:30</option>
                                <option value="19:30">19:30</option>
                                <option value="21:00">21:00</option>
                            </select>
                        </div>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="SchedulePage.saveNew()">Lưu</button>
                `
            });
        },

        async saveNew() {
            const classId = document.getElementById('sch-class').value;
            if (!classId) { Toast.warning('Thiếu thông tin', 'Vui lòng chọn lớp'); return; }

            try {
                await DB.addSchedule({
                    classId,
                    dayOfWeek: parseInt(document.getElementById('sch-day').value),
                    startTime: document.getElementById('sch-start').value,
                    endTime: document.getElementById('sch-end').value,
                    room: document.getElementById('sch-room').value || ''
                });
                Modal.close();
                Toast.success('Thành công', 'Đã thêm lịch học');
                schedules = await DB.getSchedules();
                if (isTeacher) {
                    const myClassIds = classes.map(c => c.id);
                    schedules = schedules.filter(s => myClassIds.includes(s.classId));
                }
                renderGrid();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        viewEvent(id) {
            const ev = schedules.find(s => s.id === id);
            if (!ev) return;
            const cls = getClassInfo(ev.classId);
            const dayLabel = days.find(d => d.value === ev.dayOfWeek)?.label || '';

            Modal.show({
                title: 'Chi tiết lịch học',
                content: `
                    <div style="display:flex;flex-direction:column;gap:12px;font-size:var(--font-size-sm);">
                        <div><strong>Lớp:</strong> ${cls ? cls.name : '—'}</div>
                        <div><strong>Môn:</strong> ${cls ? cls.subject || '—' : '—'}</div>
                        <div><strong>Thứ:</strong> ${dayLabel}</div>
                        <div><strong>Thời gian:</strong> ${ev.startTime} - ${ev.endTime}</div>
                        <div><strong>Phòng:</strong> ${ev.room || '—'}</div>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
                    ${canEdit ? `<button class="btn btn-danger btn-sm" onclick="SchedulePage.remove('${id}')"><i data-lucide="trash-2"></i> Xóa</button>` : ''}
                    <button class="btn btn-primary btn-sm" onclick="Modal.close(); Router.navigate('attendance');">Điểm danh</button>
                `
            });
            if (window.lucide) lucide.createIcons();
        },

        async remove(id) {
            try {
                await DB.deleteSchedule(id);
                Modal.close();
                Toast.success('Đã xóa', 'Lịch học đã được xóa');
                schedules = await DB.getSchedules();
                renderGrid();
            } catch(e) { Toast.error('Lỗi', e.message); }
        }
    };
});
