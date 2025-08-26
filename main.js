// main.js: النسخة الكاملة والمحدثة لضمان عدم وجود أخطاء

import { state, initDOM } from './state.js';
import { drawScene, resizeCanvas } from './canvas2D.js';
import { switchTo3DView, close3DView, exportRendererAsPNG } from './scene3D.js';
import {
    activateTool, updatePropsUI, closeModals, saveDesign, loadDesign, newDesign,
    importDesignFromJSON, exportCanvasAsPNG, exportDesignAsJSON, finishPolywall
} from './ui.js';
import { recordHistory, undo, redo, updateUndoRedoButtons } from './history.js';

// --- معالجات الأحداث الرئيسية (Event Handlers) ---

function getEventPos(e) {
    if (e.touches && e.touches.length > 0) { e = e.touches[0]; }
    const rect = state.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function getTransformedPoint(e) {
    const pos = getEventPos(e);
    return { x: (pos.x - state.panX) / state.scale, y: (pos.y - state.panY) / state.scale };
}

function handleMouseDown(e) { handleSingleTouchStart(e); }
function handleMouseMove(e) { handleSingleTouchMove(e); }
function handleMouseUp(e) { handleSingleTouchEnd(e); }
function handleTouchStart(e) { e.preventDefault(); if (e.touches.length > 1) { handlePinchStart(e); return; } handleSingleTouchStart(e.touches[0]); }
function handleTouchMove(e) { e.preventDefault(); if (e.touches.length > 1) { handlePinchMove(e); return; } handleSingleTouchMove(e.touches[0]); }
function handleTouchEnd(e) { handleSingleTouchEnd(e); }

function handlePinchStart(e) {
    state.initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    state.lastScale = state.scale;
    state.isPanning = false;
    state.isDrawing = false;
    state.isDrawingPolywall = false;
}
function handlePinchMove(e) {
    if (state.initialPinchDistance <= 0) return;
    const currentPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const scaleRatio = currentPinchDistance / state.initialPinchDistance;
    const newScale = state.lastScale * scaleRatio;
    const midpoint = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
    const oldWorldPos = { x: (midpoint.x - state.panX) / state.scale, y: (midpoint.y - state.panY) / state.scale };
    state.scale = Math.max(0.2, Math.min(newScale, 5.0));
    const newWorldPos = { x: (midpoint.x - state.panX) / state.scale, y: (midpoint.y - state.panY) / state.scale };
    state.panX += (oldWorldPos.x - newWorldPos.x) * state.scale;
    state.panY += (oldWorldPos.y - newWorldPos.y) * state.scale;
    drawScene();
}

function handleSingleTouchStart(e) {
    const gridCellSize = 20;
    const pos = getTransformedPoint(e);
    const snappedX = Math.round(pos.x / gridCellSize) * gridCellSize;
    const snappedY = Math.round(pos.y / gridCellSize) * gridCellSize;

    state.touchStartTime = Date.now();
    state.touchStartPos = { x: e.clientX, y: e.clientY };
    state.isDraggingGesture = false;
    const currentTime = new Date().getTime(); const tapLength = currentTime - state.lastTap;
    if (tapLength < 300 && tapLength > 0) { if (state.activeTool === 'polywall') { finishPolywall(); return; } }
    state.lastTap = currentTime;

    if (state.activeTool === 'select') {
        state.selectedObject = null;
        for (let i = state.lights.length - 1; i >= 0; i--) { if (Math.hypot(pos.x - state.lights[i].x, pos.y - state.lights[i].y) < 15 / state.scale) { state.selectedObject = state.lights[i]; break; } }
        if (!state.selectedObject) { for (let i = state.furniture.length - 1; i >= 0; i--) { const item = state.furniture[i]; const rX = (pos.x - item.x) * Math.cos(-item.rotation * Math.PI / 180) - (pos.y - item.y) * Math.sin(-item.rotation * Math.PI / 180) + item.x; const rY = (pos.x - item.x) * Math.sin(-item.rotation * Math.PI / 180) + (pos.y - item.y) * Math.cos(-item.rotation * Math.PI / 180) + item.y; if (rX >= item.x && rX <= item.x + item.width && rY >= item.y && rY <= item.y + item.height) { state.selectedObject = item; break; } } }
        if (!state.selectedObject) { const tolerance = 10 / state.scale; for (let wall of state.walls) { const dist = Math.abs((wall.endY - wall.startY) * pos.x - (wall.endX - wall.startX) * pos.y + wall.endX * wall.startY - wall.endY * wall.startX) / Math.hypot(wall.endY - wall.startY, wall.endX - wall.startX); const isBetween = (pos.x >= Math.min(wall.startX, wall.endX) - tolerance) && (pos.x <= Math.max(wall.startX, wall.endX) + tolerance) && (pos.y >= Math.min(wall.startY, wall.endY) - tolerance) && (pos.y <= Math.max(wall.startY, wall.endY) + tolerance); if (dist < tolerance && isBetween) { state.selectedObject = wall; break; } } }
        if (state.selectedObject) { state.isDraggingObject = (state.selectedObject.type !== 'wall'); state.lastX = pos.x; state.lastY = pos.y; drawScene(); } else { state.isPanning = true; const clientPos = getEventPos(e); state.lastX = clientPos.x; state.lastY = clientPos.y; }
    }
    else if (state.activeTool === 'polywall') {
        if (!state.isDrawingPolywall) {
            state.isDrawingPolywall = true;
            state.polywallPoints.push({ x: snappedX, y: snappedY });
        } else {
            const finalX = state.previewEndpointX;
            const finalY = state.previewEndpointY;
            const lastPoint = state.polywallPoints[state.polywallPoints.length - 1];
            if (Math.hypot(finalX - lastPoint.x, finalY - lastPoint.y) > 0) {
                state.walls.push({ type: 'wall', id: `wall_${Date.now()}`, startX: lastPoint.x, startY: lastPoint.y, endX: finalX, endY: finalY });
                state.polywallPoints.push({ x: finalX, y: finalY });
                drawScene();
                recordHistory();
            }
        }
    }
    else if (state.activeTool === 'draw') { state.isDrawing = true; state.lastX = snappedX; state.lastY = snappedY; }
    else if (state.activeTool === 'door' || state.activeTool === 'window') {
        const openingWidth = 80; const tolerance = 10 / state.scale;
        for (let wall of state.walls) {
            const dist = Math.abs((wall.endY - wall.startY) * pos.x - (wall.endX - wall.startX) * pos.y + wall.endX * wall.startY - wall.endY * wall.startX) / Math.hypot(wall.endY - wall.startY, wall.endX - wall.startX);
            const isBetween = (pos.x >= Math.min(wall.startX, wall.endX) - tolerance) && (pos.x <= Math.max(wall.startX, wall.endX) + tolerance) && (pos.y >= Math.min(wall.startY, wall.endY) - tolerance) && (pos.y <= Math.max(wall.startY, wall.endY) + tolerance);
            if (dist < tolerance && isBetween) {
                const wallLength = Math.hypot(wall.endX - wall.startX, wall.endY - wall.startY);
                const wallDirX = (wall.endX - wall.startX) / wallLength;
                const wallDirY = (wall.endY - wall.startY) / wallLength;
                const clickDistFromStart = wallDirX * (pos.x - wall.startX) + wallDirY * (pos.y - wall.startY);
                if (clickDistFromStart > openingWidth / 2 && clickDistFromStart < wallLength - openingWidth / 2) {
                    const startX = wall.startX + wallDirX * (clickDistFromStart - openingWidth / 2);
                    const startY = wall.startY + wallDirY * (clickDistFromStart - openingWidth / 2);
                    if (state.activeTool === 'door') {
                        state.doors.push({ type: 'door', x: startX, y: startY, width: openingWidth, wallId: wall.id });
                    } else {
                        state.windows.push({ type: 'window', x: startX, y: startY, dx: wallDirX * openingWidth, dy: wallDirY * openingWidth, width: openingWidth, wallId: wall.id });
                    }
                    drawScene();
                    recordHistory();
                    break;
                }
            }
        }
    }
}

function handleSingleTouchMove(e) {
    if (!state.isDraggingGesture) {
        const moveDistance = Math.hypot(e.clientX - state.touchStartPos.x, e.clientY - state.touchStartPos.y);
        if (moveDistance > state.DRAG_THRESHOLD) { state.isDraggingGesture = true; }
    }

    if (state.isDraggingObject && state.selectedObject) {
        const pos = getTransformedPoint(e);
        const dx = pos.x - state.lastX;
        const dy = pos.y - state.lastY;
        state.selectedObject.x += dx;
        state.selectedObject.y += dy;
        state.lastX = pos.x;
        state.lastY = pos.y;
        drawScene();
    }
    else if (state.isPanning) {
        const clientPos = getEventPos(e);
        const dx = clientPos.x - state.lastX;
        const dy = clientPos.y - state.lastY;
        state.panX += dx;
        state.panY += dy;
        state.lastX = clientPos.x;
        state.lastY = clientPos.y;
        drawScene();
    }
    else if ((state.isDrawing && state.activeTool === 'draw') || (state.isDrawingPolywall && state.activeTool === 'polywall')) {
        const gridCellSize = 20;
        let finalX, finalY;
        const worldPos = getTransformedPoint(e);
        const screenPos = getEventPos(e);
        state.snappedPoint = null;
        let snapFound = false;

        for (const wall of state.walls) {
            const points = [{ x: wall.startX, y: wall.startY }, { x: wall.endX, y: wall.endY }];
            for (const point of points) {
                const screenPointX = point.x * state.scale + state.panX;
                const screenPointY = point.y * state.scale + state.panY;
                const distance = Math.hypot(screenPos.x - screenPointX, screenPos.y - screenPointY);
                if (distance < state.SNAP_DISTANCE) {
                    finalX = point.x;
                    finalY = point.y;
                    state.snappedPoint = point;
                    snapFound = true;
                    break;
                }
            }
            if (snapFound) break;
        }

        if (!snapFound) {
            finalX = Math.round(worldPos.x / gridCellSize) * gridCellSize;
            finalY = Math.round(worldPos.y / gridCellSize) * gridCellSize;
        }

        state.previewEndpointX = finalX;
        state.previewEndpointY = finalY;

        drawScene();
        const startPoint = state.activeTool === 'draw' ? { x: state.lastX, y: state.lastY } : state.polywallPoints[state.polywallPoints.length - 1];
        state.ctx.save();
        state.ctx.translate(state.panX, state.panY);
        state.ctx.scale(state.scale, state.scale);
        state.ctx.strokeStyle = '#aaa';
        state.ctx.lineWidth = 5 / state.scale;
        state.ctx.lineCap = 'round';
        state.ctx.beginPath();
        state.ctx.moveTo(startPoint.x, startPoint.y);
        state.ctx.lineTo(finalX, finalY);
        state.ctx.stroke();
        const length = Math.hypot(finalX - startPoint.x, finalY - startPoint.y);
        const lengthText = (length / 100).toFixed(2) + 'm';
        let angleDegrees;
        let angleForTextRotation = Math.atan2(finalY - startPoint.y, finalX - startPoint.x);
        if (state.activeTool === 'polywall' && state.polywallPoints.length >= 2) {
            const p1 = startPoint;
            const p0 = state.polywallPoints[state.polywallPoints.length - 2];
            const p2 = { x: finalX, y: finalY };
            const anglePrev = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            const angleCurr = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            let cornerAngle = (angleCurr - anglePrev) * (180 / Math.PI);
            if (cornerAngle < 0) { cornerAngle += 360; }
            angleDegrees = cornerAngle;
        } else {
            angleDegrees = angleForTextRotation * (180 / Math.PI);
            if (angleDegrees < 0) { angleDegrees += 360; }
        }
        const angleText = angleDegrees.toFixed(1) + '°';
        const midX = (startPoint.x + finalX) / 2;
        const midY = (startPoint.y + finalY) / 2;
        state.ctx.save();
        state.ctx.translate(midX, midY);
        state.ctx.rotate(angleForTextRotation);
        if (angleForTextRotation < -Math.PI / 2 || angleForTextRotation > Math.PI / 2) { state.ctx.rotate(Math.PI); }
        state.ctx.fillStyle = '#fff';
        state.ctx.font = `${12 / state.scale}px Arial`;
        state.ctx.textAlign = 'center';
        state.ctx.textBaseline = 'bottom';
        state.ctx.fillText(lengthText, 0, -8 / state.scale);
        state.ctx.textBaseline = 'top';
        state.ctx.fillText(angleText, 0, 8 / state.scale);
        state.ctx.restore();
        state.ctx.restore();
    }
}

function handleSingleTouchEnd(e) {
    if (state.activeTool === 'select' && !state.isDraggingGesture && state.selectedObject) {
        updatePropsUI();
    }

    if (state.isDrawing && state.activeTool === 'draw') {
        const sX = state.previewEndpointX;
        const sY = state.previewEndpointY;

        if (Math.hypot(sX - state.lastX, sY - state.lastY) > 0) {
            state.walls.push({ type: 'wall', id: `wall_${Date.now()}`, startX: state.lastX, startY: state.lastY, endX: sX, endY: sY });
        }
    }

    const wasDragging = state.isDraggingObject;
    state.isDrawing = false; state.isPanning = false; state.isDraggingObject = false; state.initialPinchDistance = 0;
    state.snappedPoint = null;
    
    drawScene();
    
    if (wasDragging || (state.activeTool === 'draw' && (e.type === 'mouseup' || e.type === 'touchend'))) {
        recordHistory();
    }
}

function handleMouseWheel(e) {
    e.preventDefault();
    const scaleFactor = 1.1;
    const d = e.deltaY > 0 ? -1 : 1;
    const nS = state.scale * (d > 0 ? scaleFactor : 1 / scaleFactor);
    const mX = e.offsetX, mY = e.offsetY;
    const oWX = (mX - state.panX) / state.scale, oWY = (mY - state.panY) / state.scale;
    state.scale = Math.max(0.2, Math.min(nS, 5.0));
    const nWX = (mX - state.panX) / state.scale, nWY = (mY - state.panY) / state.scale;
    state.panX += (oWX - nWX) * state.scale;
    state.panY += (oWY - nWY) * state.scale;
    drawScene();
}

function init() {
    initDOM();

    const furnitureHTML = `<h3>أثاث</h3> <div class="item" data-type="sofa">أريكة</div> <div class="item" data-type="bed">سرير</div> <div class="item" data-type="table">طاولة</div>`;
    state.sidebarFurnitureList.innerHTML = furnitureHTML;
    state.modalFurnitureList.innerHTML = furnitureHTML;
    const lightingHTML = `<h3>إضاءة</h3> <div class="item" data-type="ceiling-light">مصباح سقف</div> <div class="item" data-type="wall-light">إضاءة جدارية</div> <div class="item" data-type="table-lamp">مصباح طاولة</div>`;
    state.sidebarLightingList.innerHTML = lightingHTML;
    state.modalLightingList.innerHTML = lightingHTML;
    const furniturePropsHTML = `<h3>خصائص الأثاث</h3><label>العرض: <input type="range" id="prop-width-desk" min="20" max="300" step="10"></label><label>الطول: <input type="range" id="prop-height-desk" min="20" max="300" step="10"></label><label>الدوران: <input type="range" id="prop-rotation-desk" min="0" max="360" step="1"></label><label>اللون: <input type="color" id="prop-color-desk" value="#A0522D"></label><button id="duplicate-furniture-desk" class="utility-button">تكرار 📋</button><button id="delete-furniture-desk">حذف</button>`;
    state.sidebarFurnitureProps.innerHTML = furniturePropsHTML;
    state.modalFurnitureProps.innerHTML = furniturePropsHTML.replace(/-desk/g, '-modal');
    const lightingPropsHTML = `<h3>خصائص الإضاءة</h3> <label>شدة الإضاءة (لومن): <input type="range" id="light-intensity-desk" min="100" max="2000" step="50"></label> <label>لون الإضاءة: <input type="color" id="light-color-desk" value="#ffffff"></label> <button id="duplicate-light-desk" class="utility-button">تكرار 📋</button> <button id="delete-light-desk">حذف</button>`;
    state.sidebarLightingProps.innerHTML = lightingPropsHTML;
    state.modalLightingProps.innerHTML = lightingPropsHTML.replace(/-desk/g, '-modal');
    const wallPropsHTML = `<h3>خصائص الجدار</h3><label>لون الجدار: <input type="color" id="wall-color-desk" value="#ffffff"></label><button id="remove-wall-color-desk" class="utility-button">إزالة اللون (استعادة الصورة)</button><button id="delete-wall-desk">حذف الجدار</button>`;
    state.sidebarWallProps.innerHTML = wallPropsHTML;
    state.modalWallProps.innerHTML = wallPropsHTML.replace(/-desk/g, '-modal');

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.activeTool.includes('polywall') && state.isDrawingPolywall) {
            finishPolywall();
        }
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });

    state.canvas.addEventListener('mousedown', handleMouseDown);
    state.canvas.addEventListener('mousemove', handleMouseMove);
    state.canvas.addEventListener('mouseup', handleMouseUp);
    state.canvas.addEventListener('mouseout', handleMouseUp);
    state.canvas.addEventListener('contextmenu', e => { e.preventDefault(); finishPolywall(); });
    state.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    state.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    state.canvas.addEventListener('touchend', handleTouchEnd);
    state.canvas.addEventListener('wheel', handleMouseWheel);

    document.getElementById('select-tool').addEventListener('click', () => activateTool('select'));
    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('redo-btn').addEventListener('click', redo);
    document.getElementById('polywall-tool').addEventListener('click', () => activateTool('polywall'));
    document.getElementById('draw-tool').addEventListener('click', () => activateTool('draw'));
    document.getElementById('door-tool').addEventListener('click', () => activateTool('door'));
    document.getElementById('window-tool').addEventListener('click', () => activateTool('window'));
    document.getElementById('furniture-tool').addEventListener('click', () => activateTool('furniture'));
    document.getElementById('lighting-tool').addEventListener('click', () => activateTool('lighting'));
    document.getElementById('view-3d-tool').addEventListener('click', switchTo3DView);
    document.getElementById('close-3d-view').addEventListener('click', close3DView);
    document.getElementById('save-design-btn').addEventListener('click', saveDesign);
    document.getElementById('new-design-btn').addEventListener('click', newDesign);
    document.getElementById('import-btn').addEventListener('click', () => { state.importFileInput.click(); });
    state.importFileInput.addEventListener('change', importDesignFromJSON);

    const exportBtn = document.getElementById('export-btn');
    const exportOptions = document.getElementById('export-options');
    exportBtn.addEventListener('click', (e) => { e.stopPropagation(); exportOptions.classList.toggle('open'); });
    document.getElementById('export-2d-png').addEventListener('click', (e) => { e.preventDefault(); exportCanvasAsPNG(); exportOptions.classList.remove('open'); });
    document.getElementById('export-3d-btn').addEventListener('click', (e) => { e.preventDefault(); exportRendererAsPNG(); });
    document.getElementById('export-json').addEventListener('click', (e) => { e.preventDefault(); exportDesignAsJSON(); exportOptions.classList.remove('open'); });
    window.addEventListener('click', () => { if (exportOptions.classList.contains('open')) { exportOptions.classList.remove('open'); } });

    state.modalBackdrop.addEventListener('click', closeModals);

    document.querySelectorAll('.item').forEach(item => {
        item.addEventListener('click', () => {
            const type = item.getAttribute('data-type');
            let newItem = null;
            if (['sofa', 'bed', 'table'].includes(type)) {
                let w, h;
                switch (type) {
                    case 'sofa': w = 150; h = 80; break;
                    case 'bed': w = 150; h = 200; break;
                    case 'table': w = 100; h = 100; break;
                }
                newItem = { type: 'furniture', itemType: type, x: (state.canvas.width / 2 - state.panX) / state.scale - w / 2, y: (state.canvas.height / 2 - state.panY) / state.scale - h / 2, width: w, height: h, rotation: 0, color: '#A0522D' };
                state.furniture.push(newItem);
            } else if (['ceiling-light', 'wall-light', 'table-lamp'].includes(type)) {
                newItem = { type: 'light', lightType: type, x: (state.canvas.width / 2 - state.panX) / state.scale, y: (state.canvas.height / 2 - state.panY) / state.scale, intensity: 1000, color: '#ffffff' };
                state.lights.push(newItem);
            }
            activateTool('select');
            state.selectedObject = newItem;
            updatePropsUI();
            drawScene();
            recordHistory();
        });
    });

    document.querySelectorAll('.props-panel').forEach(panel => {
        panel.addEventListener('click', e => {
            if (e.target.tagName !== 'BUTTON' || !state.selectedObject) return;
            const objectToDelete = state.selectedObject;
            if (e.target.id.includes('delete')) {
                if (objectToDelete.type === 'furniture') {
                    state.furniture.splice(state.furniture.indexOf(objectToDelete), 1);
                } else if (objectToDelete.type === 'light') {
                    state.lights.splice(state.lights.indexOf(objectToDelete), 1);
                } else if (objectToDelete.type === 'wall') {
                    state.doors = state.doors.filter(d => d.wallId !== objectToDelete.id);
                    state.windows = state.windows.filter(w => w.wallId !== objectToDelete.id);
                    state.walls.splice(state.walls.indexOf(objectToDelete), 1);
                }
                state.selectedObject = null;
                closeModals();
                drawScene();
                recordHistory();
            } else if (e.target.id.includes('duplicate')) {
                if (state.selectedObject.type === 'wall') return;
                const newObject = JSON.parse(JSON.stringify(state.selectedObject));
                newObject.x += 20;
                newObject.y += 20;
                if (newObject.type === 'furniture') state.furniture.push(newObject);
                else if (newObject.type === 'light') state.lights.push(newObject);
                state.selectedObject = newObject;
                updatePropsUI();
                drawScene();
                recordHistory();
            } else if (e.target.id.includes('remove-wall-color')) {
                if (state.selectedObject && state.selectedObject.type === 'wall') {
                    state.selectedObject.color = null;
                    recordHistory();
                }
            }
        });

        panel.addEventListener('input', e => {
            if (!state.selectedObject) return;
            const input = e.target;
            if (state.selectedObject.type === 'furniture') {
                if (input.id.includes('prop-width')) state.selectedObject.width = parseInt(input.value);
                if (input.id.includes('prop-height')) state.selectedObject.height = parseInt(input.value);
                if (input.id.includes('prop-rotation')) state.selectedObject.rotation = parseInt(input.value);
                if (input.id.includes('prop-color')) state.selectedObject.color = input.value;
            } else if (state.selectedObject.type === 'light') {
                if (input.id.includes('light-intensity')) state.selectedObject.intensity = parseInt(input.value);
                if (input.id.includes('light-color')) state.selectedObject.color = input.value;
            } else if (state.selectedObject.type === 'wall') {
                if (input.id.includes('wall-color')) {
                    state.selectedObject.color = input.value;
                }
            }
            drawScene();
        });

        panel.addEventListener('change', e => {
            if (!state.selectedObject) return;
            if (e.target.type === 'range' || e.target.type === 'color') {
                recordHistory();
            }
        });
    });

    resizeCanvas();
    activateTool('select');
    loadDesign();
    recordHistory();
    updateUndoRedoButtons();
}

window.addEventListener('DOMContentLoaded', init);