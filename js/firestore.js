// ============================================
// FIRESTORE DATA MODULE
// ============================================

const DB = {
    // === STUDENTS ===
    async getStudents() {
        const snap = await window.db.collection('students').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async getStudentsByClass(classId) {
        const snap = await window.db.collection('students').where('classIds', 'array-contains', classId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async addStudent(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = data.status || 'active';
        data.classIds = data.classIds || [];
        return await window.db.collection('students').add(data);
    },

    async addStudentsBatch(studentsArray) {
        const batch = window.db.batch();
        studentsArray.forEach(data => {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.status = data.status || 'active';
            data.classIds = data.classIds || [];
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
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async getClassesByTeacher(teacherId) {
        const snap = await window.db.collection('classes').where('teacherIds', 'array-contains', teacherId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async addClass(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = data.status || 'active';
        data.teacherIds = data.teacherIds || [];
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

    // === SCHEDULE ===
    async getSchedules() {
        const snap = await window.db.collection('schedules').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async addSchedule(data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        return await window.db.collection('schedules').add(data);
    },

    async addSchedulesBatch(schedulesArray) {
        const batch = window.db.batch();
        schedulesArray.forEach(data => {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
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

    // === SETTINGS ===
    async getSettings() {
        const doc = await window.db.collection('settings').doc('general').get();
        return doc.exists ? doc.data() : {};
    },

    async updateSettings(data) {
        return await window.db.collection('settings').doc('general').set(data, { merge: true });
    },

    // === UTILITY ===
    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    formatDateTime(timestamp) {
        if (!timestamp) return '';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },

    today() { return new Date().toISOString().split('T')[0]; },
    currentMonth() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },
    currentYear() { return new Date().getFullYear(); }
};

window.DB = DB;
