document.addEventListener('DOMContentLoaded', () => {
    // 1. Khởi tạo Icons
    lucide.createIcons();

    // 2. Sticky Header & Active Nav Link
    const header = document.getElementById('header');
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

    window.addEventListener('scroll', () => {
        // Sticky Header
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Active Link Highlighting
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // 3. Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinksContainer = document.getElementById('nav-links');

    mobileMenuBtn.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');
    });

    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinksContainer.classList.remove('active');
        });
    });

    // 4. Scroll Animations (Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');

                // Staggered animation for child cards
                const cards = entry.target.querySelectorAll('.teacher-card, .course-card, .stat-item, .feature-icon');
                cards.forEach((card, i) => {
                    card.style.transitionDelay = `${i * 0.12}s`;
                    card.style.opacity = '0';
                    card.style.transform = 'perspective(800px) rotateX(10deg) translateY(30px)';
                    requestAnimationFrame(() => {
                        card.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
                        card.style.opacity = '1';
                        card.style.transform = 'perspective(800px) rotateX(0) translateY(0)';
                    });
                });

                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(element => {
        observer.observe(element);
    });

    // 5. Advanced 3D Effects
    // 5a. Mouse Parallax for Hero Collage
    const heroCollage = document.querySelector('.hero-collage');
    const heroSection = document.querySelector('.hero');
    if (heroCollage && heroSection) {
        // Keep the scroll parallax
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const heroHeight = heroSection.offsetHeight;
            if (scrollY < heroHeight) {
                const parallaxY = scrollY * 0.3;
                const parallaxScale = 1 + (scrollY * 0.0002);
                heroCollage.style.transform = `translateY(${parallaxY}px) scale(${parallaxScale})`;
            }
        }, { passive: true });

        // Add mouse move parallax for individual images
        const collageImages = document.querySelectorAll('.collage-img');
        heroSection.addEventListener('mousemove', (e) => {
            const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
            
            collageImages.forEach((img, index) => {
                const depth = (index % 3) + 1; // Different depths for different layers
                img.style.transform = `translate(${xAxis / depth}px, ${yAxis / depth}px)`;
            });
        });
        
        heroSection.addEventListener('mouseleave', () => {
            collageImages.forEach((img) => {
                img.style.transform = `translate(0px, 0px)`;
            });
        });
    }

    // 5b. 3D Tilt Effect for Cards
    const cards3D = document.querySelectorAll('.teacher-card, .course-card');
    cards3D.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Calculate rotation (-10 to 10 degrees)
            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        });
    });

    // 5. Tabs cho phần Chiêu Sinh
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and target content
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 6. Firebase Integration
    window.globalTeacherMap = {};
    window.fetchTeachersDataPromise = fetchTeachersData();
    
    const firebaseConfig = {
        apiKey: "AIzaSyB0X4HHNv-TqJAsyE9XKRXIxzB7yRO6v84",
        authDomain: "thanhnhaneducation-29a2f.firebaseapp.com",
        projectId: "thanhnhaneducation-29a2f",
        storageBucket: "thanhnhaneducation-29a2f.firebasestorage.app",
        messagingSenderId: "849842230265",
        appId: "1:849842230265:web:b4f852137e83633318a328"
    };

    if (window.firebase) {
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        
        async function fetchClassesData() {
            try {
                if (window.fetchTeachersDataPromise) {
                    await window.fetchTeachersDataPromise;
                }
                // Fetch Teachers
                const teachersSnap = await db.collection('users').where('role', '==', 'teacher').get();
                const teachers = {};
                teachersSnap.forEach(doc => {
                    teachers[doc.id] = doc.data();
                });

                // Fetch Classes
                const classesSnap = await db.collection('classes').get();
                const activeClasses = [];
                const upcomingClasses = [];
                
                classesSnap.forEach(doc => {
                    let data = doc.data();
                    
                    // Đồng bộ định dạng năm học giống phần mềm quản lý
                    if (data.academicYear && data.academicYear.indexOf(' - ') === -1) {
                        data.academicYear = data.academicYear.replace('-', ' - ');
                    }
                    if (!data.academicYear) data.academicYear = '2025 - 2026';
                    
                    // Lọc chỉ lấy năm học hiện tại
                    if (data.academicYear === '2026 - 2027') {
                        if (data.status === 'active') activeClasses.push({ id: doc.id, ...data });
                        else if (data.status === 'upcoming') upcomingClasses.push({ id: doc.id, ...data });
                    }
                });
                
                function formatCurrency(amount) {
                    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
                }
                
                function formatDate(dateStr) {
                    if (!dateStr) return '';
                    const d = new Date(dateStr);
                    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                }
                
                function getTeacherNames(teacherIds) {
                    if (!teacherIds || teacherIds.length === 0) return 'Chưa phân công';
                    return teacherIds.map(id => {
                        if (!teachers[id]) return '';
                        const rawName = (teachers[id].displayName || teachers[id].email || '').trim();
                        const key = rawName.toLowerCase();
                        return window.globalTeacherMap && window.globalTeacherMap[key] ? window.globalTeacherMap[key] : rawName;
                    }).filter(Boolean).join(', ') || 'Chưa phân công';
                }

                function renderClassCard(c, isUpcoming = false) {
                    const badgeHtml = isUpcoming ? `<div class="class-badge upcoming">Mới</div>` : '';
                    const startDateHtml = isUpcoming && c.startDate ? `<li><i data-lucide="clock"></i> Khai giảng: <strong>${formatDate(c.startDate)}</strong></li>` : '';
                    
                    return `
                        <div class="class-card">
                            ${badgeHtml}
                            <h3 class="class-title">${c.name}</h3>
                            <ul class="class-details">
                                ${startDateHtml}
                                <li><i data-lucide="book-open"></i> Môn: ${c.subject || 'Đang cập nhật'}</li>
                                <li><i data-lucide="user"></i> GV: ${getTeacherNames(c.teacherIds)}</li>
                                <li><i data-lucide="wallet"></i> Học phí: ${c.fee ? formatCurrency(c.fee) + '/tháng' : 'Theo bảng giá'}</li>
                            </ul>
                            <a href="https://zalo.me/0388877543" target="_blank" class="btn ${isUpcoming ? 'btn-primary' : 'btn-outline'}">${isUpcoming ? 'Giữ chỗ ngay' : 'Đăng ký bổ sung'}</a>
                        </div>
                    `;
                }

                const gridActive = document.getElementById('grid-lop-dang-day');
                const gridUpcoming = document.getElementById('grid-lop-sap-mo');

                if (gridActive) {
                    if (activeClasses.length > 0) {
                        gridActive.innerHTML = activeClasses.map(c => renderClassCard(c, false)).join('');
                    } else {
                        gridActive.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Hiện chưa có lớp nào đang dạy.</div>';
                    }
                }
                
                if (gridUpcoming) {
                    if (upcomingClasses.length > 0) {
                        gridUpcoming.innerHTML = upcomingClasses.map(c => renderClassCard(c, true)).join('');
                    } else {
                        gridUpcoming.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Hiện chưa có lớp nào chuẩn bị khai giảng.</div>';
                    }
                }
                
                lucide.createIcons();
                
            } catch (error) {
                console.error("Lỗi khi tải dữ liệu từ Firebase:", error);
                document.getElementById('grid-lop-dang-day').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--primary-red);">Lỗi kết nối dữ liệu. Vui lòng thử lại sau.</div>';
                document.getElementById('grid-lop-sap-mo').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--primary-red);">Lỗi kết nối dữ liệu. Vui lòng thử lại sau.</div>';
            }
        }
        
        fetchClassesData();
    }

    // 7. Google Sheets Teachers Integration
    async function fetchTeachersData() {
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRQqEkB66KPPZZotJLPyosS8A_coYHWx7ghereXtBTNrMrRPrDyIQ2iBaz-J86OdN-j9llEh5XUPilp/pub?gid=0&single=true&output=tsv';
        const container = document.getElementById('teachers-grid-container');
        if (!container) return;

        try {
            const response = await fetch(sheetUrl);
            const data = await response.text();
            
            // Parse TSV
            const rows = data.split('\n');
            // Remove header row
            rows.shift();
            
            let html = '';
            rows.forEach(row => {
                if (!row.trim()) return;
                const cols = row.split('\t');
                if (cols.length >= 4) {
                    const name = cols[0].trim();
                    const subject = cols[1].trim();
                    let rawImage = cols[2].trim().replace(/\\/g, '/');
                    // Tự động lấy tên file (nếu admin copy nhầm cả đường dẫn trên máy tính G:/...)
                    let parts = rawImage.split('/');
                    let filename = parts[parts.length - 1];
                    // Tự động thêm đuôi .jpg nếu admin quên nhập đuôi file
                    if (!filename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) && filename !== '') {
                        filename += '.jpg';
                    }
                    let image = filename ? 'assets/images/' + filename : '';
                    
                    // Remove enclosing quotes if any
                    let description = cols[3].trim();
                    if (description.startsWith('"') && description.endsWith('"')) {
                        description = description.substring(1, description.length - 1).replace(/""/g, '"');
                    }
                    
                    let objectPosition = 'center';
                    if (cols.length >= 5 && cols[4].trim()) {
                        objectPosition = cols[4].trim();
                    }
                    
                    // Xây dựng map tên hiển thị cho Firebase
                    if (cols.length >= 6 && cols[5].trim()) {
                        const firebaseNames = cols[5].split(',');
                        firebaseNames.forEach(fn => {
                            window.globalTeacherMap[fn.trim().toLowerCase()] = name;
                        });
                    }
                    
                    let imageStyle = `style="object-position: ${objectPosition};"`;
                    let imgContainerStyle = '';
                    
                    // Specific logic for 'contain' images like Cô Ngân
                    if (objectPosition.includes('contain')) {
                        imageStyle = `style="object-fit: contain; width: 100%; height: 100%;"`;
                        imgContainerStyle = `style="background-color: white; padding: 1.5rem;"`;
                    }
                    
                    html += `
                        <div class="teacher-card">
                            <div class="teacher-img" ${imgContainerStyle}>
                                <img src="${image}" alt="${name}" ${imageStyle}>
                            </div>
                            <div class="teacher-info">
                                <h4>${name}</h4>
                                <span>${subject}</span>
                                <p>${description}</p>
                            </div>
                        </div>
                    `;
                }
            });
            
            if (html.trim() !== '') {
                container.innerHTML = html;
            } else {
                container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Đang cập nhật danh sách giáo viên.</div>';
            }
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu giáo viên:", error);
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--primary-red);">Lỗi tải dữ liệu giáo viên. Vui lòng thử lại sau.</div>';
        }
    }
});
