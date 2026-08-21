// ============================================
// TEACHER ATTENDANCE - GPS, Salary, Teacher Filter & Auto 1h30m
// ============================================

Router.register('teacher-attendance', async (container) => {
    const isOwner = Auth.isOwner();
    const isTeacher = Auth.isTeacher();
    let records = [], teachers = [], classes = [], settings = {}, schedules = [], adjustments = [];
    const currentMonth = DB.currentMonth();
    let selectedMonth = currentMonth;
    let filterTeacherId = ''; // For Owner to filter by a specific teacher
    let mySalaryConfig = {};

    try {
        settings = await DB.getSettings().catch(() => ({}));
        records = await DB.getTeacherAttendance(selectedMonth).catch(() => []);
        adjustments = await DB.getSalaryAdjustments(selectedMonth).catch(() => []);
        schedules = await DB.getSchedules().catch(() => []);
        classes = await DB.getClasses().catch(() => []);
        
        if (isOwner) teachers = await DB.getTeachers().catch(() => []);
        if (isTeacher && window.currentUser && window.currentUser.id) {
            try {
                const myDoc = await window.db.collection('users').doc(window.currentUser.id).get();
                mySalaryConfig = myDoc.exists ? (myDoc.data().salaryConfig || {}) : {};
            } catch(e) { console.warn('Could not load salaryConfig:', e); }
        }
    } catch(e) { console.warn(e); }

    function getTeacherName(id) {
        if (isTeacher && id === window.currentUser.id) return window.currentUser.displayName;
        const t = teachers.find(x => x.id === id);
        return t ? t.displayName : (id || '—');
    }
    
    function getClassName(id) { return (classes.find(c => c.id === id) || {}).name || '—'; }

    function isMyRecord(r) {
        if (!isTeacher) return true;
        if (!r) return false;
        
        const myId = (window.currentUser ? window.currentUser.id : '') || '';
        const myName = ((window.currentUser ? window.currentUser.displayName : '') || '').trim().toLowerCase();
        const myEmail = ((window.currentUser ? window.currentUser.email : '') || '').trim().toLowerCase();
        
        const rTId = (r.teacherId || '').trim();
        const rTIdLower = rTId.toLowerCase();
        const rTNameLower = (r.teacherName || '').trim().toLowerCase();
        
        if (myId && rTId === myId) return true;
        if (myEmail && (rTIdLower === myEmail || rTNameLower === myEmail)) return true;
        if (myName && (rTIdLower === myName || rTNameLower === myName)) return true;
        if (myName && rTIdLower && (myName.includes(rTIdLower) || rTIdLower.includes(myName))) return true;
        if (myName && rTNameLower && (myName.includes(rTNameLower) || rTNameLower.includes(myName))) return true;
        
        return false;
    }

    function isTeacherMatch(r, tid) {
        if (!tid) return true;
        const rTId = (r.teacherId || '').trim();
        const rTIdLower = rTId.toLowerCase();
        const rTNameLower = (r.teacherName || '').trim().toLowerCase();
        
        const t = teachers.find(x => x.id === tid);
        const tName = ((t ? t.displayName : '') || '').trim().toLowerCase();
        const tEmail = ((t ? t.email : '') || '').trim().toLowerCase();

        if (rTId === tid) return true;
        if (tEmail && (rTIdLower === tEmail || rTNameLower === tEmail)) return true;
        if (tName && (rTIdLower === tName || rTNameLower === tName)) return true;
        if (tName && rTIdLower && (tName.includes(rTIdLower) || rTIdLower.includes(tName))) return true;
        if (tName && rTNameLower && (tName.includes(rTNameLower) || rTNameLower.includes(tName))) return true;
        return false;
    }

    function getEffectiveTeacherId(id) {
        if (isTeacher) {
            if (isMyRecord({ teacherId: id })) {
                return (window.currentUser ? window.currentUser.id : '') || id;
            }
        }
        return id;
    }

    function getMyRecords() {
        if (isTeacher) return records.filter(r => isMyRecord(r));
        if (filterTeacherId) return records.filter(r => isTeacherMatch(r, filterTeacherId));
        return records;
    }

    const shiftNames = {
        lesson_1h30: 'Buổi 1h30p',
        morning: 'Ca sáng (7:00-11:30)',
        afternoon: 'Ca chiều (13:00-17:30)',
        evening: 'Ca tối (18:00-21:00)',
        custom: 'Tùy chỉnh'
    };

    function render() {
        const area = document.getElementById('ta-area');
        if (!area) return;
        const displayedRecords = getMyRecords();

        const teacherAdjustments = {};
        adjustments.forEach(a => {
            const tid = getEffectiveTeacherId(a.teacherId);
            if (!teacherAdjustments[tid]) teacherAdjustments[tid] = [];
            teacherAdjustments[tid].push(a);
        });

        // Compute summary for all or specific teacher
        const allTeachersSummary = {};
        let totalSalaryAll = 0;

        records.forEach(r => {
            const tid = getEffectiveTeacherId(r.teacherId);
            if (!allTeachersSummary[tid]) allTeachersSummary[tid] = { total: 0, hours: 0, salary: 0 };
            allTeachersSummary[tid].total++;
            allTeachersSummary[tid].hours += (r.hours || 0);
            
            let rSalary = r.salary || 0;
            if (r.salaryMultiplier !== undefined) rSalary = rSalary * r.salaryMultiplier;
            if (r.penaltyAmount) rSalary = rSalary - r.penaltyAmount;
            if (rSalary < 0) rSalary = 0;
            r.finalSalary = rSalary;

            allTeachersSummary[tid].salary += rSalary;
            totalSalaryAll += rSalary;
        });

        Object.entries(allTeachersSummary).forEach(([tid, s]) => {
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
                        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                            <div>
                                <strong>📍 Vị trí trung tâm:</strong> 
                                ${hasLocation ? `<span class="badge badge-success">Đã cài đặt (${settings.centerLat?.toFixed(4)}, ${settings.centerLng?.toFixed(4)})</span> Bán kính: ${settings.checkInRadius || 100}m` : '<span class="badge badge-warning">Chưa cài đặt</span>'}
                            </div>
                            <button class="btn btn-secondary btn-sm" onclick="TAPage.setupLocation()"><i data-lucide="map-pin"></i> Cài đặt vị trí</button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (isTeacher) {
            html += `
                <div class="card mb-4" style="text-align:center;padding:24px;">
                    <h3 style="margin-bottom:8px;font-size:18px;font-weight:700;">Chấm công ca dạy hôm nay</h3>
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Hệ thống sẽ tự động điền giờ hiện tại và tính giờ kết thúc sau 1h30p.</p>
                    <button class="btn btn-primary btn-lg" onclick="TAPage.checkIn()" id="checkin-btn" style="font-size:16px;padding:12px 36px;box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
                        📍 Bấm Chấm công ngay
                    </button>
                </div>
            `;
        }

        // If Owner selects a specific teacher: Show dedicated Teacher Header Card
        if (isOwner && filterTeacherId) {
            const selectedTeacher = teachers.find(t => t.id === filterTeacherId);
            const teacherName = selectedTeacher ? selectedTeacher.displayName : filterTeacherId;
            const tSummary = allTeachersSummary[filterTeacherId] || { total: 0, hours: 0, salary: 0 };
            const tAdjs = teacherAdjustments[filterTeacherId] || [];

            html += `
                <div class="card mb-4" style="background: linear-gradient(to right, var(--bg-card), var(--bg-elevated)); border: 1px solid var(--primary-500);">
                    <div class="card-body" style="padding: 20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                            <div style="display:flex; align-items:center; gap:14px;">
                                <div style="width:48px; height:48px; border-radius:50%; background:var(--primary-100); color:var(--primary-600); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px;">
                                    ${teacherName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 style="margin:0; font-size:18px; font-weight:700;">${teacherName}</h3>
                                    <span style="font-size:13px; color:var(--text-muted);">${selectedTeacher?.email || ''}</span>
                                </div>
                            </div>
                            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                                <div style="background:var(--bg-glass); padding:8px 14px; border-radius:var(--radius-md); text-align:center; border:1px solid var(--border-color);">
                                    <div style="font-size:11px; color:var(--text-muted);">Số buổi dạy</div>
                                    <div style="font-size:18px; font-weight:800; color:var(--primary-500);">${tSummary.total} buổi</div>
                                </div>
                                <div style="background:var(--bg-glass); padding:8px 14px; border-radius:var(--radius-md); text-align:center; border:1px solid var(--border-color);">
                                    <div style="font-size:11px; color:var(--text-muted);">Tổng thời gian</div>
                                    <div style="font-size:18px; font-weight:800; color:var(--info-500);">${tSummary.hours.toFixed(1)}h</div>
                                </div>
                                <div style="background:rgba(34,197,94,0.08); padding:8px 14px; border-radius:var(--radius-md); text-align:center; border:1px solid var(--success-500);">
                                    <div style="font-size:11px; color:var(--text-muted);">Lương tháng ${selectedMonth}</div>
                                    <div style="font-size:18px; font-weight:800; color:var(--success-500);">${DB.formatCurrency(tSummary.salary)}</div>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:16px; padding-top:12px; border-top:1px dashed var(--border-color);">
                            <button class="btn btn-sm btn-primary" onclick="TAPage.showAddRecordForTeacher('${filterTeacherId}')"><i data-lucide="plus"></i> Thêm chấm công</button>
                            <button class="btn btn-sm btn-secondary" onclick="TAPage.showAdjustment('${filterTeacherId}')"><i data-lucide="gift"></i> Thưởng / Phạt</button>
                            <button class="btn btn-sm btn-ghost" onclick="TAPage.changeTeacher('')">✕ Xem tất cả giáo viên</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Records table
        html += `
            <div class="card mb-4">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:15px; font-weight:700;">
                        <i data-lucide="list"></i> Danh sách ca dạy ${filterTeacherId ? `- ${getTeacherName(filterTeacherId)}` : `(Tổng: ${displayedRecords.length} ca)`}
                    </h3>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                ${isOwner && !filterTeacherId ? '<th>Giáo viên</th>' : ''}
                                <th>Ngày</th>
                                <th>Khung giờ / Ca</th>
                                <th>Lớp học</th>
                                <th style="text-align:center;">Số giờ</th>
                                <th style="text-align:right;">Lương ca</th>
                                <th>Ghi chú</th>
                                <th style="text-align:right;">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (displayedRecords.length === 0) {
            html += `<tr><td colspan="${isOwner && !filterTeacherId ? 8 : 7}"><div class="empty-state"><p>Chưa có dữ liệu chấm công tháng này cho giáo viên được chọn</p></div></td></tr>`;
        } else {
            html += displayedRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => `
                <tr>
                    ${isOwner && !filterTeacherId ? `<td><strong>${getTeacherName(r.teacherId)}</strong></td>` : ''}
                    <td>${DB.formatDate(r.date)}</td>
                    <td>
                        <strong style="color:var(--text-primary);">${r.startTime && r.endTime ? `${r.startTime} - ${r.endTime}` : (shiftNames[r.shift] || r.shift)}</strong>
                        ${r.shift === 'lesson_1h30' ? `<span class="badge badge-info" style="font-size:10px; margin-left:4px;">1.5h</span>` : ''}
                    </td>
                    <td><span class="badge badge-neutral">${getClassName(r.classId)}</span></td>
                    <td style="text-align:center;"><strong>${(r.hours || 0).toFixed(1)}h</strong></td>
                    <td style="text-align:right; color:var(--success-500); font-weight:700;">
                        ${DB.formatCurrency(r.finalSalary)}
                        ${r.isFirstSession ? `<div style="color:var(--warning-500);font-size:10px;">(Buổi đầu: 50%)</div>` : ''}
                        ${r.penaltyReason ? `<div style="color:var(--danger-500);font-size:11px;font-weight:400;margin-top:2px;">⚠️ ${r.penaltyReason}</div>` : ''}
                    </td>
                    <td class="text-sm" style="color:var(--text-muted);">${r.note || '—'}</td>
                    <td style="text-align:right;">
                        <div class="table-actions" style="justify-content:flex-end;">
                            ${isOwner ? `<button class="btn-icon" title="Sửa ca dạy" onclick="TAPage.editRecord('${r.id}')"><i data-lucide="pencil"></i></button>` : ''}
                            ${isOwner ? `<button class="btn-icon" title="Phạt vi phạm" onclick="TAPage.showPenalty('${r.id}')"><i data-lucide="alert-triangle" style="color:var(--danger-500);"></i></button>` : ''}
                            <button class="btn-icon" title="Xóa" onclick="TAPage.removeRecord('${r.id}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        html += '</tbody></table></div></div>';

        // Summary cards section
        if (isOwner && !filterTeacherId && Object.keys(allTeachersSummary).length > 0) {
            html += `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
                    <h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="wallet"></i> Tổng hợp lương theo từng giáo viên tháng ${selectedMonth} (Tổng: ${DB.formatCurrency(totalSalaryAll)})</h3>
                    <button class="btn btn-primary" onclick="TAPage.finalizeSalary()"><i data-lucide="check-circle"></i> Chốt lương & Chi trả</button>
                </div>
                <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); align-items:start;">
            `;

            Object.entries(allTeachersSummary).forEach(([tid, s]) => {
                const adjs = teacherAdjustments[tid] || [];
                let adjsHtml = '';
                adjs.forEach(a => {
                    adjsHtml += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-color);">
                        <span style="flex:1;color:var(--text-secondary);">${a.reason}</span>
                        <span style="color:${a.amount >= 0 ? 'var(--success-500)' : 'var(--danger-500)'};font-weight:700;margin-left:8px;">${a.amount > 0 ? '+' : ''}${DB.formatCurrency(a.amount)}</span>
                        <button class="btn-icon" style="padding:0;margin-left:4px;" onclick="TAPage.removeAdjustment('${a.id}')"><i data-lucide="x" style="width:12px;height:12px;color:var(--text-muted);"></i></button>
                    </div>`;
                });

                html += `
                    <div class="stat-card" style="padding:16px; border: 1px solid var(--border-color); cursor:pointer;" onclick="if(event.target.tagName !== 'BUTTON' && event.target.tagName !== 'I') TAPage.changeTeacher('${tid}')">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                            <div>
                                <div style="font-weight:700;font-size:15px;color:var(--text-primary);">${getTeacherName(tid)}</div>
                                <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">${s.total} buổi dạy (${s.hours.toFixed(1)}h)</div>
                            </div>
                            <button class="btn btn-sm btn-ghost" title="Lọc riêng giáo viên này" onclick="event.stopPropagation(); TAPage.changeTeacher('${tid}')">Xem riêng →</button>
                        </div>
                        <div class="stat-value" style="color:var(--success-500);font-size:20px;margin-bottom:8px;">${DB.formatCurrency(s.salary)}</div>
                        ${adjsHtml}
                        <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:12px;font-size:12px;" onclick="event.stopPropagation(); TAPage.showAdjustment('${tid}')"><i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Thêm thưởng/phạt</button>
                    </div>
                `;
            });
            html += '</div>';
        } else if (isTeacher) {
            const myId = (window.currentUser ? window.currentUser.id : '') || '';
            const s = allTeachersSummary[myId] || { total: 0, hours: 0, salary: 0 };
            const myAdjs = teacherAdjustments[myId] || [];
            let adjsHtml = '';
            myAdjs.forEach(a => {
                adjsHtml += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-color);">
                    <span>${a.reason}</span>
                    <span style="color:${a.amount >= 0 ? 'var(--success-500)' : 'var(--danger-500)'};font-weight:700;">${a.amount > 0 ? '+' : ''}${DB.formatCurrency(a.amount)}</span>
                </div>`;
            });

            html += `
                <div class="card mt-4" style="max-width: 500px; margin: 24px auto 0 auto;">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="wallet"></i> Tổng kết lương tháng ${selectedMonth}</h3></div>
                    <div class="card-body">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                            <span style="color:var(--text-secondary);">Số buổi đã dạy:</span>
                            <strong>${s.total} buổi (${s.hours.toFixed(1)}h)</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                            <span style="color:var(--text-secondary);">Tổng lương tạm tính:</span>
                            <strong style="color:var(--success-500);font-size:18px;">${DB.formatCurrency(s.salary)}</strong>
                        </div>
                        ${adjsHtml}
                    </div>
                </div>
            `;
        }

        area.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="clock"></i> Chấm công & Lương Giáo viên</h1></div>
            <div class="page-actions">
                ${isOwner ? `<button class="btn btn-primary" onclick="TAPage.showAddRecord()"><i data-lucide="plus"></i> Thêm chấm công</button>` : ''}
            </div>
        </div>
        <div class="filter-bar" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <input type="month" class="input" style="max-width:180px;" value="${selectedMonth}" onchange="TAPage.changeMonth(this.value)">
            ${isOwner ? `
                <select class="select" id="filter-teacher-select" style="max-width:260px;" onchange="TAPage.changeTeacher(this.value)">
                    <option value="">-- Tất cả giáo viên (${teachers.length}) --</option>
                    ${teachers.map(t => `<option value="${t.id}" ${filterTeacherId === t.id ? 'selected' : ''}>👨‍🏫 ${t.displayName || t.email}</option>`).join('')}
                </select>
            ` : ''}
        </div>
        <div id="ta-area"></div>
    `;
    render();

    window.TAPage = {
        async changeMonth(m) {
            selectedMonth = m;
            try {
                records = await DB.getTeacherAttendance(m);
            } catch(e) { records = []; console.warn(e); }
            try {
                adjustments = await DB.getSalaryAdjustments(m);
            } catch(e) { adjustments = []; console.warn(e); }
            render();
        },

        changeTeacher(tid) {
            filterTeacherId = tid;
            const sel = document.getElementById('filter-teacher-select');
            if (sel) sel.value = tid;
            render();
        },

        async finalizeSalary() {
            if (!Auth.isOwner()) return;
            const summary = {};
            const teacherAdjustments = {};
            adjustments.forEach(a => {
                if (!teacherAdjustments[a.teacherId]) teacherAdjustments[a.teacherId] = [];
                teacherAdjustments[a.teacherId].push(a);
            });

            records.forEach(r => {
                const tid = getEffectiveTeacherId(r.teacherId);
                if (!summary[tid]) summary[tid] = { salary: 0 };
                let rSalary = r.salary || 0;
                if (r.salaryMultiplier !== undefined) rSalary = rSalary * r.salaryMultiplier;
                if (r.penaltyAmount) rSalary = rSalary - r.penaltyAmount;
                if (rSalary < 0) rSalary = 0;
                summary[tid].salary += rSalary;
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

        // Auto calculate End Time = Start Time + 90 minutes
        calcEndTimeFromStart(startTime) {
            if (!startTime) return '';
            const [h, m] = startTime.split(':').map(Number);
            const endM = h * 60 + m + 90;
            const eh = String(Math.floor(endM / 60) % 24).padStart(2, '0');
            const em = String(endM % 60).padStart(2, '0');
            return `${eh}:${em}`;
        },

        onStartTimeChange(val) {
            const endInput = document.getElementById('ci-end');
            if (endInput && val) {
                endInput.value = this.calcEndTimeFromStart(val);
            }
        },

        onManualStartTimeChange(val) {
            const endInput = document.getElementById('ta-end');
            if (endInput && val) {
                endInput.value = this.calcEndTimeFromStart(val);
            }
        },

        // === GPS CHECK-IN ===
        async checkIn() {
            const btn = document.getElementById('checkin-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '⏳ Đang kiểm tra vị trí GPS...';
            }

            if (!settings.centerLat || !settings.centerLng) {
                Toast.error('Chưa cài đặt', 'Chủ trung tâm chưa cài đặt vị trí. Vui lòng liên hệ quản lý.');
                if (btn) { btn.disabled = false; btn.innerHTML = '📍 Bấm Chấm công ngay'; }
                return;
            }

            if (!navigator.geolocation) {
                Toast.error('Không hỗ trợ', 'Trình duyệt không hỗ trợ GPS');
                if (btn) { btn.disabled = false; btn.innerHTML = '📍 Bấm Chấm công ngay'; }
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const dist = this._getDistance(pos.coords.latitude, pos.coords.longitude, settings.centerLat, settings.centerLng);
                    const maxDist = settings.checkInRadius || 100;

                    if (dist > maxDist) {
                        Toast.error('Ngoài phạm vi', `Bạn cách trung tâm ${Math.round(dist)}m (khoảng cách tối đa: ${maxDist}m)`);
                        if (btn) { btn.disabled = false; btn.innerHTML = '📍 Bấm Chấm công ngay'; }
                        return;
                    }

                    this._showCheckInForm();
                    if (btn) { btn.disabled = false; btn.innerHTML = '📍 Bấm Chấm công ngay'; }
                },
                (err) => {
                    Toast.error('Lỗi GPS', 'Vui lòng bật định vị GPS và cho phép truy cập vị trí trên trình duyệt');
                    if (btn) { btn.disabled = false; btn.innerHTML = '📍 Bấm Chấm công ngay'; }
                }
            );
        },

        _showCheckInForm() {
            // Get current local time & add 1h30m
            const now = new Date();
            const curH = String(now.getHours()).padStart(2, '0');
            const curM = String(now.getMinutes()).padStart(2, '0');
            const startTimeStr = `${curH}:${curM}`;
            const endTimeStr = this.calcEndTimeFromStart(startTimeStr);

            const validClasses = classes;
            
            Modal.show({
                title: '✅ Xác nhận chấm công ca dạy',
                content: `
                    <p style="color:var(--success-500);margin-bottom:14px;font-weight:600;">📍 Vị trí hợp lệ — Bạn đang ở tại trung tâm</p>
                    
                    <div class="form-group">
                        <label class="form-label">Loại ca dạy</label>
                        <select class="select" id="ci-shift" onchange="TAPage._shiftChange(this.value)">
                            <option value="lesson_1h30" selected>⏱️ Buổi dạy 1h30p (${startTimeStr} - ${endTimeStr})</option>
                            <option value="morning">Ca sáng (07:00 - 11:30)</option>
                            <option value="afternoon">Ca chiều (13:00 - 17:30)</option>
                            <option value="evening">Ca tối (18:00 - 21:00)</option>
                            <option value="custom">Tùy chỉnh giờ khác...</option>
                        </select>
                    </div>

                    <div id="ci-time-row" style="background:var(--bg-glass);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-color);margin-bottom:14px;">
                        <div class="form-row">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:12px;">Giờ vào (Check-in)</label>
                                <input type="time" class="input" id="ci-start" value="${startTimeStr}" oninput="TAPage.onStartTimeChange(this.value)">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="form-label" style="font-size:12px;">Giờ ra (Dự kiến +1h30p)</label>
                                <input type="time" class="input" id="ci-end" value="${endTimeStr}">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Lớp dạy hôm nay *</label>
                        <select class="select" id="ci-class">
                            <option value="">-- Chọn lớp học --</option>
                            ${validClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Ghi chú (nếu có)</label>
                        <input type="text" class="input" id="ci-note" placeholder="VD: Dạy bù / Dạy kèm thêm...">
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.confirmCheckIn()">✓ Xác nhận chấm công</button>`
            });
        },

        _shiftChange(val) {
            const startInput = document.getElementById('ci-start');
            const endInput = document.getElementById('ci-end');
            
            if (val === 'morning') {
                if (startInput) startInput.value = '07:00';
                if (endInput) endInput.value = '11:30';
            } else if (val === 'afternoon') {
                if (startInput) startInput.value = '13:00';
                if (endInput) endInput.value = '17:30';
            } else if (val === 'evening') {
                if (startInput) startInput.value = '18:00';
                if (endInput) endInput.value = '21:00';
            } else if (val === 'lesson_1h30') {
                const now = new Date();
                const curH = String(now.getHours()).padStart(2, '0');
                const curM = String(now.getMinutes()).padStart(2, '0');
                const startStr = `${curH}:${curM}`;
                if (startInput) startInput.value = startStr;
                if (endInput) endInput.value = this.calcEndTimeFromStart(startStr);
            }
        },

        async confirmCheckIn() {
            const classId = document.getElementById('ci-class').value;
            if (!classId) {
                Toast.warning('Chưa chọn lớp', 'Vui lòng chọn Lớp học khi chấm công!');
                return;
            }
            
            if (isTeacher) {
                const cls = classes.find(c => c.id === classId);
                if (cls) {
                    const tIds = cls.teacherIds || [];
                    const myId = (window.currentUser ? window.currentUser.id : '') || '';
                    const myName = ((window.currentUser ? window.currentUser.displayName : '') || '').trim().toLowerCase();
                    const myEmail = ((window.currentUser ? window.currentUser.email : '') || '').trim().toLowerCase();
                    
                    const isMyClass = tIds.some(tid => {
                        const tidStr = (tid || '').trim();
                        const tidLower = tidStr.toLowerCase();
                        if (myId && tidStr === myId) return true;
                        if (myEmail && tidLower === myEmail) return true;
                        if (myName && (tidLower === myName || myName.includes(tidLower) || tidLower.includes(myName))) return true;
                        return false;
                    });
                    
                    if (!isMyClass) {
                        Toast.error('Lỗi phân công', 'Bạn không được phân công dạy lớp học này. Vui lòng chọn đúng lớp của bạn!');
                        return;
                    }
                }
            }
            
            const shift = document.getElementById('ci-shift').value;
            const startTime = document.getElementById('ci-start').value;
            const endTime = document.getElementById('ci-end').value;
            let hours = 1.5;

            if (startTime && endTime) {
                const [sh, sm] = startTime.split(':').map(Number);
                const [eh, em] = endTime.split(':').map(Number);
                hours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
                if (hours < 0) hours = 1.5;
            } else if (shift === 'morning' || shift === 'afternoon') {
                hours = 4.5;
            } else if (shift === 'evening') {
                hours = 3.0;
            }

            const classConf = mySalaryConfig[classId] || {};
            let salary = 0;
            if (classConf.perShift) {
                salary = classConf.perShift;
            } else if (classConf.perHour) {
                salary = classConf.perHour * hours;
            }

            try {
                await DB.addTeacherAttendanceRecord({
                    teacherId: window.currentUser.id,
                    teacherName: window.currentUser.displayName || '',
                    date: DB.today(),
                    shift, startTime, endTime, hours, salary,
                    classId,
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
        showAddRecordForTeacher(tid) {
            this.showAddRecord(tid);
        },

        showAddRecord(preselectedTeacherId = '') {
            const initialDate = DB.today();
            const now = new Date();
            const curH = String(now.getHours()).padStart(2, '0');
            const curM = String(now.getMinutes()).padStart(2, '0');
            const startTimeStr = `${curH}:${curM}`;
            const endTimeStr = this.calcEndTimeFromStart(startTimeStr);
            const classListHtml = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            Modal.show({
                title: 'Thêm chấm công cho giáo viên',
                content: `
                    <div class="form-group"><label class="form-label">Giáo viên *</label>
                        <select class="select" id="ta-teacher" onchange="if(this.value==='_custom') document.getElementById('ta-teacher-custom').style.display='block'; else document.getElementById('ta-teacher-custom').style.display='none';">
                            <option value="">-- Chọn giáo viên --</option>
                            ${teachers.map(t => `<option value="${t.id}" ${(preselectedTeacherId || filterTeacherId) === t.id ? 'selected' : ''}>${t.displayName || t.email}</option>`).join('')}
                            <option value="_custom">Nhập tên khác...</option>
                        </select>
                        <input type="text" class="input" id="ta-teacher-custom" style="display:none;margin-top:8px;" placeholder="Nhập tên giáo viên">
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Ngày</label><input type="date" class="input" id="ta-date" value="${initialDate}"></div>
                        <div class="form-group"><label class="form-label">Ca</label>
                            <select class="select" id="ta-shift">
                                <option value="lesson_1h30" selected>Buổi 1h30p</option>
                                <option value="morning">Sáng (7:00-11:30)</option>
                                <option value="afternoon">Chiều (13:00-17:30)</option>
                                <option value="evening">Tối (18:00-21:00)</option>
                                <option value="custom">Tùy chỉnh</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Giờ vào</label><input type="time" class="input" id="ta-start" value="${startTimeStr}" oninput="TAPage.onManualStartTimeChange(this.value)"></div>
                        <div class="form-group"><label class="form-label">Giờ ra (Dự kiến +1h30p)</label><input type="time" class="input" id="ta-end" value="${endTimeStr}"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Lớp dạy *</label>
                        <select class="select" id="ta-class"><option value="">-- Chọn lớp học --</option>${classListHtml}</select>
                    </div>
                    <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="ta-first-session"> Buổi dạy đầu tiên (50% lương)</label></div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="input" id="ta-note"></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.saveRecord()">Lưu</button>`
            });
        },

        async saveRecord() {
            let teacherId = document.getElementById('ta-teacher').value;
            if (teacherId === '_custom') teacherId = document.getElementById('ta-teacher-custom').value.trim();
            if (!teacherId) { Toast.warning('Chọn hoặc nhập tên giáo viên'); return; }
            const classId = document.getElementById('ta-class').value;
            if (!classId) { Toast.warning('Chưa chọn lớp', 'Vui lòng chọn Lớp học!'); return; }
            const date = document.getElementById('ta-date').value;
            const shift = document.getElementById('ta-shift').value;
            const startTime = document.getElementById('ta-start').value;
            const endTime = document.getElementById('ta-end').value;
            let hours = 1.5;
            if (startTime && endTime) {
                const [sh, sm] = startTime.split(':').map(Number);
                const [eh, em] = endTime.split(':').map(Number);
                hours = Math.round(((eh*60+em)-(sh*60+sm))/60*10)/10;
                if (hours < 0) hours = 1.5;
            } else if (shift === 'morning' || shift === 'afternoon') hours = 4.5;
            else if (shift === 'evening') hours = 3.0;

            const t = teachers.find(x => x.id === teacherId);
            const salaryConfig = t ? (t.salaryConfig || {}) : {};
            const classConf = salaryConfig[classId] || {};
            let salary = 0;
            if (classConf.perShift) {
                salary = classConf.perShift;
            } else if (classConf.perHour) {
                salary = classConf.perHour * hours;
            }

            const isFirstSession = document.getElementById('ta-first-session') ? document.getElementById('ta-first-session').checked : false;
            if (isFirstSession) {
                salary = salary * 0.5;
            }

            try {
                await DB.addTeacherAttendanceRecord({
                    teacherId, date, shift, startTime, endTime, hours, salary, isFirstSession,
                    classId,
                    note: document.getElementById('ta-note').value,
                    month: date.substring(0, 7)
                });
                Modal.close();
                Toast.success('Đã thêm chấm công');
                records = await DB.getTeacherAttendance(selectedMonth);
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        editRecord(id) {
            const r = (Auth.isOwner() ? records : getMyRecords()).find(x => x.id === id);
            if (!r) return;
            const classListHtml = classes.map(c => `<option value="${c.id}" ${c.id === r.classId ? 'selected' : ''}>${c.name}</option>`).join('');
            
            Modal.show({
                title: 'Sửa chấm công',
                content: `
                    <div class="form-group"><label class="form-label">Giáo viên *</label>
                        <select class="select" id="ta-edit-teacher" disabled><option value="${r.teacherId}">${getTeacherName(r.teacherId)}</option></select></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Ngày</label><input type="date" class="input" id="ta-edit-date" value="${r.date || ''}"></div>
                        <div class="form-group"><label class="form-label">Ca</label>
                            <select class="select" id="ta-edit-shift">
                                <option value="lesson_1h30" ${r.shift === 'lesson_1h30' ? 'selected' : ''}>Buổi 1h30p</option>
                                <option value="morning" ${r.shift === 'morning' ? 'selected' : ''}>Sáng</option>
                                <option value="afternoon" ${r.shift === 'afternoon' ? 'selected' : ''}>Chiều</option>
                                <option value="evening" ${r.shift === 'evening' ? 'selected' : ''}>Tối</option>
                                <option value="custom" ${r.shift === 'custom' ? 'selected' : ''}>Tùy chỉnh</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Giờ vào</label><input type="time" class="input" id="ta-edit-start" value="${r.startTime || ''}"></div>
                        <div class="form-group"><label class="form-label">Giờ ra</label><input type="time" class="input" id="ta-edit-end" value="${r.endTime || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Số giờ</label><input type="number" step="0.1" class="input" id="ta-edit-hours" value="${r.hours || 0}"></div>
                        <div class="form-group"><label class="form-label">Lương (đ)</label><input type="number" class="input" id="ta-edit-salary" value="${r.salary || 0}"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Lớp *</label>
                        <select class="select" id="ta-edit-class"><option value="">-- Chọn lớp học --</option>${classListHtml}</select></div>
                    <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="ta-edit-first-session" ${r.isFirstSession ? 'checked' : ''} onchange="TAPage.toggleFirstSessionEdit()"> Buổi dạy đầu tiên (50% lương)</label></div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="input" id="ta-edit-note" value="${r.note || ''}"></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TAPage.saveEditRecord('${id}')">Cập nhật</button>`
            });
        },

        toggleFirstSessionEdit() {
            const isChecked = document.getElementById('ta-edit-first-session').checked;
            const salaryInput = document.getElementById('ta-edit-salary');
            let current = parseFloat(salaryInput.value) || 0;
            if (isChecked) {
                salaryInput.value = current * 0.5;
            } else {
                salaryInput.value = current * 2;
            }
        },

        async saveEditRecord(id) {
            const classId = document.getElementById('ta-edit-class').value;
            if (!classId) { Toast.warning('Chưa chọn lớp', 'Vui lòng chọn Lớp học!'); return; }
            const date = document.getElementById('ta-edit-date').value;
            const shift = document.getElementById('ta-edit-shift').value;
            const startTime = document.getElementById('ta-edit-start').value;
            const endTime = document.getElementById('ta-edit-end').value;
            const hours = parseFloat(document.getElementById('ta-edit-hours').value) || 0;
            const salary = parseInt(document.getElementById('ta-edit-salary').value) || 0;
            const note = document.getElementById('ta-edit-note').value;
            const isFirstSession = document.getElementById('ta-edit-first-session') ? document.getElementById('ta-edit-first-session').checked : false;

            try {
                await DB.updateTeacherAttendanceRecord(id, {
                    date, shift, startTime, endTime, hours, salary, classId, note, isFirstSession, month: date.substring(0, 7)
                });
                Modal.close();
                Toast.success('Cập nhật thành công');
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
