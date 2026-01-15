// ملف JavaScript المشترك لجميع الصفحات

// 1. إدارة حالة المستخدم
const userState = {
    isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
    userData: JSON.parse(localStorage.getItem('userData') || '{}')
};

// 2. التحقق من تسجيل الدخول للصفحات المحمية
function checkAuth() {
    const protectedPages = ['dashboard.html', 'pos.html', 'inventory.html', 'customers.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage) && !userState.isLoggedIn) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// 3. تهيئة التنقل
function initNavigation() {
    // تحديث الرابط النشط
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage || 
            (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // معالجة تسجيل الخروج
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userData');
            window.location.href = 'index.html';
        });
    });
}

// 4. تهيئة المكونات
function initComponents() {
    // تهيئة التواريخ
    const dateElements = document.querySelectorAll('.current-date');
    dateElements.forEach(el => {
        const now = new Date();
        el.textContent = now.toLocaleDateString('ar-SA');
    });
    
    // تهيئة الوقت
    const timeElements = document.querySelectorAll('.current-time');
    timeElements.forEach(el => {
        function updateTime() {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('ar-SA');
        }
        updateTime();
        setInterval(updateTime, 1000);
    });
}

// 5. تهيئة كل شيء عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من المصادقة
    if (!checkAuth()) return;
    
    // تهيئة التنقل
    initNavigation();
    
    // تهيئة المكونات
    initComponents();
    
    // إضافة تأثيرات تفاعلية
    addHoverEffects();
    
    // تسجيل دخول تجريبي (للتطوير)
    setupDemoLogin();
});

// 6. وظائف مساعدة
function setupDemoLogin() {
    // للاستخدام التجريبي فقط
    if (window.location.search.includes('demo=true')) {
        userState.isLoggedIn = true;
        userState.userData = {
            name: 'أحمد محمد',
            role: 'مدير النظام',
            branch: 'الفرع الرئيسي'
        };
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userData', JSON.stringify(userState.userData));
    }
}

function addHoverEffects() {
    // إضافة تأثيرات Hover للبطاقات
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
}

// تصدير الدوال للاستخدام في ملفات أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        userState,
        checkAuth,
        initNavigation,
        initComponents
    };
}
