// ============================================
// DASHBOARD PAGE
// ============================================

Router.register('dashboard', async (container) => {
    const user = window.currentUser;
    const role = user.role;
    const displayName = user.displayName || user.email.split('@')[0];

    // Greeting based on time
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

    if (role === 'owner') {
        await renderOwnerDashboard(container, displayName, greeting);
    } else if (role === 'teacher') {
        await renderTeacherDashboard(container, displayName, greeting);
    } else if (role === 'staff') {
        await renderStaffDashboard(container, displayName, greeting);
    }
});

async function renderOwnerDashboard(container, name, greeting) {
    let students = [], classes = [], pendingTuitions = [];
    try {
        students = await DB.getStudents();
        classes = await DB.getClasses();
        pendingTuitions = await DB.getTuitionsPending();
    } catch(e) { console.warn('Dashboard data load:', e); }

    const activeStudents = students.filter(s => s.status === 'active').length;
    const activeClasses = classes.filter(c => c.status === 'active').length;
    const totalPending = pendingTuitions.reduce((sum, t) => sum + (t.amount || 0), 0);

    container.innerHTML = `
        <div class="dashboard-welcome slide-up">
            <h2>${greeting}, ${name} 👋</h2>
            <p>Chào mừng bạn đến với hệ thống quản lý Thành Nhân Education</p>
        </div>

        <div class="stats-grid stagger">
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${activeStudents}</div>
                        <div class="stat-label">Tổng học viên</div>
                    </div>
                    <div class="stat-icon indigo"><i data-lucide="users"></i></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${activeClasses}</div>
                        <div class="stat-label">Lớp đang hoạt động</div>
                    </div>
                    <div class="stat-icon violet"><i data-lucide="school"></i></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${pendingTuitions.length}</div>
                        <div class="stat-label">Học phí chưa đóng</div>
                    </div>
                    <div class="stat-icon amber"><i data-lucide="alert-circle"></i></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${DB.formatCurrency(totalPending)}</div>
                        <div class="stat-label">Tổng nợ học phí</div>
                    </div>
                    <div class="stat-icon rose"><i data-lucide="wallet"></i></div>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header"><h3>📊 Biểu đồ tài chính ${DB.currentYear()}</h3></div>
                <div class="card-body">
                    <div class="chart-container"><canvas id="revenueChart"></canvas></div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>⚠️ Nhắc học phí</h3></div>
                <div class="card-body">
                    ${pendingTuitions.length === 0 ? '<div class="empty-state"><p>Không có học phí cần nhắc</p></div>' :
                    pendingTuitions.slice(0, 5).map(t => `
                        <div class="reminder-card">
                            <div class="reminder-info">
                                <div class="reminder-avatar">${(t.studentName || '?').charAt(0)}</div>
                                <div class="reminder-details">
                                    <h4>${t.studentName || 'Học viên'}</h4>
                                    <p>${DB.formatCurrency(t.amount)} - Hạn: ${DB.formatDate(t.dueDate)}</p>
                                </div>
                            </div>
                            <span class="badge badge-${t.status === 'overdue' ? 'danger' : 'warning'}">${t.status === 'overdue' ? 'Quá hạn' : 'Chưa đóng'}</span>
                        </div>
                    `).join('')}
                    ${pendingTuitions.length > 5 ? `<button class="btn btn-ghost btn-sm mt-4" onclick="Router.navigate('tuition')">Xem tất cả (${pendingTuitions.length})</button>` : ''}
                </div>
            </div>
        </div>
    `;

    // Render chart
    try {
        const summary = await DB.getMonthlyFinanceSummary(DB.currentYear());
        const ctx = document.getElementById('revenueChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: summary.map(s => s.monthName),
                    datasets: [
                        {
                            label: 'Doanh thu',
                            data: summary.map(s => s.revenue),
                            backgroundColor: 'rgba(34, 197, 94, 0.6)',
                            borderColor: 'rgba(34, 197, 94, 1)',
                            borderWidth: 1,
                            borderRadius: 4
                        },
                        {
                            label: 'Chi phí',
                            data: summary.map(s => s.expense),
                            backgroundColor: 'rgba(239, 68, 68, 0.6)',
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
                            borderWidth: 2,
                            pointRadius: 4,
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
                        legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    return ctx.dataset.label + ': ' + DB.formatCurrency(ctx.raw);
                                }
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: {
                            ticks: {
                                color: '#64748b',
                                callback: v => v >= 1000000 ? (v/1000000) + 'M' : v >= 1000 ? (v/1000) + 'K' : v
                            },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        }
                    }
                }
            });
        }
    } catch(e) { console.warn('Chart error:', e); }
}

