// ============================================
// TEACHER ATTENDANCE - GPS, Salary, Schedule Filter
// ============================================

Router.register('teacher-attendance', async (container) => {
    const isOwner = Auth.isOwner();
    const isTeacher = Auth.isTeacher();
    let records = [], teachers = [], classes = [], settings = {}, schedules = [];
    const currentMonth = DB.currentMonth();
    let selectedMonth = currentMonth;
    let mySalaryConfig = {};

    try {
        settings = await DB.getSettings();
        records = await DB.getTeacherAttendance(selectedMonth);
        adjustments = await DB.getSalaryAdjustments(selectedMonth);
        schedules = await DB.getSchedules();
        if (isOwner) teachers = await DB.getTeachers();
        if (isTeacher) {
            classes = await DB.getClassesByTeacher(window.currentUser.id);
            const myDoc = await window.db.collection('users').doc(window.currentUser.id).get();
            mySalaryConfig = myDoc.exists ? (myDoc.data().salaryConfig || {}) : {};
        } else {
            classes = await DB.getClasses();
        }
    } catch(e) { console.warn(e); }

    function getTeacherName(id) {
        if (isTeacher && id === window.currentUser.id) return window.currentUser.displayName;
        const t = teachers.find(x => x.id === id);
        return t ? t.displayName : '—';
    }
    
    function getClassName(id) { return (classes.find(c => c.id === id) || {}).name || '—'; }

    function getMyRecords() {
        if (isTeacher) return records.filter(r => r.teacherId === window.currentUser.id);
        return records;
    }

    function getClassesForDate(dateStr) {
        if (!dateStr) return [];
        // Parse date locally to avoid UTC timezone offset issues
        const [y, m, d] = dateStr.split('-');
        const dateObj = new Date(y, m - 1, d);
        const day = dateObj.getDay();
        const firestoreDay = day === 0 ? 8 : day + 1;
        
        const scheduledClassIds = new Set(schedules.filter(s => Number(s.dayOfWeek) === firestoreDay).map(s => s.classId));
        return classes.filter(c => scheduledClassIds.has(c.id));
    }

    const shiftNames = { morning: 'Ca sáng', afternoon: 'Ca chiều', evening: 'Ca tối', custom: 'Tùy chỉnh' };

    function render() {
        const area = document.getElementById('ta-area');
        if (!area) return;
        const myRecords = getMyRecords();

        const teacherAdjustments = {};
        adjustments.forEach(a => {
            if (!teacherAdjustments[a.teacherId]) teacherAdjustments[a.teacherId] = [];
            teacherAdjustments[a.teacherId].push(a);
        });

        // Summary
        const teacherSummary = {};
        let totalSalaryAll = 0;
        myRecords.forEach(r => {
            if (!teacherSummary[r.teacherId]) teacherSummary[r.teacherId] = { total: 0, hours: 0, salary: 0 };
            teacherSummary[r.teacherId].total++;
            teacherSummary[r.teacherId].hours += (r.hours || 0);
            
            let rSalary = r.salary || 0;
            if (r.salaryMultiplier !== undefined) rSalary = rSalary * r.salaryMultiplier;
            if (r.penaltyAmount) rSalary = rSalary - r.penaltyAmount;
            if (rSalary < 0) rSalary = 0;
            r.finalSalary = rSalary;

            teacherSummary[r.teacherId].salary += rSalary;
            totalSalaryAll += rSalary;
        });

        Object.entries(teacherSummary).forEach(([tid, s]) => {
            const adjs = teacherAdjustments[tid] || [];
            let adjSum = 0;
            adjs.forEach(a => adjSum += Number(a.amount));
            s.salary += adjSum;
            totalSalaryAll += adjSum;
        });

        let html = '';

        if (isOwner) {
            const hasLocation = settings.centerLat && settings.centerLng;
            html += `
                <div class="card mb-4" style="border-left:3px solid var(--primary-500);">
                    <div class="card-body" style="padding:12px 16px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <div>
                                <strong>📍 Vị trí trung tâm:</strong> 
                                ${hasLocation ? `<span class="badge badge-success">Đã cài đặt (${settings.centerLat?.toFixed(4)}, ${settings.centerLng?.toFixed(4)})</span> Bán kính: ${settings.checkInRadius || 100}m` : '<span class="badge badge-warning">Chưa cài đặt</span>'}
                            </div>
                            <button class="btn btn-secondary btn-sm" onclick="TAPage.setupLocation()">⚙️ Cài đặt vị trí</button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (isTeacher) {
            html += `
                <div class="card mb-4" style="text-align:center;padding:24px;">
                    <h3 style="margin-bottom:12px;">Chấm công hôm nay</h3>
                    <button class="btn btn-primary btn-lg" onclick="TAPage.checkIn()" id="checkin-btn" style="font-size:16px;padding:12px 32px;">
                        📍 Chấm công
                    </button>
                    <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Bạn cần ở tại trung tâm để chấm công. Chỉ hiển thị lớp có lịch hôm nay.</p>
                </div>
            `;
        }

        // Records table
        html += `<div class="card"><div class="table-container"><table>
            <thead><tr>${isOwner ? '<th>Giáo viên</th>' : ''}<th>Ngày</th><th>Ca/Giờ</th><th>Lớp</th><th>Số giờ</th><th>Lương</th><th>Ghi chú</th><th>Thao tác</th></tr></thead>
            <tbody>`;

        if (myRecords.length === 0) {
            html += `<tr><td colspan="${isOwner ? 8 : 7}"><div class="empty-state"><p>Chưa có dữ liệu chấm công tháng này</p></div></td></tr>`;
        } else {
                html += myRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => `<tr>
                ${isOwner ? `<td>${getTeacherName(r.teacherId)}</td>` : ''}
                <td>${DB.formatDate(r.date)}</td>
                <td>${r.shift !== 'custom' ? shiftNames[r.shift] || r.shift : `${r.startTime || ''}-${r.endTime || ''}`}</td>
                <td>${getClassName(r.classId)}</td>
                <td><strong>${r.hours || 0}h</strong></td>
                <td style="color:var(--success-500);font-weight:600;">
                    ${DB.formatCurrency(r.finalSalary)}
                    ${r.penaltyReason ? `<div style="color:var(--danger-500);font-size:11px;font-weight:400;margin-top:2px;">${r.penaltyReason}</div>` : ''}
                </td>
                <td class="text-sm">${r.note || ''}</td>
                <td>
                    <div class="table-actions">
                        ${isOwner ? `<button class="btn-icon" title="Phạt vi phạm" onclick="TAPage.showPenalty('${r.id}')"><i data-lucide="alert-triangle" style="color:var(--danger-500);"></i></button>` : ''}
                        <button class="btn-icon" title="Xóa" onclick="TAPage.removeRecord('${r.id}')"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            </tr>`).join('');
        }

        html += '</tbody></table></div></div>';

        // Summary cards
        if (Object.keys(teacherSummary).length > 0) {
            html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px;margin-bottom:16px;">
                <h3 style="margin:0;">Tổng hợp lương tháng ${selectedMonth} ${isOwner ? `(Tổng: ${DB.formatCurrency(totalSalaryAll)})` : ''}</h3>
                ${isOwner ? `<button class="btn btn-primary" onclick="TAPage.finalizeSalary()"><i data-lucide="check-circle"></i> Chốt lương & Chi trả</button>` : ''}
            </div>`;
            html += '<div class="stats-grid" style="align-items:start;">';
            Object.entries(teacherSummary).forEach(([tid, s]) => {
                const adjs = teacherAdjustments[tid] || [];
                let adjsHtml = '';
                adjs.forEach(a => {
                    adjsHtml += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-color);">
                        <span style="flex:1;">${a.reason}</span>
                        <span style="color:${a.amount >= 0 ? 'var(--success-500)' : 'var(--danger-500)'};font-weight:600;margin-left:8px;">${a.amount > 0 ? '+' : ''}${DB.formatCurrency(a.amount)}</span>
                        ${isOwner ? `<button class="btn-icon" style="padding:0;margin-left:4px;" onclick="TAPage.removeAdjustment('${a.id}')"><i data-lucide="x" style="width:14px;height:14px;color:var(--text-muted);"></i></button>` : ''}
                    </div>`;
                });

                html += `<div class="stat-card" style="padding:16px;">
                    <div class="stat-value" style="color:var(--success-500);">${DB.formatCurrency(s.salary)}</div>
                    <div class="stat-label" style="margin-bottom:8px;">${getTeacherName(tid)} — ${s.total} buổi (${s.hours}h)</div>
                    ${adjsHtml}
                    ${isOwner ? `<button class="btn btn-secondary btn-sm" style="width:100%;margin-top:12px;font-size:12px;" onclick="TAPage.showAdjustment('${tid}')"><i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Thêm thưởng/phạt</button>` : ''}
                </div>`;
            });
            html += '</div>';
        }

        area.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="clock"></i> Chấm công & Lương</h1></div>
            <div class="page-actions">
                ${isOwner ? `<button class="btn btn-primary" onclick="TAPage.showAddRecord()"><i data-lucide="plus"></i> Thêm chấm công</button>` : ''}
            </div>
        </div>
        <div class="filter-bar">
            <input type="month" class="input" style="max-width:200px;" value="${selectedMonth}" onchange="TAPage.changeMonth(this.value)">
        </div>
        <div id="ta-area"></div>
    `;
    render();

    window.TAPage = {
        async changeMonth(m) {
            selectedMonth = m;
            records = await DB.getTeacherAttendance(m);
            adjustments = await DB.getSalaryAdjustments(m);
            render();
        },

        async finalizeSalary() {
            if (!Auth.isOwner()) return;
            const myRecords = getMyRecords();
            const summary = {};
            const teacherAdjustments = {};
            adjustments.forEach(a => {
                if (!teacherAdjustments[a.teacherId]) teacherAdjustments[a.teacherId] = [];
                teacherAdjustments[a.teacherId].push(a);
            });

            myRecords.forEach(r => {
                if (!summary[r.teacherId]) summary[r.teacherId] = { salary: 0 };
                let rSalary = r.salary || 0;
                if (r.salaryMultiplier !== undefined) rSalary = rSalary * r.salaryMultiplier;
                if (r.penaltyAmount) rSalary = rSalary - r.penaltyAmount;
                if (rSalary < 0) rSalary = 0;
                summary[r.teacherId].salary += rSalary;
            });
            Object.entries(summary).forEach(([tid, s]) => {
                const adjs = teacherAdjustments[tid] || [];
                adjs.forEach(a => s.salary += Number(a.amount));
            });
            if (Object.keys(summary).length === 0) return Toast.warning('Chưa có dữ liệu', 'Không có dữ liệu lương để chốt');
            
            try {
                const existingFinance = await DB.getFinanceRecords(selectedMonth);
                const alreadyPaid = existingFinance.some(r => r.category === 'Lương GV' && (r.description || '').includes('Lương tháng ' + selectedMonth));
                if (alreadyPaid) {
                    if (!confirm('CẢNH BÁO: Bạn đã từng chốt lương tháng ' + selectedMonth + ' rồi. Nếu tiếp tục sẽ bị Ghi nhận trùng lặp vào chi phí. Bạn vẫn muốn tiếp tục?')) return;
                } else {
                    if (!confirm('Chốt lương tháng ' + selectedMonth + ' và ghi nhận vào danh sách Chi phí Tài chính?')) return;
                }

                const promises = [];
                for (const [tid, s] of Object.entries(summary)) {
                    if (s.salary > 0) {
                        promises.push(DB.addFinanceRecord({
                            type: 'expense',
                            category: 'Lương GV',
                            date: DB.today(),
                            amount: s.salary,
                            description: 'Lương tháng ' + selectedMonth + ' - ' + getTeacherName(tid),
                            month: selectedMonth
                        }));
                    }
                }
                await Promise.all(promises);
                Toast.success('Thành công', 'Đã chuyển dữ liệu trả lương vào sổ Tài chính');
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        // === GPS CHECK-IN ===
        async checkIn() {
            const btn = document.getElementById('checkin-btn');
            btn.disabled = true;
            btn.innerHTML = '⏳ Đang kiểm tra vị trí...';

            if (!settings.centerLat || !settings.centerLng) {
                Toast.error('Chưa cài đặt', 'Chủ trung tâm chưa cài đặt vị trí. Liên hệ quản lý.');
                btn.disabled = false;
                btn.innerHTML = '📍 Chấm công';
                return;
            }

            if (!navigator.geolocation) {
                Toast.error('Không hỗ trợ', 'Trình duyệt không hỗ trợ GPS');
                btn.disabled = false;
                btn.innerHTML = '📍 Chấm công';
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const dist = this._getDistance(pos.coords.latitude, pos.coords.longitude, settings.centerLat, settings.centerLng);
                    const maxDist = settings.checkInRadius || 100;

                    if (dist > maxDist) {
                        Toast.error('Ngoài phạm vi', `Bạn cách trung tâm ${Math.round(dist)}m (cho phép: ${maxDist}m)`);
                        btn.disabled = false;
                        btn.innerHTML = '📍 Chấm công';
                        return;
                    }

                    this._showCheckInForm();
                    btn.disabled = false;
                    btn.innerHTML = '📍 Chấm công';
                },
                (err) => {
                    Toast.error('Lỗi GPS', 'Vui lòng bật GPS và cho phép truy cập vị trí');
                    btn.disabled = false;
                    btn.innerHTML = '📍 Chấm công';
                }
            );
        },

        _showCheckInForm() {
            const validClasses = getClassesForDate(DB.today());
            
            Modal.show({
                title: '✅ Xác nhận chấm công hôm nay',
                content: `
                    <p style="color:var(--success-400);margin-bottom:12px;">📍 Vị trí hợp lệ — Bạn đang ở trung tâm</p>
                    <div class="form-group"><label class="form-label">Ca</label>
                        <select class="select" id="ci-shift" onchange="TAPage._shiftChange(this.value)">
                            <option value="morning">Ca sáng (7:00-11:30)</option>
                            <option value="afternoon">Ca chiều (13:00-17:30)</option>
                            <option value="evening">Ca tối (18:00-21:00)</option>
                            <option value="custom">Tùy chỉnh giờ</option>
                        </select></div>
                    <div id="ci-custom-time" style="display:none;">
                        <div class="form-row">
                            <div class="form-group"><label class="form-label">Vào</label><input type="time" class="input" id="ci-start"></div>
                            <div class="form-group"><label class="form-label">Ra</label><input type="time" class="input" id="ci-end"></div>
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Lớp dạy (Chỉ hiện lớp có lịch hôm nay)</label>
                        <select class="select" id="ci-class">
                            <option value="">Chọn</option>
                            ${validClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                        ${validClasses.length === 0 ? '<p style="color:var(--danger-400);font-size:12px;margin-top:4px;">Bạn không có lớp nào xếp lịch vào hôm nay.</p>' : ''}
                    </div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="input" id="ci-note"></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-success" onclick="TAPage.confirmCheckIn()">✓ Xác nhận</button>`
            });
        },

        _shiftChange(val) {
            document.getElementById('ci-custom-time').style.display = val === 'custom' ? '' : 'none';
        },

        async confirmCheckIn() {
            const shift = document.getElementById('ci-shift').value;
            let hours = 0, startTime = '', endTime = '';
            if (shift === 'morning') { hours = 4.5; startTime = '07:00'; endTime = '11:30'; }
            else if (shift === 'afternoon') { hours = 4.5; startTime = '13:00'; endTime = '17:30'; }
            else if (shift === 'evening') { hours = 3; startTime = '18:00'; endTime = '21:00'; }
            else {
                startTime = document.getElementById('ci-start').value;
                endTime = document.getElementById('ci-end').value;
                if (startTime && endTime) {
                    const [sh, sm] = startTime.split(':').map(Number);
                    const [eh, em] = endTime.split(':').map(Number);
                    hours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
                }
            }

            const classId = document.getElementById('ci-class').value;
            const classConf = mySalaryConfig[classId] || {};
            let salary = 0;
            if (shift === 'custom') {
                salary = (classConf.perHour || 0) * hours;
            } else {
                salary = classConf.perShift || 0;
            }

            try {
                await DB.addTeacherAttendanceRecord({
                    teacherId: window.currentUser.id,
                    date: DB.today(),
                    shift, startTime, endTime, hours, salary,
                    classId: document.getElementById('ci-class').value,
                    note: document.getElementById('ci-note').value,
                    month: DB.currentMonth()
                });
                Modal.close();
                Toast.success('Chấm công thành công!');
                records = await DB.getTeacherAttendance(selectedMonth);
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        // === GPS DISTANCE ===
        _getDistance(lat1, lon1, lat2, lon2) {
            const R = 6371e3;
            const toRad = x => x * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        },

        // === OWNER: SET LOCATION ===
        setupLocation() {
            Modal.show({
                title: '📍 Cài đặt vị trí trung tâm',
                content: `
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Giáo viên chỉ chấm công được khi ở trong bán kính cho phép quanh vị trí này.</p>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Vĩ độ (Lat)</label><input type="number" step="any" class="input" id="loc-lat" value="${settings.centerLat || ''}"></div>
                        <div class="form-group"><label class="form-label">Kinh độ (Lng)</label><input type="number" step="any" class="input" id="loc-lng" value="${settings.centerLng || ''}"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Bán kính cho phép (mét)</label><input type="number" class="input" id="loc-radius" value="${settings.checkInRadius || 100}"></div>
                    <button class="btn btn-secondary" onclick="TAPage.getMyLocation()" style="width:100%;">📍 Lấy vị trí hiện tại của tôi</button>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.saveLocation()">Lưu</button>`
            });
        },

        getMyLocation() {
            if (!navigator.geolocation) { Toast.error('GPS không khả dụng'); return; }
            Toast.info('Đang lấy vị trí...');
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    document.getElementById('loc-lat').value = pos.coords.latitude;
                    document.getElementById('loc-lng').value = pos.coords.longitude;
                    Toast.success('Đã lấy vị trí');
                },
                () => Toast.error('Không thể lấy vị trí', 'Bật GPS và cho phép truy cập')
            );
        },

        async saveLocation() {
            const lat = parseFloat(document.getElementById('loc-lat').value);
            const lng = parseFloat(document.getElementById('loc-lng').value);
            const radius = parseInt(document.getElementById('loc-radius').value) || 100;
            if (isNaN(lat) || isNaN(lng)) { Toast.warning('Nhập tọa độ'); return; }
            try {
                await DB.updateSettings({ centerLat: lat, centerLng: lng, checkInRadius: radius });
                settings.centerLat = lat;
                settings.centerLng = lng;
                settings.checkInRadius = radius;
                Modal.close();
                Toast.success('Đã cài đặt vị trí');
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        // === OWNER: ADD RECORD MANUALLY ===
        showAddRecord() {
            const initialDate = DB.today();
            const classListHtml = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            Modal.show({
                title: 'Thêm chấm công',
                content: `
                    <div class="form-group"><label class="form-label">Giáo viên *</label>
                        <select class="select" id="ta-teacher"><option value="">Chọn</option>${teachers.map(t => `<option value="${t.id}">${t.displayName || t.email}</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Ngày</label><input type="date" class="input" id="ta-date" value="${initialDate}"></div>
                        <div class="form-group"><label class="form-label">Ca</label>
                            <select class="select" id="ta-shift"><option value="morning">Sáng</option><option value="afternoon">Chiều</option><option value="evening">Tối</option><option value="custom">Tùy chỉnh</option></select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Giờ vào</label><input type="time" class="input" id="ta-start"></div>
                        <div class="form-group"><label class="form-label">Giờ ra</label><input type="time" class="input" id="ta-end"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Lớp (Tất cả lớp)</label>
                        <select class="select" id="ta-class"><option value="">Chọn</option>${classListHtml}</select></div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="input" id="ta-note"></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.saveRecord()">Lưu</button>`
            });
        },

        async saveRecord() {
            const teacherId = document.getElementById('ta-teacher').value;
            if (!teacherId) { Toast.warning('Chọn giáo viên'); return; }
            const date = document.getElementById('ta-date').value;
            const shift = document.getElementById('ta-shift').value;
            const startTime = document.getElementById('ta-start').value;
            const endTime = document.getElementById('ta-end').value;
            let hours = 0;
            if (startTime && endTime) {
                const [sh, sm] = startTime.split(':').map(Number);
                const [eh, em] = endTime.split(':').map(Number);
                hours = Math.round(((eh*60+em)-(sh*60+sm))/60*10)/10;
            } else if (shift === 'morning' || shift === 'afternoon') hours = 4.5;
            else if (shift === 'evening') hours = 3;

            const t = teachers.find(x => x.id === teacherId);
            const salaryConfig = t ? (t.salaryConfig || {}) : {};
            const classConf = salaryConfig[document.getElementById('ta-class').value] || {};
            let salary = 0;
            if (shift === 'custom') {
                salary = (classConf.perHour || 0) * hours;
            } else {
                salary = classConf.perShift || 0;
            }

            try {
                await DB.addTeacherAttendanceRecord({
                    teacherId, date, shift, startTime, endTime, hours, salary,
                    classId: document.getElementById('ta-class').value,
                    note: document.getElementById('ta-note').value,
                    month: date.substring(0, 7)
                });
                Modal.close();
                Toast.success('Đã thêm');
                records = await DB.getTeacherAttendance(selectedMonth);
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        removeRecord(id) {
            Modal.confirm({ title: 'Xóa', message: 'Xóa bản ghi chấm công này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                await DB.deleteTeacherAttendanceRecord(id);
                records = records.filter(r => r.id !== id);
                render();
                Toast.success('Đã xóa');
            });
        },

        // === PENALTY & BONUS ===
        showPenalty(id) {
            const r = records.find(x => x.id === id);
            if (!r) return;
            
            Modal.show({
                title: '⚡ Phạt vi phạm giờ giấc',
                content: `
                    <div class="form-group">
                        <label class="form-label">Giáo viên: <strong>${getTeacherName(r.teacherId)}</strong></label>
                        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Ngày: ${DB.formatDate(r.date)} | Ca: ${shiftNames[r.shift] || r.shift}</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Chọn mức phạt</label>
                        <select class="select" id="penalty-select" onchange="TAPage.onPenaltyChange()">
                            <option value="">-- Chọn hình thức xử lý --</option>
                            <option value="warn">Nhắc nhở (Không trừ tiền)</option>
                            <option value="late_10">Đi trễ 10p (Phạt 20.000đ)</option>
                            <option value="late_15">Đi trễ 15p (Trừ 50% lương buổi)</option>
                            <option value="late_20">Đi trễ 20p (Trừ 100% lương buổi)</option>
                            <option value="custom">Tùy chỉnh...</option>
                        </select>
                    </div>
                    <div id="penalty-custom" style="display:none;background:var(--bg-glass);padding:12px;border-radius:8px;">
                        <div class="form-group">
                            <label class="form-label">Số tiền phạt (VNĐ)</label>
                            <input type="number" class="input" id="penalty-amount" placeholder="VD: 20000">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nhân hệ số lương (1 = 100%, 0.5 = 50%, 0 = 0%)</label>
                            <input type="number" step="0.1" class="input" id="penalty-multiplier" value="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Lý do</label>
                            <input type="text" class="input" id="penalty-reason">
                        </div>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.savePenalty('${id}')">Áp dụng</button>`
            });
        },

        onPenaltyChange() {
            const val = document.getElementById('penalty-select').value;
            const customDiv = document.getElementById('penalty-custom');
            const amt = document.getElementById('penalty-amount');
            const mul = document.getElementById('penalty-multiplier');
            const rsn = document.getElementById('penalty-reason');
            
            if (val === 'custom') {
                customDiv.style.display = 'block';
            } else {
                customDiv.style.display = 'none';
                if (val === 'warn') { amt.value = 0; mul.value = 1; rsn.value = 'Nhắc nhở đi trễ'; }
                else if (val === 'late_10') { amt.value = 20000; mul.value = 1; rsn.value = 'Đi trễ > 10p'; }
                else if (val === 'late_15') { amt.value = 0; mul.value = 0.5; rsn.value = 'Đi trễ > 15p'; }
                else if (val === 'late_20') { amt.value = 0; mul.value = 0; rsn.value = 'Đi trễ > 20p'; }
                else { amt.value = ''; mul.value = ''; rsn.value = ''; }
            }
        },

        async savePenalty(id) {
            const amt = parseInt(document.getElementById('penalty-amount').value) || 0;
            const mul = parseFloat(document.getElementById('penalty-multiplier').value);
            const rsn = document.getElementById('penalty-reason').value;
            
            if (isNaN(mul)) { Toast.warning('Vui lòng chọn hoặc nhập đủ thông tin'); return; }
            
            try {
                const data = { penaltyAmount: amt, salaryMultiplier: mul, penaltyReason: rsn };
                await DB.updateTeacherAttendanceRecord(id, data);
                const r = records.find(x => x.id === id);
                if (r) Object.assign(r, data);
                Modal.close();
                Toast.success('Đã áp dụng mức phạt');
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        showAdjustment(teacherId) {
            const teacherClasses = classes.filter(c => (c.teacherIds || []).includes(teacherId));
            
            Modal.show({
                title: '🎁 Thêm Thưởng / Phạt',
                content: `
                    <div class="form-group">
                        <label class="form-label">Chọn Loại Thưởng/Phạt</label>
                        <select class="select" id="adj-select" onchange="TAPage.onAdjChange()">
                            <option value="">-- Chọn --</option>
                            <option value="upsell_gv">Thưởng Upsell (Giáo viên) - 25% tháng đầu</option>
                            <option value="upsell_cf">Thưởng Upsell (Cofounder) - 50% tháng đầu</option>
                            <option value="retention">Thưởng Giữ sĩ số - 5% doanh thu</option>
                            <option value="custom">Tùy chỉnh...</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group" id="adj-class-group" style="display:none;">
                            <label class="form-label">Chọn lớp áp dụng</label>
                            <select class="select" id="adj-class" onchange="TAPage.onAdjClassChange()">
                                <option value="">-- Chọn lớp --</option>
                                ${teacherClasses.map(c => `<option value="${c.fee || 0}" data-name="${c.name}">${c.name} (${DB.formatCurrency(c.fee || 0)})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" id="adj-calc-group" style="display:none;">
                            <label class="form-label">Học phí / Doanh thu (VNĐ)</label>
                            <input type="number" class="input" id="adj-base" placeholder="Nhập vào để máy tự tính thưởng" oninput="TAPage.onAdjInput()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Số tiền điều chỉnh (VNĐ) *</label>
                        <input type="number" class="input" id="adj-amount" placeholder="Ghi số âm (VD: -50000) nếu là Phạt">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú / Lý do *</label>
                        <input type="text" class="input" id="adj-reason" placeholder="VD: Thưởng Upsell học viên A">
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.saveAdjustment('${teacherId}')">Lưu</button>`
            });
        },

        onAdjChange() {
            const val = document.getElementById('adj-select').value;
            const calcGrp = document.getElementById('adj-calc-group');
            const classGrp = document.getElementById('adj-class-group');
            const rsn = document.getElementById('adj-reason');
            const amt = document.getElementById('adj-amount');
            
            if (val === 'upsell_gv' || val === 'upsell_cf' || val === 'retention') {
                calcGrp.style.display = 'block';
                classGrp.style.display = 'block';
                if (val === 'upsell_gv') rsn.value = 'Thưởng Upsell (GV)';
                if (val === 'upsell_cf') rsn.value = 'Thưởng Upsell (Cofounder)';
                if (val === 'retention') rsn.value = 'Thưởng giữ sĩ số lớp';
            } else {
                calcGrp.style.display = 'none';
                classGrp.style.display = 'none';
                if (val !== 'custom') rsn.value = '';
            }
            amt.value = '';
            document.getElementById('adj-base').value = '';
            document.getElementById('adj-class').value = '';
        },

        onAdjClassChange() {
            const select = document.getElementById('adj-class');
            const fee = select.value;
            const opt = select.options[select.selectedIndex];
            if (!fee || fee === '0') return;
            
            document.getElementById('adj-base').value = fee;
            TAPage.onAdjInput();
            
            const rsn = document.getElementById('adj-reason');
            const val = document.getElementById('adj-select').value;
            const className = opt.getAttribute('data-name') || '';
            if (val === 'upsell_gv') rsn.value = 'Thưởng Upsell (GV) - Lớp ' + className;
            if (val === 'upsell_cf') rsn.value = 'Thưởng Upsell (Cofounder) - Lớp ' + className;
            if (val === 'retention') rsn.value = 'Thưởng giữ sĩ số - Lớp ' + className;
        },

        onAdjInput() {
            const val = document.getElementById('adj-select').value;
            const base = parseInt(document.getElementById('adj-base').value) || 0;
            const amtInput = document.getElementById('adj-amount');
            
            if (val === 'upsell_gv') amtInput.value = base * 0.25;
            else if (val === 'upsell_cf') amtInput.value = base * 0.50;
            else if (val === 'retention') amtInput.value = base * 0.05;
        },

        async saveAdjustment(teacherId) {
            const amt = parseInt(document.getElementById('adj-amount').value);
            const rsn = document.getElementById('adj-reason').value;
            if (isNaN(amt) || !rsn) { Toast.warning('Vui lòng nhập số tiền và lý do'); return; }
            
            try {
                const adj = { teacherId, amount: amt, reason: rsn, month: selectedMonth };
                const docRef = await DB.addSalaryAdjustment(adj);
                adj.id = docRef.id;
                adjustments.push(adj);
                Modal.close();
                Toast.success('Đã thêm');
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async removeAdjustment(id) {
            Modal.confirm({ title: 'Xóa', message: 'Bạn muốn xóa khoản điều chỉnh này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                await DB.deleteSalaryAdjustment(id);
                adjustments = adjustments.filter(a => a.id !== id);
                render();
                Toast.success('Đã xóa');
            });
        }
    };
});
