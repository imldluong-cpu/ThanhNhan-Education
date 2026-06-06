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
        // JS getDay(): 0=Sun, 1=Mon...
        // Firestore schedule dayOfWeek: 2=Mon, ..., 8=Sun
        const d = new Date(dateStr).getDay();
        const firestoreDay = d === 0 ? 8 : d + 1;
        
        const scheduledClassIds = new Set(schedules.filter(s => s.dayOfWeek === firestoreDay).map(s => s.classId));
        return classes.filter(c => scheduledClassIds.has(c.id));
    }

    const shiftNames = { morning: 'Ca sáng', afternoon: 'Ca chiều', evening: 'Ca tối', custom: 'Tùy chỉnh' };

    function render() {
        const area = document.getElementById('ta-area');
        if (!area) return;
        const myRecords = getMyRecords();

        // Summary
        const teacherSummary = {};
        let totalSalaryAll = 0;
        myRecords.forEach(r => {
            if (!teacherSummary[r.teacherId]) teacherSummary[r.teacherId] = { total: 0, hours: 0, salary: 0 };
            teacherSummary[r.teacherId].total++;
            teacherSummary[r.teacherId].hours += (r.hours || 0);
            teacherSummary[r.teacherId].salary += (r.salary || 0);
            totalSalaryAll += (r.salary || 0);
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
            <thead><tr>${isOwner ? '<th>Giáo viên</th>' : ''}<th>Ngày</th><th>Ca/Giờ</th><th>Lớp</th><th>Số giờ</th><th>Lương</th><th>Ghi chú</th>${isOwner ? '<th>Thao tác</th>' : ''}</tr></thead>
            <tbody>`;

        if (myRecords.length === 0) {
            html += `<tr><td colspan="${isOwner ? 8 : 6}"><div class="empty-state"><p>Chưa có dữ liệu chấm công tháng này</p></div></td></tr>`;
        } else {
            html += myRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => `<tr>
                ${isOwner ? `<td>${getTeacherName(r.teacherId)}</td>` : ''}
                <td>${DB.formatDate(r.date)}</td>
                <td>${r.shift !== 'custom' ? shiftNames[r.shift] || r.shift : `${r.startTime || ''}-${r.endTime || ''}`}</td>
                <td>${getClassName(r.classId)}</td>
                <td><strong>${r.hours || 0}h</strong></td>
                <td style="color:var(--success-500);font-weight:600;">${DB.formatCurrency(r.salary || 0)}</td>
                <td class="text-sm">${r.note || ''}</td>
                ${isOwner ? `<td><button class="btn-icon" onclick="TAPage.removeRecord('${r.id}')"><i data-lucide="trash-2"></i></button></td>` : ''}
            </tr>`).join('');
        }

        html += '</tbody></table></div></div>';

        // Summary cards
        if (Object.keys(teacherSummary).length > 0) {
            html += `<h3 style="margin-top:24px;margin-bottom:16px;">Tổng hợp lương tháng ${selectedMonth} ${isOwner ? `(Tổng: ${DB.formatCurrency(totalSalaryAll)})` : ''}</h3>`;
            html += '<div class="stats-grid">';
            Object.entries(teacherSummary).forEach(([tid, s]) => {
                html += `<div class="stat-card" style="padding:16px;">
                    <div class="stat-value" style="color:var(--success-500);">${DB.formatCurrency(s.salary)}</div>
                    <div class="stat-label">${getTeacherName(tid)} — ${s.total} buổi (${s.hours}h)</div>
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
            render();
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

            let salary = 0;
            if (shift === 'morning') salary = mySalaryConfig.morning || 0;
            else if (shift === 'afternoon') salary = mySalaryConfig.afternoon || 0;
            else if (shift === 'evening') salary = mySalaryConfig.evening || 0;
            else if (shift === 'custom') salary = (mySalaryConfig.hourly || 0) * hours;

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
            const validClasses = getClassesForDate(initialDate);
            
            Modal.show({
                title: 'Thêm chấm công',
                content: `
                    <div class="form-group"><label class="form-label">Giáo viên *</label>
                        <select class="select" id="ta-teacher"><option value="">Chọn</option>${teachers.map(t => `<option value="${t.id}">${t.displayName || t.email}</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Ngày</label><input type="date" class="input" id="ta-date" value="${initialDate}" onchange="TAPage.updateAddClasses(this.value)"></div>
                        <div class="form-group"><label class="form-label">Ca</label>
                            <select class="select" id="ta-shift"><option value="morning">Sáng</option><option value="afternoon">Chiều</option><option value="evening">Tối</option><option value="custom">Tùy chỉnh</option></select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Giờ vào</label><input type="time" class="input" id="ta-start"></div>
                        <div class="form-group"><label class="form-label">Giờ ra</label><input type="time" class="input" id="ta-end"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Lớp (Chỉ hiện lớp có lịch trong ngày)</label>
                        <select class="select" id="ta-class"><option value="">Chọn</option>${validClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="input" id="ta-note"></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.saveRecord()">Lưu</button>`
            });
        },

        updateAddClasses(dateStr) {
            const classSelect = document.getElementById('ta-class');
            if (!classSelect) return;
            const validClasses = getClassesForDate(dateStr);
            classSelect.innerHTML = `<option value="">Chọn</option>${validClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
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
            let salary = 0;
            if (shift === 'morning') salary = salaryConfig.morning || 0;
            else if (shift === 'afternoon') salary = salaryConfig.afternoon || 0;
            else if (shift === 'evening') salary = salaryConfig.evening || 0;
            else if (shift === 'custom') salary = (salaryConfig.hourly || 0) * hours;

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
        }
    };
});
