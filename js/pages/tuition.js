// ============================================
// TUITION PAGE - Fixed realtime updates
// ============================================

Router.register('tuition', async (container) => {
    let tuitions = [], students = [], classes = [];
    try {
        tuitions = await DB.getTuitions();
        students = await DB.getStudents();
        classes = await DB.getClasses();
    } catch(e) { console.warn(e); }

    let activeTab = 'all';
    let searchTerm = '';

    function getStudentName(id) { return (students.find(s => s.id === id) || {}).name || '—'; }
    function getClassName(id) { return (classes.find(c => c.id === id) || {}).name || '—'; }

    function getFiltered() {
        let list = tuitions;
        if (activeTab === 'pending') list = list.filter(t => t.status === 'pending');
        else if (activeTab === 'overdue') list = list.filter(t => t.status === 'overdue');
        else if (activeTab === 'paid') list = list.filter(t => t.status === 'paid');
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

        // Summary
        let totalDue = 0, totalPaid = 0, totalOwed = 0;
        tuitions.forEach(t => {
            const amt = t.amount || 0;
            totalDue += amt;
            if (t.status === 'paid') totalPaid += amt; else totalOwed += amt;
        });

        const filtered = getFiltered();

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
            // Reminder cards view
            content += `<div class="card"><div class="card-body">`;
            if (filtered.length === 0) {
                content += '<div class="empty-state"><p>Tất cả học phí đã được thu! 🎉</p></div>';
            } else {
                content += filtered.map(t => `
                    <div class="reminder-card" style="${t.reminderSent ? 'opacity:0.6;' : ''}margin-bottom:8px;">
                        <div class="reminder-info">
                            <div class="reminder-avatar">${getStudentName(t.studentId).charAt(0)}</div>
                            <div class="reminder-details">
                                <h4>${getStudentName(t.studentId)}</h4>
                                <p>${DB.formatCurrency(t.amount)} — Hạn: ${DB.formatDate(t.dueDate)} ${t.reminderSent ? '(Đã nhắc)' : ''}</p>
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;flex-shrink:0;">
                            ${!t.reminderSent ? `<button class="btn btn-secondary btn-sm" onclick="TuitionPage.markReminded('${t.id}')">📞 Đã nhắc</button>` : ''}
                            <button class="btn btn-success btn-sm" onclick="TuitionPage.markPaid('${t.id}')">✓ Đã đóng</button>
                        </div>
                    </div>
                `).join('');
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
                    <td><span class="badge badge-${t.status === 'paid' ? 'success' : t.status === 'overdue' ? 'danger' : 'warning'}">${t.status === 'paid' ? 'Đã đóng' : t.status === 'overdue' ? 'Quá hạn' : 'Chưa đóng'}</span></td>
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
            <button class="tab-item" onclick="TuitionPage.switchTab('overdue', this)">Quá hạn</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('paid', this)">Đã đóng</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('reminder', this)">📞 Nhắc học phí</button>
        </div>
        <div class="filter-bar">
            <div class="search-box"><i data-lucide="search"></i><input type="text" class="input" placeholder="Tìm theo tên..." oninput="TuitionPage.search(this.value)"></div>
        </div>
        <div id="tuition-main"></div>
    `;

    render();

    window.TuitionPage = {
        search(val) { searchTerm = val; render(); },
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
                if (t) { t.status = 'paid'; t.paidDate = DB.today(); }

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
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="TuitionPage.saveEdit('${id}')">Cập nhật</button>`
            });
        },

        async saveEdit(id) {
            try {
                const status = document.getElementById('t-status').value;
                await DB.updateTuition(id, { studentId: document.getElementById('t-student').value, studentName: getStudentName(document.getElementById('t-student').value), amount: parseInt(document.getElementById('t-amount').value) || 0, dueDate: document.getElementById('t-due').value, status, paidDate: status === 'paid' ? DB.today() : '' });
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