async function renderTeacherDashboard(container, name, greeting) {
    let myClasses = [];
    try {
        myClasses = await DB.getClassesByTeacher(window.currentUser.id);
    } catch(e) { console.warn(e); }

    container.innerHTML = `
        <div class="dashboard-welcome slide-up">
            <h2>${greeting}, ${name} 👋</h2>
            <p>Bạn đang phụ trách ${myClasses.length} lớp học</p>
        </div>

        <div class="stats-grid stagger">
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${myClasses.length}</div>
                        <div class="stat-label">Lớp phụ trách</div>
                    </div>
                    <div class="stat-icon indigo"><i data-lucide="school"></i></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">—</div>
                        <div class="stat-label">Buổi dạy tháng này</div>
                    </div>
                    <div class="stat-icon violet"><i data-lucide="calendar-check"></i></div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><h3>📚 Lớp học của bạn</h3></div>
            <div class="card-body">
                ${myClasses.length === 0 ? '<div class="empty-state"><p>Bạn chưa được phân công lớp nào</p></div>' :
                `<div class="table-container"><table>
                    <thead><tr><th>Tên lớp</th><th>Môn</th><th>Phòng</th><th>Trạng thái</th><th></th></tr></thead>
                    <tbody>
                        ${myClasses.map(c => `<tr>
                            <td><strong>${c.name}</strong></td>
                            <td>${c.subject || ''}</td>
                            <td>${c.room || ''}</td>
                            <td><span class="badge badge-${c.status === 'active' ? 'success' : 'neutral'}">${c.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'}</span></td>
                            <td><button class="btn btn-ghost btn-sm" onclick="Router.navigate('attendance')">Điểm danh</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table></div>`}
            </div>
        </div>
    `;
}

async function renderStaffDashboard(container, name, greeting) {
    let students = [], pendingTuitions = [];
    try {
        students = await DB.getStudents();
        pendingTuitions = await DB.getTuitionsPending();
    } catch(e) { console.warn(e); }

    const totalOwed = pendingTuitions.reduce((s, t) => s + (t.amount || 0), 0);

    container.innerHTML = `
        <div class="dashboard-welcome slide-up">
            <h2>${greeting}, ${name} 👋</h2>
            <p>Phòng học vụ - Thành Nhân Education</p>
        </div>

        <div class="stats-grid stagger">
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${students.filter(s => s.status === 'active').length}</div>
                        <div class="stat-label">Tổng học viên</div>
                    </div>
                    <div class="stat-icon indigo"><i data-lucide="users"></i></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${pendingTuitions.length}</div>
                        <div class="stat-label">Học phí cần thu</div>
                    </div>
                    <div class="stat-icon amber"><i data-lucide="alert-circle"></i></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-top">
                    <div>
                        <div class="stat-value">${DB.formatCurrency(totalOwed)}</div>
                        <div class="stat-label">Tổng còn nợ</div>
                    </div>
                    <div class="stat-icon rose"><i data-lucide="wallet"></i></div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>⚠️ Cần nhắc học phí</h3>
                <button class="btn btn-primary btn-sm" onclick="Router.navigate('tuition')">Quản lý học phí</button>
            </div>
            <div class="card-body">
                ${pendingTuitions.length === 0 ? '<div class="empty-state"><p>Tất cả học phí đã được thu</p></div>' :
                pendingTuitions.slice(0, 8).map(t => `
                    <div class="reminder-card">
                        <div class="reminder-info">
                            <div class="reminder-avatar">${(t.studentName || '?').charAt(0)}</div>
                            <div class="reminder-details">
                                <h4>${t.studentName || 'Học viên'}</h4>
                                <p>${DB.formatCurrency(t.amount)} - Hạn: ${DB.formatDate(t.dueDate)}</p>
                            </div>
                        </div>
                        <span class="badge badge-${t.status === 'overdue' ? 'danger' : 'warning'}">${t.status === 'overdue' ? 'Quá hạn' : 'Chưa đóng'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
