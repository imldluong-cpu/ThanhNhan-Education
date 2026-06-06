// ============================================
// GRADES PAGE
// ============================================

Router.register('grades', async (container) => {
    const isTeacher = Auth.isTeacher();
    let classes = [];

    try {
        classes = isTeacher ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
    } catch(e) { console.warn(e); }

    let selectedClass = '';
    let grades = [];
    let students = [];

    async function loadGrades() {
        if (!selectedClass) return;
        try {
            grades = await DB.getGrades(selectedClass);
            students = await DB.getStudentsByClass(selectedClass);
        } catch(e) { console.warn(e); }
        renderContent();
    }

    function getExamList() {
        const exams = {};
        grades.forEach(g => {
            const key = g.examName + '|' + g.date;
            if (!exams[key]) {
                exams[key] = { examName: g.examName, date: g.date, maxScore: g.maxScore || 10, scores: {} };
            }
            exams[key].scores[g.studentId] = { score: g.score, id: g.id };
        });
        return Object.values(exams).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    function gradeClass(score, max) {
        const pct = (score / max) * 10;
        if (pct >= 8) return 'grade-high';
        if (pct >= 5) return 'grade-mid';
        return 'grade-low';
    }

    function renderContent() {
        const content = document.getElementById('grades-content');
        if (!content) return;

        if (!selectedClass) {
            content.innerHTML = '<div class="empty-state"><i data-lucide="file-text"></i><h3>Chọn lớp để xem điểm</h3></div>';
            if (window.lucide) lucide.createIcons();
            return;
        }

        const exams = getExamList();

        if (exams.length === 0) {
            content.innerHTML = `<div class="empty-state"><i data-lucide="file-text"></i><h3>Chưa có bài kiểm tra</h3><p>Nhấn "Thêm bài kiểm tra" để bắt đầu</p></div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Build grade table with exams as columns
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3>Bảng điểm tổng hợp</h3>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Học viên</th>
                                ${exams.map(e => `<th style="text-align:center;">${e.examName}<br><span class="text-xs text-muted">${DB.formatDate(e.date)}</span></th>`).join('')}
                                <th style="text-align:center;">TB</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((s, i) => {
                                let total = 0, count = 0;
                                const cells = exams.map(e => {
                                    const sc = e.scores[s.id];
                                    if (sc) { total += sc.score; count++; }
                                    return `<td style="text-align:center;">
                                        ${sc ? `<span class="font-bold ${gradeClass(sc.score, e.maxScore)}">${sc.score}</span>` : '—'}
                                    </td>`;
                                }).join('');
                                const avg = count > 0 ? (total / count).toFixed(1) : '—';
                                const avgClass = count > 0 ? gradeClass(total / count, 10) : '';
                                return `<tr>
                                    <td>${i + 1}</td>
                                    <td><strong>${s.name}</strong></td>
                                    ${cells}
                                    <td style="text-align:center;"><strong class="${avgClass}">${avg}</strong></td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card mt-6">
                <div class="card-header"><h3>Danh sách bài kiểm tra</h3></div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Tên bài KT</th><th>Ngày</th><th>Điểm tối đa</th><th>Đã chấm</th><th>Thao tác</th></tr></thead>
                        <tbody>
                            ${exams.map(e => {
                                const scoredCount = Object.keys(e.scores).length;
                                return `<tr>
                                    <td><strong>${e.examName}</strong></td>
                                    <td>${DB.formatDate(e.date)}</td>
                                    <td>${e.maxScore}</td>
                                    <td>${scoredCount}/${students.length}</td>
                                    <td><button class="btn btn-ghost btn-sm" onclick="GradesPage.enterScores('${e.examName}', '${e.date}', ${e.maxScore})"><i data-lucide="edit-3"></i> Nhập điểm</button></td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="file-text"></i> Quản lý Điểm số</h1>
            </div>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="GradesPage.showAddExam()"><i data-lucide="plus"></i> Thêm bài kiểm tra</button>
            </div>
        </div>

        <div class="filter-bar">
            <select class="select" id="grade-class" style="max-width:220px;" onchange="GradesPage.selectClass(this.value)">
                <option value="">Chọn lớp</option>
                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
        </div>

        <div id="grades-content"></div>
    `;

    renderContent();

    window.GradesPage = {
        selectClass(val) {
            selectedClass = val;
            loadGrades();
        },

        showAddExam() {
            if (!selectedClass) { Toast.warning('Chọn lớp', 'Vui lòng chọn lớp trước'); return; }

            Modal.show({
                title: 'Thêm bài kiểm tra',
                content: `
                    <div class="form-group">
                        <label class="form-label">Tên bài kiểm tra *</label>
                        <input type="text" class="input" id="exam-name" placeholder="VD: Kiểm tra 15 phút #1">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Ngày</label>
                            <input type="date" class="input" id="exam-date" value="${DB.today()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Điểm tối đa</label>
                            <input type="number" class="input" id="exam-max" value="10">
                        </div>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="GradesPage.createAndEnter()">Tiếp tục nhập điểm</button>
                `
            });
        },

        async createAndEnter() {
            const name = document.getElementById('exam-name').value.trim();
            if (!name) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập tên bài KT'); return; }
            const date = document.getElementById('exam-date').value;
            const maxScore = parseInt(document.getElementById('exam-max').value) || 10;
            Modal.close();
            this.enterScores(name, date, maxScore);
        },

        enterScores(examName, date, maxScore) {
            const existingScores = {};
            grades.filter(g => g.examName === examName && g.date === date).forEach(g => {
                existingScores[g.studentId] = g.score;
            });

            Modal.show({
                title: `Nhập điểm: ${examName}`,
                size: 'lg',
                content: `
                    <p class="text-sm text-muted mb-4">Điểm tối đa: ${maxScore} | Ngày: ${DB.formatDate(date)}</p>
                    <div class="table-container">
                        <table>
                            <thead><tr><th>STT</th><th>Học viên</th><th style="text-align:center;">Điểm</th></tr></thead>
                            <tbody>
                                ${students.map((s, i) => `<tr>
                                    <td>${i + 1}</td>
                                    <td>${s.name}</td>
                                    <td style="text-align:center;">
                                        <input type="number" class="grade-input" id="score-${s.id}" 
                                            min="0" max="${maxScore}" step="0.5" 
                                            value="${existingScores[s.id] !== undefined ? existingScores[s.id] : ''}"
                                            placeholder="—">
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="GradesPage.saveScores('${examName.replace(/'/g, "\\'")}', '${date}', ${maxScore})">Lưu điểm</button>
                `
            });
        },

        async saveScores(examName, date, maxScore) {
            try {
                // Delete existing grades for this exam
                const existing = grades.filter(g => g.examName === examName && g.date === date);
                for (const g of existing) {
                    await DB.deleteGrade(g.id);
                }

                // Add new grades
                for (const s of students) {
                    const input = document.getElementById(`score-${s.id}`);
                    if (input && input.value !== '') {
                        await DB.addGrade({
                            studentId: s.id,
                            classId: selectedClass,
                            examName,
                            score: parseFloat(input.value),
                            maxScore,
                            date,
                            teacherId: window.currentUser.id
                        });
                    }
                }

                Modal.close();
                Toast.success('Thành công', 'Đã lưu điểm bài ' + examName);
                grades = await DB.getGrades(selectedClass);
                renderContent();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        }
    };
});
