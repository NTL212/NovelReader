// DOM Elements
const libraryView = document.getElementById('library-view');
const chapterView = document.getElementById('chapter-view');
const readerView = document.getElementById('reader-view');
const librarySkeleton = document.getElementById('library-skeleton');
const emptyState = document.getElementById('empty-state');
const novelGrid = document.getElementById('novel-grid');

// State
let currentNovelId = '';
let chapters = [];
let currentChapterIndex = -1;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    setupTheme();
});

// Theme Setup with icon toggle
function setupTheme() {
    const btn = document.getElementById('toggle-dark');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');

    function updateIcons(isDark) {
        if (isDark) {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        } else {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        }
    }

    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateIcons(isDark);
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        updateIcons(false);
    } else {
        updateIcons(true);
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

            novelGrid.innerHTML = data.map(novel => `
                <div onclick="loadChapters('${novel.id}')" 
                     class="group cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500 rounded-2xl"
                     tabindex="0"
                     role="button"
                     aria-label="Đọc truyện ${novel.title}"
                     onkeydown="if(event.key==='Enter') loadChapters('${novel.id}')">
                    <div class="novel-card aspect-[2/3] rounded-2xl mb-3 overflow-hidden border border-gray-200 dark:border-zinc-700 group-hover:border-emerald-500 transition-smooth flex items-center justify-center p-4">
                        <span class="text-gray-500 dark:text-zinc-400 group-hover:text-emerald-500 text-center font-semibold text-sm leading-tight">${novel.title}</span>
                    </div>
                    <h3 class="font-medium text-sm text-gray-700 dark:text-gray-200 group-hover:text-emerald-500 transition-smooth truncate">${novel.title}</h3>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load library:', error);
        librarySkeleton.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
    }
}

// Load Chapters
async function loadChapters(novelId) {
    currentNovelId = novelId;

    try {
        const res = await fetch(`/api/novel/${novelId}/chapters`);
        chapters = await res.json();

        document.getElementById('novel-title').innerText = novelId.replace(/-/g, " ").title();
        const list = document.getElementById('chapter-list');

        list.innerHTML = chapters.map((chap, index) => `
            <div onclick="openChapter(${index})" 
                 class="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-smooth focus-within:ring-2 focus-within:ring-emerald-500"
                 tabindex="0"
                 role="button"
                 aria-label="Đọc ${chap.title}"
                 onkeydown="if(event.key==='Enter') openChapter(${index})">
                <span class="text-gray-700 dark:text-gray-200">${chap.title}</span>
            </div>
        `).join('');

        switchView('chapters');
    } catch (error) {
        console.error('Failed to load chapters:', error);
    }
}

// Open Chapter
async function openChapter(index) {
    if (index < 0 || index >= chapters.length) return;
    currentChapterIndex = index;
    const chap = chapters[index];

    try {
        const res = await fetch(`/api/novel/${currentNovelId}/${chap.id}`);
        const data = await res.json();

        const contentEl = document.getElementById('reader-content');
        contentEl.innerHTML = data.content;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Update navigation buttons state
        updateNavButtons();

        switchView('reader');
        saveProgress(currentNovelId, index);
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

    if (view === 'library') {
        libraryView.classList.remove('hidden');
    }
    if (view === 'chapters') {
        chapterView.classList.remove('hidden');
    }
    if (view === 'reader') {
        readerView.classList.remove('hidden');
    }

    // Scroll to top on view change
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Navigation Event Listeners
document.getElementById('library-btn').onclick = () => switchView('library');
document.getElementById('back-to-lib').onclick = () => switchView('library');
document.getElementById('back-to-chapters').onclick = () => switchView('chapters');

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
        document.getElementById('reader-content').style.fontSize = savedSize + 'px';
    }
}

// Save reading progress
function saveProgress(novelId, index) {
    localStorage.setItem(`progress_${novelId}`, index);
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
