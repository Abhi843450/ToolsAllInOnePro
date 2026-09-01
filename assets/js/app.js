/**
 * Freebuff — Dashboard Logic
 * Search, filter, category navigation
 */

document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const navToggle = document.getElementById('navToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (navToggle && mobileMenu) {
        navToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('navbar__mobile-menu--open');
        });
    }

    // Mobile category collapse/expand
    document.querySelectorAll('.navbar__mobile-heading').forEach(heading => {
        heading.addEventListener('click', () => {
            const targetId = heading.dataset.toggle;
            const items = document.getElementById(targetId);
            if (items) {
                items.classList.toggle('navbar__mobile-items--open');
                heading.classList.toggle('navbar__mobile-heading--open');
            }
        });
    });

    // Desktop dropdown click fallback (for touch devices)
    document.querySelectorAll('.nav-dropdown__trigger').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const dropdown = trigger.closest('.nav-dropdown');
            const menu = dropdown.querySelector('.nav-dropdown__menu');
            // Close all other menus
            document.querySelectorAll('.nav-dropdown__menu').forEach(m => {
                if (m !== menu) m.style.cssText = '';
            });
            // Toggle this menu
            if (menu.style.opacity === '1') {
                menu.style.cssText = '';
            } else {
                menu.style.opacity = '1';
                menu.style.visibility = 'visible';
                menu.style.transform = 'translateY(0)';
            }
        });
    });
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            document.querySelectorAll('.nav-dropdown__menu').forEach(m => m.style.cssText = '');
        }
    });

    const searchInput = document.getElementById('toolSearch');
    const toolsGrid = document.getElementById('toolsGrid');
    const noResults = document.getElementById('noResults');
    const categoryTabs = document.querySelectorAll('.category-tab');
    const toolCards = document.querySelectorAll('.tool-card');

    let activeCategory = 'all';

    // Smart back link
    const backLink = document.getElementById('backLink');
    if (backLink) {
        const referrer = backLink.dataset.referrer || '';
        const toolCategory = backLink.dataset.category || '';
        // If referrer has from= param, use it; else detect from URL
        const urlParams = new URLSearchParams(window.location.search);
        const fromCat = urlParams.get('from');
        if (fromCat) {
            backLink.querySelector('.back-link__text').textContent = getCategoryName(fromCat);
            backLink.href = '/?category=' + fromCat;
        }
        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (fromCat) {
                window.location.href = '/?category=' + fromCat;
            } else {
                // Always navigate home to avoid history.back() loops
                window.location.href = '/';
            }
        });
    }

    function getCategoryName(cat) {
        const names = {'downloaders':'Content Downloaders','documents':'Document Tools','converters':'Media Converters','text':'Text Tools','security':'Security & Encoding','developer':'Developer Tools','images':'Image Tools','pdf':'PDF Tools','social':'Social Media','seo':'SEO Tools','code':'Code Tools','data':'Data Tools'};
        return names[cat] || 'All Tools';
    }

    // URL category param on homepage
    if (toolsGrid) {
        const urlParams = new URLSearchParams(window.location.search);
        const catParam = urlParams.get('category');
        if (catParam) {
            activeCategory = catParam;
            categoryTabs.forEach(t => {
                t.classList.toggle('category-tab--active', t.dataset.category === catParam);
            });
            filterTools();
        }
    }

    // Search
    if (searchInput) {
        searchInput.addEventListener('input', filterTools);
    }

    // Category tabs
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('category-tab--active'));
            tab.classList.add('category-tab--active');
            activeCategory = tab.dataset.category;
            filterTools();
        });
    });

    function filterTools() {
        const query = (searchInput?.value || '').toLowerCase().trim();
        let visible = 0;

        toolCards.forEach(card => {
            const name = (card.dataset.name || '').toLowerCase();
            const category = card.dataset.category || '';

            const matchesSearch = !query || name.includes(query);
            const matchesCategory = activeCategory === 'all' || category === activeCategory;

            if (matchesSearch && matchesCategory) {
                card.style.display = '';
                visible++;
            } else {
                card.style.display = 'none';
            }
        });

        if (noResults) {
            noResults.classList.toggle('hidden', visible > 0);
        }
    }

    // ═══ Category Tabs Arrow Scroll ═══
    const catTabs = document.getElementById('categoryTabs');
    const scrollLeft = document.getElementById('catScrollLeft');
    const scrollRight = document.getElementById('catScrollRight');
    if (catTabs && scrollLeft && scrollRight) {
        const scrollAmount = 200;
        scrollLeft.addEventListener('click', () => catTabs.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
        scrollRight.addEventListener('click', () => catTabs.scrollBy({ left: scrollAmount, behavior: 'smooth' }));
        // Show/hide arrows based on scroll position
        const updateArrows = () => {
            scrollLeft.style.opacity = catTabs.scrollLeft <= 0 ? '0.3' : '1';
            scrollRight.style.opacity = catTabs.scrollLeft + catTabs.clientWidth >= catTabs.scrollWidth - 5 ? '0.3' : '1';
        };
        catTabs.addEventListener('scroll', updateArrows);
        updateArrows();
    }
});
