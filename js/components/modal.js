// ============================================
// MODAL COMPONENT
// ============================================

const Modal = {
    show(options) {
        const { title, content, footer, size, onClose } = options;
        
        // Remove existing modal
        this.close();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'active-modal';
        
        overlay.innerHTML = `
            <div class="modal ${size === 'lg' ? 'modal-lg' : ''}">
                <div class="modal-header">
                    <h3>${title || ''}</h3>
                    <button class="btn-icon" onclick="Modal.close()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content || ''}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                Modal.close();
                if (onClose) onClose();
            }
        });

        document.body.appendChild(overlay);
        
        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        if (window.lucide) lucide.createIcons();
        return overlay;
    },

    close() {
        const modal = document.getElementById('active-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 250);
        }
    },

    confirm(options) {
        const { title, message, confirmText, cancelText, onConfirm, danger } = options;
        
        return this.show({
            title: title || 'Xác nhận',
            content: `<p style="color:var(--text-secondary);font-size:var(--font-size-sm);">${message}</p>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">${cancelText || 'Hủy'}</button>
                ${options.middleBtnText ? `<button class="btn btn-secondary" id="modal-middle-btn">${options.middleBtnText}</button>` : ''}
                <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText || 'Xác nhận'}</button>
            `
        });
    },

    // Helper to bind confirm button after showing
    bindConfirm(callback) {
        const btn = document.getElementById('modal-confirm-btn');
        if (btn) {
            btn.onclick = async () => {
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';
                try {
                    await callback();
                    Modal.close();
                } catch (e) {
                    btn.disabled = false;
                    btn.textContent = 'Thử lại';
                    Toast.error('Có lỗi xảy ra: ' + e.message);
                }
            };
        }
    },

    bindMiddle(callback) {
        const btn = document.getElementById('modal-middle-btn');
        if (btn) {
            btn.onclick = async () => {
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';
                try {
                    await callback();
                    Modal.close();
                } catch (e) {
                    btn.disabled = false;
                    btn.textContent = 'Thử lại';
                    Toast.error('Có lỗi xảy ra: ' + e.message);
                }
            };
        }
    }
};

window.Modal = Modal;
