// ============================================
// SETTINGS PAGE (Owner only)
// ============================================

Router.register('settings', async (container) => {
    if (!Auth.isOwner()) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="lock"></i><h3>Không có quyền truy cập</h3><p>Chỉ Chủ trung tâm mới có quyền truy cập Cài đặt hệ thống.</p></div>';
        if (window.lucide) lucide.createIcons();
        return;
    }

    let settings = {};
    try {
        settings = await DB.getSettings();
    } catch(e) { console.warn(e); }

    function render() {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title"><i data-lucide="settings"></i> Cài đặt hệ thống</h1>
                    <p class="page-subtitle">Quản lý cấu hình chung cho toàn trung tâm</p>
                </div>
            </div>

            <div class="settings-grid stagger" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
                <!-- Location Settings -->
                <div class="card">
                    <div class="card-header">
                        <h3>📍 Tọa độ điểm danh (GPS)</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Vĩ độ (Latitude)</label>
                            <input type="text" class="input" id="set-lat" value="${settings.centerLat || ''}" placeholder="VD: 10.762622">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kinh độ (Longitude)</label>
                            <input type="text" class="input" id="set-lng" value="${settings.centerLng || ''}" placeholder="VD: 106.660172">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Bán kính cho phép (mét)</label>
                            <input type="number" class="input" id="set-radius" value="${settings.checkInRadius || 100}">
                        </div>
                        <button class="btn btn-primary" onclick="SettingsPage.saveLocation()">Lưu Vị trí</button>
                    </div>
                </div>

                <!-- Tuition Settings Info -->
                <div class="card">
                    <div class="card-header">
                        <h3>💰 Quy định Tài chính</h3>
                    </div>
                    <div class="card-body">
                        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;">
                            Hệ thống đã được lập trình logic tự động nhảy số tiền học phí khi tạo/sửa lớp học, dựa trên bảng giá chuẩn mà bạn cung cấp.
                        </p>
                        <div style="background:var(--bg-glass);padding:16px;border-radius:8px;border:1px solid var(--border-color);font-size:13px;">
                            <h4 style="margin-bottom:8px;color:var(--primary-600);">Lớp nhóm (8 buổi/tháng)</h4>
                            <ul style="margin-left:20px;margin-bottom:16px;color:var(--text-secondary);">
                                <li>Lớp 1-5: 500.000đ</li>
                                <li>Lớp 6: 525.000đ | Lớp 7: 550.000đ | Lớp 8: 575.000đ</li>
                                <li>Lớp 9: 600.000đ | Lớp 10: 625.000đ | Lớp 11: 650.000đ</li>
                                <li>Lớp 12: 675.000đ</li>
                            </ul>
                            
                            <h4 style="margin-bottom:8px;color:var(--accent-600);">Lớp 1 kèm 1 (8 buổi/tháng)</h4>
                            <ul style="margin-left:20px;color:var(--text-secondary);">
                                <li>Lớp 1-5: 1.300.000đ</li>
                                <li>Lớp 6-8: 1.400.000đ</li>
                                <li>Lớp 9-11: 1.500.000đ</li>
                                <li>Lớp 12: 1.800.000đ</li>
                            </ul>
                        </div>
                        <p style="font-size:12px;color:var(--text-muted);margin-top:16px;">
                            Nếu trung tâm thay đổi bảng giá, vui lòng liên hệ lập trình viên để cập nhật công thức nội bộ, hoặc mở file quy định gốc lên xem.
                        </p>
                        <div style="margin-top:20px;padding-top:16px;border-top:1px dashed var(--border-color);">
                            <p style="font-size:13px;margin-bottom:8px;"><strong>Công cụ quản trị:</strong></p>
                            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.updateAllClassFees()"><i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Cập nhật Học phí cho toàn bộ Lớp cũ</button>
                            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Hệ thống sẽ duyệt qua tất cả các lớp hiện có và tự động áp dụng mức học phí mới nhất dựa trên tên lớp.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    render();

    function getFeeForClass(name) {
        if (!name) return 0;
        const lowerName = name.toLowerCase();
        const isOneOnOne = lowerName.includes('1:1') || lowerName.includes('1 kèm 1') || lowerName.includes('kèm riêng');
        const match = lowerName.match(/(?:lớp|khối|\s|^|a|b|c)(\d{1,2})(?:\s|$|[a-z])/i);
        if (!match) return 0;
        
        const grade = parseInt(match[1]);
        if (grade < 1 || grade > 12) return 0;

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
        return fee;
    }

    window.SettingsPage = {
        async updateAllClassFees() {
            if (!confirm('Hệ thống sẽ quét toàn bộ danh sách lớp học và ghi đè Học phí theo bảng quy định chuẩn (dựa vào số khối trong tên lớp). Bạn có chắc chắn muốn thực hiện?')) return;
            
            try {
                Toast.success('Đang xử lý...', 'Vui lòng không đóng trang');
                const classes = await DB.getClasses();
                const batch = window.db.batch();
                let count = 0;

                classes.forEach(c => {
                    const newFee = getFeeForClass(c.name);
                    if (newFee > 0 && newFee !== c.fee) {
                        const ref = window.db.collection('classes').doc(c.id);
                        batch.update(ref, { fee: newFee });
                        count++;
                    }
                });

                if (count > 0) {
                    await batch.commit();
                    Toast.success('Thành công', 'Đã tự động cập nhật học phí cho ' + count + ' lớp học.');
                } else {
                    Toast.success('Hoàn tất', 'Tất cả các lớp đều đã có học phí chuẩn, không cần cập nhật thêm.');
                }
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        },

        async saveLocation() {
            const lat = parseFloat(document.getElementById('set-lat').value);
            const lng = parseFloat(document.getElementById('set-lng').value);
            const radius = parseInt(document.getElementById('set-radius').value) || 100;

            if (isNaN(lat) || isNaN(lng)) {
                return Toast.error('Lỗi', 'Tọa độ không hợp lệ');
            }

            try {
                await DB.updateSettings({
                    centerLat: lat,
                    centerLng: lng,
                    checkInRadius: radius
                });
                Toast.success('Thành công', 'Đã lưu cài đặt vị trí');
            } catch(e) {
                Toast.error('Lỗi', e.message);
            }
        }
    };
});
