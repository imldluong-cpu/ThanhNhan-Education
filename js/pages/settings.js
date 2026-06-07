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
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    render();

    window.SettingsPage = {
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
