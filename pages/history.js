// history.js: لإدارة سجل التغييرات ووظائف التراجع/الإعادة.

import { state } from './state.js';
import { drawScene } from './canvas2D.js';
import { updatePropsUI } from './ui.js';

const history = [];
let historyIndex = -1;

// دالة لأخذ لقطة من الحالة الحالية للتصميم
function takeSnapshot() {
    // نستخدم JSON لتحقيق "نسخ عميق" (deep copy) يمنع المشاكل المستقبلية
    return JSON.parse(JSON.stringify({
        walls: state.walls,
        doors: state.doors,
        windows: state.windows,
        furniture: state.furniture,
        lights: state.lights
    }));
}

// دالة لاستعادة حالة التصميم من لقطة معينة
function restoreState(snapshot) {
    state.walls = snapshot.walls;
    state.doors = snapshot.doors;
    state.windows = snapshot.windows;
    state.furniture = snapshot.furniture;
    state.lights = snapshot.lights;

    // إلغاء تحديد أي كائن بعد التراجع/الإعادة لتجنب الأخطاء
    state.selectedObject = null;
    
    // إعادة رسم كل شيء وتحديث الواجهة
    updatePropsUI();
    drawScene();
}

// الدالة الرئيسية لتسجيل تغيير في التاريخ
export function recordHistory() {
    // إذا قمنا بتغيير جديد بعد التراجع، نحذف "المستقبل" الذي تراجعنا عنه
    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }

    history.push(takeSnapshot());
    historyIndex++;

    // لتجنب استهلاك ذاكرة كبيرة، يمكننا تحديد حد أقصى للتاريخ
    if (history.length > 50) {
        history.shift(); // إزالة أقدم عنصر
        historyIndex--;
    }
    updateUndoRedoButtons();
}

export function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
    }
    updateUndoRedoButtons();
}

export function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
    }
    updateUndoRedoButtons();
}

// دالة لتفعيل/تعطيل أزرار التراجع والإعادة
export function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
}