// ============================================
// FIRESTORE DATA MODULE
// ============================================

const DB = {
    // === STUDENTS ===
    async getStudents() {
        const snap = await window.db.collection('students').get();
        const year = window.currentAcademicYear || '2026-2027';
        return snap.docs
            .map(d => ({ academicYear: '2025-2026', ...d.data(), id: d.id }))
            .filter(d => d.academicYear === year)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async getStudentsByClass(classId) {
        const snap = await window.db.collection('students').where('classIds', 'array-contains', classId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async addStudent(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = data.status || 'active';
        data.classIds = data.classIds || [];
        data.academicYear = window.currentAcademicYear || '2026-2027';
        return await window.db.collection('students').add(data);
    },

    async addStudentsBatch(studentsArray) {
        const batch = window.db.batch();
        const year = window.currentAcademicYear || '2026-2027';
        studentsArray.forEach(data => {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.status = data.status || 'active';
            data.classIds = data.classIds || [];
            data.academicYear = year;
            const ref = window.db.collection('students').doc();
            batch.set(ref, data);
        });
        return await batch.commit();
    },

    async updateStudent(id, data) {
        return await window.db.collection('students').doc(id).update(data);
    },

    async deleteStudent(id) {
        return await window.db.collection('students').doc(id).delete();
    },

    // === CLASSES ===
    async getClasses() {
        const snap = await window.db.collection('classes').get();
        const year = window.currentAcademicYear || '2026-2027';
        return snap.docs
            .map(d => ({ academicYear: '2025-2026', ...d.data(), id: d.id }))
            .filter(d => d.academicYear === year)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async getClassesByTeacher(teacherId) {
        const snap = await window.db.collection('classes').where('teacherIds', 'array-contains', teacherId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async addClass(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = data.status || 'active';
        data.teacherIds = data.teacherIds || [];
        data.academicYear = window.currentAcademicYear || '2026-2027';
        const ref = await window.db.collection('classes').add(data);
        return { id: ref.id, ...data };
    },

    async updateClass(id, data) {
        return await window.db.collection('classes').doc(id).update(data);
    },

    async deleteClass(id) {
        return await window.db.collection('classes').doc(id).delete();
    },

    // === ATTENDANCE ===
    async getAttendance(classId, date) {
        const snap = await window.db.collection('attendance')
            .where('classId', '==', classId)
            .where('date', '==', date)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getAttendanceByDateRange(classId, startDate, endDate) {
        const snap = await window.db.collection('attendance')
            .where('classId', '==', classId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },

    async saveAttendance(data) {
        const existing = await this.getAttendance(data.classId, data.date);
        if (existing.length > 0) {
            return await window.db.collection('attendance').doc(existing[0].id).update({
                records: data.records,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            return await window.db.collection('attendance').add(data);
        }
    },

    // === GRADES ===
    async getGrades(classId) {
        const snap = await window.db.collection('grades')
            .where('classId', '==', classId)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },

    async addGrade(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        return await window.db.collection('grades').add(data);
    },

    async updateGrade(id, data) {
        return await window.db.collection('grades').doc(id).update(data);
    },

    async deleteGrade(id) {
        return await window.db.collection('grades').doc(id).delete();
    },

    // === TUITION ===
    async getTuitions() {
        const snap = await window.db.collection('tuition').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
    },

    async getTuitionsPending() {
        const snap = await window.db.collection('tuition')
            .where('status', 'in', ['pending', 'overdue'])
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    },

    async addTuition(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = data.status || 'pending';
        return await window.db.collection('tuition').add(data);
    },

    async updateTuition(id, data) {
        return await window.db.collection('tuition').doc(id).update(data);
    },

    async deleteTuition(id) {
        return await window.db.collection('tuition').doc(id).delete();
    },

    // === TEACHER ATTENDANCE ===
    async getTeacherAttendance(month) {
        const snap = await window.db.collection('teacherAttendance')
            .where('month', '==', month)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async addTeacherAttendanceRecord(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        return await window.db.collection('teacherAttendance').add(data);
    },

    async updateTeacherAttendanceRecord(id, data) {
        return await window.db.collection('teacherAttendance').doc(id).update(data);
    },

    async deleteTeacherAttendanceRecord(id) {
        return await window.db.collection('teacherAttendance').doc(id).delete();
    },

    // === SALARY ADJUSTMENTS ===
    async getSalaryAdjustments(month) {
        const snap = await window.db.collection('salaryAdjustments')
            .where('month', '==', month)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async addSalaryAdjustment(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        return await window.db.collection('salaryAdjustments').add(data);
    },

    async deleteSalaryAdjustment(id) {
        return await window.db.collection('salaryAdjustments').doc(id).delete();
    },

    // === FINANCE ===
    async getFinanceRecords(month) {
        let snap;
        if (month) {
            const start = month + '-01';
            const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0);
            const end = month + '-' + String(endDate.getDate()).padStart(2, '0');
            snap = await window.db.collection('finance')
                .where('date', '>=', start)
                .where('date', '<=', end)
                .get();
        } else {
            snap = await window.db.collection('finance').get();
        }
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },

    async addFinanceRecord(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        return await window.db.collection('finance').add(data);
    },

    async updateFinanceRecord(id, data) {
        return await window.db.collection('finance').doc(id).update(data);
    },

    async deleteFinanceRecord(id) {
        return await window.db.collection('finance').doc(id).delete();
    },

    async getMonthlyFinanceSummary(year) {
        const results = [];
        for (let m = 1; m <= 12; m++) {
            const month = `${year}-${String(m).padStart(2, '0')}`;
            const records = await this.getFinanceRecords(month);
            let revenue = 0, expense = 0;
            records.forEach(r => {
                if (r.type === 'revenue') revenue += (r.amount || 0);
                else if (r.type === 'expense') expense += (r.amount || 0);
            });
            results.push({ month: m, monthName: `T${m}`, revenue, expense, profit: revenue - expense });
        }
        return results;
    },

    // === USERS ===
    async getUsers() {
        const snap = await window.db.collection('users').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getTeachers() {
        const snap = await window.db.collection('users').where('role', '==', 'teacher').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async updateUserRole(userId, role) {
        return await window.db.collection('users').doc(userId).update({ role });
    },

    async updateUserStatus(userId, status) {
        return await window.db.collection('users').doc(userId).update({ status });
    },

    async updateUserSalary(userId, salaryConfig) {
        return await window.db.collection('users').doc(userId).update({ salaryConfig });
    },

    async updateTeacherAttendanceSalaries(teacherId, month, salaryConfig) {
        const snap = await window.db.collection('teacherAttendance')
            .where('teacherId', '==', teacherId)
            .where('month', '==', month)
            .get();
        
        const batch = window.db.batch();
        snap.docs.forEach(doc => {
            const data = doc.data();
            const classConf = salaryConfig[data.classId] || {};
            let salary = 0;
            if (data.shift === 'custom') {
                salary = (classConf.perHour || 0) * (data.hours || 0);
            } else {
                salary = classConf.perShift || 0;
            }
            
            batch.update(doc.ref, { salary });
        });
        return await batch.commit();
    },

    // === SCHEDULE ===
    async getSchedules() {
        const snap = await window.db.collection('schedules').get();
        const year = window.currentAcademicYear || '2026-2027';
        return snap.docs
            .map(d => ({ academicYear: '2025-2026', ...d.data(), id: d.id }))
            .filter(d => d.academicYear === year);
    },

    async addSchedule(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.academicYear = window.currentAcademicYear || '2026-2027';
        return await window.db.collection('schedules').add(data);
    },

    async addSchedulesBatch(schedulesArray) {
        const batch = window.db.batch();
        const year = window.currentAcademicYear || '2026-2027';
        schedulesArray.forEach(data => {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.academicYear = year;
            const ref = window.db.collection('schedules').doc();
            batch.set(ref, data);
        });
        return await batch.commit();
    },

    async updateSchedule(id, data) {
        return await window.db.collection('schedules').doc(id).update(data);
    },

    async deleteSchedule(id) {
        return await window.db.collection('schedules').doc(id).delete();
    },

    // === SCHEDULE EXCEPTIONS (Lịch bù) ===
    async getScheduleExceptions() {
        const snap = await window.db.collection('scheduleExceptions').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getScheduleExceptionsByMonth(monthStr) {
        // monthStr format: YYYY-MM
        const start = `${monthStr}-01`;
        const end = `${monthStr}-31`; // Approx
        const snap = await window.db.collection('scheduleExceptions')
            .where('originalDate', '>=', start)
            .where('originalDate', '<=', end)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async addScheduleException(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const ref = await window.db.collection('scheduleExceptions').add(data);
        return { id: ref.id, ...data };
    },

    async deleteScheduleException(id) {
        return await window.db.collection('scheduleExceptions').doc(id).delete();
    },

    // === SETTINGS ===
    async getSettings() {
        const doc = await window.db.collection('settings').doc('general').get();
        return doc.exists ? doc.data() : {};
    },

    async updateSettings(data) {
        return await window.db.collection('settings').doc('general').set(data, { merge: true });
    },

    // === UTILITY ===
    roundTuition(amount) {
        if (!amount) return 0;
        let base = Math.floor(amount / 10000) * 10000;
        let th = Math.floor((amount % 10000) / 1000);
        
        if (th < 5) th = 0;
        else if (th === 5) th = 5;
        else if (th === 6 || th === 7) th = 5;
        // if th === 8 or 9, it remains unchanged
        
        return base + (th * 1000);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    },

    formatDateTime(timestamp) {
        if (!timestamp) return '';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },

    today() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const d2 = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${d2}`;
    },
    currentMonth() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    },
    currentYear() { return new Date().getFullYear(); }
};

window.DB = DB;
