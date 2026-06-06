// ============================================
// TUITION PAGE
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

    function getStudentName(id) {
        const s = students.find(st => st.id === id);
        return s ? s.name : '—';
    }

    function getClassName(id) {
        const c = classes.find(cl => cl.id === id);
        return c ? c.name : '—';
    }

    function getFiltered() {
        let list = tuitions;
        if (activeTab === 'pending') list = list.filter(t => t.status === 'pending');
        else if (activeTab === 'overdue') list = list.filter(t => t.status === 'overdue');
        else if (activeTab === 'paid') list = list.filter(t => t.status === 'paid');
        else if (activeTab === 'reminder') list = list.filter(t => t.status !== 'paid');

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(t => {
                const name = getStudentName(t.studentId).toLowerCase();
                return name.includes(q);
            });
        }
        return list;
    }

    function getSummary() {
        let totalDue = 0, totalPaid = 0, totalOwed = 0;
        tuitions.forEach(t => {
            const amt = t.amount || 0;
            totalDue += amt;
            if (t.status === 'paid') totalPaid += amt;
            else totalOwed += amt;
        });
        return { totalDue, totalPaid, totalOwed };
    }

    function renderTable() {
        const tbody = document.getElementById('tuition-tbody');
        const summary = getSummary();
        if (!tbody) return;

        // Update summary
        const sumEl = document.getElementById('tuition-summary');
        if (sumEl) {
            sumEl.innerHTML = `
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--info-400);">${DB.formatCurrency(summary.totalDue)}</div>
                    <div class="stat-label">Tổng cần thu</div>
                </div>
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--success-400);">${DB.formatCurrency(summary.totalPaid)}</div>
                    <div class="stat-label">Đã thu</div>
                </div>
                <div class="stat-card" style="padding:var(--space-4);">
                    <div class="stat-value" style="font-size:var(--font-size-xl);color:var(--danger-400);">${DB.formatCurrency(summary.totalOwed)}</div>
                    <div class="stat-label">Còn nợ</div>
                </div>
            `;
        }

        const filtered = getFiltered();

        if (activeTab === 'reminder') {
            renderReminders(tbody, filtered);
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Không có dữ liệu</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(t => `<tr>
            <td><strong>${getStudentName(t.studentId)}</strong></td>
            <td>${getClassName(t.classId)}</td>
            <td>${DB.formatCurrency(t.amount || 0)}</td>
            <td>${DB.formatDate(t.dueDate)}</td>
            <td>${t.paidDate ? DB.formatDate(t.paidDate) : '—'}</td>
            <td><span class="badge badge-${t.status === 'paid' ? 'success' : t.status === 'overdue' ? 'danger' : 'warning'}">${t.status === 'paid' ? 'Đã đóng' : t.status === 'overdue' ? 'Quá hạn' : 'Chưa đóng'}</span></td>
            <td>
                <div class="table-actions">
                    ${t.status !== 'paid' ? `<button class="btn btn-success btn-sm" onclick="TuitionPage.markPaid('${t.id}')">Đã đóng</button>` : ''}
                    <button class="btn-icon" title="Sửa" onclick="TuitionPage.edit('${t.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-icon" title="Xóa" onclick="TuitionPage.remove('${t.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>`).join('');
        if (window.lucide) lucide.createIcons();
    }

    function renderReminders(tbody, filtered) {
        const reminderContainer = document.getElementById('tuition-tbody').parentElement.parentElement;
        if (!reminderContainer) return;

        const parentCard = reminderContainer.closest('.card');
        if (!parentCard) return;

        // Replace table with reminder cards
        const body = parentCard.querySelector('.card-body') || parentCard;
        const tableContainer = parentCard.querySelector('.table-container');
        if (tableContainer) {
            if (filtered.length === 0) {
                tableContainer.innerHTML = '<div class="empty-state"><p>Tất cả học phí đã được thu! 🎉</p></div>';
                return;
            }

            tableContainer.innerHTML = `<div style="padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-3);">
                ${filtered.map(t => {
                    const reminded = t.reminderSent;
                    return `
                        <div class="reminder-card" style="${reminded ? 'opacity:0.6;' : ''}">
                            <div class="reminder-info">
                                <div class="reminder-avatar">${getStudentName(t.studentId).charAt(0)}</div>
                                <div class="reminder-details">
                                    <h4>${getStudentName(t.studentId)}</h4>
                                    <p>${DB.formatCurrency(t.amount || 0)} — Hạn: ${DB.formatDate(t.dueDate)} ${reminded ? '(Đã nhắc)' : ''}</p>
                                </div>
                            </div>
                            <div style="display:flex;gap:8px;">
                                ${!reminded ? `<button class="btn btn-secondary btn-sm" onclick="TuitionPage.markReminded('${t.id}')">📞 Đã nhắc</button>` : ''}
                                <button class="btn btn-success btn-sm" onclick="TuitionPage.markPaid('${t.id}')">✓ Đã đóng</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>`;
        }
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="wallet"></i> Quản lý Học phí</h1>
            </div>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="TuitionPage.showAdd()"><i data-lucide="plus"></i> Thêm khoản thu</button>
            </div>
        </div>

        <div class="stats-grid" id="tuition-summary"></div>

        <div class="tabs">
            <button class="tab-item active" onclick="TuitionPage.switchTab('all', this)">Tất cả</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('pending', this)">Chưa đóng</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('overdue', this)">Quá hạn</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('paid', this)">Đã đóng</button>
            <button class="tab-item" onclick="TuitionPage.switchTab('reminder', this)">📞 Nhắc học phí</button>
        </div>

        <div class="filter-bar">
            <div class="search-box">
                <i data-lucide="search"></i>
                <input type="text" class="input" placeholder="Tìm theo tên học viên..." oninput="TuitionPage.search(this.value)">
            </div>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Học viên</th><th>Lớp</th><th>Số tiền</th><th>Hạn đóng</th><th>Ngày đóng</th><th>Trạng thái</th><th>Thao tác</th></tr>
                    </thead>
                    <tbody id="tuition-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    renderTable();

    window.TuitionPage = {
        search(val) { searchTerm = val; renderTable(); },

        switchTab(tab, el) {
            activeTab = tab;
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            renderTable();
        },

        showAdd() {
            Modal.show({
                title: 'Thêm khoản thu học phí',
                content: `
                    <div class="form-group">
                        <label class="form-label">Học viên *</label>
                        <select class="select" id="t-student">
                            <option value="">Chọn học viên</option>
                            ${students.filter(s => s.status === 'active').map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lớp</label>
                        <select class="select" id="t-class">
                            <option value="">Chọn lớp</option>
                            ${classes.map(c => `<option value="${c.id}">${c.name} ${c.fee ? '(' + DB.formatCurrency(c.fee) + ')' : ''}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Số tiền (VNĐ) *</label>
                            <input type="number" class="input" id="t-amount" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hạn đóng *</label>
                            <input type="date" class="input" id="t-due">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <input type="text" class="input" id="t-note" placeholder="VD: Học phí tháng 6">
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="TuitionPage.saveNew()">Lưu</button>
                `
            });

            // Auto-fill fee when class selected
            document.getElementById('t-class').addEventListener('change', function() {
                const cls = classes.find(c => c.id === this.value);
                if (cls && cls.fee) {
                    document.getElementById('t-amount').value = cls.fee;
                }
            });
        },

        async saveNew() {
            const studentId = document.getElementById('t-student').value;
            const amount = parseInt(document.getElementById('t-amount').value);
            const dueDate = document.getElementById('t-due').value;

            if (!studentId || !amount || !dueDate) {
                Toast.warning('Thiếu thông tin', 'Vui lòng điền đầy đủ');
                return;
            }

            try {
                await DB.addTuition({
                    studentId,
                    studentName: getStudentName(studentId),
                    classId: document.getElementById('t-class').value || '',
                    amount,
                    dueDate,
                    paidDate: '',
                    status: new Date(dueDate) < new Date() ? 'overdue' : 'pending',
                    reminderSent: false,
                    note: document.getElementById('t-note').value || ''
                });
                Modal.close();
                Toast.success('Thành công', 'Đã thêm khoản thu');
                tuitions = await DB.getTuitions();
                renderTable();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        async markPaid(id) {
            try {
                await DB.updateTuition(id, {
                    status: 'paid',
                    paidDate: DB.today()
                });
                Toast.success('Đã cập nhật', 'Đã xác nhận thanh toán');
                tuitions = await DB.getTuitions();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async markReminded(id) {
            try {
                await DB.updateTuition(id, { reminderSent: true });
                Toast.info('Đã ghi nhận', 'Đã đánh dấu nhắc nhở');
                tuitions = await DB.getTuitions();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async edit(id) {
            const t = tuitions.find(tu => tu.id === id);
            if (!t) return;

            Modal.show({
                title: 'Sửa khoản thu',
                content: `
                    <div class="form-group">
                        <label class="form-label">Học viên</label>
                        <select class="select" id="t-student">
                            ${students.map(s => `<option value="${s.id}" ${s.id === t.studentId ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Số tiền</label>
                            <input type="number" class="input" id="t-amount" value="${t.amount || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hạn đóng</label>
                            <input type="date" class="input" id="t-due" value="${t.dueDate || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Trạng thái</label>
                        <select class="select" id="t-status">
                            <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>Chưa đóng</option>
                            <option value="overdue" ${t.status === 'overdue' ? 'selected' : ''}>Quá hạn</option>
                            <option value="paid" ${t.status === 'paid' ? 'selected' : ''}>Đã đóng</option>
                        </select>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="TuitionPage.saveEdit('${id}')">Cập nhật</button>
                `
            });
        },

        async saveEdit(id) {
            const studentId = document.getElementById('t-student').value;
            try {
                await DB.updateTuition(id, {
                    studentId,
                    studentName: getStudentName(studentId),
                    amount: parseInt(document.getElementById('t-amount').value) || 0,
                    dueDate: document.getElementById('t-due').value || '',
                    status: document.getElementById('t-status').value,
                    paidDate: document.getElementById('t-status').value === 'paid' ? DB.today() : ''
                });
                Modal.close();
                Toast.success('Đã cập nhật');
                tuitions = await DB.getTuitions();
                renderTable();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        remove(id) {
            Modal.confirm({ title: 'Xóa khoản thu', message: 'Bạn có chắc muốn xóa khoản thu này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                await DB.deleteTuition(id);
                Toast.success('Đã xóa');
                tuitions = await DB.getTuitions();
                renderTable();
            });
        }
    };
});
