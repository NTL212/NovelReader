// DOM Elements
const libraryView = document.getElementById('library-view');
const chapterView = document.getElementById('chapter-view');
const readerView = document.getElementById('reader-view');
const librarySkeleton = document.getElementById('library-skeleton');
const emptyState = document.getElementById('empty-state');
const novelGrid = document.getElementById('novel-grid');
const progressBar = document.getElementById('reading-progress-bar');
const progressContainer = document.getElementById('reading-progress-container');

// State
let currentNovelId = '';
let chapters = [];
let currentChapterIndex = -1;
let currentPage = 1;
const chaptersPerPage = 10;
let scrollTimeout;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    setupTheme();
    // Navbar Dark/Light Toggle Logic (Outside Reader)
    const navToggle = document.getElementById('toggle-dark');
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('theme') || 'light';
            const isDark = currentTheme === 'dark' || currentTheme === 'amoled';
            setTheme(isDark ? 'light' : 'dark');
        });
    }

    loadFontSize(); // Restore font size preference
    setupScrollTracking();
});

// Theme and Settings Setup
function setupTheme() {
    // Settings Modal Toggle
    const settingsBtn = document.getElementById('reader-settings-btn');
    const settingsPanel = document.getElementById('settings-panel');

    // Toggle modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
        });
    }

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        if (settingsPanel && !settingsPanel.classList.contains('hidden') &&
            !settingsPanel.contains(e.target) &&
            e.target !== settingsBtn &&
            !settingsBtn.contains(e.target)) {
            settingsPanel.classList.add('hidden');
        }
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

// Set Theme Function
window.setTheme = function (theme) {
    // Remove all theme attributes first
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark'); // Remove Tailwind dark mode

    // Apply new theme
    document.documentElement.setAttribute('data-theme', theme);

    // Handle Tailwind Dark Mode compatibility
    if (theme === 'dark' || theme === 'amoled') {
        document.documentElement.classList.add('dark');
    }

    // Save preference
    localStorage.setItem('theme', theme);

    // Update active state in settings panel (visual feedback)
    updateThemeButtons(theme);
}

function updateThemeButtons(activeTheme) {
    const buttons = document.querySelectorAll('#settings-panel button[onclick^="setTheme"]');
    buttons.forEach(btn => {
        // Simple check based on onclick attribute content
        if (btn.getAttribute('onclick').includes(activeTheme)) {
            btn.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
            if (activeTheme === 'dark' || activeTheme === 'amoled') {
                btn.classList.add('ring-offset-zinc-800');
            } else {
                btn.classList.remove('ring-offset-zinc-800');
            }
        } else {
            btn.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2', 'ring-offset-zinc-800');
        }
    });

    // Also update main toggle icon in Navbar (if it exists - though we moved to reader settings)
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    if (moonIcon && sunIcon) {
        const isDark = activeTheme === 'dark' || activeTheme === 'amoled';
        if (isDark) {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        } else {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        }
    }
}

