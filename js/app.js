// ============================================
// MAIN APP - ENTRY POINT
// ============================================

const App = {
    async init() {
        console.log('🚀 Initializing Thành Nhân Education...');
        
        try {
            // Wait for Firebase Auth
            await Auth.init();
            
            // Listen for auth changes
            Auth.onAuthChange((user, userDoc) => {
                this.handleAuthChange(user, userDoc);
            });

            // Initial render based on auth state
            this.handleAuthChange(Auth.currentUser, Auth.currentUserDoc);
        } catch (error) {
            console.error('Init error:', error);
            this.showError(error);
        }
    },

    handleAuthChange(user, userDoc) {
        const loading = document.getElementById('loading-screen');
        const loginPage = document.getElementById('login-page');
        const appShell = document.getElementById('app-shell');

        // Hide loading
        loading.classList.add('hidden');

        if (!user) {
            // Not logged in - show login
            loginPage.style.display = '';
            appShell.style.display = 'none';
            this.renderLogin();
        } else if (!userDoc) {
            // User logged in but no Firestore doc yet - retry
            loginPage.style.display = 'none';
            appShell.style.display = 'none';
            loading.classList.remove('hidden');
            loading.innerHTML = `
                <div class="loading-content">
                    <div class="loading-logo">
                        <h2 style="color:var(--warning-400);">Đang kết nối dữ liệu...</h2>
                    </div>
                    <p style="color:var(--text-secondary);max-width:400px;text-align:center;">
                        Không thể kết nối Firestore. Vui lòng thử lại.
                    </p>
                    <button class="btn btn-primary" style="margin-top:var(--space-6);" onclick="location.reload()">
                        Tải lại trang
                    </button>
                    <button class="btn btn-secondary" style="margin-top:var(--space-3);" onclick="App.logout()">
                        Đăng xuất
                    </button>
                </div>
            `;
        } else if (userDoc.role === 'pending') {
            // Pending approval
            loginPage.style.display = '';
            appShell.style.display = 'none';
            this.renderPending();
        } else if (userDoc.status === 'inactive') {
            // Account disabled
            loginPage.style.display = '';
            appShell.style.display = 'none';
            this.renderDisabled();
        } else {
            // Logged in with valid role
            loginPage.style.display = 'none';
            appShell.style.display = '';
            this.renderApp();
        }
    },

    renderLogin() {
        const page = document.getElementById('login-page');
        page.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-logo">
                        <div class="login-logo-icon" style="background: white; padding: 4px; border-radius: 8px; width: 64px; height: 64px; margin: 0 auto 16px auto;">
                            <img src="assets/images/logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <h1>Thành Nhân Education</h1>
                        <p>Hệ thống quản lý trung tâm dạy thêm</p>
                    </div>

                    <button class="google-login-btn" onclick="App.loginWithGoogle()" id="google-login-btn">
                        <svg viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Đăng nhập bằng Google
                    </button>

                    <div class="login-divider">Tính năng hệ thống</div>

                    <div class="login-features">
                        <div class="login-feature">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            Quản lý học viên & lớp học
                        </div>
                        <div class="login-feature">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            Điểm danh & chấm điểm
                        </div>
                        <div class="login-feature">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
                            Quản lý học phí & tài chính
                        </div>
                        <div class="login-feature">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                            Phân quyền bảo mật 3 cấp
                        </div>
                    </div>

                    <div class="login-footer">
                        © 2026 Thành Nhân Education. All rights reserved.
                    </div>
                </div>
            </div>
        `;
    },

    renderPending() {
        const page = document.getElementById('login-page');
        const user = Auth.currentUser;
        page.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-logo">
                        <div class="login-logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 6v6l4 2"/>
                            </svg>
                        </div>
                        <h1>Chờ duyệt tài khoản</h1>
                        <p>Xin chào, ${user.displayName || user.email}</p>
                    </div>

                    <div class="login-status pending">
                        <strong>⏳ Tài khoản đang chờ duyệt</strong><br>
                        Quản trị viên cần gán vai trò cho bạn trước khi bạn có thể sử dụng hệ thống. Vui lòng liên hệ Chủ trung tâm.
                    </div>

                    <button class="btn btn-secondary" style="width:100%;margin-top:var(--space-6);" onclick="App.logout()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Đăng xuất
                    </button>
                </div>
            </div>
        `;
    },

    renderDisabled() {
        const page = document.getElementById('login-page');
        page.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-logo">
                        <div class="login-logo-icon" style="background:linear-gradient(135deg,#dc2626,#ef4444);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        </div>
                        <h1>Tài khoản bị khóa</h1>
                    </div>

                    <div class="login-status error">
                        Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Chủ trung tâm để được hỗ trợ.
                    </div>

                    <button class="btn btn-secondary" style="width:100%;margin-top:var(--space-6);" onclick="App.logout()">
                        Đăng xuất
                    </button>
                </div>
            </div>
        `;
    },

    renderApp() {
        // Render sidebar and header
        Sidebar.render();
        Header.render();

        // Navigate to dashboard
        Router.navigate('dashboard');
    },

    async loginWithGoogle() {
        const btn = document.getElementById('google-login-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Đang đăng nhập...';
        }
        try {
            await Auth.signInWithGoogle();
        } catch (error) {
            console.error('Login error:', error);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Đăng nhập bằng Google
                `;
            }
            Toast.error('Lỗi đăng nhập', error.message);
        }
    },

    async logout() {
        try {
            // Đóng sidebar trên mobile nếu đang mở
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) {
                overlay.classList.remove('active');
                overlay.remove(); // Xóa hẳn overlay khỏi DOM để tránh bị kẹt
            }

            await Auth.signOut();
            
            // Xóa cache và reset router
            localStorage.removeItem('academicYear');
            
            // Ép giao diện chuyển về màn hình đăng nhập
            document.getElementById('app-shell').style.display = 'none';
            document.getElementById('login-page').style.display = '';
            App.renderLogin();
            
            Toast.info('Đã đăng xuất thành công');
        } catch (error) {
            Toast.error('Lỗi', error.message);
        }
    },

    showError(error) {
        const loading = document.getElementById('loading-screen');
        loading.innerHTML = `
            <div class="loading-content">
                <div class="loading-logo">
                    <h2 style="color:var(--danger-400);">Lỗi khởi tạo</h2>
                </div>
                <p style="color:var(--text-secondary);max-width:400px;text-align:center;">
                    ${error.message}<br><br>
                    Vui lòng kiểm tra cấu hình Firebase trong file <code>js/firebase-config.js</code>
                </p>
                <button class="btn btn-primary" style="margin-top:var(--space-6);" onclick="location.reload()">
                    Tải lại trang
                </button>
            </div>
        `;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
