// ============================================
// CLASSES PAGE
// ============================================

Router.register('classes', async (container) => {
    const canEdit = Auth.hasAnyRole('owner', 'staff');
    const isTeacher = Auth.isTeacher();
    let classes = [], teachers = [], students = [], tuitions = [], teacherAttendance = [];
    let searchText = '';

    try {
        if (isTeacher) {
            classes = await DB.getClassesByTeacher(window.currentUser.id);
        } else {
            classes = await DB.getClasses();
        }
        teachers = await DB.getTeachers();

        try {
            students = await DB.getStudents();
        } catch(e) { console.warn("Cannot fetch students:", e); }

        if (canEdit) {
            tuitions = await DB.getTuitions();
            teacherAttendance = await DB.getTeacherAttendance(DB.currentMonth());
        }
    } catch(e) { console.warn(e); }

    function getTeacherNames(teacherIds) {
        if (!teacherIds || teacherIds.length === 0) return 'Chưa phân công';
        return teacherIds.map(id => {
            const t = teachers.find(te => te.id === id);
            return t ? (t.displayName || t.email) : id;
        }).filter(Boolean).join(', ') || 'Chưa phân công';
    }

    function renderCards() {
        const grid = document.getElementById('classes-grid');
        if (!grid) return;

        const filteredClasses = classes.filter(c => {
            if (!searchText) return true;
            const s = searchText.toLowerCase();
            return (c.name || '').toLowerCase().includes(s) || (c.subject || '').toLowerCase().includes(s);
        });

        filteredClasses.sort((a, b) => {
            const getGradeNum = (str) => {
                if (!str) return 999;
                const match = str.match(/\d+/);
                return match ? parseInt(match[0], 10) : 999;
            };
            const gradeA = getGradeNum(a.name);
            const gradeB = getGradeNum(b.name);
            if (gradeA !== gradeB) return gradeA - gradeB;
            return (a.name || '').localeCompare(b.name || '');
        });

        if (filteredClasses.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="school"></i><h3>Không tìm thấy lớp học</h3><p>${canEdit ? 'Nhấn "Thêm lớp" để tạo lớp mới' : 'Bạn chưa được phân công lớp nào'}</p></div>`;
        } else {
            grid.innerHTML = filteredClasses.map(c => {
                const classStudents = students.filter(s => (s.classIds || []).includes(c.id));
                const activeStudents = classStudents.filter(s => s.status === 'active');
                const pendingCount = classStudents.filter(s => s.status === 'pending').length;
                let studentCountHtml = `Sĩ số: ${activeStudents.length} học viên`;
                if (pendingCount > 0) studentCountHtml += ` <span style="font-weight:normal;color:var(--warning-600);">(${pendingCount} chờ lớp)</span>`;

                let profitHtml = '';
                if (canEdit) {
                    const expectedRev = activeStudents.length * (c.fee || 0);
                    
                    let expectedSal = 0;
                    (c.teacherIds || []).forEach(tid => {
                        const t = teachers.find(x => x.id === tid);
                        if (t && t.salaryConfig && t.salaryConfig[c.id]) {
                            const conf = t.salaryConfig[c.id];
                            expectedSal += (conf.perShift || 0) * (conf.perHour || 0);
                        }
                    });
                    const expectedProfit = expectedRev - expectedSal;

                    const currentMonth = DB.currentMonth();
                    const paidTuitions = tuitions.filter(t => {
                        if (t.status !== 'paid') return false;
                        if (!t.dueDate || !t.dueDate.startsWith(currentMonth)) return false;
                        if (t.classId === c.id) return true;
                        // For multi-class students, check if the student belongs to this class
                        if (t.classId === 'Nhiều môn' && t.studentId) {
                            const student = students.find(s => s.id === t.studentId);
                            return student && (student.classIds || []).includes(c.id);
                        }
                        return false;
                    });
                    // For multi-class tuitions, pro-rate the amount based on this class's fee vs total
                    const realtimeRev = paidTuitions.reduce((sum, t) => {
                        if (t.classId === c.id) return sum + Number(t.amount || 0);
                        // Pro-rate for multi-class
                        const student = students.find(s => s.id === t.studentId);
                        if (student && student.classIds && student.classIds.length > 1) {
                            const thisFee = (student.customFees && student.customFees[c.id] !== undefined) ? student.customFees[c.id] : (c.fee || 0);
                            let totalFee = 0;
                            student.classIds.forEach(cid => {
                                const cls = classes.find(cc => cc.id === cid);
                                if (cls) totalFee += (student.customFees && student.customFees[cid] !== undefined) ? student.customFees[cid] : (cls.fee || 0);
                            });
                            if (totalFee > 0) return sum + Math.round(Number(t.amount || 0) * thisFee / totalFee);
                        }
                        return sum + Number(t.amount || 0);
                    }, 0);

                    const classAtt = teacherAttendance.filter(r => r.classId === c.id);
                    let realtimeSal = 0;
                    classAtt.forEach(r => {
                        let rSalary = r.salary || 0;
                        if (r.salaryMultiplier !== undefined) rSalary *= r.salaryMultiplier;
                        if (r.penaltyAmount) rSalary -= r.penaltyAmount;
                        if (rSalary < 0) rSalary = 0;
                        realtimeSal += rSalary;
                    });
                    const realtimeProfit = realtimeRev - realtimeSal;

                    profitHtml = `
                        <div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border-color);">
                            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
                                <span style="color:var(--text-secondary);" title="Dự kiến = Sĩ số x Học phí - (Số buổi TC x Lương ca)">Dự kiến:</span>
                                <div style="text-align:right;">
                                    <span style="color:#3b82f6;">${DB.formatCurrency(expectedRev)}</span>
                                    <span style="color:var(--text-muted);margin:0 4px;">-</span>
                                    <span style="color:var(--danger-500);">${DB.formatCurrency(expectedSal)}</span>
                                    <span style="color:var(--text-muted);margin:0 4px;">=</span>
                                    <strong style="color:${expectedProfit >= 0 ? 'var(--success-600)' : 'var(--danger-600)'};">${DB.formatCurrency(expectedProfit)}</strong>
                                </div>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-size:12px;">
                                <span style="color:var(--text-secondary);" title="Thực tế = Đã thu - Đã chấm công">Thực tế (Tháng ${DB.currentMonth()}):</span>
                                <div style="text-align:right;">
                                    <span style="color:#3b82f6;">${DB.formatCurrency(realtimeRev)}</span>
                                    <span style="color:var(--text-muted);margin:0 4px;">-</span>
                                    <span style="color:var(--danger-500);">${DB.formatCurrency(realtimeSal)}</span>
                                    <span style="color:var(--text-muted);margin:0 4px;">=</span>
                                    <strong style="color:${realtimeProfit >= 0 ? 'var(--success-600)' : 'var(--danger-600)'};">${DB.formatCurrency(realtimeProfit)}</strong>
                                </div>
                            </div>
                        </div>
                    `;
                }

                return `
                <div class="card" style="border-top:3px solid ${c.status === 'active' ? 'var(--primary-500)' : 'var(--neutral-600)'};">
                    <div class="card-body">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-4);">
                            <div>
                                <h3 style="font-size:var(--font-size-lg);font-weight:700;margin-bottom:4px;">${c.name}</h3>
                                <span class="badge badge-${c.status === 'active' ? 'success' : (c.status === 'upcoming' ? 'warning' : 'neutral')}">${c.status === 'active' ? 'Đang hoạt động' : (c.status === 'upcoming' ? 'Chuẩn bị khai giảng' : 'Tạm ngưng')}</span>
                            </div>
                            ${canEdit ? `<div class="table-actions">
                                <button class="btn-icon" title="Sửa" onclick="ClassesPage.edit('${c.id}')"><i data-lucide="pencil"></i></button>
                                ${Auth.isOwner() ? `<button class="btn-icon" title="Xóa" onclick="ClassesPage.remove('${c.id}', '${(c.name||'').replace(/'/g,"\\'")}')"><i data-lucide="trash-2"></i></button>` : ''}
                            </div>` : ''}
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;font-size:var(--font-size-sm);color:var(--text-secondary);">
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="book-open" style="width:16px;height:16px;color:var(--primary-400);"></i> ${c.subject || 'Chưa rõ'}</div>
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="user" style="width:16px;height:16px;color:var(--accent-400);"></i> ${getTeacherNames(c.teacherIds)}</div>
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="map-pin" style="width:16px;height:16px;color:var(--success-400);"></i> ${c.room || 'Chưa có phòng'}</div>
                            ${c.status === 'upcoming' && c.startDate ? `<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="calendar-clock" style="width:16px;height:16px;color:var(--warning-500);"></i> <strong style="color:var(--warning-600);">Khai giảng: ${DB.formatDate(c.startDate)}</strong></div>` : ''}
                            ${!isTeacher ? `<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="wallet" style="width:16px;height:16px;color:var(--warning-400);"></i> ${c.fee ? DB.formatCurrency(c.fee) + '/tháng' : 'Chưa cập nhật'}</div>` : ''}
                            <div style="display:flex;align-items:center;gap:8px;"><i data-lucide="users" style="width:16px;height:16px;color:var(--info-400);"></i> <a href="javascript:void(0)" onclick="ClassesPage.showStudents('${c.id}')" style="color:var(--info-600);text-decoration:none;font-weight:600;">${studentCountHtml}</a></div>
                        </div>
                        ${profitHtml}
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('attendance')"><i data-lucide="clipboard-check"></i> Điểm danh</button>
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('schedule')"><i data-lucide="calendar-days"></i> Lịch học</button>
                        ${!isTeacher ? `<button class="btn btn-primary btn-sm" onclick="ClassesPage.showGenerateTuition('${c.id}')"><i data-lucide="coins"></i> Phát hành học phí</button>` : ''}
                    </div>
                </div>
            `}).join('');
        }
        if (window.lucide) lucide.createIcons();
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title"><i data-lucide="school"></i> Quản lý Lớp học</h1>
                <p class="page-subtitle">${classes.length} lớp trong hệ thống</p>
            </div>
            <div class="page-actions" style="display:flex;align-items:center;gap:12px;">
                <div class="search-box" style="position:relative;">
                    <i data-lucide="search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-muted);"></i>
                    <input type="text" class="input" placeholder="Tìm lớp, môn học..." style="padding-left:36px;width:250px;" onkeyup="ClassesPage.filter(this.value)">
                </div>
                ${Auth.isOwner() ? '<button class="btn btn-secondary" onclick="window.open(\'assets/docs/QuyDinhTaiChinh_ThanhNhanEducation.pdf\', \'_blank\')"><i data-lucide="file-text"></i> Xem quy định</button>' : ''}
                ${canEdit ? '<button class="btn btn-primary" onclick="ClassesPage.showAdd()"><i data-lucide="plus"></i> Thêm lớp</button>' : ''}
            </div>
        </div>

        <div id="classes-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-6);"></div>
    `;

    renderCards();

    window.ClassesPage = {
        filter(text) {
            searchText = text;
            renderCards();
        },

        showStudents(classId) {
            const cls = classes.find(c => c.id === classId);
            if (!cls) return;
            const classStudents = students.filter(s => (s.classIds || []).includes(classId) && s.status !== 'inactive');
            let html = '<div class="table-container"><table><thead><tr><th>STT</th><th>Họ tên</th><th>Trạng thái</th><th>Trường</th><th>SĐT Phụ huynh</th></tr></thead><tbody>';
            if (classStudents.length === 0) {
                html += '<tr><td colspan="5"><div class="empty-state">Lớp chưa có học viên nào</div></td></tr>';
            } else {
                classStudents.sort((a, b) => a.name.localeCompare(b.name));
                classStudents.forEach((s, idx) => {
                    const statusText = s.status === 'pending' ? '<span class="badge badge-warning">Chờ sắp lớp</span>' : '<span class="badge badge-success">Đang học</span>';
                    html += `<tr><td>${idx+1}</td><td><strong>${s.name}</strong></td><td>${statusText}</td><td>${s.school || '—'}</td><td>${s.parentPhone || '—'}</td></tr>`;
                });
            }
            html += '</tbody></table></div>';
            
            Modal.show({
                title: `Danh sách học viên: ${cls.name}`,
                size: 'lg',
                content: html,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Đóng</button>`
            });
        },

        suggestFee(name) {
            if (!name) return;
            const feeInput = document.getElementById('c-fee');
            if (!feeInput) return;
            
            const lowerName = name.toLowerCase();
            const isOneOnOne = lowerName.includes('1:1') || lowerName.includes('1 kèm 1') || lowerName.includes('kèm riêng');
            const match = lowerName.match(/(?:lớp|khối|\s|^|a|b|c)(\d{1,2})(?:\s|$|[a-z])/i);
            if (!match) return;
            
            const grade = parseInt(match[1]);
            if (grade < 1 || grade > 12) return;

            let fee = 0;
            if (isOneOnOne) {
                if (grade >= 1 && grade <= 5) fee = 1300000;
                else if (grade >= 6 && grade <= 8) fee = 1400000;
                else if (grade >= 9 && grade <= 11) fee = 1500000;
                else if (grade === 12) fee = 1800000;
            } else {
                if (grade >= 1 && grade <= 5) fee = 500000;
                else if (grade === 6) fee = 525000;
                else if (grade === 7) fee = 550000;
                else if (grade === 8) fee = 575000;
                else if (grade === 9) fee = 600000;
                else if (grade === 10) fee = 625000;
                else if (grade === 11) fee = 650000;
                else if (grade === 12) fee = 675000;
            }
            if (fee > 0) feeInput.value = fee;
        },

        showGenerateTuition(classId) {
            const cls = classes.find(c => c.id === classId);
            if (!cls) return;
            
            const currentMonth = DB.currentMonth();
            
            Modal.show({
                title: `Phát hành Học phí: ${cls.name}`,
                content: `
                    <div class="form-group">
                        <label class="form-label">Tháng thu học phí</label>
                        <input type="month" class="input" id="gen-month" value="${currentMonth}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hạn đóng</label>
                        <input type="date" class="input" id="gen-due-date" value="${currentMonth}-15">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú (Tùy chọn)</label>
                        <input type="text" class="input" id="gen-note" placeholder="VD: Học phí tháng ${currentMonth.split('-')[1]}">
                    </div>
                    <div class="alert alert-info">
                        Hệ thống sẽ tự động tính toán số tiền cho từng học viên đang học trong lớp (bao gồm giảm giá, nhiều môn) và tạo hàng loạt hóa đơn chưa đóng.
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="ClassesPage.generateTuition('${classId}')">Tạo tự động</button>
                `
            });
        },

        async generateTuition(classId) {
            const cls = classes.find(c => c.id === classId);
            if (!cls) return;
            
            const monthStr = document.getElementById('gen-month').value;
            const dueDate = document.getElementById('gen-due-date').value;
            const note = document.getElementById('gen-note').value;
            
            if (!monthStr || !dueDate) { Toast.warning('Thiếu thông tin'); return; }
            
            const classStudents = students.filter(s => s.status === 'active' && (s.classIds || []).includes(classId));
            if (classStudents.length === 0) { Toast.warning('Lớp chưa có học viên đang học'); return; }
            
            Modal.show({ title: 'Đang xử lý...', content: '<div class="empty-state"><div class="spinner"></div></div>' });
            
            try {
                const existingSnap = await window.db.collection('tuition').where('dueDate', '==', dueDate).get();
                const existingStudentIds = new Set(existingSnap.docs.map(d => d.data().studentId));
                
                let successCount = 0;
                let skipCount = 0;
                
                for (const student of classStudents) {
                    if (existingStudentIds.has(student.id)) {
                        skipCount++;
                        continue;
                    }
                    
                    let totalFee = 0;
                    student.classIds.forEach(cid => {
                        const c = classes.find(cc => cc.id === cid);
                        if (c) {
                            const fee = (student.customFees && student.customFees[cid] !== undefined) ? student.customFees[cid] : (c.fee || 0);
                            totalFee += fee;
                        }
                    });
                    
                    if (totalFee > 0) {
                        const discount = student.discount || 0;
                        let finalAmount = Math.round(totalFee * (1 - discount));
                        finalAmount = DB.roundTuition(finalAmount);
                        
                        const actualClassId = student.classIds.length > 1 ? 'Nhiều môn' : classId;
                        
                        await DB.addTuition({
                            studentId: student.id,
                            studentName: student.name,
                            classId: actualClassId,
                            amount: finalAmount,
                            dueDate: dueDate,
                            status: new Date(dueDate) < new Date() ? 'overdue' : 'pending',
                            reminderSent: false,
                            note: note || `Học phí tháng ${monthStr.split('-')[1]}`
                        });
                        successCount++;
                    }
                }
                
                Modal.close();
                if (successCount > 0) {
                    Toast.success(`Đã phát hành ${successCount} hóa đơn học phí thành công!` + (skipCount > 0 ? ` (Bỏ qua ${skipCount} học viên đã có)` : ''));
                } else {
                    Toast.info('Không có hóa đơn mới nào được tạo', skipCount > 0 ? `Tất cả ${skipCount} học viên đều đã có hóa đơn cho hạn đóng này.` : '');
                }
            } catch (e) {
                Modal.close();
                Toast.error('Lỗi', e.message);
            }
        },

        showAdd() {
            const teacherCheckboxes = teachers.map(t => `
                <label class="checkbox-label"><input type="checkbox" value="${t.id}"> ${t.displayName || t.email}</label>
            `).join('') || '<span class="text-muted text-sm">Chưa có giáo viên nào</span>';
            const customInput = `<div style="margin-top:8px;"><input type="text" class="input" id="c-custom-teachers" placeholder="Hoặc nhập tên GV khác (cách nhau bằng dấu phẩy)"></div>`;

            Modal.show({
                title: 'Thêm lớp học mới',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Tên lớp *</label>
                            <input type="text" class="input" id="c-name" placeholder="VD: Toán 12A" oninput="ClassesPage.suggestFee(this.value)">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Môn học</label>
                            <input type="text" class="input" id="c-subject" placeholder="VD: Toán, Lý, Hóa...">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Học phí/tháng (VNĐ)</label>
                            <input type="number" class="input" id="c-fee" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phòng học</label>
                            <input type="text" class="input" id="c-room" placeholder="VD: P.01">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Giáo viên phụ trách</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="c-teachers">${teacherCheckboxes}</div>
                        ${customInput}
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Trạng thái</label>
                            <select class="select" id="c-status" onchange="document.getElementById('c-start-group').style.display = this.value === 'upcoming' ? 'block' : 'none'">
                                <option value="active">Đang hoạt động</option>
                                <option value="upcoming">Chuẩn bị khai giảng</option>
                                <option value="inactive">Tạm ngưng</option>
                            </select>
                        </div>
                        <div class="form-group" id="c-start-group" style="display:none;">
                            <label class="form-label">Ngày khai giảng</label>
                            <input type="date" class="input" id="c-start-date" value="${DB.today()}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="textarea" id="c-notes" rows="2"></textarea>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="ClassesPage.saveNew()">Lưu</button>
                `
            });
        },

        async saveNew() {
            const name = document.getElementById('c-name').value.trim();
            if (!name) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập tên lớp'); return; }

            const teacherIds = Array.from(document.querySelectorAll('#c-teachers input:checked')).map(cb => cb.value);
            const customInput = document.getElementById('c-custom-teachers');
            if (customInput && customInput.value.trim()) {
                customInput.value.split(',').forEach(n => {
                    const tName = n.trim();
                    if (tName) teacherIds.push(tName);
                });
            }
            const fee = parseInt(document.getElementById('c-fee').value) || 0;

            try {
                const status = document.getElementById('c-status').value;
                const startDate = document.getElementById('c-start-date') ? document.getElementById('c-start-date').value : '';
                await DB.addClass({
                    name,
                    subject: document.getElementById('c-subject').value || '',
                    fee,
                    room: document.getElementById('c-room').value || '',
                    teacherIds,
                    status,
                    startDate: status === 'upcoming' ? startDate : '',
                    notes: document.getElementById('c-notes').value || ''
                });
                Modal.close();
                Toast.success('Thành công', 'Đã thêm lớp ' + name);
                classes = await DB.getClasses();
                renderCards();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        async edit(id) {
            const c = classes.find(cl => cl.id === id);
            if (!c) return;

            const teacherCheckboxes = teachers.map(t => `
                <label class="checkbox-label"><input type="checkbox" value="${t.id}" ${(c.teacherIds || []).includes(t.id) ? 'checked' : ''}> ${t.displayName || t.email}</label>
            `).join('') || '<span class="text-muted text-sm">Chưa có giáo viên</span>';
            const customTeachers = (c.teacherIds || []).filter(tid => !teachers.find(t => t.id === tid)).join(', ');
            const customInput = `<div style="margin-top:8px;"><input type="text" class="input" id="c-custom-teachers" value="${customTeachers}" placeholder="Hoặc nhập tên GV khác (cách nhau bằng dấu phẩy)"></div>`;

            Modal.show({
                title: 'Sửa lớp học',
                content: `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Tên lớp *</label>
                            <input type="text" class="input" id="c-name" value="${c.name || ''}" oninput="ClassesPage.suggestFee(this.value)">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Môn học</label>
                            <input type="text" class="input" id="c-subject" value="${c.subject || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Học phí/tháng (VNĐ)</label>
                            <input type="number" class="input" id="c-fee" value="${c.fee || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phòng học</label>
                            <input type="text" class="input" id="c-room" value="${c.room || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Giáo viên phụ trách</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="c-teachers">${teacherCheckboxes}</div>
                        ${customInput}
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Trạng thái</label>
                            <select class="select" id="c-status" onchange="document.getElementById('c-start-group').style.display = this.value === 'upcoming' ? 'block' : 'none'">
                                <option value="active" ${c.status === 'active' ? 'selected' : ''}>Đang hoạt động</option>
                                <option value="upcoming" ${c.status === 'upcoming' ? 'selected' : ''}>Chuẩn bị khai giảng</option>
                                <option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>Tạm ngưng</option>
                            </select>
                        </div>
                        <div class="form-group" id="c-start-group" style="display:${c.status === 'upcoming' ? 'block' : 'none'};">
                            <label class="form-label">Ngày khai giảng</label>
                            <input type="date" class="input" id="c-start-date" value="${c.startDate || DB.today()}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="textarea" id="c-notes" rows="2">${c.notes || ''}</textarea>
                    </div>
                `,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                    <button class="btn btn-primary" onclick="ClassesPage.saveEdit('${id}')">Cập nhật</button>
                `
            });
        },

        async saveEdit(id) {
            const name = document.getElementById('c-name').value.trim();
            if (!name) { Toast.warning('Thiếu thông tin', 'Vui lòng nhập tên lớp'); return; }

            const teacherIds = Array.from(document.querySelectorAll('#c-teachers input:checked')).map(cb => cb.value);
            const customInput = document.getElementById('c-custom-teachers');
            if (customInput && customInput.value.trim()) {
                customInput.value.split(',').forEach(n => {
                    const tName = n.trim();
                    if (tName) teacherIds.push(tName);
                });
            }
            const fee = parseInt(document.getElementById('c-fee').value) || 0;

            try {
                const status = document.getElementById('c-status').value;
                const startDate = document.getElementById('c-start-date') ? document.getElementById('c-start-date').value : '';
                await DB.updateClass(id, {
                    name,
                    subject: document.getElementById('c-subject').value || '',
                    fee,
                    room: document.getElementById('c-room').value || '',
                    teacherIds,
                    status,
                    startDate: status === 'upcoming' ? startDate : '',
                    notes: document.getElementById('c-notes').value || ''
                });

                // Auto-activate or revert students
                if (status === 'active') {
                    const pendingStudents = students.filter(s => (s.classIds || []).includes(id) && s.status === 'pending');
                    if (pendingStudents.length > 0) {
                        Toast.info('Hệ thống đang tự động cập nhật trạng thái học viên...');
                        for (const ps of pendingStudents) {
                            await DB.updateStudent(ps.id, { status: 'active' });
                        }
                    }
                } else {
                    const activeStudents = students.filter(s => (s.classIds || []).includes(id) && s.status === 'active');
                    if (activeStudents.length > 0) {
                        const otherActiveClasses = classes.filter(c => c.id !== id && c.status === 'active');
                        let studentsToRevert = [];
                        for (const s of activeStudents) {
                            const hasOtherActiveClass = otherActiveClasses.some(c => (s.classIds || []).includes(c.id));
                            if (!hasOtherActiveClass) {
                                studentsToRevert.push(s);
                            }
                        }
                        if (studentsToRevert.length > 0) {
                            Toast.info('Hệ thống đang tự động chuyển học viên về chờ sắp lớp...');
                            for (const ps of studentsToRevert) {
                                await DB.updateStudent(ps.id, { status: 'pending' });
                            }
                        }
                    }
                }
                Modal.close();
                Toast.success('Thành công', 'Đã cập nhật lớp');
                classes = isTeacher ? await DB.getClassesByTeacher(window.currentUser.id) : await DB.getClasses();
                renderCards();
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        remove(id, name) {
            Modal.confirm({
                title: 'Xóa lớp học',
                message: `Bạn có chắc muốn xóa lớp <strong>${name}</strong>?`,
                confirmText: 'Xóa',
                danger: true
            });
            Modal.bindConfirm(async () => {
                await DB.deleteClass(id);
                Toast.success('Đã xóa', 'Lớp đã được xóa');
                classes = await DB.getClasses();
                renderCards();
            });
        }
    };
});
