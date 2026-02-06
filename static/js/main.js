const libraryView = document.getElementById('library-view');
const chapterView = document.getElementById('chapter-view');
const readerView = document.getElementById('reader-view');

let currentNovelId = '';
let chapters = [];
let currentChapterIndex = -1;

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    setupTheme();
});

function setupTheme() {
    const btn = document.getElementById('toggle-dark');
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.remove('dark');
    }
}

async function loadLibrary() {
    const res = await fetch('/api/library');
    const data = await res.json();
    
    libraryView.innerHTML = data.map(novel => `
        <div onclick="loadChapters('${novel.id}')" class="group cursor-pointer">
            <div class="aspect-[2/3] bg-zinc-800 rounded-xl mb-3 overflow-hidden border border-zinc-700 group-hover:border-emerald-500 transition-all flex items-center justify-center p-4">
                <span class="text-zinc-500 group-hover:text-emerald-400 text-center font-bold">${novel.title}</span>
            </div>
            <h3 class="font-medium text-sm group-hover:text-emerald-400">${novel.title}</h3>
        </div>
    `).join('');
}

async function loadChapters(novelId) {
    currentNovelId = novelId;
    const res = await fetch(`/api/novel/${novelId}/chapters`);
    chapters = await res.json();
    
    document.getElementById('novel-title').innerText = novelId.replace("-", " ").title();
    const list = document.getElementById('chapter-list');
    list.innerHTML = chapters.map((chap, index) => `
        <div onclick="openChapter(${index})" class="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 cursor-pointer hover:border-emerald-500">
            ${chap.title}
        </div>
    `).join('');

    switchView('chapters');
}

async function openChapter(index) {
    if (index < 0 || index >= chapters.length) return;
    currentChapterIndex = index;
    const chap = chapters[index];
    
    const res = await fetch(`/api/novel/${currentNovelId}/${chap.id}`);
    const data = await res.json();
    
    const contentEl = document.getElementById('reader-content');
    contentEl.innerHTML = data.content;
    window.scrollTo(0, 0);
    
    switchView('reader');
    saveProgress(currentNovelId, index);
}

function switchView(view) {
    libraryView.classList.add('hidden');
    chapterView.classList.add('hidden');
    readerView.classList.add('hidden');

    if (view === 'library') libraryView.classList.remove('hidden');
    if (view === 'chapters') chapterView.classList.remove('hidden');
    if (view === 'reader') readerView.classList.remove('hidden');
}

// Navigation Events
document.getElementById('library-btn').onclick = () => switchView('library');
document.getElementById('back-to-lib').onclick = () => switchView('library');
document.getElementById('back-to-chapters').onclick = () => switchView('chapters');

document.getElementById('next-chap').onclick = () => openChapter(currentChapterIndex + 1);
document.getElementById('prev-chap').onclick = () => openChapter(currentChapterIndex - 1);

function changeFontSize(delta) {
    const el = document.getElementById('reader-content');
    const style = window.getComputedStyle(el, null).getPropertyValue('font-size');
    const currentSize = parseFloat(style);
    el.style.fontSize = (currentSize + delta) + 'px';
}

function saveProgress(novelId, index) {
    localStorage.setItem(`progress_${novelId}`, index);
}

String.prototype.title = function() {
    return this.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
