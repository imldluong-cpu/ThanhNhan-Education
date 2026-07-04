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
                        <button class="btn-icon" title="In phiếu" onclick="TuitionPage.showInvoice('${t.id}')"><i data-lucide="printer"></i></button>
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

        showInvoice(id) {
            const t = tuitions.find(x => x.id === id);
            if (!t) return;
            
            const studentName = getStudentName(t.studentId);
            const className = getClassName(t.classId);
            const amountFormatted = DB.formatCurrency(t.amount).replace(' ₫', '');
            
            const d = new Date();
            const currentDay = String(d.getDate()).padStart(2, '0');
            const currentMonth = String(d.getMonth() + 1).padStart(2, '0');
            const currentYear = d.getFullYear();
            
            const dueDateObj = new Date(t.dueDate);
            const monthStr = String(dueDateObj.getMonth() + 1).padStart(2, '0');
            const yearStr = dueDateObj.getFullYear();
            
            const fromDateStr = `01/${monthStr}/${yearStr}`;
            const toDateStr = `30/${monthStr}/${yearStr}`;

            Modal.show({
                title: 'Phiếu thu học phí',
                content: `
                    <style>
                    @media print {
                        body * { visibility: hidden !important; }
                        #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
                        #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                        .modal { position: absolute; left: 0; top: 0; background: transparent !important; overflow: visible !important; }
                        .modal-content { box-shadow: none !important; border: none !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
                        .modal-header, .modal-footer, .invoice-actions { display: none !important; }
                    }
                    .invoice-editable:hover { background-color: #f0f9ff; cursor: text; outline: 1px dashed #0ea5e9; }
                    .invoice-editable:focus { outline: 1px solid #0ea5e9; background-color: #fff; }
                    </style>
                    
                    <div class="invoice-actions" style="display:flex; gap:10px; margin-bottom: 20px; justify-content: flex-end;">
                        <button class="btn btn-secondary" onclick="TuitionPage.exportInvoiceImage('${studentName}')"><i data-lucide="image"></i> Tải ảnh</button>
                        <button class="btn btn-primary" onclick="window.print()"><i data-lucide="printer"></i> In / Lưu PDF</button>
                    </div>

                    <div style="overflow-x: auto; padding-bottom: 15px; margin: 0 -20px; padding-left: 20px; padding-right: 20px;">
                    <div id="invoice-print-area" style="width: 148mm; flex-shrink: 0; background: white; padding: 15mm; box-sizing: border-box; margin: 0 auto; color: black; font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.5; border: 1px solid #eee;">
                        <div style="text-align: center; margin-bottom: 15px;">
                            <img src="assets/images/logo.png" style="height: 50px;" alt="Logo" onerror="this.style.display='none'">
                        </div>
                        
                        <h2 style="text-align: center; margin: 0; font-size: 20px; font-weight: bold;">PHIẾU THU HỌC PHÍ</h2>
                        <p style="text-align: center; margin: 5px 0 15px 0;">Tháng <span class="invoice-editable" contenteditable="true" style="border-bottom: 1px dotted #ccc; min-width: 40px; display: inline-block; text-align: center;">${monthStr}</span>/<span class="invoice-editable" contenteditable="true" style="border-bottom: 1px dotted #ccc; min-width: 40px; display: inline-block; text-align: center;">${yearStr}</span></p>
                        
                        <div style="margin-bottom: 15px;">
                            <div style="display: flex; margin-bottom: 8px;">
                                <strong style="width: 120px;">Học viên:</strong>
                                <span class="invoice-editable" contenteditable="true" style="flex: 1; border-bottom: 1px dotted #ccc; outline: none;">${studentName}</span>
                            </div>
                            <div style="display: flex; margin-bottom: 8px;">
                                <strong style="width: 120px;">Lớp - Môn:</strong>
                                <span class="invoice-editable" contenteditable="true" style="flex: 1; border-bottom: 1px dotted #ccc; outline: none;">${className}</span>
                            </div>
                            <div style="display: flex; margin-bottom: 8px;">
                                <strong style="width: 120px;">Số tiền:</strong>
                                <span class="invoice-editable" contenteditable="true" style="flex: 1; border-bottom: 1px dotted #ccc; outline: none;">${amountFormatted}</span>
                            </div>
                            <div style="display: flex; margin-bottom: 8px; align-items: baseline;">
                                <strong style="width: 150px; flex-shrink: 0;">Học phí từ ngày:</strong>
                                <span class="invoice-editable" contenteditable="true" style="border-bottom: 1px dotted #ccc; min-width: 100px; text-align: center; outline: none;">${fromDateStr}</span>
                                <span style="margin: 0 10px;">đến ngày</span>
                                <span class="invoice-editable" contenteditable="true" style="flex: 1; border-bottom: 1px dotted #ccc; text-align: center; outline: none;">${toDateStr}</span>
                            </div>
                        </div>
                        
                        <div style="text-align: right; font-style: italic; margin-bottom: 15px;">
                            Ngày <span class="invoice-editable" contenteditable="true" style="border-bottom: 1px dotted #ccc; min-width: 25px; display: inline-block; text-align: center; outline: none;">${currentDay}</span>
                            tháng <span class="invoice-editable" contenteditable="true" style="border-bottom: 1px dotted #ccc; min-width: 25px; display: inline-block; text-align: center; outline: none;">${currentMonth}</span>
                            năm <span class="invoice-editable" contenteditable="true" style="border-bottom: 1px dotted #ccc; min-width: 40px; display: inline-block; text-align: center; outline: none;">${currentYear}</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 15px;">
                            <div style="width: 65%; display: flex; gap: 10px; align-items: center;">
                                <img src="https://img.vietqr.io/image/970415-1801755276-print.png" style="width: 80px; height: 80px; object-fit: contain; flex-shrink: 0;">
                                <div style="font-size: 11px; font-style: italic; line-height: 1.3;">
                                    <p style="margin: 0 0 3px 0;">STK: 1801755276</p>
                                    <p style="margin: 0 0 3px 0; font-size: 10px;">CONG TY TNHH THANH NHAN EDUCATION</p>
                                    <p style="margin: 0;">Ngân hàng TMCP Kỹ thương Việt Nam</p>
                                </div>
                            </div>
                            <div style="width: 30%; text-align: center; border-left: 1px solid #000; padding-left: 5px;">
                                <strong style="font-size: 14px;">Người lập</strong>
                                <br><br><br><br>
                                <strong class="invoice-editable" contenteditable="true" style="font-size: 14px; outline: none;">Lê Duy Lương</strong>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin-bottom: 10px;">
                            <strong style="font-size: 15px;">TRUNG TÂM DẠY THÊM THÀNH NHÂN EDUCATION</strong>
                        </div>
                        
                        <div style="margin-bottom: 15px; font-size: 12px; line-height: 1.4;">
                            <p style="margin: 0 0 5px 0; text-align: justify;">Chương trình giảng dạy bám sát chương trình phổ thông, tập trung củng cố kiến thức nền tảng và theo sát tiến độ học tập của từng học sinh, với các môn học:</p>
                            <strong style="font-size: 13px; display: block; margin-bottom: 8px;">TOÁN - VĂN - ANH VĂN - LÝ - HÓA - TIẾNG ANH GIAO TIẾP.</strong>
                            
                            <p style="margin: 0 0 4px 0;">📌 <strong>Đối tượng:</strong> Học sinh Cấp 2; Cấp 3; Tiểu học (Tiếng Anh giao tiếp).</p>
                            <p style="margin: 0 0 8px 0;">🆓 <strong>HỌC THỬ MIỄN PHÍ 01 BUỔI:</strong> Học trải nghiệm trước khi đăng ký.</p>
                            
                            <p style="margin: 0 0 4px 0;">🤝 <strong>Học cùng bạn - tăng động lực học tập:</strong> (Giảm trực tiếp học phí 3 tháng đầu cho cả nhóm)</p>
                            <ul style="margin: 0 0 8px 20px; padding: 0;">
                                <li>2 học sinh: giảm 5%</li>
                                <li>3 học sinh: giảm 10%</li>
                                <li>Từ 5 học sinh: giảm 20%</li>
                            </ul>
                            
                            <p style="margin: 0 0 4px 0;">💡 <strong>Hỗ trợ học phí toàn khóa:</strong></p>
                            <ul style="margin: 0 0 8px 20px; padding: 0;">
                                <li>Đăng ký 2 môn: giảm 5%</li>
                                <li>Từ 3 môn trở lên: giảm 10%</li>
                            </ul>
                        </div>
                        
                        <div style="border-top: 1px solid #000; padding-top: 8px; font-style: italic; font-weight: bold; font-size: 12px;">
                            <p style="margin: 0 0 4px 0;">Số 56 Nguyễn Văn Trỗi, P. Xuân Khánh, TPCT (dưới chân cầu Rạch Ngỗng 1)</p>
                            <p style="margin: 0;">Hotline/Zalo: 0388 877 543</p>
                        </div>
                    </div>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Đóng</button>`
            });
            
            if (window.lucide) {
                window.lucide.createIcons();
            }
        },
        
        async exportInvoiceImage(studentName) {
            const element = document.getElementById('invoice-print-area');
            if (!element) return;
            
            if (typeof html2canvas === 'undefined') {
                Toast.error('Thư viện chụp ảnh chưa được tải. Vui lòng thử lại sau.');
                return;
            }
            
            const oldBorder = element.style.border;
            element.style.border = 'none';
            
            try {
                const btn = event.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = 'Đang xử lý...';
                btn.disabled = true;
                
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                });
                
                const link = document.createElement('a');
                link.download = `PhieuThu_${studentName.replace(/\s+/g, '')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                Toast.success('Đã tải ảnh thành công');
                
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            } catch (err) {
                console.error(err);
                Toast.error('Lỗi chụp ảnh', err.message);
            } finally {
                element.style.border = oldBorder;
            }
        },

        remove(id) {
            Modal.confirm({ title: 'Xóa', message: 'Xóa khoản thu này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => { await DB.deleteTuition(id); tuitions = await DB.getTuitions(); render(); Toast.success('Đã xóa'); });
        }
    };
});
