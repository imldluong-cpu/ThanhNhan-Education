// ============================================
// GRADES PAGE - With Comments
// ============================================

Router.register('grades', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'teacher');
    let classes = [], grades = [], students = [];
    try {
        classes = Auth.isTeacher() ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
    } catch(e) { console.warn(e); }

    let selectedClassId = '';

    async function loadGrades() {
        if (!selectedClassId) { grades = []; students = []; return; }
        try {
            grades = await DB.getGrades(selectedClassId);
            students = await DB.getStudentsByClass(selectedClassId);
        } catch(e) { console.warn(e); }
    }

    function render() {
        const area = document.getElementById('grades-area');
        if (!area) return;
        if (!selectedClassId) {
            area.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><p>Vui lòng chọn lớp để xem điểm số</p></div></div></div>';
            return;
        }
        if (grades.length === 0) {
            area.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><h3>Chưa có bài kiểm tra</h3><p>Nhấn "Thêm bài kiểm tra" để bắt đầu</p></div></div></div>';
            return;
        }
        function renderDashboard() {
            if (!selectedClassId || grades.length === 0) return '';
            const majorExams = grades.filter(g => ['GK1','CK1','GK2','CK2'].some(k => g.examName.includes(k)));
            if (majorExams.length === 0) return '';

            let count8OrAbove = 0, countBelow8 = 0;
            // Dãy điểm 1-10 để đếm số lượng học sinh đạt mỗi mức điểm
            const scoreDist = { '0-4':0, '4.5-6':0, '6.5-7.5':0, '8-10':0 };
            
            let totalScores = 0;
            majorExams.forEach(g => {
                const max = parseFloat(g.maxScore) || 10;
                Object.values(g.scores || {}).forEach(score => {
                    const normalized = (parseFloat(score) / max) * 10; // Đưa về hệ 10
                    if (isNaN(normalized)) return;
                    totalScores++;
                    if (normalized >= 8) count8OrAbove++; else countBelow8++;
                    
                    if (normalized < 4.5) scoreDist['0-4']++;
                    else if (normalized < 6.5) scoreDist['4.5-6']++;
                    else if (normalized < 8) scoreDist['6.5-7.5']++;
                    else scoreDist['8-10']++;
                });
            });

            if (totalScores === 0) return '';
            const pct8 = Math.round((count8OrAbove / totalScores) * 100);

            return `
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>📊 Thống kê chất lượng lớp (Dựa trên ${majorExams.length} kỳ thi chính)</h3>
                    </div>
                    <div class="card-body" style="display:flex;gap:32px;align-items:center;flex-wrap:wrap;">
                        <div style="flex:1;min-width:200px;">
                            <div style="font-size:3rem;font-weight:700;color:${pct8 >= 80 ? 'var(--success-500)' : pct8 >= 50 ? 'var(--warning-500)' : 'var(--danger-500)'};">${pct8}%</div>
                            <div style="color:var(--text-secondary);">Tỉ lệ đạt >= 8 điểm (Ngưỡng lý tưởng)</div>
                            <div style="margin-top:16px;">
                                <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:var(--success-500);">>= 8 điểm</span><strong>${count8OrAbove} lượt</strong></div>
                                <div style="display:flex;justify-content:space-between;"><span style="color:var(--danger-500);">< 8 điểm</span><strong>${countBelow8} lượt</strong></div>
                            </div>
                        </div>
                        <div style="width:250px;height:250px;position:relative;">
                            <canvas id="gradePieChart"></canvas>
                        </div>
                    </div>
                </div>
            `;
        }

        // Render function...
        area.innerHTML = renderDashboard() + `<div class="card"><div class="table-container"><table>
            <thead><tr><th>Tên kỳ kiểm tra</th><th>Ngày</th><th>Điểm tối đa</th><th>Đã chấm</th><th>Thao tác</th></tr></thead>
            <tbody>${grades.map(g => {
                const scored = g.scores ? Object.keys(g.scores).length : 0;
                const isTN = g.examName.includes('Tại TN') || g.examName.includes('Làm bài tại TN');
                const badgeClass = isTN ? 'badge-neutral' : 'badge-primary';
                
                return `<tr>
                    <td><span class="badge ${badgeClass}" style="font-size:14px;padding:4px 8px;">${g.examName || ''}</span></td>
                    <td>${DB.formatDate(g.date)}</td>
                    <td>${g.maxScore || 10}</td>
                    <td>${scored}/${students.length}</td>
                    <td><div class="table-actions">
                        <button class="btn btn-primary btn-sm" onclick="GradesPage.enterScores('${g.id}')"><i data-lucide="edit-3"></i> Nhập điểm</button>
                        ${canEdit ? `<button class="btn-icon" onclick="GradesPage.removeExam('${g.id}')"><i data-lucide="trash-2"></i></button>` : ''}
                    </div></td>
                </tr>`;
            }).join('')}</tbody>
        </table></div></div>`;
        if (window.lucide) lucide.createIcons();

        // Vẽ biểu đồ nếu có
        setTimeout(() => {
            const ctx = document.getElementById('gradePieChart');
            if (ctx && window.Chart) {
                // Get data from function scope by re-calculating or passing.
                // Trích xuất lại dist vì scope, cách nhanh nhất là tính lại ở đây.
                const majorExams = grades.filter(g => ['GK1','CK1','GK2','CK2'].some(k => g.examName.includes(k)));
                const scoreDist = { '0-4':0, '4.5-6':0, '6.5-7.5':0, '8-10':0 };
                majorExams.forEach(g => {
                    const max = parseFloat(g.maxScore) || 10;
                    Object.values(g.scores || {}).forEach(score => {
                        const normalized = (parseFloat(score) / max) * 10;
                        if (isNaN(normalized)) return;
                        if (normalized < 4.5) scoreDist['0-4']++;
                        else if (normalized < 6.5) scoreDist['4.5-6']++;
                        else if (normalized < 8) scoreDist['6.5-7.5']++;
                        else scoreDist['8-10']++;
                    });
                });
                
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['0-4 điểm', '4.5-6 điểm', '6.5-7.5 điểm', '8-10 điểm'],
                        datasets: [{
                            data: [scoreDist['0-4'], scoreDist['4.5-6'], scoreDist['6.5-7.5'], scoreDist['8-10']],
                            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'],
                            borderWidth: 0
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#cbd5e1' } } } }
                });
            }
        }, 100);
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="bar-chart-3"></i> Quản lý Điểm số</h1></div>
            <div class="page-actions">
                ${canEdit ? `<button class="btn btn-primary" onclick="GradesPage.showAddExam()"><i data-lucide="plus"></i> Thêm điểm kiểm tra</button>` : ''}
            </div>
        </div>
        <div class="filter-bar">
            <select class="select" style="max-width:250px;" onchange="GradesPage.selectClass(this.value)">
                <option value="">Chọn lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
        </div>
        <div id="grades-area"></div>
    `;
    render();

    window.GradesPage = {
        async selectClass(id) {
            selectedClassId = id;
            await loadGrades();
            render();
        },

        showAddExam() {
            if (!selectedClassId) { Toast.warning('Vui lòng chọn lớp trước'); return; }
            Modal.show({
                title: 'Thêm điểm kiểm tra',
                content: `
                    <div class="form-group">
                        <label class="form-label">Tên kỳ kiểm tra *</label>
                        <select class="select" id="g-exam">
                            <option value="Làm bài tại TN">Làm bài tại TN</option>
                            <option value="GK1">GK1 (Giữa kỳ 1)</option>
                            <option value="CK1">CK1 (Cuối kỳ 1)</option>
                            <option value="GK2">GK2 (Giữa kỳ 2)</option>
                            <option value="CK2">CK2 (Cuối kỳ 2)</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Ngày</label><input type="date" class="input" id="g-date" value="${DB.today()}"></div>
                        <div class="form-group"><label class="form-label">Điểm tối đa</label><input type="number" class="input" id="g-max" value="10"></div>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="GradesPage.saveExam()">Lưu</button>`
            });
        },

        async saveExam() {
            const examName = document.getElementById('g-exam').value.trim();
            if (!examName) { Toast.warning('Nhập tên bài kiểm tra'); return; }
            try {
                await DB.addGrade({ classId: selectedClassId, examName, date: document.getElementById('g-date').value || DB.today(), maxScore: parseInt(document.getElementById('g-max').value) || 10, scores: {}, comments: {} });
                Modal.close();
                Toast.success('Đã thêm bài KT');
                await loadGrades();
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        enterScores(gradeId) {
            const grade = grades.find(g => g.id === gradeId);
            if (!grade) return;
            const scores = grade.scores || {};
            const comments = grade.comments || {};
            const maxScore = grade.maxScore || 10;

            Modal.show({
                title: `Nhập điểm: ${grade.examName}`,
                size: 'lg',
                content: `
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Điểm tối đa: <strong>${maxScore}</strong>. Bắt buộc nhận xét nếu có nhập điểm.</p>
                    <div class="table-container" style="max-height:50vh;overflow-y:auto;">
                        <table>
                            <thead><tr><th>Họ tên</th><th style="width:90px;">Điểm</th><th>Nhận xét</th></tr></thead>
                            <tbody>${students.map((s) => {
                                const score = scores[s.id] !== undefined ? scores[s.id] : '';
                                const comment = comments[s.id] || '';
                                const colorClass = score !== '' ? (score >= maxScore * 0.8 ? 'grade-high' : score >= maxScore * 0.5 ? 'grade-mid' : 'grade-low') : '';
                                return `<tr>
                                    <td>${s.name}</td>
                                    <td><input type="number" class="input grade-input ${colorClass}" data-sid="${s.id}" data-type="score" value="${score}" min="0" max="${maxScore}" step="0.5" oninput="GradesPage.colorScore(this, ${maxScore})"></td>
                                    <td><input type="text" class="input" data-sid="${s.id}" data-type="comment" value="${comment}" placeholder="Nhận xét (Bắt buộc)"></td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>
                `,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Hủy</button><button class="btn btn-primary" onclick="GradesPage.saveScores('${gradeId}')">💾 Lưu điểm</button>`
            });
        },

        colorScore(input, maxScore) {
            const val = parseFloat(input.value);
            input.classList.remove('grade-high', 'grade-mid', 'grade-low');
            if (isNaN(val)) return;
            if (val >= maxScore * 0.8) input.classList.add('grade-high');
            else if (val >= maxScore * 0.5) input.classList.add('grade-mid');
            else input.classList.add('grade-low');
        },

        async saveScores(gradeId) {
            const scoreInputs = document.querySelectorAll('.grade-input[data-type="score"]');
            const scores = {};
            const comments = {};
            let hasError = false;

            scoreInputs.forEach(inp => {
                const sid = inp.dataset.sid;
                const scoreVal = inp.value.trim();
                const commentInput = document.querySelector(`input[data-type="comment"][data-sid="${sid}"]`);
                const commentVal = commentInput ? commentInput.value.trim() : '';

                if (scoreVal !== '') {
                    if (commentVal === '') {
                        commentInput.style.borderColor = 'var(--danger-500)';
                        hasError = true;
                    } else {
                        if(commentInput) commentInput.style.borderColor = '';
                        scores[sid] = parseFloat(scoreVal);
                        comments[sid] = commentVal;
                    }
                } else {
                    if(commentInput) commentInput.style.borderColor = '';
                }
            });

            if (hasError) {
                Toast.error('Lỗi nhập liệu', 'Vui lòng điền nhận xét cho những học viên có điểm.');
                return;
            }

            try {
                await DB.updateGrade(gradeId, { scores, comments });
                Modal.close();
                Toast.success('Đã lưu điểm');
                await loadGrades();
                render();
            } catch(e) { Toast.error('Lỗi', e.message); }
        },

        removeExam(id) {
            Modal.confirm({ title: 'Xóa bài KT', message: 'Xóa bài kiểm tra và tất cả điểm?', confirmText: 'Xóa', danger: true });
            Modal.bindConfirm(async () => { await DB.deleteGrade(id); Toast.success('Đã xóa'); await loadGrades(); render(); });
        }
    };
});
