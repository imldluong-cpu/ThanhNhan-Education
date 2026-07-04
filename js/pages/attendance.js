// ============================================
// ATTENDANCE PAGE
// ============================================

Router.register('attendance', async (container) => {
    const isManager = Auth.hasAnyRole('owner', 'admin', 'staff');
    const canEdit = Auth.hasAnyRole('owner', 'admin', 'staff', 'teacher');
    let classes = [], schedules = [];
    let selectedClassId = '', selectedDate = DB.today();
    let students = [], attendance = [], allStudents = [], dailyAttendance = [];
    try {
        const pClasses = Auth.isTeacher() ? DB.getClassesByTeacher(window.currentUser.id) : DB.getClasses();
        const pSchedules = DB.getSchedules();
        const pStudents = DB.getStudents();
        const pDaily = (async () => {
            if (!selectedDate) return;
            const snap = await window.db.collection('attendance').where('date', '==', selectedDate).get();
            dailyAttendance = snap.docs.map(d => d.data());
        })();
        [classes, schedules, allStudents] = await Promise.all([pClasses, pSchedules, pStudents, pDaily]);
    } catch(e) { console.warn(e); }
    
    // Global state for Monthly Grid
    window.globalGridRecords = {}; 
    window.globalGridClassDates = {};

    async function loadDailySummary() {
        if (!selectedDate) return;
        try {
            const snap = await window.db.collection('attendance').where('date', '==', selectedDate).get();
            dailyAttendance = snap.docs.map(d => d.data());
        } catch(e) { console.warn('Load summary error:', e); }
    }

    function getValidClassesForDate(dateStr) {
        if (!dateStr) return [];
        const [y, m, d] = dateStr.split('-');
        const dateObj = new Date(y, m - 1, d);
        const day = dateObj.getDay();
        const firestoreDay = day === 0 ? 8 : day + 1; // 2=Mon, 8=Sun
        
        const scheduledClassIds = new Set(schedules.filter(s => Number(s.dayOfWeek) === firestoreDay).map(s => s.classId));
        return classes.filter(c => scheduledClassIds.has(c.id));
    }

    async function loadData() {
        if (!selectedClassId) { students = []; attendance = []; return; }
        try {
            students = await DB.getStudentsByClass(selectedClassId);
            const att = await DB.getAttendance(selectedClassId, selectedDate);
            attendance = att.length > 0 ? att[0].records || [] : [];
        } catch(e) { console.warn('Load attendance error:', e); }
    }

    function getStatusObj(studentId) {
        const record = attendance.find(r => r.studentId === studentId);
        return record || { status: '', reason: '' };
    }

    async function renderMonthlyGrid() {
        const area = document.getElementById('att-area');
        
        const classSelect = document.getElementById('att-class-select');
        if (classSelect) classSelect.style.display = 'none';
        
        const summaryArea = document.getElementById('att-summary');
        if (summaryArea) summaryArea.style.display = 'none';

        if (!selectedDate) return;
        const [y, m, d] = selectedDate.split('-');
        const monthPrefix = `${y}-${m}`;

        // Show ALL classes, not just those scheduled for the selected day
        const allActiveClasses = classes.filter(c => c.status !== 'inactive');
        if (allActiveClasses.length === 0) {
            area.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><p>Không có lớp nào</p></div></div></div>';
            return;
        }

        area.innerHTML = '<div class="text-center" style="padding: 40px;"><div class="spinner"></div><p style="margin-top:10px;color:var(--text-muted);">Đang tải dữ liệu điểm danh tháng...</p></div>';

        let html = '';
        const allMonthDates = []; 
        const daysInMonth = new Date(y, m, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            allMonthDates.push(`${y}-${m}-${String(i).padStart(2, '0')}`);
        }

        window.globalGridRecords = {}; 
        window.globalGridClassDates = {};

        const classesToRender = [];
        
        // Single DB query for the entire month
        const allMonthAttendance = await DB.getAttendanceByMonth(`${monthPrefix}-01`, `${monthPrefix}-31`);

        for (const cls of allActiveClasses) {
            const classDays = schedules.filter(s => s.classId === cls.id).map(s => Number(s.dayOfWeek));
            if (classDays.length === 0) continue; 
            
            const classDates = allMonthDates.filter(dateStr => {
                const dateObj = new Date(dateStr.split('-')[0], dateStr.split('-')[1]-1, dateStr.split('-')[2]);
                const day = dateObj.getDay();
                const firestoreDay = day === 0 ? 8 : day + 1;
                return classDays.includes(firestoreDay);
            });
            if (classDates.length === 0) continue;
            window.globalGridClassDates[cls.id] = classDates;

            const classStudents = allStudents.filter(s => s.status === 'active' && (s.classIds || []).includes(cls.id));
            if (classStudents.length === 0) continue;

            classesToRender.push({ cls, classDates, classStudents });
        }

        for (let i = 0; i < classesToRender.length; i++) {
            const { cls, classDates, classStudents } = classesToRender[i];
            const monthAttendance = allMonthAttendance.filter(a => a.classId === cls.id);
            
            globalGridRecords[cls.id] = {};
            classStudents.forEach(s => globalGridRecords[cls.id][s.id] = {});
            
            monthAttendance.forEach(record => {
                const date = record.date;
                (record.records || []).forEach(r => {
                    if (globalGridRecords[cls.id][r.studentId]) {
                        // Backward compat: map old 'absent' to 'absent_unexcused'
                        let status = r.status;
                        if (status === 'absent') status = 'absent_unexcused';
                        if (status === 'late') status = 'present'; // treat old 'late' as present
                        globalGridRecords[cls.id][r.studentId][date] = { status, reason: r.reason || '' };
                    }
                });
            });

            // Count attendance summary for this class
            let totalPresent = 0, totalAbsent = 0;
            classStudents.forEach(student => {
                classDates.forEach(dateStr => {
                    const rec = globalGridRecords[cls.id][student.id][dateStr];
                    if (rec && rec.status === 'present') totalPresent++;
                    else if (rec && (rec.status === 'absent_excused' || rec.status === 'absent_unexcused')) totalAbsent++;
                });
            });

            html += `<div class="card" style="margin-bottom: 20px;">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <h3 style="margin:0;">📚 ${cls.name}</h3>
                    <div style="display:flex; gap:12px; font-size: 13px;">
                        <span style="color:var(--success);font-weight:600;">✓ Có mặt: ${totalPresent}</span>
                        <span style="color:var(--danger);font-weight:600;">✗ Vắng: ${totalAbsent}</span>
                        <span style="color:var(--text-muted);">📅 ${classDates.length} buổi/tháng</span>
                    </div>
                </div>
                <div class="card-body" style="overflow-x: auto; padding: 0;">
                    <table class="table" style="min-width: max-content; margin: 0; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--bg-color);">
                                <th style="position: sticky; left: 0; background: var(--bg-color); z-index: 2; border-right: 1px solid var(--border-color); min-width: 150px;">Học viên</th>
                                ${classDates.map(dateStr => {
                                    const dateD = dateStr.split('-')[2];
                                    const dateObj = new Date(dateStr.split('-')[0], dateStr.split('-')[1]-1, dateStr.split('-')[2]);
                                    const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
                                    const dayName = dayNames[dateObj.getDay()];
                                    const isToday = dateStr === DB.today();
                                    return `<th style="text-align:center; min-width: 55px; font-size: 12px; ${isToday ? 'background: var(--primary-light); color: var(--primary-color);' : ''}"><div>${dayName}</div><div>${dateD}/${m}</div></th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${classStudents.map(student => `
                                <tr>
                                    <td style="position: sticky; left: 0; background: white; z-index: 1; font-weight: 500; border-right: 1px solid var(--border-color);">${student.name}</td>
                                    ${classDates.map(dateStr => {
                                        const rec = globalGridRecords[cls.id][student.id][dateStr];
                                        const status = rec ? rec.status : '';
                                        const reason = rec ? rec.reason : '';
                                        let icon = '<div style="width:26px;height:26px;border-radius:50%;border:1.5px dashed var(--border-color);margin:0 auto;background:#fafafa;"></div>';
                                        if (status === 'present') { icon = '<div style="width:26px;height:26px;border-radius:50%;background:var(--success);color:white;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;">✓</div>'; }
                                        else if (status === 'absent_excused') { icon = '<div style="width:26px;height:26px;border-radius:50%;background:var(--warning);color:white;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;">CP</div>'; }
                                        else if (status === 'absent_unexcused') { icon = '<div style="width:26px;height:26px;border-radius:50%;background:var(--danger);color:white;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;">KP</div>'; }
                                        
                                        const isToday = dateStr === DB.today();
                                        return `<td id="cell-${cls.id}-${student.id}-${dateStr}" style="text-align:center; cursor:pointer; padding: 4px; ${isToday ? 'background: #f0f7ff;' : ''}" title="${reason ? 'Lý do: ' + reason : ''}" onclick="AttendancePage.cycleGridStatus('${cls.id}', '${student.id}', '${dateStr}')">
                                            ${icon}
                                        </td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        if (html === '') {
            html = '<div class="card"><div class="card-body"><div class="empty-state"><p>Không có dữ liệu học viên trong các lớp</p></div></div></div>';
        } else {
            html += `<div style="position: sticky; bottom: 20px; text-align: center; margin-top: 20px;">
                <button class="btn btn-primary btn-lg" style="box-shadow: 0 4px 12px rgba(13,110,253,0.3); padding: 12px 32px;" onclick="AttendancePage.saveAllGrid()"><i data-lucide="save"></i> Lưu điểm danh toàn bộ Tháng</button>
            </div>`;
        }
        
        area.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }

    function renderDailyView() {
        const area = document.getElementById('att-area');
        if (!area) return;

        const validClasses = getValidClassesForDate(selectedDate);
        
        const classSelect = document.getElementById('att-class-select');
        if (classSelect) {
            classSelect.style.display = 'inline-block';
            const currentVal = classSelect.value;
            classSelect.innerHTML = `<option value="">Chọn lớp</option>${validClasses.map(c => {
                const classStudentsCount = allStudents.filter(s => s.status === 'active' && (s.classIds || []).includes(c.id)).length;
                const attRecord = dailyAttendance.find(a => a.classId === c.id);
                let statusText = '(Chưa ĐD)';
                if (attRecord && attRecord.records) {
                    const presentCount = attRecord.records.filter(r => r.status === 'present').length;
                    statusText = `(${presentCount}/${classStudentsCount})`;
                }
                return `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${c.name} ${statusText}</option>`;
            }).join('')}`;
            if (currentVal && !validClasses.find(c => c.id === currentVal)) {
                selectedClassId = '';
                classSelect.value = '';
            }
        }

        const summaryArea = document.getElementById('att-summary');
        if (summaryArea) {
            summaryArea.style.display = 'block';
            if (validClasses.length === 0) {
                summaryArea.innerHTML = '';
            } else {
                let summaryHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:8px 0;">';
                validClasses.forEach(c => {
                    const classStudentsCount = allStudents.filter(s => s.status === 'active' && (s.classIds || []).includes(c.id)).length;
                    const attRecord = dailyAttendance.find(a => a.classId === c.id);
                    if (attRecord && attRecord.records) {
                        const presentCount = attRecord.records.filter(r => r.status === 'present').length;
                        summaryHtml += `<span class="badge badge-success" style="cursor:pointer;" onclick="AttendancePage.selectClass('${c.id}')">${c.name}: ${presentCount}/${classStudentsCount}</span>`;
                    } else {
                        summaryHtml += `<span class="badge badge-warning" style="cursor:pointer;" onclick="AttendancePage.selectClass('${c.id}')">${c.name}: Chưa ĐD</span>`;
                    }
                });
                summaryHtml += '</div>';
                summaryArea.innerHTML = summaryHtml;
            }
        }

        if (!selectedClassId) {
            area.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><p>Vui lòng chọn lớp có lịch học trong ngày</p></div></div></div>';
            return;
        }

        if (students.length === 0) {
            area.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><h3>Lớp chưa có học viên</h3><p>Vào mục Học viên để thêm học viên vào lớp này</p></div></div></div>';
            return;
        }

        area.innerHTML = `
            <div class="card">
                <div class="card-body" style="padding: 0;">
                    <table class="table" style="margin: 0;">
                        <thead>
                            <tr style="background: var(--bg-color);">
                                <th style="width: 40px; text-align: center;">#</th>
                                <th>Học viên</th>
                                <th style="text-align: center; width: 80px;">Có mặt</th>
                                <th style="text-align: center; width: 100px;">Vắng CP</th>
                                <th style="text-align: center; width: 100px;">Vắng KP</th>
                                <th style="width: 200px;">Lý do</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((s, i) => {
                                const rec = localRecords[s.id] || { status: '', reason: '' };
                                const status = rec.status;
                                return `<tr id="att-item-${s.id}">
                                    <td style="text-align: center; color: var(--text-muted);">${i + 1}</td>
                                    <td style="font-weight: 500;" class="att-student-name">${s.name}</td>
                                    <td style="text-align: center;">
                                        <button class="status-btn ${status === 'present' ? 'active-present' : ''}" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; font-size: 16px;" onclick="AttendancePage.setStatus('${s.id}', 'present')" title="Có mặt">✓</button>
                                    </td>
                                    <td style="text-align: center;">
                                        <button class="status-btn ${status === 'absent_excused' ? 'active-absent' : ''}" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; font-size: 11px; font-weight: 600;" onclick="AttendancePage.setStatus('${s.id}', 'absent_excused')" title="Vắng có phép">CP</button>
                                    </td>
                                    <td style="text-align: center;">
                                        <button class="status-btn ${status === 'absent_unexcused' ? 'active-absent' : ''}" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; font-size: 11px; font-weight: 600;" onclick="AttendancePage.setStatus('${s.id}', 'absent_unexcused')" title="Vắng không phép">KP</button>
                                    </td>
                                    <td class="att-reason-display" style="font-size: 13px; color: var(--danger);">
                                        <span class="reason-text">${rec.reason || ''}</span>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    ${canEdit ? `
                        <div style="padding: 16px; display:flex; justify-content:center; gap:var(--space-3);">
                            <button class="btn btn-secondary btn-lg" onclick="AttendancePage.markAllPresent()"><i data-lucide="check-square"></i> Cả lớp có mặt</button>
                            <button class="btn btn-primary btn-lg" onclick="AttendancePage.save()"><i data-lucide="save"></i> Lưu điểm danh</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    function render() {
        if (isManager) {
            renderMonthlyGrid();
        } else {
            renderDailyView();
        }
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="check-square"></i> ${isManager ? 'Điểm danh Tổng quan Tháng' : 'Điểm danh học viên'}</h1></div>
        </div>
        <div class="filter-bar">
            <input type="date" class="input" style="max-width:180px;" value="${selectedDate}" onchange="AttendancePage.selectDate(this.value)">
            <select class="select" id="att-class-select" style="max-width:300px; display:none;" onchange="AttendancePage.selectClass(this.value)">
                <option value="">Chọn lớp</option>
            </select>
        </div>
        <div id="att-summary" style="margin-bottom:var(--space-4); display:none;"></div>
        <div id="att-area"></div>
    `;
    
    // Initial call requires careful ordering
    let localRecords = {};
    if (isManager) {
        renderMonthlyGrid();
    } else {
        renderDailyView();
    }

    window.AttendancePage = {
        async selectClass(id) {
            selectedClassId = id;
            await loadData();
            localRecords = {};
            attendance.forEach(r => {
                let st = r.status;
                if (st === 'absent') st = 'absent_unexcused';
                if (st === 'late') st = 'present';
                localRecords[r.studentId] = { status: st, reason: r.reason || '' }; 
            });
            renderDailyView();
        },

        async selectDate(date) {
            selectedDate = date;
            if (isManager) {
                renderMonthlyGrid();
            } else {
                const validClasses = getValidClassesForDate(selectedDate);
                if (selectedClassId && !validClasses.find(c => c.id === selectedClassId)) {
                    selectedClassId = ''; 
                }
                await loadDailySummary();
                await loadData();
                localRecords = {};
                attendance.forEach(r => {
                    let st = r.status;
                    if (st === 'absent') st = 'absent_unexcused';
                    if (st === 'late') st = 'present';
                    localRecords[r.studentId] = { status: st, reason: r.reason || '' }; 
                });
                renderDailyView();
            }
        },

        async setStatus(studentId, status) {
            let reason = '';
            if (status === 'absent_excused' || status === 'absent_unexcused') {
                const res = await Swal.fire({
                    title: status === 'absent_excused' ? 'Lý do vắng có phép' : 'Lý do vắng không phép',
                    input: 'text',
                    inputPlaceholder: 'Nhập lý do vắng...',
                    showCancelButton: true,
                    confirmButtonText: 'Lưu',
                    cancelButtonText: 'Hủy'
                });
                if (!res.isConfirmed || !res.value.trim()) {
                    if (res.isConfirmed) Toast.warning('Vui lòng nhập lý do vắng');
                    return; // Cancelled or empty
                }
                reason = res.value.trim();
            }

            if (localRecords[studentId] && localRecords[studentId].status === status) {
                delete localRecords[studentId];
            } else {
                localRecords[studentId] = { status, reason };
            }

            // Update UI for this item
            const item = document.getElementById(`att-item-${studentId}`);
            if (item) {
                const btns = item.querySelectorAll('.status-btn');
                btns.forEach(btn => btn.classList.remove('active-present', 'active-absent'));
                const st = localRecords[studentId] ? localRecords[studentId].status : null;
                if (st === 'present') btns[0].classList.add('active-present');
                else if (st === 'absent_excused') btns[1].classList.add('active-absent');
                else if (st === 'absent_unexcused') btns[2].classList.add('active-absent');
                
                const reasonText = item.querySelector('.reason-text');
                if (reasonText) {
                    reasonText.textContent = (localRecords[studentId] && localRecords[studentId].reason) ? localRecords[studentId].reason : '';
                }
            }
        },

        async cycleGridStatus(classId, studentId, date) {
            if (!canEdit) return;
            const rec = globalGridRecords[classId][studentId][date] || { status: '', reason: '' };
            let nextStatus = '';
            let reason = '';
            
            if (rec.status === '') nextStatus = 'present';
            else if (rec.status === 'present') nextStatus = 'absent_excused';
            else if (rec.status === 'absent_excused') nextStatus = 'absent_unexcused';
            else if (rec.status === 'absent_unexcused') nextStatus = '';

            if (nextStatus === 'absent_excused' || nextStatus === 'absent_unexcused') {
                const res = await Swal.fire({
                    title: nextStatus === 'absent_excused' ? 'Lý do vắng có phép' : 'Lý do vắng không phép',
                    input: 'text',
                    inputPlaceholder: 'Nhập lý do vắng...',
                    showCancelButton: true,
                    confirmButtonText: 'Lưu',
                    cancelButtonText: 'Bỏ qua'
                });
                if (!res.isConfirmed || !res.value.trim()) {
                    if (res.isConfirmed) Toast.warning('Vui lòng nhập lý do vắng');
                    return; // abort cycle
                }
                reason = res.value.trim();
            }

            globalGridRecords[classId][studentId][date] = { status: nextStatus, reason };
            
            // Re-render cell
            const cell = document.getElementById(`cell-${classId}-${studentId}-${date}`);
            if (cell) {
                let icon = '<div style="width:26px;height:26px;border-radius:50%;border:1.5px dashed var(--border-color);margin:0 auto;background:#fafafa;"></div>';
                if (nextStatus === 'present') { icon = '<div style="width:26px;height:26px;border-radius:50%;background:var(--success);color:white;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;">✓</div>'; }
                else if (nextStatus === 'absent_excused') { icon = '<div style="width:26px;height:26px;border-radius:50%;background:var(--warning);color:white;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;">CP</div>'; }
                else if (nextStatus === 'absent_unexcused') { icon = '<div style="width:26px;height:26px;border-radius:50%;background:var(--danger);color:white;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;">KP</div>'; }
                cell.innerHTML = icon;
                cell.title = reason ? 'Lý do: ' + reason : '';
            }
        },

        markAllPresent() {
            students.forEach(s => {
                localRecords[s.id] = { status: 'present', reason: '' };
            });
            renderDailyView();
        },

        async save() {
            if (!selectedClassId) return;
            const records = Object.entries(localRecords).map(([studentId, data]) => ({ studentId, status: data.status, reason: data.reason }));
            if (records.length === 0) { Toast.warning('Chưa điểm danh ai'); return; }
            try {
                await DB.saveAttendance({ classId: selectedClassId, date: selectedDate, records });
                const present = records.filter(r => r.status === 'present').length;
                const absentE = records.filter(r => r.status === 'absent_excused').length;
                const absentU = records.filter(r => r.status === 'absent_unexcused').length;
                Toast.success('Đã lưu điểm danh', `✓ ${present} có mặt, ✗ ${absentE+absentU} vắng`);
                await loadDailySummary();
                renderDailyView();
            } catch(e) { Toast.error('Lỗi lưu', e.message); }
        },

        async saveAllGrid() {
            if (!canEdit) return;
            try {
                Toast.info('Đang lưu dữ liệu...', 'Vui lòng đợi...');
                const updates = [];
                for (const classId in globalGridRecords) {
                    const classDates = globalGridClassDates[classId] || [];
                    for (const dateStr of classDates) {
                        const records = [];
                        for (const studentId in globalGridRecords[classId]) {
                            const rec = globalGridRecords[classId][studentId][dateStr];
                            if (rec && rec.status) {
                                records.push({ studentId, status: rec.status, reason: rec.reason || '' });
                            }
                        }
                        if (records.length > 0) {
                            updates.push({ classId, date: dateStr, records });
                        }
                    }
                }
                if (updates.length === 0) {
                    Toast.warning('Không có dữ liệu nào để lưu');
                    return;
                }
                
                await DB.saveAttendanceBatch(updates);
                Toast.success('Đã lưu toàn bộ điểm danh', `Cập nhật thành công ${updates.length} bản ghi ngày.`);
            } catch(e) {
                console.error(e);
                Toast.error('Lỗi lưu dữ liệu', e.message);
            }
        }
    };
});

