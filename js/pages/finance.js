// ============================================
// FINANCE PAGE (Owner only)
// ============================================

Router.register('finance', async (container) => {
    if (!Auth.isOwner()) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="lock"></i><h3>Không có quyền truy cập</h3><p>Chỉ Chủ trung tâm mới có quyền xem trang Tài chính</p></div>';
        if (window.lucide) lucide.createIcons();
        return;
    }

    let selectedMonth = DB.currentMonth();
    let records = [];

    try {
        records = await DB.getFinanceRecords(selectedMonth);
    } catch(e) { console.warn(e); }

    function getSummary() {
        let revenue = 0, expense = 0;
        records.forEach(r => {
            if (r.type === 'revenue') revenue += (r.amount || 0);
            else if (r.type === 'expense') expense += (r.amount || 0);
        });
        return { revenue, expense, profit: revenue - expense };
    }

    function getCategoryBadge(cat) {
        const colors = {
            'Học phí': 'success', 'Lương GV': 'info', 'Điện nước': 'warning',
            'Thuê mặt bằng': 'danger', 'Vật tư': 'neutral', 'Khác': 'primary'
        };
        return colors[cat] || 'neutral';
    }

    function renderContent() {
        const content = document.getElementById('finance-content');
        if (!content) return;

        const summary = getSummary();
        const monthLabel = `tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`;

        content.innerHTML = `
            <div class="finance-summary stagger">
                <div class="finance-summary-item revenue">
                    <div class="amount">${DB.formatCurrency(summary.revenue)}</div>
                    <div class="label">Doanh thu ${monthLabel}</div>
                </div>
                <div class="finance-summary-item expense">
                    <div class="amount">${DB.formatCurrency(summary.expense)}</div>
                    <div class="label">Chi phí ${monthLabel}</div>
                </div>
                <div class="finance-summary-item profit">
                    <div class="amount">${DB.formatCurrency(summary.profit)}</div>
                    <div class="label">Lợi nhuận ${monthLabel}</div>
                </div>
            </div>

            <div class="card mb-8">
                <div class="card-header"><h3>📊 Biểu đồ tài chính năm ${DB.currentYear()}</h3></div>
                <div class="card-body">
                    <div class="chart-container"><canvas id="financeChart"></canvas></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Chi tiết thu/chi ${monthLabel}</h3>
                    <span class="badge badge-neutral">${records.length} bản ghi</span>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Mô tả</th><th style="text-align:right;">Số tiền</th><th>Thao tác</th></tr>
                        </thead>
                        <tbody>
                            ${records.length === 0 ? '<tr><td colspan="6"><div class="empty-state"><p>Chưa có dữ liệu tháng này</p></div></td></tr>' :
                            records.map(r => `<tr style="background:${r.type === 'revenue' ? 'rgba(34,197,94,0.03)' : 'rgba(239,68,68,0.03)'};">
                                <td>${DB.formatDate(r.date)}</td>
                                <td><span class="badge badge-${r.type === 'revenue' ? 'success' : 'danger'}">${r.type === 'revenue' ? 'Thu' : 'Chi'}</span></td>
                                <td><span class="badge badge-${getCategoryBadge(r.category)}">${r.category || '—'}</span></td>
                                <td>${r.description || ''}</td>
                                <td style="text-align:right;font-weight:700;color:${r.type === 'revenue' ? 'var(--success-400)' : 'var(--danger-400)'};">
                                    ${r.type === 'revenue' ? '+' : '-'}${DB.formatCurrency(r.amount || 0)}
                                </td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn-icon" title="Sửa" onclick="FinancePage.edit('${r.id}')"><i data-lucide="pencil"></i></button>
                                        <button class="btn-icon" title="Xóa" onclick="FinancePage.remove('${r.id}')"><i data-lucide="trash-2"></i></button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();

        // Render chart
        renderChart();
    }

    async function renderChart() {
        try {
            const summary = await DB.getMonthlyFinanceSummary(DB.currentYear());
            const ctx = document.getElementById('financeChart');
            if (!ctx) return;

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: summary.map(s => s.monthName),
                    datasets: [
                        {
                            label: 'Doanh thu',
                            data: summary.map(s => s.revenue),
                            backgroundColor: 'rgba(34, 197, 94, 0.7)',
                            borderColor: 'rgba(34, 197, 94, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        },
                        {
                            label: 'Chi phí',
                            data: summary.map(s => s.expense),
                            backgroundColor: 'rgba(239, 68, 68, 0.7)',
                            borderColor: 'rgba(239, 68, 68, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        },
                        {
                            label: 'Lợi nhuận',
                            data: summary.map(s => s.profit),
                            type: 'line',
                            borderColor: 'rgba(99, 102, 241, 1)',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            borderWidth: 3,
                            pointRadius: 5,
                            pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                            fill: true,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ctx.dataset.label + ': ' + DB.formatCurrency(ctx.raw)
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: {
                            ticks: {
                                color: '#64748b',
                                callback: v => {
                                    if (Math.abs(v) >= 1000000) return (v/1000000).toFixed(1) + 'M';
                                    if (Math.abs(v) >= 1000) return (v/1000).toFixed(0) + 'K';
                                    return v;
                                }
                            },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        }
                    }
                }
            });
        } catch(e) { console.warn('Chart error:', e); }
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="trending-up"></i> Quản lý Tài chính</h1>
                <p class="page-subtitle">Doanh thu, chi phí & lợi nhuận</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="FinancePage.showAdd()"><i data-lucide="plus"></i> Thêm thu/chi</button>
            </div>
        </div>

        <div class="filter-bar">
            <input type="month" class="input" id="finance-month" value="${selectedMonth}" style="max-width:200px;" onchange="FinancePage.changeMonth(this.value)">
        </div>

        <div id="finance-content"></div>
    `;

    renderContent();

    window.FinancePage = {
        async changeMonth(val) {
            selectedMonth = val;
            try { records = await DB.getFinanceRecords(selectedMonth); } catch(e) { console.warn(e); }
            renderContent();
        },

        showAdd() {
            Modal.show({
                title: 'Thêm khoản thu/chi',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Loại *</label>
                            <select class="select" id="f-type">
                                <option value="revenue">Thu (Doanh thu)</option>
                                <option value="expense">Chi (Chi phí)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Danh mục</label>
                            <select class="select" id="f-category">
                                <option value="Học phí">Học phí</option>
                                <option value="Lương GV">Lương GV</option>
                                <option value="Điện nước">Điện nước</option>
                                <option value="Thuê mặt bằng">Thuê mặt bằng</option>
                                <option value="Vật tư">Vật tư</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mô tả</label>
                        <input type="text" class="input" id="f-desc" placeholder="VD: Thu học phí tháng 6 lớp Toán 12">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Số tiền (VNĐ) *</label>
                            <input type="number" class="input" id="f-amount" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày *</label>
                            <input type="date" class="input" id="f-date" value="${DB.today()}">
                        </div>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="FinancePage.saveNew()">Lưu</button>
                `
            });
        },

        async saveNew() {
            const amount = parseInt(document.getElementById('f-amount').value);
            const date = document.getElementById('f-date').value;
            if (!amount || !date) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập số tiền và ngày'); return; }

            try {
                await DB.addFinanceRecord({
                    type: document.getElementById('f-type').value,
                    category: document.getElementById('f-category').value,
                    description: document.getElementById('f-desc').value || '',
                    amount,
                    date,
                    createdBy: window.currentUser.id
                });
                Modal.close();
                Toast.success('Thành công', 'Đã thêm bản ghi');
                records = await DB.getFinanceRecords(selectedMonth);
                renderContent();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        async edit(id) {
            const r = records.find(rec => rec.id === id);
            if (!r) return;

            Modal.show({
                title: 'Sửa khoản thu/chi',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Loại</label>
                            <select class="select" id="f-type">
                                <option value="revenue" ${r.type === 'revenue' ? 'selected' : ''}>Thu</option>
                                <option value="expense" ${r.type === 'expense' ? 'selected' : ''}>Chi</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Danh mục</label>
                            <select class="select" id="f-category">
                                ${['Học phí','Lương GV','Điện nước','Thuê mặt bằng','Vật tư','Khác'].map(c =>
                                    `<option value="${c}" ${r.category === c ? 'selected' : ''}>${c}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mô tả</label>
                        <input type="text" class="input" id="f-desc" value="${r.description || ''}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Số tiền</label>
                            <input type="number" class="input" id="f-amount" value="${r.amount || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày</label>
                            <input type="date" class="input" id="f-date" value="${r.date || ''}">
                        </div>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="FinancePage.saveEdit('${id}')">Cập nhật</button>
                `
            });
        },

        async saveEdit(id) {
            try {
                await DB.updateFinanceRecord(id, {
                    type: document.getElementById('f-type').value,
                    category: document.getElementById('f-category').value,
                    description: document.getElementById('f-desc').value || '',
                    amount: parseInt(document.getElementById('f-amount').value) || 0,
                    date: document.getElementById('f-date').value
                });
                Modal.close();
                Toast.success('Đã cập nhật');
                records = await DB.getFinanceRecords(selectedMonth);
                renderContent();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        remove(id) {
            Modal.confirm({ title: 'Xóa bản ghi', message: 'Xóa bản ghi thu/chi này?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => {
                await DB.deleteFinanceRecord(id);
                Toast.success('Đã xóa');
                records = await DB.getFinanceRecords(selectedMonth);
                renderContent();
            });
        }
    };
});
