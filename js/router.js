// ============================================
// CLIENT-SIDE ROUTER
// ============================================

const Router = {
    currentPage: null,
    routes: {},

    register(name, renderFn) {
        this.routes[name] = renderFn;
    },

    async navigate(page) {
        if (!this.routes[page]) {
            console.warn(`Route not found: ${page}`);
            return;
        }

        // Update sidebar active state
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Render page
        const container = document.getElementById('page-content');
        container.innerHTML = '<div class="loading-page"><div class="spinner"></div></div>';
        container.classList.remove('fade-in');

        try {
            this.currentPage = page;
            await this.routes[page](container);
            container.classList.add('fade-in');

            // Reinitialize Lucide icons
            if (window.lucide) {
                lucide.createIcons();
            }

            // Update header breadcrumb
            Header.updateBreadcrumb(page);
        } catch (error) {
            console.error(`Error rendering page ${page}:`, error);
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="alert-triangle"></i>
                    <h3>Đã xảy ra lỗi</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="Router.navigate('dashboard')">
                        Về trang chủ
                    </button>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    },

    // Get page display name in Vietnamese
    getPageName(page) {
        const names = {
            'dashboard': 'Tổng quan',
            'students': 'Học viên',
            'classes': 'Lớp học',
            'schedule': 'Thời khóa biểu',
            'attendance': 'Điểm danh',
            'grades': 'Điểm số',
            'tuition': 'Học phí',
            'teacher-attendance': 'Chấm công',
            'finance': 'Tài chính',
            'users': 'Người dùng'
        };
        return names[page] || page;
    }
};

window.Router = Router;
