// ============================================
// TUITION PAGE - Fixed realtime updates
// ============================================

Router.register('tuition', async (container) => {
    let tuitions = [], students = [], classes = [];
    try {
        tuitions = await DB.getTuitions();
        students = await DB.getStudents();
        classes = await DB.getClasses();
        
        // Migrate existing tuitions to 2026 - 2027 if due > June 15
        tuitions.forEach(t => {
            if (t.academicYear && t.academicYear.indexOf(' - ') === -1) {
                t.academicYear = t.academicYear.replace('-', ' - ');
                DB.updateTuition(t.id, { academicYear: t.academicYear }).catch(()=>{});
            }
            if (t.academicYear === '2026 - 2027' && t.dueDate && t.dueDate >= '2026-06-01' && t.dueDate <= '2026-06-15') {
                t.academicYear = '2025 - 2026';
                DB.updateTuition(t.id, { academicYear: '2025 - 2026' }).catch(()=>{});
            } else if (!t.academicYear && t.dueDate && t.dueDate > '2026-06-15') {
                t.academicYear = '2026 - 2027';
                DB.updateTuition(t.id, { academicYear: '2026 - 2027' }).catch(()=>{});
            }
        });
    } catch(e) { console.warn(e); }

    let activeTab = 'all';
    let searchTerm = '';
    
    function getAcademicYear(dateStr, t = null) {
        if (t && t.academicYear) {
            return t.academicYear.indexOf(' - ') === -1 ? t.academicYear.replace('-', ' - ') : t.academicYear;
        }
        if (!dateStr) return 'Khác';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Khác';
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const date = d.getDate();
        if (month >= 7 || (month === 6 && date > 15)) return `${year} - ${year + 1}`;
        return `${year - 1} - ${year}`;
    }
    
    let currentYearStr = getAcademicYear(DB.today());
    let activeYear = currentYearStr;

    function getStudentName(id) { return (students.find(s => s.id === id) || {}).name || '—'; }
    function getClassName(id) {
        if (id === 'Nhiều môn') return 'Nhiều môn';
        return (classes.find(c => c.id === id) || {}).name || '—';
    }

    function getFiltered() {
        let list = tuitions;
        if (activeYear) {
            list = list.filter(t => getAcademicYear(t.dueDate, t) === activeYear);
        }
        
        const todayDate = new Date(DB.today());
        list.forEach(t => {
            if (t.status === 'pending' && t.dueDate) {
                const due = new Date(t.dueDate);
                if (due < todayDate) {
                    t.status = 'overdue';
                    DB.updateTuition(t.id, { status: 'overdue' }).catch(()=>{});
                    t._displayStatus = 'overdue';
                } else {
                    const diffTime = due.getTime() - todayDate.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 7) {
                        t._displayStatus = 'upcoming';
                    } else {
                        t._displayStatus = 'pending';
                    }
                }
            } else {
                t._displayStatus = t.status;
            }
        });

        if (activeTab === 'pending') list = list.filter(t => t._displayStatus === 'pending');
        else if (activeTab === 'upcoming') list = list.filter(t => t._displayStatus === 'upcoming');
        else if (activeTab === 'overdue') list = list.filter(t => t._displayStatus === 'overdue');
        else if (activeTab === 'paid') list = list.filter(t => t._displayStatus === 'paid');
        else if (activeTab === 'reminder') list = list.filter(t => t.status !== 'paid');
        
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(t => getStudentName(t.studentId).toLowerCase().includes(q));
        }
        return list;
    }

    function render() {
        const mainArea = document.getElementById('tuition-main');
        if (!mainArea) return;

        const filtered = getFiltered();

        const yearSet = new Set();
        tuitions.forEach(t => yearSet.add(getAcademicYear(t.dueDate, t)));
        if (!yearSet.has(currentYearStr)) yearSet.add(currentYearStr);
        const years = Array.from(yearSet).sort().reverse();
        
        const yearSelect = document.getElementById('t-year-filter');
        if (yearSelect) {
            yearSelect.innerHTML = `<option value="">Tất cả năm học</option>` + 
                years.map(y => `<option value="${y}" ${activeYear === y ? 'selected' : ''}>Năm học ${y}</option>`).join('');
        }

        let totalDue = 0, totalPaid = 0, totalOwed = 0;
        filtered.forEach(t => {
            const amt = t.amount || 0;
            totalDue += amt;
            if (t.status === 'paid') totalPaid += amt; else totalOwed += amt;
        });

        let content = `
            <div class="stats-grid mb-6">
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--info-400);">${DB.formatCurrency(totalDue)}</div>
                    <div class="stat-label">Tổng cần thu</div>
                </div>
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--success-400);">${DB.formatCurrency(totalPaid)}</div>
                    <div class="stat-label">Đã thu</div>
                </div>
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--danger-400);">${DB.formatCurrency(totalOwed)}</div>
                    <div class="stat-label">Còn nợ</div>
                </div>
            </div>
        `;

        if (activeTab === 'reminder') {
            const todayStr = DB.today();
            const todayDate = new Date(todayStr);
            const limitDate = new Date(todayDate);
            limitDate.setDate(limitDate.getDate() + 7);
            
            const reminderFiltered = filtered.filter(t => {
                if (!t.dueDate) return true;
                const d = new Date(t.dueDate);
                return d <= limitDate;
            });

            // Reminder cards view
            content += `<div class="card"><div class="card-body">`;
            if (reminderFiltered.length === 0) {
                content += '<div class="empty-state"><p>Tất cả học phí đã được thu hoặc chưa đến kỳ! 🎉</p></div>';
            } else {
                content += reminderFiltered.map(t => {
                    const d = new Date(t.dueDate);
                    const isOverdue = d < todayDate;
                    const statusColor = isOverdue ? 'var(--danger-500)' : 'var(--warning-500)';
                    const statusText = isOverdue ? 'Quá hạn' : 'Sắp đến hạn';
                    
                    return `
                    <div class="reminder-card" style="${t.reminderSent ? 'opacity:0.6;' : ''}margin-bottom:8px;border-left:4px solid ${statusColor};">
                        <div class="reminder-info">
                            <div class="reminder-avatar" style="background:${statusColor}22;color:${statusColor}">${getStudentName(t.studentId).charAt(0)}</div>
                            <div class="reminder-details">
                                <h4>${getStudentName(t.studentId)} <span style="font-size:12px;font-weight:normal;color:var(--text-secondary);">(${getClassName(t.classId)})</span></h4>
                                <p>${DB.formatCurrency(t.amount)} — Hạn: ${DB.formatDate(t.dueDate)} <span style="color:${statusColor};font-weight:600;">(${statusText})</span> ${t.reminderSent ? '(Đã nhắc)' : ''}</p>
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;flex-shrink:0;">
                            ${!t.reminderSent ? `<button class="btn btn-secondary btn-sm" onclick="TuitionPage.markReminded('${t.id}')">📞 Đã nhắc</button>` : ''}
                            <button class="btn btn-success btn-sm" onclick="TuitionPage.markPaid('${t.id}')">✓ Đã đóng</button>
                        </div>
                    </div>
                `}).join('');
            }
            content += '</div></div>';
        } else {
            // Table view
            content += `<div class="card"><div class="table-container"><table>
                <thead><tr><th>Học viên</th><th>Lớp</th><th>Số tiền</th><th>Hạn đóng</th><th>Ngày đóng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>`;
            if (filtered.length === 0) {
                content += '<tr><td colspan="7"><div class="empty-state"><p>Không có dữ liệu</p></div></td></tr>';
            } else {
                content += filtered.map(t => `<tr>
                    <td><strong>${getStudentName(t.studentId)}</strong></td>
                    <td>${getClassName(t.classId)}</td>
                    <td>${DB.formatCurrency(t.amount)}</td>
                    <td>${DB.formatDate(t.dueDate)}</td>
                    <td>${t.paidDate ? DB.formatDate(t.paidDate) : '—'}</td>
                    <td><span class="badge badge-${t._displayStatus === 'paid' ? 'success' : t._displayStatus === 'overdue' ? 'danger' : t._displayStatus === 'upcoming' ? 'info' : 'warning'}">${t._displayStatus === 'paid' ? 'Đã đóng' : t._displayStatus === 'overdue' ? 'Quá hạn' : t._displayStatus === 'upcoming' ? 'Chưa đến hạn' : 'Chưa đóng'}</span></td>
                    <td><div class="table-actions">
                        ${t.status !== 'paid' ? `<button class="btn btn-success btn-sm" onclick="TuitionPage.markPaid('${t.id}')">Đã đóng</button>` : ''}
                        <button class="btn-icon" onclick="TuitionPage.edit('${t.id}')"><i data-lucide="pencil"></i></button>
                        <button class="btn-icon" onclick="TuitionPage.remove('${t.id}')"><i data-lucide="trash-2"></i></button>
                    </div></td>
                </tr>`).join('');
            }
            content += '</tbody></table></div></div>';
        }

        mainArea.innerHTML = content;
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="wallet"></i> Quản lý Học phí</h1></div>
            <div class="page-actions"><button class="btn btn-primary" onclick="TuitionPage.showAdd()"><i data-lucide="plus"></i> Thêm khoản thu</button></div>
        </div>
        <div class="tabs">
            <button class="tab-item active" onclick="TuitionPage.switchTab('all', this)">Tất cả</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('pending', this)">Chưa đóng</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('upcoming', this)">Sắp đến hạn</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('overdue', this)">Quá hạn</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('paid', this)">Đã đóng</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('reminder', this)">📞 Nhắc học phí</button>
        </div>
        <div class="filter-bar" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="search-box"><i data-lucide="search"></i><input type="text" class="input" placeholder="Tìm theo tên..." oninput="TuitionPage.search(this.value)"></div>
            <select class="select" id="t-year-filter" style="max-width:200px;" onchange="TuitionPage.filterYear(this.value)">
            </select>
        </div>
        <div id="tuition-main"></div>
    `;

    render();

    window.TuitionPage = {
        search(val) { searchTerm = val; render(); },
        filterYear(val) { activeYear = val; render(); },
        switchTab(tab, el) {
            activeTab = tab;
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            render();
        },

        markPaid(id) {
            Modal.confirm({
                title: 'Xác nhận thanh toán',
                message: 'Đánh dấu khoản thu này là "Đã đóng" và tự động tạo phiếu thu cho tháng tiếp theo?',
                confirmText: 'Xác nhận & Tạo tháng sau',
                middleBtnText: 'Chỉ xác nhận',
                cancelText: 'Hủy',
                danger: false
            });
            Modal.bindConfirm(async () => {
                await TuitionPage._processPaid(id, true);
            });
            Modal.bindMiddle(async () => {
                await TuitionPage._processPaid(id, false);
            });
        },

        async _processPaid(id, createNext) {
            try {
                await DB.updateTuition(id, { status: 'paid', paidDate: DB.today() });
                const t = tuitions.find(x => x.id === id);
                if (t) { 
                    t.status = 'paid'; 
                    t.paidDate = DB.today(); 
                    
                    // Auto-sync with Finance
                    await DB.addFinanceRecord({
                        type: 'revenue',
                        category: 'Học phí',
                        description: `Thu học phí: ${t.studentName || getStudentName(t.studentId)} ${t.note ? '(' + t.note + ')' : ''}`,
                        amount: t.amount,
                        date: DB.today(),
                        createdBy: window.currentUser ? window.currentUser.id : 'system'
                    });
                }

                if (createNext && t) {
                    const [y, m, d] = t.dueDate.split('-');
                    const nextDue = new Date(y, m - 1, d);
                    nextDue.setMonth(nextDue.getMonth() + 1);
                    const nextY = nextDue.getFullYear();
                    const nextM = String(nextDue.getMonth() + 1).padStart(2, '0');
                    const nextD = String(nextDue.getDate()).padStart(2, '0');
                    const nextDueStr = `${nextY}-${nextM}-${nextD}`;
                    
                    await DB.addTuition({
                        studentId: t.studentId,
                        studentName: t.studentName,
                        classId: t.classId || 'Nhiều môn',
                        amount: t.amount,
                        dueDate: nextDueStr,
                        status: 'pending',
                        reminderSent: false,
                        note: `Học phí tháng ${nextM}/${nextY} (Tạo tự động)`
                    });
                }

                Toast.success('Thành công', createNext ? 'Đã xác nhận và tạo phiếu tháng sau' : 'Đã xác nhận thanh toán');
                tuitions = await DB.getTuitions();
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async markReminded(id) {
            try {
                await DB.updateTuition(id, { reminderSent: true });
                const t = tuitions.find(x => x.id === id);
                if (t) t.reminderSent = true;
                Toast.info('Đã ghi nhận nhắc nhở');
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        showAdd() {
            Modal.show({
                title: 'Thêm khoản thu',
                content: `
                    <div class="form-group"><label class="form-label">Học viên *</label>
                        <select class="select" id="t-student"><option value="">Chọn</option>${students.filter(s => s.status === 'active').map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Lớp</label>
                        <select class="select" id="t-class"><option value="">Chọn</option>${classes.map(c => `<option value="${c.id}">${c.name} ${c.fee ? '(' + DB.formatCurrency(c.fee) + ')' : ''}</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Số tiền *</label><input type="number" class="input" id="t-amount" placeholder="0"></div>
                        <div class="form-group"><label class="form-label">Hạn đóng *</label><input type="date" class="input" id="t-due"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="input" id="t-note" placeholder="VD: Học phí tháng 6"></div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TuitionPage.saveNew()">Lưu</button>`
            });
            document.getElementById('t-class')?.addEventListener('change', function() {
                const cls = classes.find(c => c.id === this.value);
                if (cls?.fee) document.getElementById('t-amount').value = cls.fee;
            });
            
            document.getElementById('t-student')?.addEventListener('change', function() {
                const studentId = this.value;
                if (!studentId) return;
                
                const student = students.find(s => s.id === studentId);
                if (student && student.classIds && student.classIds.length > 0) {
                    let totalFee = 0;
                    let classNames = [];
                    
                    student.classIds.forEach(cid => {
                        const cls = classes.find(c => c.id === cid);
                        if (cls) {
                            const fee = (student.customFees && student.customFees[cid] !== undefined) ? student.customFees[cid] : (cls.fee || 0);
                            totalFee += fee;
                            classNames.push(cls.name);
                        }
                    });
                    
                    if (totalFee > 0) {
                        const discount = student.discount || 0;
                        let finalAmount = Math.round(totalFee * (1 - discount));
                        finalAmount = DB.roundTuition(finalAmount);
                        document.getElementById('t-amount').value = finalAmount;
                    }
                    
                    const classSelect = document.getElementById('t-class');
                    if (student.classIds.length === 1) {
                        classSelect.value = student.classIds[0];
                    } else if (student.classIds.length > 1) {
                        let multiOption = Array.from(classSelect.options).find(opt => opt.value === 'Nhiều môn');
                        if (!multiOption) {
                            multiOption = document.createElement('option');
                            multiOption.value = 'Nhiều môn';
                            classSelect.appendChild(multiOption);
                        }
                        multiOption.text = 'Nhiều môn (' + classNames.join(', ') + ')';
                        classSelect.value = 'Nhiều môn';
                    }
                    
                    if (classNames.length > 0) {
                        const month = new Date().getMonth() + 1;
                        document.getElementById('t-note').value = 'Học phí T' + month + ' - ' + classNames.join(', ');
                    }
                }
            });
        },

        async saveNew() {
            const studentId = document.getElementById('t-student').value;
            const amount = parseInt(document.getElementById('t-amount').value);
            const dueDate = document.getElementById('t-due').value;
            if (!studentId || !amount || !dueDate) { Toast.warning('Điền đầy đủ thông tin'); return; }
            try {
                await DB.addTuition({ studentId, studentName: getStudentName(studentId), classId: document.getElementById('t-class').value, amount, dueDate, status: new Date(dueDate) < new Date() ? 'overdue' : 'pending', reminderSent: false, note: document.getElementById('t-note').value });
                Modal.close();
                Toast.success('Đã thêm');
                tuitions = await DB.getTuitions();
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async edit(id) {
            const t = tuitions.find(x => x.id === id);
            if (!t) return;
            Modal.show({
                title: 'Sửa khoản thu',
                content: `
                    <div class="form-group"><label class="form-label">Học viên</label><select class="select" id="t-student">${students.map(s => `<option value="${s.id}" ${s.id === t.studentId ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Số tiền</label><input type="number" class="input" id="t-amount" value="${t.amount || 0}"></div>
                        <div class="form-group"><label class="form-label">Hạn đóng</label><input type="date" class="input" id="t-due" value="${t.dueDate || ''}"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Trạng thái</label>
                        <select class="select" id="t-status"><option value="pending" ${t.status === 'pending' ? 'selected' : ''}>Chưa đóng</option><option value="overdue" ${t.status === 'overdue' ? 'selected' : ''}>Quá hạn</option><option value="paid" ${t.status === 'paid' ? 'selected' : ''}>Đã đóng</option></select></div>
                    <div class="form-group" id="t-paid-date-group" style="${t.status === 'paid' ? '' : 'display:none;'}"><label class="form-label">Ngày đóng</label><input type="date" class="input" id="t-paid-date" value="${t.paidDate || DB.today()}"></div>
                    <script>
                        document.getElementById('t-status').addEventListener('change', function() {
                            document.getElementById('t-paid-date-group').style.display = this.value === 'paid' ? 'block' : 'none';
                        });
                    </script>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TuitionPage.saveEdit('${id}')">Cập nhật</button>`
            });
        },

        async saveEdit(id) {
            try {
                const status = document.getElementById('t-status').value;
                let paidDate = '';
                if (status === 'paid') {
                    const inputPaidDate = document.getElementById('t-paid-date');
                    paidDate = (inputPaidDate && inputPaidDate.value) ? inputPaidDate.value : DB.today();
                }
                const oldT = tuitions.find(x => x.id === id);
                await DB.updateTuition(id, { studentId: document.getElementById('t-student').value, studentName: getStudentName(document.getElementById('t-student').value), amount: parseInt(document.getElementById('t-amount').value) || 0, dueDate: document.getElementById('t-due').value, status, paidDate });
                
                if (status === 'paid' && oldT && oldT.status !== 'paid') {
                    const studentName = getStudentName(document.getElementById('t-student').value);
                    const note = oldT.note ? ` (${oldT.note})` : '';
                    await DB.addFinanceRecord({
                        type: 'revenue',
                        category: 'Học phí',
                        description: `Thu học phí: ${studentName}${note}`,
                        amount: parseInt(document.getElementById('t-amount').value) || 0,
                        date: DB.today(),
                        createdBy: window.currentUser ? window.currentUser.id : 'system'
                    });
                }

                Modal.close();
                tuitions = await DB.getTuitions();
                render();
                Toast.success('Đã cập nhật');
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        remove(id) {
            Modal.confirm({ title: 'Xóa', message: 'Xóa khoản thu này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => { await DB.deleteTuition(id); tuitions = await DB.getTuitions(); render(); Toast.success('Đã xóa'); });
        }
    };
});
