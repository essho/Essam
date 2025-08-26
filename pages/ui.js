// ui.js: للتحكم في واجهة المستخدم، النوافذ، والأزرار.

import { state } from './state.js';
import { drawScene } from './canvas2D.js';
export function isMobile() { return window.innerWidth <= 768; }

export function openModal(modalElement) {
    closeModals();
    if(isMobile()) {
        modalElement.classList.add('open');
        document.getElementById('modal-backdrop').classList.add('open');
    } else {
        modalElement.style.display = 'block';
    }
}

export function closeModals() {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.item-list, .props-panel').forEach(p => { if(!p.closest('.modal')) p.style.display = 'none'; });
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('open');
}

export function updatePropsUI() {
    closeModals();
    if (!state.selectedObject) return;
    let targetPropsPanel;
    if (state.selectedObject.type === 'furniture') {
        targetPropsPanel = isMobile() ? state.modalFurnitureProps : state.sidebarFurnitureProps;
        targetPropsPanel.querySelector('input[id*="prop-width"]').value = state.selectedObject.width;
        targetPropsPanel.querySelector('input[id*="prop-height"]').value = state.selectedObject.height;
        targetPropsPanel.querySelector('input[id*="prop-rotation"]').value = state.selectedObject.rotation;
        targetPropsPanel.querySelector('input[id*="prop-color"]').value = state.selectedObject.color || '#A0522D';
    } else if (state.selectedObject.type === 'light') {
        targetPropsPanel = isMobile() ? state.modalLightingProps : state.sidebarLightingProps;
        targetPropsPanel.querySelector('input[id*="light-intensity"]').value = state.selectedObject.intensity;
        targetPropsPanel.querySelector('input[id*="light-color"]').value = state.selectedObject.color;
    } else if (state.selectedObject.type === 'wall') {
        targetPropsPanel = isMobile() ? state.modalWallProps : state.sidebarWallProps;
        targetPropsPanel.querySelector('input[id*="wall-color"]').value = state.selectedObject.color || '#ffffff';
    }
    if (targetPropsPanel) { if (isMobile()) openModal(targetPropsPanel); else targetPropsPanel.style.display = 'block'; }
}

export function activateTool(toolName) {
    finishPolywall();
    closeModals();
    state.selectedObject = null;
    state.activeTool = toolName;
    document.querySelectorAll('#top-toolbar button').forEach(b => b.classList.remove('active-tool'));
    document.getElementById(`${toolName}-tool`).classList.add('active-tool');
    state.canvas.style.cursor = toolName.includes('draw') || toolName.includes('polywall') ? 'crosshair' : toolName === 'select' ? 'default' : 'pointer';
    if (toolName === 'furniture') {
        const targetList = isMobile() ? state.modalFurnitureList : state.sidebarFurnitureList;
        openModal(targetList);
    } else if (toolName === 'lighting') {
        const targetList = isMobile() ? state.modalLightingList : state.sidebarLightingList;
        openModal(targetList);
    }
    drawScene();
}

export function finishPolywall() { 
    if (state.isDrawingPolywall) { 
        state.isDrawingPolywall = false; 
        state.polywallPoints = []; 
        drawScene(); 
    } 
}

// دوال الحفظ والاستيراد والتصدير
export function saveDesign() { 
    const designData = { walls: state.walls, doors: state.doors, windows: state.windows, furniture: state.furniture, lights: state.lights, panX: state.panX, panY: state.panY, scale: state.scale }; 
    localStorage.setItem('roomDesignerData', JSON.stringify(designData)); 
    alert('تم حفظ التصميم بنجاح!'); 
}
export function loadDesign() { 
    const savedData = localStorage.getItem('roomDesignerData'); 
    if (savedData) { 
        const designData = JSON.parse(savedData); 
        state.walls = designData.walls || []; 
        state.doors = designData.doors || []; 
        state.windows = designData.windows || []; 
        state.furniture = designData.furniture || []; 
        state.lights = designData.lights || []; 
        state.panX = designData.panX || 0; 
        state.panY = designData.panY || 0; 
        state.scale = designData.scale || 1.0; 
        drawScene(); 
    } 
}
export function newDesign() { 
    if (confirm('هل أنت متأكد أنك تريد البدء في تصميم جديد؟ سيتم فقدان العمل غير المحفوظ.')) { 
        state.walls = []; 
        state.doors = []; 
        state.windows = []; 
        state.furniture = []; 
        state.lights = []; 
        state.panX = 0; 
        state.panY = 0; 
        state.scale = 1.0; 
        state.selectedObject = null; 
        updatePropsUI(); 
        drawScene(); 
    } 
}
export function exportCanvasAsPNG() { 
    const dataURL = state.canvas.toDataURL('image/png'); 
    const link = document.createElement('a'); 
    link.href = dataURL; 
    link.download = 'plan-2d.png'; 
    link.click(); 
}
export function exportDesignAsJSON() { 
    try { 
        const designData = { walls: state.walls, doors: state.doors, windows: state.windows, furniture: state.furniture, lights: state.lights, panX: state.panX, panY: state.panY, scale: state.scale }; 
        const jsonString = JSON.stringify(designData, null, 2); 
        const blob = new Blob([jsonString], { type: 'application/json' }); 
        const url = URL.createObjectURL(blob); 
        const link = document.createElement('a'); 
        link.href = url; 
        link.download = 'design.json'; 
        link.click(); 
        URL.revokeObjectURL(url); 
    } catch (e) { 
        console.error("Error exporting JSON:", e); 
        alert("Error saving file."); 
    } 
}
export function importDesignFromJSON(event) { 
    const file = event.target.files[0]; 
    if (!file) { return; } 
    const reader = new FileReader(); 
    reader.onload = (e) => { 
        const jsonString = e.target.result; 
        try { 
            const designData = JSON.parse(jsonString); 
            if (designData && designData.walls) { 
                state.walls = designData.walls || []; 
                state.doors = designData.doors || []; 
                state.windows = designData.windows || []; 
                state.furniture = designData.furniture || []; 
                state.lights = designData.lights || []; 
                state.panX = designData.panX || 0; 
                state.panY = designData.panY || 0; 
                state.scale = designData.scale || 1.0; 
                closeModals(); 
                state.selectedObject = null; 
                drawScene(); 
                alert("تم استيراد التصميم بنجاح!"); 
            } else { 
                alert("خطأ: ملف JSON غير صالح."); 
            } 
        } catch (error) { 
            console.error("Error parsing JSON:", error); 
            alert("عذرًا، حدث خطأ أثناء قراءة الملف."); 
        } 
    }; 
    reader.onerror = () => { 
        console.error("Failed to read file."); 
        alert("عذرًا، فشل في قراءة الملف."); 
    }; 
    reader.readAsText(file); 
    event.target.value = null; 
}