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
let displayedChapters = [];
let currentChapterIndex = -1;
let isReversed = false;
const batchSize = 20;
let scrollTimeout;

// ... (giữ nguyên LORE_KEYWORDS_MAP)

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    setupTheme();
    registerServiceWorker(); 
    
    // Setup Navigation Listeners
    setupNavigation();
    
    loadFontSize(); 
    setupScrollTracking();
    setupInfiniteScroll();
});

function setupNavigation() {
    const navToggle = document.getElementById('toggle-dark');
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('theme') || 'light';
            const isDark = currentTheme === 'dark' || currentTheme === 'amoled';
            setTheme(isDark ? 'light' : 'dark');
        });
    }

    document.getElementById('library-btn').onclick = () => switchView('library');
    document.getElementById('back-to-lib').onclick = () => switchView('library');
    document.getElementById('back-to-chapters').onclick = () => switchView('chapters');
    
    document.getElementById('next-chap').onclick = () => {
        if (currentChapterIndex < chapters.length - 1) openChapter(currentChapterIndex + 1);
    };

    document.getElementById('prev-chap').onclick = () => {
        if (currentChapterIndex > 0) openChapter(currentChapterIndex - 1);
    };

    // Sort & Jump
    document.getElementById('reverse-sort').onclick = toggleSort;
    document.getElementById('jump-to-chapter').onkeypress = (e) => {
        if (e.key === 'Enter') jumpToChapter(e.target.value);
    };
}

function toggleSort() {
    isReversed = !isReversed;
    renderChapterList(true); // Reset list
}

function jumpToChapter(num) {
    const chapterNum = parseInt(num);
    if (isNaN(chapterNum)) return;
    
    // Find index (assuming chapter_number meta or sequential)
    const index = chapters.findIndex(c => c.title.includes(chapterNum) || chapters.indexOf(c) + 1 === chapterNum);
    if (index !== -1) openChapter(index);
}

function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && chapterView.classList.contains('hidden') === false) {
            loadMoreChapters();
        }
    }, { threshold: 0.1 });

    observer.observe(document.getElementById('chapter-loading'));
}

// Load Chapters
async function loadChapters(novelId) {
    currentNovelId = novelId;
    isReversed = false; // Reset to default

    try {
        const res = await fetch(`/api/novel/${novelId}/chapters`);
        chapters = await res.json();

        document.getElementById('novel-title').innerText = novelId.replace(/-/g, " ").title();
        renderChapterList(true);
        switchView('chapters');
    } catch (error) {
        console.error('Failed to load chapters:', error);
    }
}

function renderChapterList(reset = false) {
    const list = document.getElementById('chapter-list');
    if (reset) {
        list.innerHTML = '';
        displayedChapters = [];
    }
    loadMoreChapters();
}

function loadMoreChapters() {
    const list = document.getElementById('chapter-list');
    const loading = document.getElementById('chapter-loading');
    
    const sortedChapters = isReversed ? [...chapters].reverse() : chapters;
    const start = displayedChapters.length;
    if (start >= sortedChapters.length) {
        loading.classList.add('hidden');
        return;
    }

    loading.classList.remove('hidden');
    const nextBatch = sortedChapters.slice(start, start + batchSize);
    
    const html = nextBatch.map((chap) => {
        const globalIndex = chapters.indexOf(chap);
        const progress = getChapterProgress(currentNovelId, globalIndex);
        const isRead = progress > 90;
        const inProgress = progress > 0 && progress <= 90;

        let statusIcon = '';
        if (isRead) statusIcon = `<span class="text-emerald-500 text-xs flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Đã đọc</span>`;
        else if (inProgress) statusIcon = `<span class="text-amber-500 text-xs font-medium">${Math.round(progress)}%</span>`;

        return `
        <div onclick="openChapter(${globalIndex})" 
             class="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-smooth flex justify-between items-center"
             tabindex="0" role="button">
            <span class="text-gray-700 dark:text-gray-200">${chap.title}</span>
            ${statusIcon}
        </div>`;
    }).join('');

    list.insertAdjacentHTML('beforeend', html);
    displayedChapters.push(...nextBatch);
    
    if (displayedChapters.length >= sortedChapters.length) {
        loading.classList.add('hidden');
    }
}
