// ============================================
// SCHEDULE PAGE - 30min slots + Drag & Drop + Multi-add
// ============================================

Router.register('schedule', async (container) => {
    const canEdit = Auth.hasAnyRole('owner');
    let classes = [], schedules = [];
    try {
        classes = Auth.isTeacher() ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
        schedules = await DB.getSchedules();
        if (Auth.isTeacher()) {
            const classIds = classes.map(c => c.id);
            schedules = schedules.filter(s => classIds.includes(s.classId));
        }
    } catch(e) { console.warn(e); }

    let filterClassId = '';

    // Time slots: 7:00 - 20:30, every 30 min
    const timeSlots = [];
    for (let h = 7; h <= 20; h++) {
        timeSlots.push(`${String(h).padStart(2,'0')}:00`);
        if (h < 20 || (h === 20 && true)) {
            timeSlots.push(`${String(h).padStart(2,'0')}:30`);
        }
    }
    // Results in 7:00, 7:30, 8:00, ..., 20:00, 20:30

    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

    function getClassName(id) { return (classes.find(c => c.id === id) || {}).name || '?'; }

    function timeToSlot(time) {
        return timeSlots.indexOf(time);
    }

    function getSlotLabel(i) {
        if (i < timeSlots.length - 1) return `${timeSlots[i]} - ${timeSlots[i+1]}`;
        return `${timeSlots[i]} - 21:00`;
    }

    function getScheduleAtSlot(day, time) {
        return schedules.filter(s => {
            if (filterClassId && s.classId !== filterClassId) return false;
            if (s.dayOfWeek !== day) return false;
            return s.startTime === time;
        });
    }

    function getScheduleSpan(sch) {
        const startIdx = timeToSlot(sch.startTime);
        const endIdx = timeToSlot(sch.endTime);
        return Math.max(1, endIdx - startIdx);
    }

    // Colors for classes
    const classColors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
    function getClassColor(classId) {
        const idx = classes.findIndex(c => c.id === classId);
        return classColors[idx % classColors.length];
    }

    function render() {
        const grid = document.getElementById('schedule-grid');
        if (!grid) return;

        // Track which slots are "occupied" by multi-row events
        const occupied = {}; // "day-slotIdx" => true

        let html = `<div class="sched-table">
            <div class="sched-row sched-header">
                <div class="sched-cell sched-time-header">Thời gian</div>
                ${dayNames.map((d, i) => `<div class="sched-cell sched-day-header">${d}</div>`).join('')}
            </div>`;

        timeSlots.forEach((time, slotIdx) => {
            html += `<div class="sched-row">
                <div class="sched-cell sched-time">${getSlotLabel(slotIdx)}</div>`;

            for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                const day = dayIdx + 2; // 2=Mon, 8=Sun
                const key = `${day}-${slotIdx}`;

                if (occupied[key]) {
                    // Skip - occupied by a multi-row event
                    continue;
                }

                const events = getScheduleAtSlot(day, time);
                if (events.length > 0) {
                    const ev = events[0];
                    const span = getScheduleSpan(ev);
                    // Mark subsequent slots as occupied
                    for (let s = 1; s < span; s++) {
                        occupied[`${day}-${slotIdx + s}`] = true;
                    }
                    const color = getClassColor(ev.classId);
                    html += `<div class="sched-cell sched-event" style="grid-row: span ${span};background:${color}22;border-left:3px solid ${color};" 
                        draggable="${canEdit}" 
                        data-schedule-id="${ev.id}"
                        ondragstart="SchedulePage.dragStart(event, '${ev.id}')"
                        ondblclick="SchedulePage.editSchedule('${ev.id}')">
                        <div class="sched-event-name" style="color:${color};">${getClassName(ev.classId)}</div>
                        <div class="sched-event-detail">${ev.startTime}-${ev.endTime}</div>
                        ${ev.room ? `<div class="sched-event-detail">📍 ${ev.room}</div>` : ''}
                        ${canEdit ? `<button class="sched-del-btn" onclick="event.stopPropagation();SchedulePage.removeSchedule('${ev.id}')" title="Xóa">×</button>` : ''}
                    </div>`;
                } else {
                    html += `<div class="sched-cell sched-empty" 
                        data-day="${day}" data-time="${time}"
                        ondragover="event.preventDefault();this.classList.add('sched-drop-hover')" 
                        ondragleave="this.classList.remove('sched-drop-hover')"
                        ondrop="SchedulePage.drop(event, ${day}, '${time}')">
                    </div>`;
                }
            }
            html += '</div>';
        });

        html += '</div>';
        grid.innerHTML = html;
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="calendar"></i> Thời khóa biểu</h1></div>
            <div class="page-actions">
                ${canEdit ? `<button class="btn btn-primary" onclick="SchedulePage.showAddSchedule()"><i data-lucide="plus"></i> Thêm lịch học</button>` : ''}
            </div>
        </div>
        <div class="filter-bar">
            <select class="select" style="max-width:250px;" onchange="SchedulePage.filterClass(this.value)">
                <option value="">Tất cả lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
            ${canEdit ? `<p style="font-size:12px;color:var(--text-muted);margin-left:8px;">💡 Kéo thả để dời lịch • Nhấp đúp để sửa</p>` : ''}
        </div>
        <div id="schedule-grid" class="schedule-wrapper"></div>
    `;
    render();

    let draggedId = null;

    window.SchedulePage = {
        filterClass(id) { filterClassId = id; render(); },

        // === DRAG & DROP ===
        dragStart(e, id) { draggedId = id; e.dataTransfer.effectAllowed = 'move'; },

        async drop(e, day, time) {
            e.preventDefault();
            e.target.classList.remove('sched-drop-hover');
            if (!draggedId) return;
            const sch = schedules.find(s => s.id === draggedId);
            if (!sch) return;

            // Calculate duration
            const startIdx = timeToSlot(sch.startTime);
            const endIdx = timeToSlot(sch.endTime);
            const duration = endIdx - startIdx;
            const newStartIdx = timeToSlot(time);
            const newEndIdx = Math.min(newStartIdx + duration, timeSlots.length - 1);

            try {
                await DB.updateSchedule(draggedId, {
                    dayOfWeek: day,
                    startTime: time,
                    endTime: timeSlots[newEndIdx] || '21:00'
                });
                // Update local
                sch.dayOfWeek = day;
                sch.startTime = time;
                sch.endTime = timeSlots[newEndIdx] || '21:00';
                Toast.success('Đã dời lịch');
                render();
            } catch(err) { Toast.error('Lỗi', err.message); }
            draggedId = null;
        },

        // === ADD SCHEDULE (multi-row) ===
        _schedRows: 1,

        showAddSchedule() {
            this._schedRows = 1;
            Modal.show({
                title: 'Thêm lịch học',
                size: 'lg',
                content: this._buildAddContent(),
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="SchedulePage.saveNewSchedules()">💾 Lưu tất cả</button>`
            });
        },

        _buildAddContent() {
            let rowsHtml = '';
            for (let i = 0; i < this._schedRows; i++) {
                rowsHtml += `
                    <div class="sched-add-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:rgba(99,102,241,0.05);border-radius:8px;">
                        <select class="select" id="sa-day-${i}" style="width:100px;">
                            ${dayNames.map((d, j) => `<option value="${j + 2}">${d}</option>`).join('')}
                        </select>
                        <select class="select" id="sa-start-${i}" style="width:90px;">
                            ${timeSlots.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                        <span style="color:var(--text-muted);">→</span>
                        <select class="select" id="sa-end-${i}" style="width:90px;">
                            ${timeSlots.slice(1).map(t => `<option value="${t}">${t}</option>`).join('')}
                            <option value="21:00">21:00</option>
                        </select>
                        <input type="text" class="input" id="sa-room-${i}" placeholder="Phòng" style="width:80px;">
                        ${i > 0 ? `<button class="btn-icon" onclick="this.parentElement.remove()" title="Xóa"><i data-lucide="x" style="width:14px;"></i></button>` : ''}
                    </div>`;
            }

            return `
                <div class="form-group"><label class="form-label">Lớp *</label>
                    <select class="select" id="sa-class"><option value="">Chọn lớp</option>${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <div class="form-group">
                    <label class="form-label">Lịch học 
                        <button class="btn btn-ghost btn-sm" onclick="SchedulePage.addScheduleRow()" style="font-size:12px;margin-left:8px;">
                            <i data-lucide="plus" style="width:14px;height:14px;"></i> Thêm buổi
                        </button>
                    </label>
                    <div id="schedule-rows">${rowsHtml}</div>
                </div>
            `;
        },

        addScheduleRow() {
            this._schedRows++;
            const container = document.getElementById('schedule-rows');
            if (!container) return;
            const div = document.createElement('div');
            div.className = 'sched-add-row';
            div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:rgba(99,102,241,0.05);border-radius:8px;';
            const i = this._schedRows - 1;
            div.innerHTML = `
                <select class="select" id="sa-day-${i}" style="width:100px;">
                    ${dayNames.map((d, j) => `<option value="${j + 2}">${d}</option>`).join('')}
                </select>
                <select class="select" id="sa-start-${i}" style="width:90px;">
                    ${timeSlots.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
                <span style="color:var(--text-muted);">→</span>
                <select class="select" id="sa-end-${i}" style="width:90px;">
                    ${timeSlots.slice(1).map(t => `<option value="${t}">${t}</option>`).join('')}
                    <option value="21:00">21:00</option>
                </select>
                <input type="text" class="input" id="sa-room-${i}" placeholder="Phòng" style="width:80px;">
                <button class="btn-icon" onclick="this.parentElement.remove()" title="Xóa"><i data-lucide="x" style="width:14px;"></i></button>
            `;
            container.appendChild(div);
            if (window.lucide) lucide.createIcons();
        },

        async saveNewSchedules() {
            const classId = document.getElementById('sa-class').value;
            if (!classId) { Toast.warning('Chọn lớp'); return; }

            const rows = document.querySelectorAll('.sched-add-row');
            const toAdd = [];
            rows.forEach((row, i) => {
                const dayEl = row.querySelector(`[id^="sa-day"]`);
                const startEl = row.querySelector(`[id^="sa-start"]`);
                const endEl = row.querySelector(`[id^="sa-end"]`);
                const roomEl = row.querySelector(`[id^="sa-room"]`);
                if (dayEl && startEl && endEl) {
                    toAdd.push({
                        classId,
                        dayOfWeek: parseInt(dayEl.value),
                        startTime: startEl.value,
                        endTime: endEl.value,
                        room: roomEl ? roomEl.value : ''
                    });
                }
            });

            if (toAdd.length === 0) return;

            try {
                await DB.addSchedulesBatch(toAdd);
                Modal.close();
                Toast.success('Đã thêm ' + toAdd.length + ' lịch học');
                schedules = await DB.getSchedules();
                if (Auth.isTeacher()) {
                    const classIds = classes.map(c => c.id);
                    schedules = schedules.filter(s => classIds.includes(s.classId));
                }
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        // === EDIT ===
        editSchedule(id) {
            if (!canEdit) return;
            const sch = schedules.find(s => s.id === id);
            if (!sch) return;
            Modal.show({
                title: 'Sửa lịch học',
                content: `
                    <div class="form-group"><label class="form-label">Lớp</label>
                        <select class="select" id="se-class">${classes.map(c => `<option value="${c.id}" ${c.id === sch.classId ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Thứ</label>
                            <select class="select" id="se-day">${dayNames.map((d, j) => `<option value="${j+2}" ${j+2 === sch.dayOfWeek ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
                        <div class="form-group"><label class="form-label">Phòng</label><input type="text" class="input" id="se-room" value="${sch.room || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Bắt đầu</label>
                            <select class="select" id="se-start">${timeSlots.map(t => `<option value="${t}" ${t === sch.startTime ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                        <div class="form-group"><label class="form-label">Kết thúc</label>
                            <select class="select" id="se-end">${[...timeSlots.slice(1), '21:00'].map(t => `<option value="${t}" ${t === sch.endTime ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="SchedulePage.saveEdit('${id}')">Cập nhật</button>`
            });
        },

        async saveEdit(id) {
            try {
                await DB.updateSchedule(id, {
                    classId: document.getElementById('se-class').value,
                    dayOfWeek: parseInt(document.getElementById('se-day').value),
                    startTime: document.getElementById('se-start').value,
                    endTime: document.getElementById('se-end').value,
                    room: document.getElementById('se-room').value
                });
                Modal.close();
                schedules = await DB.getSchedules();
                render();
                Toast.success('Đã cập nhật');
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        removeSchedule(id) {
            Modal.confirm({ title: 'Xóa lịch', message: 'Xóa lịch học này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                await DB.deleteSchedule(id);
                schedules = schedules.filter(s => s.id !== id);
                render();
                Toast.success('Đã xóa');
            });
        }
    };
});
