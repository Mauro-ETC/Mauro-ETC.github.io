// Configuration
const CONFIG = {
    pages: ['about', 'video', 'animation', 'programming', 'motion', 'achievements'],
    animationDuration: {
        fade: 0,
        scroll: 0,
        projectDelay: 0
    },
    scrollDebounceDelay: 1500,
    intersectionThreshold: 0.05
};

// State Management
class AppState {
    constructor() {
        this.currentPageIndex = 0;
        this.isTransitioning = false;
        this.isScrolling = false;
        this.lastIntersectingSection = null;
    }

    setTransitioning(value) {
        this.isTransitioning = value;
    }

    setScrolling(value) {
        this.isScrolling = value;
    }

    setCurrentPageIndex(index) {
        if (index >= 0 && index < CONFIG.pages.length) {
            this.currentPageIndex = index;
            return true;
        }
        return false;
    }
}

// DOM Manager
class DOMManager {
    constructor() {
        this.elements = {
            cursor: document.querySelector('.cursor'),
            content: document.querySelector('.content'),
            loading: document.querySelector('.loading'),
            navLinks: document.querySelectorAll('nav a[data-target]')
        };
        this.sections = {};
    }

    createSections() {
        this.elements.content.innerHTML = '';
        CONFIG.pages.forEach(pageName => {
            const section = document.createElement('section');
            section.id = pageName;
            section.className = 'page-section';
            this.elements.content.appendChild(section);
            this.sections[pageName] = section;
        });
    }

    async updateNavLinks(currentPage) {
        this.elements.navLinks.forEach(async link => {
            link.classList.toggle('active', link.getAttribute('data-target') === currentPage);
            if (link.classList.contains('active')) { // Only check scrollBlock
                await window.pageNav.execClick({ target: link }, false);
            }
        });
    }

    async fadeTransition(targetSection, callback) {
        // Add transitioning class to apply red tint
        targetSection.classList.add('red-tint');

        // Fade out all sections
        Object.values(this.sections).forEach(section => {
            section.classList.add('red-tint', 'transparent-mode');
        });

        await new Promise(resolve => setTimeout(resolve, CONFIG.animationDuration.fade));

        if (callback) {
            await callback();
        }

        // Fade in target section
        targetSection.classList.remove('red-tint', 'transparent-mode');

        // Remove transitioning class to remove red tint
        targetSection.classList.remove('red-tint', 'transparent-mode');
    }
}

// Custom Cursor
class Cursor {
    constructor(domManager) {
        this.cursor = domManager.elements.cursor;
        this.links = document.querySelectorAll('a, button');
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.links.forEach(link => {
            link.addEventListener('mouseenter', () => this.cursor.classList.add('hover'));
            link.addEventListener('mouseleave', () => this.cursor.classList.remove('hover'));
        });
    }

    handleMouseMove({ clientX, clientY }) {
        this.cursor.style.transform = `translate(${clientX - 10}px, ${clientY - 10}px)`;
    }
}

// Content Loader
class ContentLoader {
    static async loadPage(pageName, section) {
        try {
            const response = await fetch(`${pageName}.html`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            section.innerHTML = html;
            return true;
        } catch (error) {
            console.error('Error loading content:', error);
            section.innerHTML = '<p>Error loading content. Please try again.</p>';
            return false;
        }
    }
}

// Page Navigator
class PageNavigator {
    constructor() {
        this.state = new AppState();
        this.domManager = new DOMManager();
        this.setupApplication();
    }

    async setupApplication() {
        this.domManager.createSections();
        this.setupIntersectionObserver();
        this.bindEventListeners();
        await this.initialLoad();
    }

    setupIntersectionObserver() {
        const options = {
            threshold: CONFIG.intersectionThreshold,
            rootMargin: '0px'
        };

        this.observer = new IntersectionObserver(entries => {
            if (this.state.isTransitioning) return;

            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    const newIndex = CONFIG.pages.indexOf(sectionId);

                    if (newIndex !== this.state.currentPageIndex) {
                        this.state.setCurrentPageIndex(newIndex);
                        this.updateUI(sectionId);
                        this.state.lastIntersectingSection = sectionId;
                    }
                }
            });
        }, options);

        Object.values(this.domManager.sections).forEach(section => {
            this.observer.observe(section);
        });
    }

    bindEventListeners() {
        this.bindScrollHandler();
    }



    async execClick(e, scrollBlock = false) {
        if (scrollBlock) return;
        this.isScrolling = true;
        try {
            e.preventDefault();
        } catch (e) {}

        if (this.state.isTransitioning || this.state.isScrolling) return;

        const target = e.target.getAttribute('data-target');
        const targetIndex = CONFIG.pages.indexOf(target);

        if (targetIndex !== -1) {
            this.state.setCurrentPageIndex(targetIndex);
            await this.changePage(target);

        }
    }

    bindScrollHandler() {
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (this.state.isTransitioning) return;

            clearTimeout(scrollTimeout);
            this.state.setScrolling(true);

            scrollTimeout = setTimeout(() => {
                this.state.setScrolling(false);
                this.snapToNearestSection();
            }, CONFIG.scrollDebounceDelay);
        });
    }

    async changePage(pageName) {
        if (this.state.isTransitioning) return;

        const targetSection = this.domManager.sections[pageName];
        if (!targetSection) return;

        this.state.setTransitioning(true);

        await this.domManager.fadeTransition(targetSection, async() => {
            await ContentLoader.loadPage(pageName, targetSection);
        });

        this.scrollToSection(pageName);
        this.updateUI(pageName);

        setTimeout(() => {
            this.state.setTransitioning(false);
        }, CONFIG.animationDuration.fade);
    }

    scrollToSection(pageName) {
        const section = this.domManager.sections[pageName];
        if (!section) return;

        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    updateUI(pageName) {
        this.domManager.updateNavLinks(pageName);
    }

    snapToNearestSection() {
        if (this.state.isTransitioning || this.state.isScrolling) return;

        let closestSection = null;
        let closestDistance = Infinity;

        Object.entries(this.domManager.sections).forEach(([pageName, section]) => {
            const rect = section.getBoundingClientRect();
            const distance = Math.abs(rect.top);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestSection = pageName;
            }
        });

        if (closestSection && closestSection !== this.state.lastIntersectingSection) {
            this.scrollToSection(closestSection);
            this.state.currentPageIndex = CONFIG.pages.indexOf(closestSection);
            this.updateUI(closestSection);
            this.state.lastIntersectingSection = closestSection;
        }
    }

    async initialLoad() {
        await this.changePage('about');

        setTimeout(() => {
            this.domManager.elements.loading.classList.add('transparent-mode', 'gone-mode');

        }, 2000);

    }
}

// Application Initialization
const initializeApplication = async() => {
    new Cursor(new DOMManager());
    window.pageNav = new PageNavigator();
};

document.readyState === 'loading' ?
    document.addEventListener('DOMContentLoaded', initializeApplication) :
    initializeApplication();

// Hamburger menu functionality
const hamburger = document.querySelector(".hamburger");
const navLinks = document.querySelector(".nav-links");

hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    hamburger.classList.toggle("active");
});

const overlay = document.querySelector('.overlay');
hamburger.addEventListener('click', () => {
    overlay.classList.toggle('active');
});

navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        hamburger.classList.remove('active');
        overlay.classList.remove('active');
    });
});
//    controller