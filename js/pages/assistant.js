Router.register('assistant', async (container) => {
    container.innerHTML = `<div class="p-8 text-center"><p>Đang tải dữ liệu Trợ lý thông minh...</p></div>`;

    // 1. Prepare Date Parameters
    const todayStr = DB.today();
    const currentMonthStr = DB.currentMonth();
    const currentYear = DB.currentYear();
    
    const todayDateObj = new Date(todayStr);
    const dayOfWeek = todayDateObj.getDay(); 
    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    // System dayOfWeek: 2=Mon, ..., 8=Sun
    const systemDayOfWeek = dayOfWeek === 0 ? 8 : dayOfWeek + 1;

    // Last 3 months for break-even analysis
    const threeMonthsAgo = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() - 3, 1);
    const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
    
    const lastMonthDate = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // 2. Load ALL Data concurrently
    const [
        students,
        classes,
        schedules,
        scheduleExceptions,
        financeCurrentMonth,
        financeLastMonth,
        financeLast3Months,
        tuitionsPending,
        allTuitions,
        teachers,
        users,
        attendanceCurrentMonth,
        teacherAttendanceCurrentMonth,
        salaryAdjustments
    ] = await Promise.all([
        DB.getStudents(),
        DB.getClasses(),
        DB.getSchedules(),
        DB.getScheduleExceptions(),
        DB.getFinanceRecords(currentMonthStr),
        DB.getFinanceRecords(lastMonthStr),
        DB.getFinanceRecords({ from: threeMonthsAgoStr, to: todayStr }),
        DB.getTuitionsPending(),
        DB.getTuitions(),
        DB.getTeachers(),
        DB.getUsers(),
        DB.getAttendanceByMonth(todayStr, todayStr), // Just need today's attendance for check
        DB.getTeacherAttendance(currentMonthStr),
        DB.getSalaryAdjustments(currentMonthStr)
    ]);

    // 3. Helper Functions & Computations

    const activeStudents = students.filter(s => s.status === 'active');
    const activeClasses = classes.filter(c => c.status === 'active');
    const upcomingClasses = classes.filter(c => c.status === 'upcoming');

    // Get today's classes
    const todayClasses = [];
    schedules.forEach(sched => {
        const cls = activeClasses.find(c => c.id === sched.classId);
        if (!cls) return;
        
        // Skip if class hasn't started
        if (cls.startDate && cls.startDate > todayStr) return;

        let isToday = false;
        let finalRoom = sched.room;
        let finalStartTime = sched.startTime;
        let finalEndTime = sched.endTime;

        // Check if regular schedule for today
        if (sched.dayOfWeek === systemDayOfWeek && !sched.specificDate) {
            isToday = true;
        } else if (sched.specificDate === todayStr) {
            isToday = true;
        }

        // Check exceptions
        const exceptions = scheduleExceptions.filter(e => e.scheduleId === sched.id);
        const movedAway = exceptions.find(e => e.originalDate === todayStr);
        if (movedAway) {
            isToday = false; // Moved to another date
        }

        const movedToToday = exceptions.find(e => e.newDate === todayStr);
        if (movedToToday) {
            isToday = true;
            finalRoom = movedToToday.newRoom || sched.room;
            finalStartTime = movedToToday.newStartTime || sched.startTime;
            finalEndTime = movedToToday.newEndTime || sched.endTime;
        }

        if (isToday) {
            todayClasses.push({
                ...sched,
                classId: cls.id,
                className: cls.name,
                teacherIds: cls.teacherIds || [],
                room: finalRoom,
                startTime: finalStartTime,
                endTime: finalEndTime,
                originalSchedule: sched
            });
        }
    });

    // Sort today's classes by start time
    todayClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Compute today's attendance status
    const todayAttendanceRecords = attendanceCurrentMonth.filter(a => a.date === todayStr);
    const todayTeacherAttendance = teacherAttendanceCurrentMonth.filter(ta => ta.date === todayStr);

    let classesWithAttendance = 0;
    todayClasses.forEach(tc => {
        const hasAttendance = todayAttendanceRecords.some(a => a.classId === tc.classId && a.records && a.records.length > 0);
        tc.hasAttendance = hasAttendance;
        if (hasAttendance) classesWithAttendance++;

        const teacherCheckedIn = tc.teacherIds.every(tid => todayTeacherAttendance.some(ta => ta.teacherId === tid && ta.classId === tc.classId));
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

    // Calculate finances for Owner
    const currentMonthRevenue = financeCurrentMonth.filter(f => f.type === 'revenue').reduce((sum, f) => sum + (f.amount || 0), 0);
    const currentMonthExpense = financeCurrentMonth.filter(f => f.type === 'expense').reduce((sum, f) => sum + (f.amount || 0), 0);
    const currentMonthProfit = currentMonthRevenue - currentMonthExpense;

    const lastMonthRevenue = financeLastMonth.filter(f => f.type === 'revenue').reduce((sum, f) => sum + (f.amount || 0), 0);
    const lastMonthExpense = financeLastMonth.filter(f => f.type === 'expense').reduce((sum, f) => sum + (f.amount || 0), 0);
    const lastMonthProfit = lastMonthRevenue - lastMonthExpense;

    const calculatePercentChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };
    
    const formatPercent = (val) => {
        const sign = val >= 0 ? '+' : '';
        return `${sign}${val.toFixed(1)}%`;
    };

    const revChange = calculatePercentChange(currentMonthRevenue, lastMonthRevenue);
    const expChange = calculatePercentChange(currentMonthExpense, lastMonthExpense);
    const profitChange = calculatePercentChange(currentMonthProfit, lastMonthProfit);

    // Expected revenue
    let expectedRevenue = 0;
    activeStudents.forEach(s => {
        if (!s.classIds) return;
        s.classIds.forEach(cid => {
            const cls = activeClasses.find(c => c.id === cid);
            if (cls && cls.fee) {
                // Apply discount logic if needed, simple version here
                let fee = (s.customFees && s.customFees[cid]) ? s.customFees[cid] : cls.fee;
                if (s.discount) fee = fee * (1 - s.discount);
                expectedRevenue += fee;
            }
        });
    });

    const collectionRate = expectedRevenue > 0 ? Math.min((currentMonthRevenue / expectedRevenue) * 100, 100) : 0;

    // Break-even calculation
    // Average of last 3 months fixed costs (expenses excluding Lương GV)
    let fixedCostsSum = 0;
    let monthsCount = new Set();
    financeLast3Months.forEach(f => {
        if (f.type === 'expense' && f.category !== 'Lương GV') {
            fixedCostsSum += f.amount;
            monthsCount.add(f.date.substring(0, 7));
        }
    });
    const avgFixedCost = monthsCount.size > 0 ? fixedCostsSum / monthsCount.size : 0;
    
    // Total teacher salary estimate this month (or from last month if not ended)
    const teacherSalaryExpense = financeCurrentMonth.filter(f => f.type === 'expense' && f.category === 'Lương GV').reduce((sum, f) => sum + f.amount, 0) || 1; // avoid div by 0
    
    const varCostPerStudent = activeStudents.length > 0 ? teacherSalaryExpense / activeStudents.length : 0;
    const avgRevPerStudent = activeStudents.length > 0 ? expectedRevenue / activeStudents.length : 0;
    
    let breakEvenStudents = 0;
    if (avgRevPerStudent > varCostPerStudent) {
        breakEvenStudents = Math.ceil(avgFixedCost / (avgRevPerStudent - varCostPerStudent));
    }

    // Action Items Generator
    const generateActionItems = () => {
        const items = [];
        
        // Overdue tuitions
        const overdue = tuitionsPending.filter(t => t.status === 'overdue').sort((a, b) => b.amount - a.amount);
        if (overdue.length > 0) {
            overdue.slice(0, 5).forEach(t => {
                const due = new Date(t.dueDate);
                const daysLate = Math.floor((todayDateObj - due) / (1000 * 60 * 60 * 24));
                items.push({
                    priority: 'high', level: 'danger', label: 'Khẩn',
                    title: `Học phí quá hạn: ${t.studentName}`,
                    desc: `${DB.formatCurrency(t.amount)} - Quá hạn ${daysLate} ngày`,
                    action: () => Router.navigate('tuition')
                });
            });
        }

        // Classes today without attendance
        todayClasses.forEach(tc => {
            // Only flag if class has already started (time passed)
            if (tc.startTime && !tc.hasAttendance) {
                const [h, m] = tc.startTime.split(':').map(Number);
                const classTime = new Date(todayDateObj).setHours(h, m, 0, 0);
                if (new Date() > classTime) {
                    items.push({
                        priority: 'high', level: 'danger', label: 'Khẩn',
                        title: `Chưa điểm danh: Lớp ${tc.className}`,
                        desc: `Ca học lúc ${tc.startTime}`,
                        action: () => Router.navigate('attendance')
                    });
                }
            }
        });

        // Tuition due soon (next 7 days)
        const next7Days = new Date(todayDateObj);
        next7Days.setDate(next7Days.getDate() + 7);
        const upcomingTuitions = tuitionsPending.filter(t => {
            const due = new Date(t.dueDate);
            return due > todayDateObj && due <= next7Days && t.status === 'pending';
        });
        
        if (upcomingTuitions.length > 0) {
            items.push({
                priority: 'medium', level: 'warning', label: 'Cần chú ý',
                title: `${upcomingTuitions.length} khoản học phí sắp đến hạn`,
                desc: `Trong 7 ngày tới`,
                action: () => Router.navigate('tuition')
            });
        }

        // Teachers not checked in
        todayClasses.forEach(tc => {
            if (tc.startTime && !tc.teacherCheckedIn) {
                const [h, m] = tc.startTime.split(':').map(Number);
                const classTime = new Date(todayDateObj).setHours(h, m, 0, 0);
                if (new Date() > classTime) {
                    items.push({
                        priority: 'medium', level: 'warning', label: 'Cần chú ý',
                        title: `Giáo viên chưa chấm công`,
                        desc: `Lớp ${tc.className} (${tc.startTime})`,
                        action: () => Router.navigate('teacher-attendance')
                    });
                }
            }
        });

        // Students with no classes
        const unassignedStudents = activeStudents.filter(s => !s.classIds || s.classIds.length === 0);
        if (unassignedStudents.length > 0) {
            items.push({
                priority: 'medium', level: 'warning', label: 'Cần chú ý',
                title: `${unassignedStudents.length} học viên chưa xếp lớp`,
                desc: `Cần sắp xếp lớp học cho các học viên này`,
                action: () => Router.navigate('students')
            });
        }

        // Low enrollment classes
        activeClasses.forEach(cls => {
            const enrolled = activeStudents.filter(s => s.classIds && s.classIds.includes(cls.id)).length;
            if (enrolled <= 3 && enrolled > 0) {
                items.push({
                    priority: 'low', level: 'info', label: 'Thông tin',
                    title: `Lớp ít học viên: ${cls.name}`,
                    desc: `Chỉ có ${enrolled} học viên đang học`,
                    action: () => Router.navigate('classes')
                });
            }
        });

        // Upcoming classes opening soon
        upcomingClasses.forEach(cls => {
            if (cls.startDate) {
                const start = new Date(cls.startDate);
                const diffDays = Math.ceil((start - todayDateObj) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 14) {
                    items.push({
                        priority: 'info', level: 'success', label: 'Tin vui',
                        title: `Sắp khai giảng: ${cls.name}`,
                        desc: `Bắt đầu sau ${diffDays} ngày (${DB.formatDate(cls.startDate)})`,
                        action: () => Router.navigate('classes')
                    });
                }
            }
        });

        return items;
    };

    const actionItems = generateActionItems();

    // 4. Render Components
    const renderGreeting = () => {
        const userName = window.currentUser ? window.currentUser.displayName : 'Bạn';
        let statsHtml = '';

        if (Auth.isOwner() || Auth.isStaff()) {
            statsHtml = `
                <div class="assistant-stats" style="display: flex; gap: 20px; margin-top: 15px;">
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: var(--radius-md);">
                        <div style="font-size: 24px; font-weight: bold;">${todayClasses.length}</div>
                        <div style="font-size: 13px; opacity: 0.9;">Lớp hôm nay</div>
                    </div>
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: var(--radius-md);">
                        <div style="font-size: 24px; font-weight: bold;">${classesWithAttendance}</div>
                        <div style="font-size: 13px; opacity: 0.9;">Đã điểm danh</div>
                    </div>
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: var(--radius-md);">
                        <div style="font-size: 24px; font-weight: bold;">${classesWithoutAttendance}</div>
                        <div style="font-size: 13px; opacity: 0.9;">Chưa điểm danh</div>
                    </div>
                </div>
            `;
        } else if (Auth.isTeacher()) {
            const myClassesToday = todayClasses.filter(tc => tc.teacherIds.includes(window.currentUser.uid));
            statsHtml = `
                <div class="assistant-stats" style="display: flex; gap: 20px; margin-top: 15px;">
                    <div class="assistant-stat" style="background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: var(--radius-md);">
                        <div style="font-size: 24px; font-weight: bold;">${myClassesToday.length}</div>
                        <div style="font-size: 13px; opacity: 0.9;">Lớp phụ trách hôm nay</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="assistant-greeting slide-up" style="background: linear-gradient(135deg, var(--primary-500), var(--primary-600, #3b82f6)); color: white; padding: 30px; border-radius: var(--radius-lg); margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="font-size: 28px; margin: 0 0 10px 0; font-weight: 700;">${greetingTime}, ${userName}!</h1>
                <p style="font-size: 16px; margin: 0; opacity: 0.9;"><i data-lucide="calendar" style="width: 18px; height: 18px; display: inline-block; vertical-align: text-bottom; margin-right: 5px;"></i> Hôm nay là ${todayVNStr}</p>
                ${statsHtml}
            </div>
        `;
    };

    const renderTodayClasses = (classesToRender, isTeacher = false) => {
        if (classesToRender.length === 0) {
            return `<div class="text-center p-6 text-muted">Không có lớp học nào được lên lịch trong hôm nay.</div>`;
        }

        const getTimeGroup = (time) => {
            if (!time) return 'Khác';
            const h = parseInt(time.split(':')[0]);
            if (h < 12) return 'Sáng';
            if (h < 17) return 'Chiều';
            return 'Tối';
        };

        let rows = '';
        classesToRender.forEach(tc => {
            const teacherNames = tc.teacherIds.map(tid => {
                const t = teachers.find(x => x.id === tid);
                return t ? t.displayName : 'N/A';
            }).join(', ') || 'Chưa phân công';

            rows += `
                <tr style="cursor: pointer;" onclick="Router.navigate('attendance')">
                    <td style="font-weight: 500;">
                        ${tc.className}
                        <div style="font-size: 12px; color: var(--text-muted);">${getTimeGroup(tc.startTime)}</div>
                    </td>
                    <td>${tc.startTime} - ${tc.endTime}</td>
                    <td>${tc.room || 'N/A'}</td>
                    ${!isTeacher ? `<td>${teacherNames}</td>` : ''}
                    <td>
                        ${tc.hasAttendance 
                            ? `<span class="badge badge-success"><i data-lucide="check-circle" style="width:12px; height:12px; margin-right:4px;"></i> Đã ĐD</span>` 
                            : `<span class="badge badge-warning"><i data-lucide="alert-circle" style="width:12px; height:12px; margin-right:4px;"></i> Chưa ĐD</span>`}
                    </td>
                    <td>
                        ${tc.teacherCheckedIn 
                            ? `<span class="badge badge-success">Đã CC</span>` 
                            : `<span class="badge badge-danger">Chưa CC</span>`}
                    </td>
                </tr>
            `;
        });

        return `
            <div class="table-container">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th class="p-4 border-b">Lớp</th>
                            <th class="p-4 border-b">Thời gian</th>
                            <th class="p-4 border-b">Phòng</th>
                            ${!isTeacher ? `<th class="p-4 border-b">Giáo viên</th>` : ''}
                            <th class="p-4 border-b">Điểm danh</th>
                            <th class="p-4 border-b">Chấm công</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    };

    const renderActionItems = () => {
        if (actionItems.length === 0) {
            return `
                <div class="text-center p-6" style="color: var(--success-500);">
                    <i data-lucide="check-circle-2" style="width: 48px; height: 48px; margin: 0 auto 10px auto; opacity: 0.8;"></i>
                    <p style="font-weight: 500; font-size: 16px;">Tuyệt vời! Mọi thứ đang diễn ra suôn sẻ.</p>
                    <p style="font-size: 14px; color: var(--text-muted);">Không có vấn đề khẩn cấp nào cần xử lý ngay.</p>
                </div>
            `;
        }

        let itemsHtml = '';
        actionItems.forEach(item => {
            itemsHtml += `
                <div class="assistant-action-item" style="display: flex; align-items: flex-start; padding: 15px; border-bottom: 1px solid var(--border-color); gap: 15px; transition: background 0.2s;">
                    <span class="badge badge-${item.level}" style="white-space: nowrap;">${item.label}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--text-primary);">${item.title}</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${item.desc}</div>
                    </div>
                    <button class="btn btn-sm" onclick="window.AssistantPage.executeAction(${actionItems.indexOf(item)})" style="background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-primary);">Xem &rarr;</button>
                </div>
            `;
        });

        return `<div class="assistant-action-list">${itemsHtml}</div>`;
    };

    const renderFinancialSummary = () => {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div style="background: rgba(var(--success-500-rgb, 34, 197, 94), 0.1); padding: 15px; border-radius: var(--radius-md); border-left: 4px solid var(--success-500);">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px;">Thực thu tháng này</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--success-600, #16a34a);">${DB.formatCurrency(currentMonthRevenue)}</div>
                </div>
                <div style="background: rgba(var(--danger-500-rgb, 239, 68, 68), 0.1); padding: 15px; border-radius: var(--radius-md); border-left: 4px solid var(--danger-500);">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px;">Thực chi tháng này</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--danger-600, #dc2626);">${DB.formatCurrency(currentMonthExpense)}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                    <span style="color: var(--text-secondary);">Tỷ lệ thu / Dự kiến</span>
                    <span style="font-weight: 600;">${DB.formatCurrency(currentMonthRevenue)} / ${DB.formatCurrency(expectedRevenue)} (${collectionRate.toFixed(1)}%)</span>
                </div>
                <div class="assistant-progress" style="height: 8px; background: var(--bg-body); border-radius: 4px; overflow: hidden;">
                    <div class="assistant-progress-bar" style="height: 100%; width: ${collectionRate}%; background: var(--primary-500); border-radius: 4px;"></div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px dashed var(--border-color);">
                <div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Lợi nhuận ròng</div>
                    <div style="font-size: 22px; font-weight: 700; color: ${currentMonthProfit >= 0 ? 'var(--success-500)' : 'var(--danger-500)'};">${DB.formatCurrency(currentMonthProfit)}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 13px; color: var(--text-secondary);">Học phí tồn đọng</div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--warning-500);">${DB.formatCurrency(tuitionsPending.reduce((s,t) => s + t.amount, 0))}</div>
                </div>
            </div>
        `;
    };

    const renderBreakEven = () => {
        if (monthsCount.size === 0) {
            return `<div class="p-4 text-center text-muted">Chưa đủ dữ liệu chi phí 3 tháng gần nhất để phân tích.</div>`;
        }

        const currentStudentsCount = activeStudents.length;
        const isProfitable = currentStudentsCount >= breakEvenStudents;
        let progressPercent = 0;
        if (breakEvenStudents > 0) {
            progressPercent = Math.min((currentStudentsCount / breakEvenStudents) * 100, 100);
        }

        return `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                    <span style="color: var(--text-secondary);">Học viên hiện tại</span>
                    <span style="font-weight: 600;">${currentStudentsCount} / ${breakEvenStudents} HV hoà vốn</span>
                </div>
                <div class="assistant-progress" style="height: 10px; background: var(--bg-body); border-radius: 5px; overflow: hidden;">
                    <div class="assistant-progress-bar" style="height: 100%; width: ${progressPercent}%; background: ${isProfitable ? 'var(--success-500)' : 'var(--warning-500)'}; border-radius: 5px;"></div>
                </div>
            </div>
            <div style="background: var(--bg-body); padding: 15px; border-radius: var(--radius-md); font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: var(--text-secondary);">Chi phí cố định (ước tính):</span>
                    <span style="font-weight: 500;">${DB.formatCurrency(avgFixedCost)}/tháng</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: var(--text-secondary);">Doanh thu TB / HV:</span>
                    <span style="font-weight: 500;">${DB.formatCurrency(avgRevPerStudent)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Chi phí GV / HV:</span>
                    <span style="font-weight: 500;">${DB.formatCurrency(varCostPerStudent)}</span>
                </div>
            </div>
        `;
    };

    const renderMonthlyTrends = () => {
        return `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">Doanh thu</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${DB.formatCurrency(currentMonthRevenue)}</div>
                    </div>
                    <div class="assistant-trend ${revChange >= 0 ? 'up' : 'down'}" style="display: flex; align-items: center; gap: 5px; color: ${revChange >= 0 ? 'var(--success-500)' : 'var(--danger-500)'}; font-weight: 600; font-size: 14px;">
                        <i data-lucide="${revChange >= 0 ? 'trending-up' : 'trending-down'}" style="width: 16px; height: 16px;"></i>
                        <span>${formatPercent(revChange)}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">Chi phí</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${DB.formatCurrency(currentMonthExpense)}</div>
                    </div>
                    <div class="assistant-trend ${expChange <= 0 ? 'up' : 'down'}" style="display: flex; align-items: center; gap: 5px; color: ${expChange <= 0 ? 'var(--success-500)' : 'var(--danger-500)'}; font-weight: 600; font-size: 14px;">
                        <i data-lucide="${expChange <= 0 ? 'trending-down' : 'trending-up'}" style="width: 16px; height: 16px;"></i>
                        <span>${formatPercent(expChange)}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">Lợi nhuận</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${DB.formatCurrency(currentMonthProfit)}</div>
                    </div>
                    <div class="assistant-trend ${profitChange >= 0 ? 'up' : 'down'}" style="display: flex; align-items: center; gap: 5px; color: ${profitChange >= 0 ? 'var(--success-500)' : 'var(--danger-500)'}; font-weight: 600; font-size: 14px;">
                        <i data-lucide="${profitChange >= 0 ? 'trending-up' : 'trending-down'}" style="width: 16px; height: 16px;"></i>
                        <span>${formatPercent(profitChange)}</span>
                    </div>
                </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 15px;">* So với tháng ${String(lastMonthDate.getMonth()+1).padStart(2, '0')}/${lastMonthDate.getFullYear()}</div>
        `;
    };

    const renderClassProfitability = () => {
        if (activeClasses.length === 0) {
            return `<div class="p-4 text-center text-muted">Chưa có lớp học nào đang hoạt động.</div>`;
        }

        const classPnL = activeClasses.map(cls => {
            // Students in this class
            const classStudents = activeStudents.filter(s => s.classIds && s.classIds.includes(cls.id));
            const studentCount = classStudents.length;

            // Expected revenue
            let expectedRev = 0;
            classStudents.forEach(s => {
                let fee = (s.customFees && s.customFees[cls.id] !== undefined) ? s.customFees[cls.id] : (cls.fee || 0);
                if (s.discount) fee = fee * (1 - s.discount);
                expectedRev += fee;
            });

            // Expected teacher salary
            let expectedSal = 0;
            (cls.teacherIds || []).forEach(tid => {
                const t = teachers.find(x => x.id === tid);
                if (t && t.salaryConfig && t.salaryConfig[cls.id]) {
                    const conf = t.salaryConfig[cls.id];
                    // Count scheduled sessions per month for this class (approx 4 weeks)
                    const classSchedules = schedules.filter(s => s.classId === cls.id && !s.specificDate);
                    const sessionsPerMonth = classSchedules.length * 4;
                    expectedSal += (conf.perShift || 0) * sessionsPerMonth;
                }
            });

            // Actual revenue from paid tuitions this month
            const paidTuitions = allTuitions.filter(t => {
                if (t.status !== 'paid') return false;
                if (!t.dueDate || !t.dueDate.startsWith(currentMonthStr)) return false;
                if (t.classId === cls.id) return true;
                if (t.classId === 'Nhiều môn' && t.studentId) {
                    const student = students.find(s => s.id === t.studentId);
                    return student && (student.classIds || []).includes(cls.id);
                }
                return false;
            });

            const actualRev = paidTuitions.reduce((sum, t) => {
                if (t.classId === cls.id) return sum + Number(t.amount || 0);
                const student = students.find(s => s.id === t.studentId);
                if (student && student.classIds && student.classIds.length > 1) {
                    const thisFee = (student.customFees && student.customFees[cls.id] !== undefined) ? student.customFees[cls.id] : (cls.fee || 0);
                    let totalFee = 0;
                    student.classIds.forEach(cid => {
                        const c2 = classes.find(cc => cc.id === cid);
                        if (c2) totalFee += (student.customFees && student.customFees[cid] !== undefined) ? student.customFees[cid] : (c2.fee || 0);
                    });
                    if (totalFee > 0) return sum + Math.round(Number(t.amount || 0) * thisFee / totalFee);
                }
                return sum + Number(t.amount || 0);
            }, 0);

            // Actual teacher salary from attendance
            const classTeacherAtt = teacherAttendanceCurrentMonth.filter(r => r.classId === cls.id);
            let actualSal = 0;
            classTeacherAtt.forEach(r => {
                let rSalary = r.salary || 0;
                if (r.salaryMultiplier !== undefined) rSalary *= r.salaryMultiplier;
                if (r.penaltyAmount) rSalary -= r.penaltyAmount;
                if (rSalary < 0) rSalary = 0;
                actualSal += rSalary;
            });

            const expectedProfit = expectedRev - expectedSal;
            const actualProfit = actualRev - actualSal;

            return {
                id: cls.id,
                name: cls.name,
                subject: cls.subject || '',
                studentCount,
                expectedRev,
                expectedSal,
                expectedProfit,
                actualRev,
                actualSal,
                actualProfit,
                margin: expectedRev > 0 ? ((expectedProfit / expectedRev) * 100) : 0
            };
        });

        // Sort: losing classes first, then by profit ascending
        classPnL.sort((a, b) => a.expectedProfit - b.expectedProfit);

        const losing = classPnL.filter(c => c.expectedProfit < 0);
        const breakingEven = classPnL.filter(c => c.expectedProfit === 0);
        const profitable = classPnL.filter(c => c.expectedProfit > 0).sort((a, b) => b.expectedProfit - a.expectedProfit);

        let html = '';

        // Summary
        html += `<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">`;
        if (losing.length > 0) {
            html += `<div style="flex:1;min-width:100px;padding:12px;border-radius:var(--radius-md);background:rgba(239,68,68,0.08);border-left:3px solid var(--danger-500);text-align:center;">
                <div style="font-size:22px;font-weight:800;color:var(--danger-500);">${losing.length}</div>
                <div style="font-size:12px;color:var(--text-muted);">Lớp đang lỗ</div>
            </div>`;
        }
        html += `<div style="flex:1;min-width:100px;padding:12px;border-radius:var(--radius-md);background:rgba(34,197,94,0.08);border-left:3px solid var(--success-500);text-align:center;">
            <div style="font-size:22px;font-weight:800;color:var(--success-500);">${profitable.length}</div>
            <div style="font-size:12px;color:var(--text-muted);">Lớp có lãi</div>
        </div>`;
        html += `</div>`;

        // Table
        html += `<div class="table-container"><table><thead><tr>
            <th>Lớp</th><th style="text-align:center;">Sĩ số</th>
            <th style="text-align:right;">DT dự kiến</th><th style="text-align:right;">Lương GV</th>
            <th style="text-align:right;">Lợi nhuận DK</th><th style="text-align:center;">Biên LN</th>
            <th style="text-align:center;">Trạng thái</th>
        </tr></thead><tbody>`;

        // Show losing first, then profitable
        const allSorted = [...losing, ...breakingEven, ...profitable];
        allSorted.forEach(c => {
            const isLoss = c.expectedProfit < 0;
            const rowBg = isLoss ? 'rgba(239,68,68,0.04)' : '';
            const profitColor = isLoss ? 'var(--danger-500)' : 'var(--success-500)';
            const statusBadge = isLoss
                ? `<span class="badge badge-danger">📉 Đang lỗ</span>`
                : c.expectedProfit === 0
                    ? `<span class="badge badge-warning">⚖️ Hoà vốn</span>`
                    : c.margin >= 50
                        ? `<span class="badge badge-success">🔥 Lãi tốt</span>`
                        : `<span class="badge badge-success">✅ Có lãi</span>`;

            html += `<tr style="background:${rowBg};cursor:pointer;" onclick="Router.navigate('classes')">
                <td>
                    <div style="font-weight:600;">${c.name}</div>
                    ${c.subject ? `<div style="font-size:12px;color:var(--text-muted);">${c.subject}</div>` : ''}
                </td>
                <td style="text-align:center;">${c.studentCount} HV</td>
                <td style="text-align:right;color:var(--info-500);">${DB.formatCurrency(c.expectedRev)}</td>
                <td style="text-align:right;color:var(--danger-400);">${DB.formatCurrency(c.expectedSal)}</td>
                <td style="text-align:right;font-weight:700;color:${profitColor};">${DB.formatCurrency(c.expectedProfit)}</td>
                <td style="text-align:center;font-weight:600;color:${profitColor};">${c.margin.toFixed(0)}%</td>
                <td style="text-align:center;">${statusBadge}</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;

        // Tips for losing classes
        if (losing.length > 0) {
            html += `<div style="margin-top:16px;padding:14px;background:rgba(239,68,68,0.06);border-radius:var(--radius-md);border:1px dashed var(--danger-400);">`;
            html += `<div style="font-weight:600;margin-bottom:8px;color:var(--danger-500);"><i data-lucide="lightbulb" style="width:16px;height:16px;margin-right:6px;vertical-align:text-bottom;"></i>Gợi ý cải thiện</div>`;
            html += `<ul style="margin:0;padding-left:20px;font-size:13px;color:var(--text-secondary);line-height:1.8;">`;
            losing.forEach(c => {
                const minStudents = c.expectedSal > 0 && (c.expectedRev / (c.studentCount || 1)) > 0
                    ? Math.ceil(c.expectedSal / (c.expectedRev / (c.studentCount || 1)))
                    : '?';
                html += `<li><strong>${c.name}</strong>: Cần tối thiểu <strong>${minStudents} HV</strong> để hoà vốn (hiện có ${c.studentCount} HV). Cân nhắc tuyển thêm hoặc giảm chi phí giảng dạy.</li>`;
            });
            html += `</ul></div>`;
        }

        return html;
    };

    const renderExpenseChart = () => {
        return `
            <div style="position: relative; height: 200px; width: 100%;">
                <canvas id="expenseChart"></canvas>
            </div>
        `;
    };

    const renderTeacherSalary = () => {
        if (!window.currentUser) return '';
        
        const myAttendance = teacherAttendanceCurrentMonth.filter(a => a.teacherId === window.currentUser.uid);
        const sessions = myAttendance.length;
        const baseSalary = myAttendance.reduce((sum, a) => sum + (a.salary || 0), 0);
        
        const myAdjustments = salaryAdjustments.filter(a => a.teacherId === window.currentUser.uid);
        const bonusPenalty = myAdjustments.reduce((sum, a) => sum + (a.amount || 0), 0);
        
        const netSalary = baseSalary + bonusPenalty;

        return `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Số ca dạy trong tháng:</span>
                    <span style="font-weight: 600;">${sessions} ca</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Lương cơ bản:</span>
                    <span style="font-weight: 600;">${DB.formatCurrency(baseSalary)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Thưởng/Phạt:</span>
                    <span style="font-weight: 600; color: ${bonusPenalty >= 0 ? 'var(--success-500)' : 'var(--danger-500)'}">${DB.formatCurrency(bonusPenalty)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 5px;">
                    <span style="font-weight: 600; color: var(--text-primary);">Tổng thu nhập dự kiến:</span>
                    <span style="font-weight: 700; font-size: 18px; color: var(--primary-500);">${DB.formatCurrency(netSalary)}</span>
                </div>
            </div>
        `;
    };

    // 5. Build Main Layout
    let contentHtml = `<div class="stagger" style="max-width: 1200px; margin: 0 auto;">`;
    
    contentHtml += renderGreeting();

    if (Auth.isOwner()) {
        contentHtml += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up" style="grid-column: 1 / -1;">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="list-todo" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Việc cần xử lý</h3></div>
                    <div class="card-body" style="padding: 0;">${renderActionItems()}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="monitor-play" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Tình trạng lớp học hôm nay</h3></div>
                    <div class="card-body" style="padding: 0;">${renderTodayClasses(todayClasses)}</div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <div class="card slide-up">
                        <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="pie-chart" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Tổng quan tài chính (${currentMonthStr})</h3></div>
                        <div class="card-body">${renderFinancialSummary()}</div>
                    </div>
                    
                    <div class="card slide-up">
                        <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="target" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Phân tích hoà vốn</h3></div>
                        <div class="card-body">${renderBreakEven()}</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="bar-chart-2" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Biến động so với tháng trước</h3></div>
                    <div class="card-body">${renderMonthlyTrends()}</div>
                </div>
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="donut" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Cơ cấu chi phí</h3></div>
                    <div class="card-body">${renderExpenseChart()}</div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="scale" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Lãi / Lỗ theo từng lớp</h3></div>
                    <div class="card-body" style="padding:0 0 16px 0;">${renderClassProfitability()}</div>
                </div>
            </div>
        `;
    } else if (Auth.isStaff()) {
        contentHtml += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up" style="grid-column: 1 / -1;">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="list-todo" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Việc cần xử lý</h3></div>
                    <div class="card-body" style="padding: 0;">${renderActionItems()}</div>
                </div>
                
                <div class="card slide-up" style="grid-column: 1 / -1;">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="monitor-play" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Tình trạng lớp học hôm nay</h3></div>
                    <div class="card-body" style="padding: 0;">${renderTodayClasses(todayClasses)}</div>
                </div>
            </div>
        `;
    } else if (Auth.isTeacher()) {
        const myClassesToday = todayClasses.filter(tc => tc.teacherIds.includes(window.currentUser.uid));
        
        contentHtml += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="monitor-play" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Lịch dạy hôm nay</h3></div>
                    <div class="card-body" style="padding: 0;">${renderTodayClasses(myClassesToday, true)}</div>
                </div>
                
                <div class="card slide-up">
                    <div class="card-header"><h3 style="margin:0;font-size:16px;font-weight:600;"><i data-lucide="wallet" style="width:18px;height:18px;margin-right:8px;vertical-align:text-bottom;"></i> Lương dự kiến tháng ${currentMonthStr.split('-')[1]}</h3></div>
                    <div class="card-body">${renderTeacherSalary()}</div>
                </div>
            </div>
        `;
    }

    contentHtml += `</div>`;
    container.innerHTML = contentHtml;

    // Initialize Chart.js for Owner
    if (Auth.isOwner()) {
        const ctx = document.getElementById('expenseChart');
        if (ctx) {
            const expenses = financeCurrentMonth.filter(f => f.type === 'expense');
            const categories = ['Học phí', 'Lương GV', 'Điện nước', 'Thuê mặt bằng', 'Vật tư', 'Khác'];
            const dataMap = {};
            categories.forEach(c => dataMap[c] = 0);
            
            expenses.forEach(e => {
                const cat = e.category || 'Khác';
                if (dataMap[cat] !== undefined) dataMap[cat] += e.amount;
                else dataMap['Khác'] += e.amount;
            });

            const bgColors = [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'
            ];

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categories,
                    datasets: [{
                        data: categories.map(c => dataMap[c]),
                        backgroundColor: bgColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
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
