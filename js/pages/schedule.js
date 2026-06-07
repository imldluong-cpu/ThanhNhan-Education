// ============================================
// SCHEDULE PAGE - 30min slots + Drag & Drop + Multi-add
// ============================================

Router.register('schedule', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'admin', 'staff', 'teacher');
    let classes = [], schedules = [];
    try {
        classes = await DB.getClasses();
        schedules = await DB.getSchedules();
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

    // Anchor week: 2024-01-01 (Monday) to 2024-01-07 (Sunday)
    function getAnchorDate(dayOfWeek) {
        const dayMap = {
            2: '2024-01-01',
            3: '2024-01-02',
            4: '2024-01-03',
            5: '2024-01-04',
            6: '2024-01-05',
            7: '2024-01-06',
            8: '2024-01-07'
        };
        return dayMap[dayOfWeek] || '2024-01-01';
    }

    function render() {
        const grid = document.getElementById('schedule-grid');
        if (!grid) return;

        grid.style.height = 'calc(100vh - 200px)';
        grid.style.minHeight = '600px';
        grid.style.background = 'var(--bg-card)';
        grid.style.borderRadius = 'var(--radius-lg)';
        grid.style.padding = 'var(--space-4)';
        grid.style.boxShadow = 'var(--shadow-sm)';

        if (window.calendar) {
            window.calendar.destroy();
        }

        window.calendar = new FullCalendar.Calendar(grid, {
            initialView: 'timeGridWeek',
            initialDate: new Date(), // Current date
            firstDay: 1, // Start on Monday
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            buttonText: {
                today: 'Hôm nay',
                month: 'Tháng',
                week: 'Tuần'
            },
            allDaySlot: false,
            slotMinTime: '07:00:00',
            slotMaxTime: '21:30:00',
            locale: 'vi',
            editable: canEdit,
            eventOverlap: true,
            slotEventOverlap: false,
            events: function(info, successCallback, failureCallback) {
                const start = info.start;
                const end = info.end;
                
                let expandedEvents = [];
                const filtered = schedules.filter(s => {
                    if (filterClassId && s.classId !== filterClassId) return false;
                    return true;
                });

                // Convert to start/end dates handling timezone offset
                for (let d = new Date(start.getTime()); d < end; d.setDate(d.getDate() + 1)) {
                    let dbDay = d.getDay() + 1;
                    if (dbDay === 1) dbDay = 8; // Sunday

                    const dayEvents = filtered.filter(s => s.dayOfWeek === dbDay);
                    
                    dayEvents.forEach(s => {
                        const dateStr = d.toISOString().split('T')[0];
                        const color = getClassColor(s.classId);
                        
                        expandedEvents.push({
                            id: s.id + '_' + dateStr,
                            groupId: s.id,
                            title: getClassName(s.classId) + (s.room ? ` (📍 ${s.room})` : ''),
                            start: `${dateStr}T${s.startTime}:00`,
                            end: `${dateStr}T${s.endTime}:00`,
                            backgroundColor: color,
                            borderColor: color,
                            extendedProps: { ...s, occurrenceDate: dateStr }
                        });
                    });
                }
                
                successCallback(expandedEvents);
            },
            eventDrop: async function(info) {
                if (!canEdit) { info.revert(); return; }
                const newStart = info.event.start;
                const newEnd = info.event.end || new Date(newStart.getTime() + 90 * 60000);
                
                let dayOfWeek = newStart.getDay() + 1;
                if (dayOfWeek === 1) dayOfWeek = 8;
                
                const startTime = newStart.toTimeString().substring(0, 5);
                const endTime = newEnd.toTimeString().substring(0, 5);
                
                try {
                    await DB.updateSchedule(info.event.groupId, {
                        dayOfWeek: dayOfWeek,
                        startTime: startTime,
                        endTime: endTime
                    });
                    
                    const sch = schedules.find(s => s.id === info.event.groupId);
                    if (sch) {
                        sch.dayOfWeek = dayOfWeek;
                        sch.startTime = startTime;
                        sch.endTime = endTime;
                    }
                    Toast.success('Đã dời lịch');
                } catch(e) {
                    info.revert();
                    Toast.error('Lỗi', e.message);
                }
            },
            eventResize: async function(info) {
                if (!canEdit) { info.revert(); return; }
                const newStart = info.event.start;
                const newEnd = info.event.end;
                
                const startTime = newStart.toTimeString().substring(0, 5);
                const endTime = newEnd.toTimeString().substring(0, 5);
                
                try {
                    await DB.updateSchedule(info.event.groupId, {
                        startTime: startTime,
                        endTime: endTime
                    });
                    
                    const sch = schedules.find(s => s.id === info.event.groupId);
                    if (sch) {
                        sch.startTime = startTime;
                        sch.endTime = endTime;
                    }
                    Toast.success('Đã cập nhật giờ học');
                } catch(e) {
                    info.revert();
                    Toast.error('Lỗi', e.message);
                }
            },
            eventClick: function(info) {
                if(canEdit) SchedulePage.editSchedule(info.event.groupId);
            }
        });

        window.calendar.render();
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

    window.SchedulePage = {
        filterClass(id) { filterClassId = id; render(); },

        autoSetEnd(rowIdx) {
            const startSelect = document.getElementById(`sa-start-${rowIdx}`);
            const endSelect = document.getElementById(`sa-end-${rowIdx}`);
            if (!startSelect || !endSelect) return;
            const idx = timeSlots.indexOf(startSelect.value);
            if (idx !== -1) {
                let endIdx = idx + 3; // +1.5 hours
                endSelect.value = endIdx >= timeSlots.length ? "21:00" : timeSlots[endIdx];
            }
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
                        <select class="select" id="sa-start-${i}" style="width:90px;" onchange="SchedulePage.autoSetEnd(${i})">
                            ${timeSlots.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                        <span style="color:var(--text-muted);">→</span>
                        <select class="select" id="sa-end-${i}" style="width:90px;">
                            ${timeSlots.slice(1).map(t => `<option value="${t}">${t}</option>`).join('')}
                            <option value="21:00">21:00</option>
                        </select>
                        <select class="select" id="sa-room-${i}" style="width:100px;">
                            <option value="">Phòng</option>
                            <option value="Trệt">Trệt</option>
                            <option value="P.T1">P.T1</option>
                            <option value="P.T2">P.T2</option>
                            <option value="P.ST">P.ST</option>
                        </select>
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
                <select class="select" id="sa-start-${i}" style="width:90px;" onchange="SchedulePage.autoSetEnd(${i})">
                    ${timeSlots.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
                <span style="color:var(--text-muted);">→</span>
                <select class="select" id="sa-end-${i}" style="width:90px;">
                    ${timeSlots.slice(1).map(t => `<option value="${t}">${t}</option>`).join('')}
                    <option value="21:00">21:00</option>
                </select>
                <select class="select" id="sa-room-${i}" style="width:100px;">
                    <option value="">Phòng</option>
                    <option value="Trệt">Trệt</option>
                    <option value="P.T1">P.T1</option>
                    <option value="P.T2">P.T2</option>
                    <option value="P.ST">P.ST</option>
                </select>
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
                const allDB = await DB.getSchedules();
                for (const item of toAdd) {
                    if (!item.room) continue;
                    const conflict = allDB.find(s => 
                        s.dayOfWeek === item.dayOfWeek && 
                        s.room === item.room && 
                        Math.max(timeToSlot(s.startTime), timeToSlot(item.startTime)) < Math.min(timeToSlot(s.endTime), timeToSlot(item.endTime))
                    );
                    if (conflict) { 
                        Toast.error('Trùng phòng học', `Phòng ${item.room} đã có lớp từ ${conflict.startTime} đến ${conflict.endTime}`); 
                        return; 
                    }
                }

                await DB.addSchedulesBatch(toAdd);
                
                // Update class room if at least one room is specified
                const roomToUpdate = toAdd.find(s => s.room)?.room;
                if (roomToUpdate) {
                    await DB.updateClass(classId, { room: roomToUpdate });
                    const c = classes.find(x => x.id === classId);
                    if (c) c.room = roomToUpdate;
                }

                Modal.close();
                Toast.success('Đã thêm ' + toAdd.length + ' lịch học');
                schedules = await DB.getSchedules();
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
                        <div class="form-group"><label class="form-label">Phòng</label>
                            <select class="select" id="se-room">
                                <option value="" ${!sch.room ? 'selected' : ''}>Phòng</option>
                                <option value="Trệt" ${sch.room === 'Trệt' ? 'selected' : ''}>Trệt</option>
                                <option value="P.T1" ${sch.room === 'P.T1' ? 'selected' : ''}>P.T1</option>
                                <option value="P.T2" ${sch.room === 'P.T2' ? 'selected' : ''}>P.T2</option>
                                <option value="P.ST" ${sch.room === 'P.ST' ? 'selected' : ''}>P.ST</option>
                            </select>
                        </div>
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
                const newData = {
                    classId: document.getElementById('se-class').value,
                    dayOfWeek: parseInt(document.getElementById('se-day').value),
                    startTime: document.getElementById('se-start').value,
                    endTime: document.getElementById('se-end').value,
                    room: document.getElementById('se-room').value
                };

                if (newData.room) {
                    const allDB = await DB.getSchedules();
                    const conflict = allDB.find(s => 
                        s.id !== id &&
                        s.dayOfWeek === newData.dayOfWeek && 
                        s.room === newData.room && 
                        Math.max(timeToSlot(s.startTime), timeToSlot(newData.startTime)) < Math.min(timeToSlot(s.endTime), timeToSlot(newData.endTime))
                    );
                    if (conflict) { 
                        Toast.error('Trùng phòng học', `Phòng ${newData.room} đã có lớp từ ${conflict.startTime} đến ${conflict.endTime}`); 
                        return; 
                    }
                }

                await DB.updateSchedule(id, newData);
                
                if (newData.room) {
                    await DB.updateClass(newData.classId, { room: newData.room });
                    const c = classes.find(x => x.id === newData.classId);
                    if (c) c.room = newData.room;
                }

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
