// ============================================
// SMART ASSISTANT PAGE (Trợ lý Thông minh)
// ============================================

Router.register('assistant', async (container) => {
    container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted);">
            <div class="spinner" style="margin: 0 auto 16px auto; width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--primary-500); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <p style="font-size: 15px;">Đang tải dữ liệu Trợ lý thông minh...</p>
        </div>
    `;

    const user = window.currentUser || {};
    const role = user.role || 'teacher';
    const isOwner = Auth.isOwner();
    const isStaff = Auth.isStaff();
    const isTeacher = Auth.isTeacher();

    // 1. Prepare Date Parameters
    const todayStr = DB.today();
    const currentMonthStr = DB.currentMonth();
    const currentYear = DB.currentYear();
    
    const todayDateObj = new Date(todayStr);
    const dayOfWeek = todayDateObj.getDay(); 
    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat -> System dayOfWeek: 2=Mon, ..., 8=Sun
    const systemDayOfWeek = dayOfWeek === 0 ? 8 : dayOfWeek + 1;

    const lastMonthDate = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const threeMonthsAgo = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() - 3, 1);
    const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    // Helper: Safe fetch wrapper to avoid breaking on permission-denied
    async function safeFetch(promiseFn, fallback = []) {
        try {
            return await promiseFn;
        } catch (e) {
            console.warn('Assistant safeFetch fallback:', e);
            return fallback;
        }
    }

    // 2. Load Data conditionally based on permissions
    let students = [], classes = [], schedules = [], scheduleExceptions = [];
    let financeCurrentMonth = [], financeLastMonth = [], financeLast3Months = [];
    let tuitionsPending = [], allTuitions = [];
    let teachers = [], users = [];
    let attendanceToday = [], teacherAttendanceCurrentMonth = [], salaryAdjustments = [];

    // Core data (classes, schedules, exceptions) - accessible by all roles
    const corePromises = [
        safeFetch(DB.getClasses()),
        safeFetch(DB.getSchedules()),
        safeFetch(DB.getScheduleExceptions()),
        safeFetch(DB.getTeacherAttendance(currentMonthStr)),
        safeFetch(DB.getSalaryAdjustments(currentMonthStr))
    ];

    // Attendance today
    corePromises.push(safeFetch(DB.getAttendanceByMonth(todayStr, todayStr)));

    // Role-specific data
    if (isOwner || isStaff) {
        corePromises.push(safeFetch(DB.getStudents()));
        corePromises.push(safeFetch(DB.getTuitionsPending()));
        corePromises.push(safeFetch(DB.getTuitions()));
        corePromises.push(safeFetch(DB.getTeachers()));
    }

    if (isOwner) {
        corePromises.push(safeFetch(DB.getFinanceRecords(currentMonthStr)));
        corePromises.push(safeFetch(DB.getFinanceRecords(lastMonthStr)));
        corePromises.push(safeFetch(DB.getFinanceRecords({ from: threeMonthsAgoStr, to: todayStr })));
        corePromises.push(safeFetch(DB.getUsers()));
    }

    const results = await Promise.all(corePromises);
    classes = results[0] || [];
    schedules = results[1] || [];
    scheduleExceptions = results[2] || [];
    teacherAttendanceCurrentMonth = results[3] || [];
    salaryAdjustments = results[4] || [];
    attendanceToday = results[5] || [];

    let idx = 6;
    if (isOwner || isStaff) {
        students = results[idx++] || [];
        tuitionsPending = results[idx++] || [];
        allTuitions = results[idx++] || [];
        teachers = results[idx++] || [];
    }

    if (isOwner) {
        financeCurrentMonth = results[idx++] || [];
        financeLastMonth = results[idx++] || [];
        financeLast3Months = results[idx++] || [];
        users = results[idx++] || [];
    }

    // Helper functions for matching teacher records
    function isMyRecord(r) {
        if (!isTeacher) return true;
        if (!r) return false;
        const myId = (user.id || user.uid || '').trim();
        const myName = (user.displayName || '').trim().toLowerCase();
        const myEmail = (user.email || '').trim().toLowerCase();
        
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

    function isMyClass(cls) {
        if (!cls || !cls.teacherIds) return false;
        const myId = (user.id || user.uid || '').trim();
        const myName = (user.displayName || '').trim().toLowerCase();
        const myEmail = (user.email || '').trim().toLowerCase();
        
        return cls.teacherIds.some(tid => {
            if (!tid) return false;
            const tLower = String(tid).trim().toLowerCase();
            if (myId && tLower === myId.toLowerCase()) return true;
            if (myEmail && tLower === myEmail) return true;
            if (myName && (tLower === myName || myName.includes(tLower) || tLower.includes(myName))) return true;
            return false;
        });
    }

    const activeStudents = students.filter(s => s.status === 'active');
    const activeClasses = classes.filter(c => c.status === 'active');
    const upcomingClasses = classes.filter(c => c.status === 'upcoming');

    // 3. Compute Today's Classes
    const todayClasses = [];
    schedules.forEach(sched => {
        const cls = classes.find(c => c.id === sched.classId);
        if (!cls) return;
        if (cls.status === 'inactive') return;
        if (cls.startDate && cls.startDate > todayStr) return;

        let isToday = false;
        let finalRoom = sched.room || cls.room || '';
        let finalStartTime = sched.startTime;
        let finalEndTime = sched.endTime;

        if (sched.dayOfWeek === systemDayOfWeek && !sched.specificDate) {
            isToday = true;
        } else if (sched.specificDate === todayStr) {
            isToday = true;
        }

        // Check schedule exceptions
        const exceptions = scheduleExceptions.filter(e => e.scheduleId === sched.id);
        const movedAway = exceptions.find(e => e.originalDate === todayStr);
        if (movedAway) isToday = false;

        const movedToToday = exceptions.find(e => e.newDate === todayStr);
        if (movedToToday) {
            isToday = true;
            finalRoom = movedToToday.newRoom || finalRoom;
            finalStartTime = movedToToday.newStartTime || finalStartTime;
            finalEndTime = movedToToday.newEndTime || finalEndTime;
        }

        if (isToday) {
            todayClasses.push({
                ...sched,
                classId: cls.id,
                className: cls.name,
                subject: cls.subject || '',
                teacherIds: cls.teacherIds || [],
                room: finalRoom,
                startTime: finalStartTime,
                endTime: finalEndTime,
                originalSchedule: sched
            });
        }
    });

    todayClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Check attendance & teacher check-in for today
    const todayAttendanceRecords = attendanceToday.filter(a => a.date === todayStr);
    const todayTeacherAttendance = teacherAttendanceCurrentMonth.filter(ta => ta.date === todayStr);

    let classesWithAttendance = 0;
    todayClasses.forEach(tc => {
        const hasAttendance = todayAttendanceRecords.some(a => a.classId === tc.classId && a.records && a.records.length > 0);
        tc.hasAttendance = hasAttendance;
        if (hasAttendance) classesWithAttendance++;

        // Teacher check-in status
        const teacherCheckedIn = tc.teacherIds.length > 0 && tc.teacherIds.some(tid => {
            return todayTeacherAttendance.some(ta => {
                if (ta.classId && ta.classId !== tc.classId) return false;
                const taTId = (ta.teacherId || '').toLowerCase();
                const tidLower = String(tid).toLowerCase();
                return taTId === tidLower || taTId.includes(tidLower) || tidLower.includes(taTId);
            });
        });
        tc.teacherCheckedIn = teacherCheckedIn;
    });

    const classesWithoutAttendance = todayClasses.length - classesWithAttendance;

    // Greeting logic
    const currentHour = new Date().getHours();
    let greetingTime = 'Chào buổi sáng';
    if (currentHour >= 12 && currentHour < 17) greetingTime = 'Chào buổi chiều';
    else if (currentHour >= 17) greetingTime = 'Chào buổi tối';

    const daysOfWeekVN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const todayVNStr = `${daysOfWeekVN[dayOfWeek]}, ngày ${DB.formatDate(todayStr)}`;
    const displayName = user.displayName || user.email || 'Bạn';

    // 4. Financial Computations (Owner only)
    let currentMonthRevenue = 0, currentMonthExpense = 0, currentMonthProfit = 0;
    let lastMonthRevenue = 0, lastMonthExpense = 0, lastMonthProfit = 0;
    let revChange = 0, expChange = 0, profitChange = 0;
    let expectedRevenue = 0, collectionRate = 0;
    let avgFixedCost = 0, breakEvenStudents = 0, varCostPerStudent = 0, avgRevPerStudent = 0;
    let monthsCount = new Set();

    if (isOwner) {
        currentMonthRevenue = financeCurrentMonth.filter(f => f.type === 'revenue').reduce((sum, f) => sum + (f.amount || 0), 0);
        currentMonthExpense = financeCurrentMonth.filter(f => f.type === 'expense').reduce((sum, f) => sum + (f.amount || 0), 0);
        currentMonthProfit = currentMonthRevenue - currentMonthExpense;

        lastMonthRevenue = financeLastMonth.filter(f => f.type === 'revenue').reduce((sum, f) => sum + (f.amount || 0), 0);
        lastMonthExpense = financeLastMonth.filter(f => f.type === 'expense').reduce((sum, f) => sum + (f.amount || 0), 0);
        lastMonthProfit = lastMonthRevenue - lastMonthExpense;

        const calcChange = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
        revChange = calcChange(currentMonthRevenue, lastMonthRevenue);
        expChange = calcChange(currentMonthExpense, lastMonthExpense);
        profitChange = calcChange(currentMonthProfit, lastMonthProfit);

        // Expected revenue
        activeStudents.forEach(s => {
            if (!s.classIds) return;
            s.classIds.forEach(cid => {
                const cls = activeClasses.find(c => c.id === cid);
                if (cls && cls.fee) {
                    let fee = (s.customFees && s.customFees[cid] !== undefined) ? s.customFees[cid] : cls.fee;
                    if (s.discount) fee = fee * (1 - s.discount);
                    expectedRevenue += fee;
                }
            });
        });

        collectionRate = expectedRevenue > 0 ? Math.min((currentMonthRevenue / expectedRevenue) * 100, 100) : 0;

        // Break-even
        let fixedCostsSum = 0;
        financeLast3Months.forEach(f => {
            if (f.type === 'expense' && f.category !== 'Lương GV') {
                fixedCostsSum += f.amount;
                monthsCount.add((f.date || '').substring(0, 7));
            }
        });
        avgFixedCost = monthsCount.size > 0 ? fixedCostsSum / monthsCount.size : 0;
        const teacherSalaryExpense = financeCurrentMonth.filter(f => f.type === 'expense' && f.category === 'Lương GV').reduce((sum, f) => sum + f.amount, 0) || 1;
        varCostPerStudent = activeStudents.length > 0 ? teacherSalaryExpense / activeStudents.length : 0;
        avgRevPerStudent = activeStudents.length > 0 ? expectedRevenue / activeStudents.length : 0;

        if (avgRevPerStudent > varCostPerStudent) {
            breakEvenStudents = Math.ceil(avgFixedCost / (avgRevPerStudent - varCostPerStudent));
        }
    }

    // 5. Action Items Generator
    const actionItems = [];
    if (isOwner || isStaff) {
        // Overdue tuitions
        const overdue = tuitionsPending.filter(t => t.status === 'overdue').sort((a, b) => (b.amount || 0) - (a.amount || 0));
        if (overdue.length > 0) {
            overdue.slice(0, 5).forEach(t => {
                const due = new Date(t.dueDate);
                const daysLate = Math.max(1, Math.floor((todayDateObj - due) / (1000 * 60 * 60 * 24)));
                actionItems.push({
                    level: 'danger', label: 'Khẩn',
                    title: `Học phí quá hạn: ${t.studentName}`,
                    desc: `${DB.formatCurrency(t.amount)} — Quá hạn ${daysLate} ngày (Hạn: ${DB.formatDate(t.dueDate)})`,
                    action: () => Router.navigate('tuition')
                });
            });
        }

        // Classes today without attendance
        todayClasses.forEach(tc => {
            if (tc.startTime && !tc.hasAttendance) {
                actionItems.push({
                    level: 'warning', label: 'Cần ĐD',
                    title: `Chưa điểm danh: Lớp ${tc.className}`,
                    desc: `Ca học ${tc.startTime} - ${tc.endTime} (${tc.room || 'Chưa xếp phòng'})`,
                    action: () => Router.navigate('attendance')
                });
            }
        });

        // Teachers not checked in today
        todayClasses.forEach(tc => {
            if (tc.startTime && !tc.teacherCheckedIn) {
                actionItems.push({
                    level: 'warning', label: 'Nhắc GV',
                    title: `Giáo viên chưa chấm công`,
                    desc: `Lớp ${tc.className} (${tc.startTime} - ${tc.endTime})`,
                    action: () => Router.navigate(isOwner ? 'teacher-attendance' : 'schedule')
                });
            }
        });

        // Tuition due in next 7 days
        const next7Days = new Date(todayDateObj);
        next7Days.setDate(next7Days.getDate() + 7);
        const upcomingTuitions = tuitionsPending.filter(t => {
            const due = new Date(t.dueDate);
            return due >= todayDateObj && due <= next7Days && t.status === 'pending';
        });
        if (upcomingTuitions.length > 0) {
            actionItems.push({
                level: 'warning', label: 'Sắp tới hạn',
                title: `${upcomingTuitions.length} khoản học phí sắp đến hạn`,
                desc: `Tổng tiền: ${DB.formatCurrency(upcomingTuitions.reduce((s, t) => s + (t.amount || 0), 0))} (trong 7 ngày tới)`,
                action: () => Router.navigate('tuition')
            });
        }

        // Students without class
        const unassignedStudents = activeStudents.filter(s => !s.classIds || s.classIds.length === 0);
        if (unassignedStudents.length > 0) {
            actionItems.push({
                level: 'neutral', label: 'Chú ý',
                title: `${unassignedStudents.length} học viên chưa xếp lớp`,
                desc: `Cần bổ sung lớp học cho các học viên này`,
                action: () => Router.navigate('students')
            });
        }

        // Upcoming classes
        upcomingClasses.forEach(cls => {
            if (cls.startDate) {
                const start = new Date(cls.startDate);
                const diffDays = Math.ceil((start - todayDateObj) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 14) {
                    actionItems.push({
                        level: 'success', label: 'Khai giảng',
                        title: `Sắp khai giảng: ${cls.name}`,
                        desc: `Bắt đầu sau ${diffDays} ngày (${DB.formatDate(cls.startDate)})`,
                        action: () => Router.navigate('classes')
                    });
                }
            }
        });
    }

    // 6. Component Renderers

    // Greeting Banner
    function renderGreeting() {
        let statsHtml = '';
        if (isOwner || isStaff) {
            statsHtml = `
                <div class="assistant-stats" style="margin-top: 20px; margin-bottom: 0;">
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); backdrop-filter: blur(4px);">
                        <div class="stat-val" style="color:#fff;">${todayClasses.length}</div>
                        <div class="stat-lbl" style="color:rgba(255,255,255,0.85);">Lớp hôm nay</div>
                    </div>
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); backdrop-filter: blur(4px);">
                        <div class="stat-val" style="color:#86efac;">${classesWithAttendance}</div>
                        <div class="stat-lbl" style="color:rgba(255,255,255,0.85);">Đã điểm danh</div>
                    </div>
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); backdrop-filter: blur(4px);">
                        <div class="stat-val" style="color:${classesWithoutAttendance > 0 ? '#fca5a5' : '#fff'};">${classesWithoutAttendance}</div>
                        <div class="stat-lbl" style="color:rgba(255,255,255,0.85);">Chưa điểm danh</div>
                    </div>
                    ${isOwner ? `
                        <div class="assistant-stat" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); backdrop-filter: blur(4px);">
                            <div class="stat-val" style="color:#93c5fd;">${activeStudents.length}</div>
                            <div class="stat-lbl" style="color:rgba(255,255,255,0.85);">Học viên active</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (isTeacher) {
            const myClassesToday = todayClasses.filter(tc => isMyClass(classes.find(c => c.id === tc.classId)));
            const myCheckedInToday = myClassesToday.filter(tc => tc.teacherCheckedIn).length;
            statsHtml = `
                <div class="assistant-stats" style="margin-top: 20px; margin-bottom: 0;">
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2);">
                        <div class="stat-val" style="color:#fff;">${myClassesToday.length}</div>
                        <div class="stat-lbl" style="color:rgba(255,255,255,0.85);">Lớp dạy hôm nay</div>
                    </div>
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2);">
                        <div class="stat-val" style="color:#86efac;">${myCheckedInToday}</div>
                        <div class="stat-lbl" style="color:rgba(255,255,255,0.85);">Đã chấm công</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="assistant-greeting slide-up" style="background: linear-gradient(135deg, var(--primary-600), #2563eb); color: white; border: none; box-shadow: 0 10px 25px -5px rgba(37,99,235,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h2>${greetingTime}, ${displayName}! 👋</h2>
                        <div class="assistant-date" style="color: rgba(255,255,255,0.8); display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="calendar" style="width: 16px; height: 16px;"></i> ${todayVNStr}
                        </div>
                    </div>
                    <div style="background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600; letter-spacing: 0.3px;">
                        ✨ Trợ lý AI Trung tâm
                    </div>
                </div>
                ${statsHtml}
            </div>
        `;
    }

    // Action Items Card
    function renderActionItemsCard() {
        if (actionItems.length === 0) {
            return `
                <div class="assistant-all-good">
                    <i data-lucide="check-circle-2"></i>
                    <p>Tuyệt vời! Mọi thứ đang diễn ra suôn sẻ.</p>
                    <p style="font-size: 13px; color: var(--text-muted); font-weight: normal; margin-top: 4px;">Không có vấn đề khẩn cấp nào cần xử lý ngay.</p>
                </div>
            `;
        }

        return `
            <div class="assistant-action-list">
                ${actionItems.map((item, index) => `
                    <div class="assistant-action-item">
                        <span class="badge badge-${item.level}" style="white-space: nowrap;">${item.label}</span>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); margin-bottom: 2px;">${item.title}</div>
                            <div style="font-size: 13px; color: var(--text-muted);">${item.desc}</div>
                        </div>
                        <button class="btn btn-sm btn-secondary" onclick="window.AssistantPage.executeAction(${index})">Xem →</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Today's Classes Table
    function renderTodayClassesTable(classesList, isTeacherView = false) {
        if (classesList.length === 0) {
            return `<div class="p-8 text-center text-muted" style="font-size:14px;"><i data-lucide="calendar-off" style="width:32px;height:32px;margin:0 auto 8px auto;display:block;opacity:0.5;"></i>Không có lớp học nào được lên lịch hôm nay.</div>`;
        }

        return `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Lớp học</th>
                            <th>Thời gian</th>
                            <th>Phòng</th>
                            ${!isTeacherView ? `<th>Giáo viên</th>` : ''}
                            <th style="text-align:center;">Điểm danh</th>
                            <th style="text-align:center;">Chấm công</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${classesList.map(tc => {
                            const teacherNames = (tc.teacherIds || []).map(tid => {
                                const t = teachers.find(x => x.id === tid);
                                return t ? t.displayName : tid;
                            }).join(', ') || 'Chưa gán';

                            return `
                                <tr style="cursor: pointer;" onclick="Router.navigate('attendance')">
                                    <td>
                                        <div style="font-weight: 600;">${tc.className}</div>
                                        ${tc.subject ? `<div style="font-size: 12px; color: var(--text-muted);">${tc.subject}</div>` : ''}
                                    </td>
                                    <td><strong style="color:var(--text-primary);">${tc.startTime} - ${tc.endTime}</strong></td>
                                    <td><span class="badge badge-neutral">${tc.room || '—'}</span></td>
                                    ${!isTeacherView ? `<td style="font-size: 13px;">${teacherNames}</td>` : ''}
                                    <td style="text-align:center;">
                                        ${tc.hasAttendance 
                                            ? `<span class="badge badge-success">✓ Đã ĐD</span>` 
                                            : `<span class="badge badge-warning">⚠️ Chưa ĐD</span>`}
                                    </td>
                                    <td style="text-align:center;">
                                        ${tc.teacherCheckedIn 
                                            ? `<span class="badge badge-success">✓ Đã CC</span>` 
                                            : `<span class="badge badge-danger">✗ Chưa CC</span>`}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Tuition Reminders Section (Dedicated Card for Owner & Staff)
    function renderTuitionReminders() {
        const overdue = tuitionsPending.filter(t => t.status === 'overdue').sort((a, b) => (b.amount || 0) - (a.amount || 0));
        
        const next7Days = new Date(todayDateObj);
        next7Days.setDate(next7Days.getDate() + 7);
        const upcoming = tuitionsPending.filter(t => {
            const due = new Date(t.dueDate);
            return due >= todayDateObj && due <= next7Days && t.status === 'pending';
        }).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

        const totalOverdue = overdue.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalUpcoming = upcoming.reduce((sum, t) => sum + (t.amount || 0), 0);

        if (overdue.length === 0 && upcoming.length === 0) {
            return `
                <div class="assistant-all-good" style="padding: 24px;">
                    <i data-lucide="badge-check" style="width:40px;height:40px;margin-bottom:8px;"></i>
                    <p style="font-size:15px;">Tuyệt vời! Không có khoản học phí nào quá hạn hoặc sắp đến hạn cần thu gấp.</p>
                </div>
            `;
        }

        let html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
                <div style="background: rgba(239,68,68,0.08); padding: 12px 16px; border-radius: var(--radius-md); border-left: 3px solid var(--danger-500);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 2px;">Nợ quá hạn (${overdue.length} học viên)</div>
                    <div style="font-size: 18px; font-weight: 800; color: var(--danger-500);">${DB.formatCurrency(totalOverdue)}</div>
                </div>
                <div style="background: rgba(245,158,11,0.08); padding: 12px 16px; border-radius: var(--radius-md); border-left: 3px solid var(--warning-500);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 2px;">Sắp đến hạn 7 ngày (${upcoming.length} học viên)</div>
                    <div style="font-size: 18px; font-weight: 800; color: var(--warning-500);">${DB.formatCurrency(totalUpcoming)}</div>
                </div>
            </div>
        `;

        if (overdue.length > 0) {
            html += `
                <div style="font-size: 13px; font-weight: 700; color: var(--danger-500); margin: 12px 0 8px 0; display:flex; align-items:center; gap:6px;">
                    <i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> DANH SÁCH QUÁ HẠN CẦN NHẮC (${overdue.length})
                </div>
                <div class="table-container mb-4">
                    <table>
                        <thead>
                            <tr>
                                <th>Học viên</th>
                                <th>Lớp</th>
                                <th style="text-align:right;">Số tiền</th>
                                <th>Hạn đóng</th>
                                <th style="text-align:center;">Quá hạn</th>
                                <th style="text-align:right;">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${overdue.slice(0, 8).map(t => {
                                const due = new Date(t.dueDate);
                                const daysLate = Math.max(1, Math.floor((todayDateObj - due) / (1000 * 60 * 60 * 24)));
                                const cls = classes.find(c => c.id === t.classId);
                                const className = cls ? cls.name : (t.classId === 'Nhiều môn' ? 'Nhiều môn' : '—');
                                return `
                                    <tr>
                                        <td><strong>${t.studentName}</strong></td>
                                        <td style="font-size:13px;color:var(--text-muted);">${className}</td>
                                        <td style="text-align:right;font-weight:700;color:var(--danger-500);">${DB.formatCurrency(t.amount)}</td>
                                        <td style="font-size:13px;">${DB.formatDate(t.dueDate)}</td>
                                        <td style="text-align:center;"><span class="badge badge-danger">Trễ ${daysLate} ngày</span></td>
                                        <td style="text-align:right;">
                                            <button class="btn btn-sm btn-primary" onclick="Router.navigate('tuition')">Thu / Nhắc</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (upcoming.length > 0) {
            html += `
                <div style="font-size: 13px; font-weight: 700; color: var(--warning-500); margin: 12px 0 8px 0; display:flex; align-items:center; gap:6px;">
                    <i data-lucide="clock" style="width:14px;height:14px;"></i> SẮP ĐẾN HẠN TRONG 7 NGÀY TỚI (${upcoming.length})
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Học viên</th>
                                <th>Lớp</th>
                                <th style="text-align:right;">Số tiền</th>
                                <th>Hạn đóng</th>
                                <th style="text-align:center;">Thời gian</th>
                                <th style="text-align:right;">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${upcoming.slice(0, 6).map(t => {
                                const due = new Date(t.dueDate);
                                const daysLeft = Math.max(0, Math.ceil((due - todayDateObj) / (1000 * 60 * 60 * 24)));
                                const cls = classes.find(c => c.id === t.classId);
                                const className = cls ? cls.name : (t.classId === 'Nhiều môn' ? 'Nhiều môn' : '—');
                                return `
                                    <tr>
                                        <td><strong>${t.studentName}</strong></td>
                                        <td style="font-size:13px;color:var(--text-muted);">${className}</td>
                                        <td style="text-align:right;font-weight:700;color:var(--warning-500);">${DB.formatCurrency(t.amount)}</td>
                                        <td style="font-size:13px;">${DB.formatDate(t.dueDate)}</td>
                                        <td style="text-align:center;"><span class="badge badge-warning">Còn ${daysLeft} ngày</span></td>
                                        <td style="text-align:right;">
                                            <button class="btn btn-sm btn-secondary" onclick="Router.navigate('tuition')">Xem</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `
            <div style="text-align:right; margin-top: 14px;">
                <button class="btn btn-sm btn-secondary" onclick="Router.navigate('tuition')">Mở trang Quản lý Học phí đầy đủ →</button>
            </div>
        `;

        return html;
    }

    // Financial Summary Component
    function renderFinancialSummary() {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div style="background: rgba(34,197,94,0.08); padding: 14px; border-radius: var(--radius-md); border-left: 3px solid var(--success-500);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 2px;">Thực thu tháng này</div>
                    <div style="font-size: 20px; font-weight: 800; color: var(--success-500);">${DB.formatCurrency(currentMonthRevenue)}</div>
                </div>
                <div style="background: rgba(239,68,68,0.08); padding: 14px; border-radius: var(--radius-md); border-left: 3px solid var(--danger-500);">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 2px;">Thực chi tháng này</div>
                    <div style="font-size: 20px; font-weight: 800; color: var(--danger-500);">${DB.formatCurrency(currentMonthExpense)}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                    <span style="color: var(--text-secondary);">Tỷ lệ thu / Dự kiến</span>
                    <span style="font-weight: 700;">${DB.formatCurrency(currentMonthRevenue)} / ${DB.formatCurrency(expectedRevenue)} (${collectionRate.toFixed(1)}%)</span>
                </div>
                <div class="assistant-progress">
                    <div class="assistant-progress-bar" style="width: ${collectionRate}%; background: ${collectionRate >= 80 ? 'var(--success-500)' : 'var(--primary-500)'};"></div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px dashed var(--border-color);">
                <div>
                    <div style="font-size: 12px; color: var(--text-muted);">Lợi nhuận ròng</div>
                    <div style="font-size: 22px; font-weight: 800; color: ${currentMonthProfit < 0 ? 'var(--danger-500)' : '#3b82f6'};">${DB.formatCurrency(currentMonthProfit)}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; color: var(--text-muted);">Học phí tồn đọng</div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--warning-500);">${DB.formatCurrency(tuitionsPending.reduce((s,t) => s + (t.amount || 0), 0))}</div>
                </div>
            </div>
        `;
    }

    // Break-Even Analysis Component
    function renderBreakEven() {
        if (monthsCount.size === 0) {
            return `<div class="p-4 text-center text-muted" style="font-size:13px;">Chưa đủ dữ liệu chi phí 3 tháng gần nhất để tính điểm hoà vốn.</div>`;
        }

        const currentStudentsCount = activeStudents.length;
        const isProfitable = currentStudentsCount >= breakEvenStudents;
        let progressPercent = breakEvenStudents > 0 ? Math.min((currentStudentsCount / breakEvenStudents) * 100, 100) : 0;

        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                    <span style="color: var(--text-secondary);">Học viên hiện tại vs Hoà vốn</span>
                    <span style="font-weight: 700; color:${isProfitable ? 'var(--success-500)' : 'var(--warning-500)'};">${currentStudentsCount} / ${breakEvenStudents} HV (${progressPercent.toFixed(0)}%)</span>
                </div>
                <div class="assistant-progress">
                    <div class="assistant-progress-bar" style="width: ${progressPercent}%; background: ${isProfitable ? 'var(--success-500)' : 'var(--warning-500)'};"></div>
                </div>
            </div>
            <div style="background: var(--bg-elevated); padding: 14px; border-radius: var(--radius-md); font-size: 13px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary);">Chi phí cố định TB (Mặt bằng, điện...):</span>
                    <span style="font-weight: 600;">${DB.formatCurrency(avgFixedCost)}/tháng</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary);">Doanh thu TB / Học viên:</span>
                    <span style="font-weight: 600;">${DB.formatCurrency(avgRevPerStudent)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Chi phí GV / Học viên:</span>
                    <span style="font-weight: 600;">${DB.formatCurrency(varCostPerStudent)}</span>
                </div>
            </div>
        `;
    }

    // Monthly Trends Component
    function renderMonthlyTrends() {
        const formatPercent = (val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

        return `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">Doanh thu</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${DB.formatCurrency(currentMonthRevenue)}</div>
                    </div>
                    <div class="assistant-trend ${revChange >= 0 ? 'up' : 'down'}">
                        <i data-lucide="${revChange >= 0 ? 'trending-up' : 'trending-down'}"></i>
                        <span>${formatPercent(revChange)}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">Chi phí</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${DB.formatCurrency(currentMonthExpense)}</div>
                    </div>
                    <div class="assistant-trend ${expChange <= 0 ? 'up' : 'down'}">
                        <i data-lucide="${expChange <= 0 ? 'trending-down' : 'trending-up'}"></i>
                        <span>${formatPercent(expChange)}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">Lợi nhuận</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${DB.formatCurrency(currentMonthProfit)}</div>
                    </div>
                    <div class="assistant-trend ${profitChange >= 0 ? 'up' : 'down'}">
                        <i data-lucide="${profitChange >= 0 ? 'trending-up' : 'trending-down'}"></i>
                        <span>${formatPercent(profitChange)}</span>
                    </div>
                </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 14px;">* So với tháng ${String(lastMonthDate.getMonth()+1).padStart(2, '0')}/${lastMonthDate.getFullYear()}</div>
        `;
    }

    // Class P&L Component
    function renderClassProfitability() {
        if (activeClasses.length === 0) {
            return `<div class="p-6 text-center text-muted">Chưa có lớp học nào đang hoạt động.</div>`;
        }

        const classPnL = activeClasses.map(cls => {
            const classStudents = activeStudents.filter(s => s.classIds && s.classIds.includes(cls.id));
            const studentCount = classStudents.length;

            let expectedRev = 0;
            classStudents.forEach(s => {
                let fee = (s.customFees && s.customFees[cls.id] !== undefined) ? s.customFees[cls.id] : (cls.fee || 0);
                if (s.discount) fee = fee * (1 - s.discount);
                expectedRev += fee;
            });

            let expectedSal = 0;
            (cls.teacherIds || []).forEach(tid => {
                const t = teachers.find(x => x.id === tid);
                if (t && t.salaryConfig && t.salaryConfig[cls.id]) {
                    const conf = t.salaryConfig[cls.id];
                    const today = new Date().toISOString().split('T')[0];
                    const classSchedules = schedules.filter(s => 
                        s.classId === cls.id && 
                        !s.specificDate &&
                        (!s.endDate || s.endDate >= today) &&
                        (!s.startDate || s.startDate <= today)
                    );
                    const sessionsPerMonth = classSchedules.length * 4;
                    expectedSal += (conf.perShift || 0) * sessionsPerMonth;
                }
            });

            const expectedProfit = expectedRev - expectedSal;

            return {
                id: cls.id,
                name: cls.name,
                subject: cls.subject || '',
                studentCount,
                expectedRev,
                expectedSal,
                expectedProfit,
                margin: expectedRev > 0 ? ((expectedProfit / expectedRev) * 100) : 0
            };
        });

        const losing = classPnL.filter(c => c.expectedProfit < 0);
        const breakingEven = classPnL.filter(c => c.expectedProfit === 0);
        const profitable = classPnL.filter(c => c.expectedProfit > 0).sort((a, b) => b.expectedProfit - a.expectedProfit);

        let html = `
            <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
                ${losing.length > 0 ? `
                    <div style="flex:1;min-width:110px;padding:10px;border-radius:var(--radius-md);background:rgba(239,68,68,0.08);border-left:3px solid var(--danger-500);text-align:center;">
                        <div style="font-size:20px;font-weight:800;color:var(--danger-500);">${losing.length}</div>
                        <div style="font-size:12px;color:var(--text-muted);">Lớp đang lỗ</div>
                    </div>
                ` : ''}
                <div style="flex:1;min-width:110px;padding:10px;border-radius:var(--radius-md);background:rgba(34,197,94,0.08);border-left:3px solid var(--success-500);text-align:center;">
                    <div style="font-size:20px;font-weight:800;color:var(--success-500);">${profitable.length}</div>
                    <div style="font-size:12px;color:var(--text-muted);">Lớp có lãi</div>
                </div>
            </div>
        `;

        const totalRev = classPnL.reduce((sum, c) => sum + c.expectedRev, 0);
        const totalSal = classPnL.reduce((sum, c) => sum + c.expectedSal, 0);
        const totalProfit = classPnL.reduce((sum, c) => sum + c.expectedProfit, 0);
        const totalMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

        html += `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Lớp</th>
                            <th style="text-align:center;">Sĩ số</th>
                            <th style="text-align:right;">DT dự kiến</th>
                            <th style="text-align:right;">Lương GV</th>
                            <th style="text-align:right;">Lợi nhuận DK</th>
                            <th style="text-align:center;">Biên LN</th>
                            <th style="text-align:center;">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${[...losing, ...breakingEven, ...profitable].map(c => {
                            const isLoss = c.expectedProfit < 0;
                            const profitColor = isLoss ? 'var(--danger-500)' : 'var(--success-500)';
                            const statusBadge = isLoss
                                ? `<span class="badge badge-danger">📉 Đang lỗ</span>`
                                : c.expectedProfit === 0
                                    ? `<span class="badge badge-warning">⚖️ Hoà vốn</span>`
                                    : c.margin >= 50
                                        ? `<span class="badge badge-success">🔥 Lãi tốt</span>`
                                        : `<span class="badge badge-success">✓ Có lãi</span>`;

                            return `
                                <tr style="background:${isLoss ? 'rgba(239,68,68,0.03)' : ''}; cursor:pointer;" onclick="Router.navigate('classes')">
                                    <td>
                                        <div style="font-weight:600;">${c.name}</div>
                                        ${c.subject ? `<div style="font-size:12px;color:var(--text-muted);">${c.subject}</div>` : ''}
                                    </td>
                                    <td style="text-align:center;">${c.studentCount} HV</td>
                                    <td style="text-align:right;color:#3b82f6;">${DB.formatCurrency(c.expectedRev)}</td>
                                    <td style="text-align:right;color:var(--danger-400);">${DB.formatCurrency(c.expectedSal)}</td>
                                    <td style="text-align:right;font-weight:700;color:${profitColor};">${DB.formatCurrency(c.expectedProfit)}</td>
                                    <td style="text-align:center;font-weight:600;color:${profitColor};">${c.margin.toFixed(0)}%</td>
                                    <td style="text-align:center;">${statusBadge}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background:var(--bg-alt);font-weight:700;">
                            <td colspan="2" style="text-align:right;text-transform:uppercase;">Tổng cộng:</td>
                            <td style="text-align:right;color:#3b82f6;">${DB.formatCurrency(totalRev)}</td>
                            <td style="text-align:right;color:var(--danger-400);">${DB.formatCurrency(totalSal)}</td>
                            <td style="text-align:right;color:${totalProfit >= 0 ? 'var(--success-500)' : 'var(--danger-500)'};">${DB.formatCurrency(totalProfit)}</td>
                            <td style="text-align:center;color:${totalProfit >= 0 ? 'var(--success-500)' : 'var(--danger-500)'};">${totalMargin.toFixed(0)}%</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        if (losing.length > 0) {
            html += `
                <div style="margin-top:14px;padding:12px 14px;background:rgba(239,68,68,0.06);border-radius:var(--radius-md);border:1px dashed var(--danger-400);">
                    <div style="font-weight:700;margin-bottom:6px;color:var(--danger-500);display:flex;align-items:center;gap:6px;">
                        <i data-lucide="lightbulb" style="width:16px;height:16px;"></i> Gợi ý cải thiện các lớp lỗ
                    </div>
                    <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--text-secondary);line-height:1.7;">
                        ${losing.map(c => {
                            const minStudents = c.expectedSal > 0 && (c.expectedRev / (c.studentCount || 1)) > 0
                                ? Math.ceil(c.expectedSal / (c.expectedRev / (c.studentCount || 1)))
                                : '?';
                            return `<li><strong>${c.name}</strong>: Cần tối thiểu <strong>${minStudents} HV</strong> để hoà vốn (hiện có ${c.studentCount} HV). Cân nhắc tuyển sinh thêm hoặc điều chỉnh chi phí ca dạy.</li>`;
                        }).join('')}
                    </ul>
                </div>
            `;
        }

        return html;
    }

    // Teacher Salary View
    function renderTeacherSalary() {
        const myAttendance = teacherAttendanceCurrentMonth.filter(isMyRecord);
        const sessions = myAttendance.length;
        const baseSalary = myAttendance.reduce((sum, a) => {
            let sal = a.salary || 0;
            if (a.salaryMultiplier !== undefined) sal *= a.salaryMultiplier;
            if (a.penaltyAmount) sal -= a.penaltyAmount;
            return sum + Math.max(0, sal);
        }, 0);
        
        const myAdjustments = salaryAdjustments.filter(isMyRecord);
        const bonusPenalty = myAdjustments.reduce((sum, a) => sum + (a.amount || 0), 0);
        const netSalary = Math.max(0, baseSalary + bonusPenalty);

        return `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary);">Số ca dạy đã chấm công:</span>
                    <span style="font-weight: 700;">${sessions} ca</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary);">Lương ca dạy:</span>
                    <span style="font-weight: 700;">${DB.formatCurrency(baseSalary)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary);">Thưởng / Phạt điều chỉnh:</span>
                    <span style="font-weight: 700; color: ${bonusPenalty >= 0 ? 'var(--success-500)' : 'var(--danger-500)'}">${DB.formatCurrency(bonusPenalty)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 6px; align-items: center;">
                    <span style="font-weight: 700; color: var(--text-primary);">Tổng lương tạm tính:</span>
                    <span style="font-weight: 800; font-size: 20px; color: #3b82f6;">${DB.formatCurrency(netSalary)}</span>
                </div>
                <div style="margin-top: 8px; text-align: right;">
                    <button class="btn btn-sm btn-secondary" onclick="Router.navigate('teacher-attendance')">Xem chi tiết chấm công →</button>
                </div>
            </div>
        `;
    }

    // 7. Assemble Main Content
    let contentHtml = `<div class="stagger" style="max-width: 1200px; margin: 0 auto;">`;
    contentHtml += renderGreeting();

    if (isOwner) {
        contentHtml += `
            <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="list-todo" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Việc cần xử lý ngay</h3></div>
                    <div class="card-body">${renderActionItemsCard()}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="calendar-clock" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Tình trạng lớp học hôm nay</h3></div>
                    <div class="card-body" style="padding:0;">${renderTodayClassesTable(todayClasses)}</div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <div class="card slide-up">
                        <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="pie-chart" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Tổng quan tài chính (${currentMonthStr})</h3></div>
                        <div class="card-body">${renderFinancialSummary()}</div>
                    </div>
                    
                    <div class="card slide-up">
                        <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="target" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Phân tích điểm hoà vốn</h3></div>
                        <div class="card-body">${renderBreakEven()}</div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="bell-ring" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Nhắc nhở thu học phí</h3></div>
                    <div class="card-body">${renderTuitionReminders()}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="bar-chart-2" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Biến động so với tháng trước</h3></div>
                    <div class="card-body">${renderMonthlyTrends()}</div>
                </div>
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="donut" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Cơ cấu chi phí</h3></div>
                    <div class="card-body">
                        <div style="position: relative; height: 200px; width: 100%;">
                            <canvas id="expenseChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="scale" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Lãi / Lỗ theo từng lớp học</h3></div>
                    <div class="card-body">${renderClassProfitability()}</div>
                </div>
            </div>
        `;
    } else if (isStaff) {
        contentHtml += `
            <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="list-todo" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Việc cần xử lý ngay</h3></div>
                    <div class="card-body">${renderActionItemsCard()}</div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="calendar-clock" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Tình trạng lớp học hôm nay</h3></div>
                    <div class="card-body" style="padding:0;">${renderTodayClassesTable(todayClasses)}</div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="bell-ring" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Nhắc nhở thu học phí</h3></div>
                    <div class="card-body">${renderTuitionReminders()}</div>
                </div>
            </div>
        `;
    } else if (isTeacher) {
        const myClassesToday = todayClasses.filter(tc => isMyClass(classes.find(c => c.id === tc.classId)));
        
        contentHtml += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="calendar-check" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Lịch dạy hôm nay của tôi</h3></div>
                    <div class="card-body" style="padding:0;">${renderTodayClassesTable(myClassesToday, true)}</div>
                </div>
                
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:700;"><i data-lucide="wallet" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Lương dự kiến tháng ${currentMonthStr.split('-')[1]}</h3></div>
                    <div class="card-body">${renderTeacherSalary()}</div>
                </div>
            </div>
        `;
    }

    contentHtml += `</div>`;
    container.innerHTML = contentHtml;

    // Initialize Chart.js for Owner Expense Donut
    if (isOwner) {
        const ctx = document.getElementById('expenseChart');
        if (ctx) {
            const expenses = financeCurrentMonth.filter(f => f.type === 'expense');
            const categories = ['Học phí', 'Lương GV', 'Điện nước', 'Thuê mặt bằng', 'Vật tư', 'Khác'];
            const dataMap = {};
            categories.forEach(c => dataMap[c] = 0);
            
            expenses.forEach(e => {
                const cat = e.category || 'Khác';
                if (dataMap[cat] !== undefined) dataMap[cat] += (e.amount || 0);
                else dataMap['Khác'] = (dataMap['Khác'] || 0) + (e.amount || 0);
            });

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categories,
                    datasets: [{
                        data: categories.map(c => dataMap[c]),
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.label}: ${DB.formatCurrency(ctx.raw)}`
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
    }

    if (window.lucide) {
        lucide.createIcons();
    }

    window.AssistantPage = {
        actionItems,
        executeAction: (index) => {
            const item = window.AssistantPage.actionItems[index];
            if (item && item.action) item.action();
        }
    };
});
