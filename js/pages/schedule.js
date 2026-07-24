// ============================================
// SCHEDULE PAGE - 30min slots + Drag & Drop + Multi-add
// ============================================

Router.register('schedule', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'admin', 'staff', 'teacher');
    let classes = [], schedules = [], scheduleExceptions = [];
    try {
        classes = await DB.getClasses();
        schedules = await DB.getSchedules();
        scheduleExceptions = await DB.getScheduleExceptions();
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
        if (idx === -1) return '#999999'; // Default gray for deleted classes
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

        const isMobile = window.innerWidth <= 768;

        window.calendar = new FullCalendar.Calendar(grid, {
            initialView: isMobile ? 'listWeek' : 'timeGridWeek',
            initialDate: new Date(), // Current date
            firstDay: 1, // Start on Monday
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: isMobile ? 'listWeek,listMonth' : 'dayGridMonth,timeGridWeek'
            },
            buttonText: {
                today: 'Hôm nay',
                month: 'Tháng',
                week: 'Tuần',
                listWeek: 'DS Tuần',
                listMonth: 'DS Tháng'
            },
            allDaySlot: false,
            slotMinTime: '07:00:00',
            slotMaxTime: '21:30:00',
            locale: 'vi',
            editable: canEdit,
            eventOverlap: true,
            slotEventOverlap: false,
            eventContent: function(arg) {
                const title = arg.event.title;
                const timeText = arg.timeText;
                let html = `
                    <div class="fc-event-main-frame" style="position:relative;width:100%;height:100%;">
                        <div class="fc-event-time">${timeText}</div>
                        <div class="fc-event-title-container">
                            <div class="fc-event-title fc-sticky">${title}</div>
                        </div>
                `;
                if (canEdit) {
                    html += `
                        <button class="event-delete-btn" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.15);border:none;border-radius:4px;color:inherit;cursor:pointer;padding:2px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.3)'" onmouseout="this.style.background='rgba(0,0,0,0.15)'" onclick="event.stopPropagation(); SchedulePage.removeSchedule('${arg.event.groupId}', ${arg.event.extendedProps.isException ? `'${arg.event.extendedProps.exceptionId}'` : 'null'}, '${arg.event.extendedProps.occurrenceDate || ''}')" title="Xóa lịch này">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    `;
                }
                html += `</div>`;
                return { html: html };
            },
            events: function(info, successCallback, failureCallback) {
                const start = info.start;
                const end = info.end;
                
                let expandedEvents = [];
                const filtered = schedules.filter(s => {
                    if (filterClassId && s.classId !== filterClassId) return false;
                    return true;
                });

                // Generate recurring events
                for (let d = new Date(start.getTime()); d < end; d.setDate(d.getDate() + 1)) {
                    let dbDay = d.getDay() + 1;
                    if (dbDay === 1) dbDay = 8; // Sunday

                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    
                    const dayEvents = filtered.filter(s => s.dayOfWeek === dbDay);
                    
                    dayEvents.forEach(s => {
                        const c = classes.find(x => x.id === s.classId);
                        if (c && c.startDate && dateStr < c.startDate) return; // Skip if before start date

                        const exception = scheduleExceptions.find(ex => ex.scheduleId === s.id && ex.originalDate === dateStr);
                        if (exception) return; // Skip if exception exists
                        
                        const color = getClassColor(s.classId);
                        expandedEvents.push({
                            id: s.id + '_' + dateStr,
                            groupId: s.id,
                            title: getClassName(s.classId) + (s.room ? ` (📍 ${s.room})` : ''),
                            start: `${dateStr}T${s.startTime}:00`,
                            end: `${dateStr}T${s.endTime}:00`,
                            backgroundColor: color,
                            borderColor: color,
                            extendedProps: { ...s, occurrenceDate: dateStr, isException: false }
                        });
                    });
                }
                
                // Add exceptions
                scheduleExceptions.forEach(ex => {
                    if (ex.newDate) {
                        const d = new Date(ex.newDate);
                        if (d >= start && d < end) {
                            const originalSch = schedules.find(s => s.id === ex.scheduleId);
                            if (originalSch && (!filterClassId || originalSch.classId === filterClassId)) {
                                const color = getClassColor(originalSch.classId);
                                expandedEvents.push({
                                    id: 'ex_' + ex.id,
                                    groupId: originalSch.id,
                                    title: '(Bù) ' + getClassName(originalSch.classId) + (ex.newRoom ? ` (📍 ${ex.newRoom})` : (originalSch.room ? ` (📍 ${originalSch.room})` : '')),
                                    start: `${ex.newDate}T${ex.newStartTime}:00`,
                                    end: `${ex.newDate}T${ex.newEndTime}:00`,
                                    backgroundColor: 'transparent',
                                    borderColor: color,
                                    textColor: color,
                                    classNames: ['dashed-border'],
                                    extendedProps: { ...originalSch, exceptionId: ex.id, isException: true }
                                });
                            }
                        }
                    }
                });
                
                successCallback(expandedEvents);
            },
            eventDrop: async function(info) {
                if (!canEdit) { info.revert(); return; }
                const ev = info.event;
                const newStart = ev.start;
                const newEnd = ev.end || new Date(newStart.getTime() + 90 * 60000);
                
                let dayOfWeek = newStart.getDay() + 1;
                if (dayOfWeek === 1) dayOfWeek = 8;
                
                const startTime = newStart.toTimeString().substring(0, 5);
                const endTime = newEnd.toTimeString().substring(0, 5);
                
                const newDateStr = newStart.toISOString().split('T')[0];
                const isException = ev.extendedProps.isException;

                Modal.confirm({
                    title: 'Tùy chọn dời lịch',
                    message: 'Bạn muốn dời lịch cố định hàng tuần, hay chỉ dời lịch bù cho đúng buổi này?',
                    confirmText: 'Chỉ dời buổi này (Bù)',
                    middleBtnText: 'Dời lịch cố định',
                    cancelText: 'Hủy'
                });

                // Bắt sự kiện Cancel
                const modal = document.getElementById('active-modal');
                if (modal) {
                    const cancelBtn = modal.querySelector('.btn-secondary[onclick="Modal.close()"]');
                    const closeIcon = modal.querySelector('.btn-icon');
                    const revertFn = () => { info.revert(); Modal.close(); };
                    if (cancelBtn) cancelBtn.onclick = revertFn;
                    if (closeIcon) closeIcon.onclick = revertFn;
                }

                // Nút giữa: Dời cố định
                Modal.bindMiddle(async () => {
                    try {
                        if (isException) {
                            await DB.deleteScheduleException(ev.extendedProps.exceptionId);
                            scheduleExceptions = scheduleExceptions.filter(e => e.id !== ev.extendedProps.exceptionId);
                        }

                        await DB.updateSchedule(ev.groupId, {
                            dayOfWeek: dayOfWeek,
                            startTime: startTime,
                            endTime: endTime
                        });
                        
                        const sch = schedules.find(s => s.id === ev.groupId);
                        if (sch) {
                            sch.dayOfWeek = dayOfWeek;
                            sch.startTime = startTime;
                            sch.endTime = endTime;
                        }
                        Toast.success('Đã cập nhật lịch cố định');
                        window.calendar.refetchEvents();
                    } catch(e) {
                        info.revert();
                        throw e;
                    }
                });

                // Nút xác nhận: Dời bù
                Modal.bindConfirm(async () => {
                    try {
                        if (isException) {
                            await DB.updateScheduleException(ev.extendedProps.exceptionId, {
                                newDate: newDateStr,
                                newStartTime: startTime,
                                newEndTime: endTime
                            });
                            const ex = scheduleExceptions.find(e => e.id === ev.extendedProps.exceptionId);
                            if (ex) {
                                ex.newDate = newDateStr;
                                ex.newStartTime = startTime;
                                ex.newEndTime = endTime;
                            }
                        } else {
                            const originalDate = ev.extendedProps.occurrenceDate;
                            const originalSch = schedules.find(s => s.id === ev.groupId);
                            const newEx = await DB.addScheduleException({
                                scheduleId: ev.groupId,
                                originalDate: originalDate,
                                newDate: newDateStr,
                                newStartTime: startTime,
                                newEndTime: endTime,
                                newRoom: originalSch.room || ''
                            });
                            scheduleExceptions.push(newEx);
                        }
                        Toast.success('Đã dời lịch bù thành công');
                        window.calendar.refetchEvents();
                    } catch(e) {
                        info.revert();
                        throw e;
                    }
                });
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

        showAddSchedule(preselectClassId = '') {
            this._schedRows = 1;
            Modal.show({
                title: 'Thêm lịch học',
                size: 'lg',
                content: this._buildAddContent(preselectClassId),
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="SchedulePage.saveNewSchedules()">💾 Lưu tất cả</button>`
            });
        },

        _buildAddContent(preselectClassId) {
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
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Lớp *</label>
                        <select class="select" id="sa-class"><option value="">Chọn lớp</option>${classes.map(c => `<option value="${c.id}" ${c.id === preselectClassId ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Ngày bắt đầu (Dự kiến)</label>
                        <input type="date" class="input" id="sa-start-date" value="${DB.today()}"></div>
                </div>
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
            const startDate = document.getElementById('sa-start-date').value;
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
                
                // Update class room and startDate
                const roomToUpdate = toAdd.find(s => s.room)?.room;
                if (roomToUpdate || startDate) {
                    const updateData = {};
                    if (roomToUpdate) updateData.room = roomToUpdate;
                    if (startDate) updateData.startDate = startDate;
                    await DB.updateClass(classId, updateData);
                    const c = classes.find(x => x.id === classId);
                    if (c) Object.assign(c, updateData);
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
                    </div>
                `,
                footer: `
                    <div style="display:flex;justify-content:space-between;width:100%;">
                        <button class="btn btn-ghost" onclick="SchedulePage.showAddSchedule('${sch.classId}')"><i data-lucide="plus"></i> Thêm buổi khác</button>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                            <button class="btn btn-primary" onclick="SchedulePage.saveEdit('${id}')">Cập nhật</button>
                        </div>
                    </div>
                `
            });
            if (window.lucide) lucide.createIcons();
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
                scheduleExceptions = await DB.getScheduleExceptions();
                render();
                Toast.success('Đã cập nhật');
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        removeSchedule(id, exceptionId = null, occurrenceDate = '') {
            if (exceptionId) {
                Modal.confirm({ title: 'Khôi phục lịch gốc', message: 'Bạn đang thao tác trên một buổi học đã được bù/đổi lịch. Việc xóa sẽ khôi phục lại lịch gốc. Bạn có chắc chắn?', confirmText: 'Khôi phục', danger: true });
                Modal.bindConfirm(async () => {
                    try {
                        await DB.deleteScheduleException(exceptionId);
                        scheduleExceptions = scheduleExceptions.filter(e => e.id !== exceptionId);
                        render();
                        Toast.success('Đã khôi phục lịch gốc');
                    } catch(e) { Toast.error('Lỗi', e.message); }
                });
            } else {
                let dateFmt = occurrenceDate;
                if (occurrenceDate) {
                    const [y, m, d] = occurrenceDate.split('-');
                    dateFmt = `${d}/${m}/${y}`;
                }
                Modal.show({
                    title: 'Xóa lịch học',
                    content: `
                        <p style="margin-bottom: 12px; font-size: 15px;">Bạn muốn xóa buổi học ngày <strong>${dateFmt}</strong> hay xóa toàn bộ lịch định kỳ này của môn học?</p>
                    `,
                    footer: `
                        <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                        <button class="btn btn-warning" onclick="SchedulePage._processRemove('${id}', '${occurrenceDate}', false)">Xóa 1 buổi này</button>
                        <button class="btn btn-danger" onclick="SchedulePage._processRemove('${id}', null, true)">Xóa toàn bộ</button>
                    `
                });
            }
        },

        async _processRemove(id, occurrenceDate, isAll) {
            Modal.close();
            try {
                if (isAll) {
                    await DB.deleteSchedule(id);
                    schedules = schedules.filter(s => s.id !== id);
                    Toast.success('Đã xóa toàn bộ lịch định kỳ');
                } else if (occurrenceDate) {
                    const exData = {
                        scheduleId: id,
                        originalDate: occurrenceDate,
                        newDate: null,
                        newStartTime: null,
                        newEndTime: null,
                        newRoom: null,
                        note: 'Nghỉ học'
                    };
                    const docRef = await DB.addScheduleException(exData);
                    exData.id = docRef.id;
                    scheduleExceptions.push(exData);
                    Toast.success('Đã xóa buổi học');
                }
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        }
    };
});
