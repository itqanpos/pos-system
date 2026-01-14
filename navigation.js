// js/navigation.js

// Handle mobile menu
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navMenu = document.querySelector('.nav-menu');

if(mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('show');
    });
}

// Active link highlighting
const currentPage = window.location.pathname.split('/').pop();
const navLinks = document.querySelectorAll('.nav-menu a');

navLinks.forEach(link => {
    const linkPage = link.getAttribute('href').split('/').pop();
    if(linkPage === currentPage || 
       (currentPage === '' && linkPage === 'index.html')) {
        link.classList.add('active');
    } else {
        link.classList.remove('active');
    }
});

// Handle back navigation
const backButtons = document.querySelectorAll('.btn-back, .back-home');
backButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.history.back();
    });
});

// User session management
class SessionManager {
    constructor() {
        this.isLoggedIn = localStorage.getItem('loggedIn') === 'true';
        this.userData = JSON.parse(localStorage.getItem('userData') || '{}');
    }
    
    login(userData) {
        this.isLoggedIn = true;
        this.userData = userData;
        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    logout() {
        this.isLoggedIn = false;
        this.userData = {};
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('userData');
        window.location.href = 'pages/login.html';
    }
    
    checkAuth(redirectTo = 'pages/login.html') {
        if(!this.isLoggedIn && !window.location.href.includes('login.html')) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }
}

// Initialize session manager
window.sessionManager = new SessionManager();

// Protected route check
if(window.location.pathname.includes('dashboard') || 
   window.location.pathname.includes('pos') ||
   window.location.pathname.includes('inventory')) {
    sessionManager.checkAuth();
}

// Handle logout
const logoutButtons = document.querySelectorAll('.logout-btn');
logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionManager.logout();
    });
});
