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
        area.innerHTML = `<div class="card"><div class="table-container"><table>
            <thead><tr><th>Tên bài KT</th><th>Ngày</th><th>Điểm tối đa</th><th>Đã chấm</th><th>Thao tác</th></tr></thead>
            <tbody>${grades.map(g => {
                const scored = g.scores ? Object.keys(g.scores).length : 0;
                return `<tr>
                    <td><strong>${g.examName || ''}</strong></td>
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
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title"><i data-lucide="bar-chart-3"></i> Quản lý Điểm số</h1></div>
            <div class="page-actions">
                ${canEdit ? `<button class="btn btn-primary" onclick="GradesPage.showAddExam()"><i data-lucide="plus"></i> Thêm bài kiểm tra</button>` : ''}
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
                title: 'Thêm bài kiểm tra',
                content: `
                    <div class="form-group"><label class="form-label">Tên bài kiểm tra *</label><input type="text" class="input" id="g-exam" placeholder="VD: Kiểm tra giữa kỳ"></div>
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