// Load Library with proper loading states
async function loadLibrary() {
    // Show skeleton, hide others
    librarySkeleton.classList.remove('hidden');
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
    novelGrid.classList.add('hidden');

    try {
        const res = await fetch('/api/library');
        const data = await res.json();

        // Hide skeleton
        librarySkeleton.classList.add('hidden');

        if (data.length === 0) {
            // Show empty state
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
            novelGrid.classList.add('hidden');
        } else {
            // Show novels
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
            novelGrid.classList.remove('hidden');

            // Check for last read
            const lastReadHtml = renderLastReadSection(data);

            novelGrid.innerHTML = data.map(novel => `
                <div onclick="loadChapters('${novel.id}')" 
                     class="group cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500 rounded-2xl"
                     tabindex="0"
                     role="button"
                     aria-label="Đọc truyện ${novel.title}"
                     onkeydown="if(event.key==='Enter') loadChapters('${novel.id}')">
                    <div class="novel-card aspect-[2/3] rounded-2xl mb-3 overflow-hidden border border-gray-200 dark:border-zinc-700 group-hover:border-emerald-500 transition-smooth flex flex-col items-center justify-center p-4">
                        <span class="text-gray-500 dark:text-zinc-400 group-hover:text-emerald-500 text-center font-semibold text-sm leading-tight mb-2">${novel.title}</span>
                        <div class="flex flex-wrap gap-1 justify-center">
                            ${novel.tags ? novel.tags.map(tag => `<span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] rounded-md border border-emerald-500/20 uppercase tracking-tighter">${tag}</span>`).join('') : ''}
                        </div>
                    </div>
                    <h3 class="font-medium text-sm text-gray-700 dark:text-gray-200 group-hover:text-emerald-500 transition-smooth truncate">${novel.title}</h3>
                </div>
            `).join('');

            // Prepend last read if exists
            if (lastReadHtml) {
                // Optional: Insert last read section above grid
                // For now, let's keep it simple or implement a separate "Continue Reading" banner later
            }
        }
    } catch (error) {
        console.error('Failed to load library:', error);
        librarySkeleton.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
    }
}

// Helper to render last read (placeholder for now)
function renderLastReadSection(novels) {
    const lastRead = JSON.parse(localStorage.getItem('last_read_session'));
    if (!lastRead) return '';
    // Implementation for "Continue Reading" banner can go here
    return '';
}

// Load Chapters
async function loadChapters(novelId) {
    currentNovelId = novelId;
    currentPage = 1; // Reset to page 1

    try {
        const res = await fetch(`/api/novel/${novelId}/chapters`);
        chapters = await res.json();

        document.getElementById('novel-title').innerText = novelId.replace(/-/g, " ").title();
        renderChapterListPage();
        switchView('chapters');
    } catch (error) {
        console.error('Failed to load chapters:', error);
    }
}

function renderChapterListPage() {
    const list = document.getElementById('chapter-list');
    const paginationEl = document.getElementById('chapter-list-pagination');
    const pageInfo = document.getElementById('page-info');
    
    const totalPages = Math.ceil(chapters.length / chaptersPerPage);
    const start = (currentPage - 1) * chaptersPerPage;
    const end = start + chaptersPerPage;
    const currentChapters = chapters.slice(start, end);

    // Show/Hide pagination
    if (totalPages > 1) {
        paginationEl.classList.remove('hidden');
        pageInfo.innerText = `Trang ${currentPage} / ${totalPages}`;
        document.getElementById('prev-page').disabled = currentPage === 1;
        document.getElementById('next-page').disabled = currentPage === totalPages;
    } else {
        paginationEl.classList.add('hidden');
    }

    list.innerHTML = currentChapters.map((chap, i) => {
        const globalIndex = start + i;
        const progress = getChapterProgress(currentNovelId, globalIndex);
        const isRead = progress > 90;
        const inProgress = progress > 0 && progress <= 90;

        let statusIcon = '';
        if (isRead) statusIcon = `<span class="text-emerald-500 text-xs flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Đã đọc
        </span>`;
        else if (inProgress) statusIcon = `<span class="text-amber-500 text-xs font-medium">${Math.round(progress)}%</span>`;

        return `
        <div onclick="openChapter(${globalIndex})" 
             class="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-smooth focus-within:ring-2 focus-within:ring-emerald-500 flex justify-between items-center"
             tabindex="0"
             role="button"
             aria-label="Đọc ${chap.title}"
             onkeydown="if(event.key==='Enter') openChapter(${globalIndex})">
            <span class="text-gray-700 dark:text-gray-200">${chap.title}</span>
            ${statusIcon}
        </div>
    `}).join('');
}

// Open Chapter
async function openChapter(index) {
    if (index < 0 || index >= chapters.length) return;
    currentChapterIndex = index;
    const chap = chapters[index];

    try {
        const res = await fetch(`/api/novel/${currentNovelId}/${chap.id}`);
        const data = await res.json();

        // Set Chapter Title and Content
        document.getElementById('current-chapter-title').innerText = chap.title;
        const contentEl = document.getElementById('reader-content');
        contentEl.innerHTML = data.content;

        // Update Pagination Info
        document.getElementById('chapter-pagination').innerText = `Chương ${index + 1} / ${chapters.length}`;

        // Mark session
        localStorage.setItem('last_read_session', JSON.stringify({
            novelId: currentNovelId,
            chapterIndex: index,
            chapterTitle: chap.title,
            timestamp: Date.now()
        }));

        // Restore scroll position
        const savedScroll = getSavedScroll(currentNovelId, index);
        if (savedScroll > 0) {
            // Slight delay to ensure content renders
            setTimeout(() => {
                window.scrollTo({ top: savedScroll, behavior: 'auto' });
            }, 50);
        } else {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }

        // Update navigation buttons state
        updateNavButtons();

        switchView('reader');
        // saveProgress is handled by scroll listener now
    } catch (error) {
        console.error('Failed to load chapter:', error);
    }
}

// Update navigation button states
function updateNavButtons() {
    const prevBtn = document.getElementById('prev-chap');
    const nextBtn = document.getElementById('next-chap');

    if (currentChapterIndex <= 0) {
        prevBtn.disabled = true;
        prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
        prevBtn.classList.remove('cursor-pointer');
    } else {
        prevBtn.disabled = false;
        prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        prevBtn.classList.add('cursor-pointer');
    }

    if (currentChapterIndex >= chapters.length - 1) {
        nextBtn.disabled = true;
        nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
        nextBtn.classList.remove('cursor-pointer');
    } else {
        nextBtn.disabled = false;
        nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        nextBtn.classList.add('cursor-pointer');
    }
}

// Switch Views with smooth transition
function switchView(view) {
    libraryView.classList.add('hidden');
    chapterView.classList.add('hidden');
    readerView.classList.add('hidden');
    progressContainer.classList.add('hidden'); // Default hide progress
    document.getElementById('reader-footer-nav').classList.add('hidden');

    if (view === 'library') {
        libraryView.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (view === 'chapters') {
        chapterView.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (view === 'reader') {
        readerView.classList.remove('hidden');
        progressContainer.classList.remove('hidden'); // Show progress in reader
        document.getElementById('reader-footer-nav').classList.remove('hidden');
    }
}

// Navigation Event Listeners
document.getElementById('library-btn').onclick = () => switchView('library');
document.getElementById('back-to-lib').onclick = () => switchView('library');
document.getElementById('back-to-chapters').onclick = () => switchView('chapters');

document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        renderChapterListPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.getElementById('next-page').onclick = () => {
    const totalPages = Math.ceil(chapters.length / chaptersPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderChapterListPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.getElementById('next-chap').onclick = () => {
    if (currentChapterIndex < chapters.length - 1) {
        openChapter(currentChapterIndex + 1);
    }
};

document.getElementById('prev-chap').onclick = () => {
    if (currentChapterIndex > 0) {
        openChapter(currentChapterIndex - 1);
    }
};

// Font Size Control
function changeFontSize(delta) {
    const el = document.getElementById('reader-content');
    const style = window.getComputedStyle(el, null).getPropertyValue('font-size');
    const currentSize = parseFloat(style);
    const newSize = Math.max(14, Math.min(28, currentSize + delta)); // Clamp between 14-28px
    el.style.fontSize = newSize + 'px';
    localStorage.setItem('reader-font-size', newSize);
}

// Load saved font size
function loadFontSize() {
    const savedSize = localStorage.getItem('reader-font-size');
    if (savedSize) {
        const el = document.getElementById('reader-content');
        if (el) el.style.fontSize = savedSize + 'px';
    }
}

// Save reading progress (Legacy simpler version)
function saveProgress(novelId, index) {
    localStorage.setItem(`progress_${novelId}`, index);
}

// --- NEW SCROLL TRACKING LOGIC ---

function setupScrollTracking() {
    window.addEventListener('scroll', () => {
        if (readerView.classList.contains('hidden')) return;

        // Cancel previous timeout
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }

        // Use requestAnimationFrame for smooth UI updates
        scrollTimeout = window.requestAnimationFrame(() => {
            updateProgress();
        });
    });
}

function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

    // Prevent division by zero
    if (docHeight <= 0) return;

    const scrollPercent = (scrollTop / docHeight) * 100;

    // Update UI
    progressBar.style.width = scrollPercent + '%';

    // Save to localStorage (Throttled could be better here, but for now simple check)
    if (currentNovelId && currentChapterIndex >= 0) {
        // Only save every 1% change or if multiple pixels moved to avoid spamming too much?
        // Actually localStorage sync is fast enough for text apps.

        const key = `scroll_${currentNovelId}_${currentChapterIndex}`;
        localStorage.setItem(key, Math.floor(scrollTop));

        // Also save percentage for chapter list view
        const progressKey = `percent_${currentNovelId}_${currentChapterIndex}`;
        localStorage.setItem(progressKey, scrollPercent.toFixed(1));
    }
}

function getSavedScroll(novelId, index) {
    const key = `scroll_${novelId}_${index}`;
    return parseInt(localStorage.getItem(key)) || 0;
}

function getChapterProgress(novelId, index) {
    const key = `percent_${novelId}_${index}`;
    return parseFloat(localStorage.getItem(key)) || 0;
}

// String title case helper
String.prototype.title = function () {
    return this.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    if (readerView && !readerView.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
            document.getElementById('prev-chap').click();
        } else if (e.key === 'ArrowRight') {
            document.getElementById('next-chap').click();
        }
    }
});
