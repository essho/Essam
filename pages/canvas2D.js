// canvas2D.js: يحتوي على جميع وظائف الرسم على Canvas (النسخة الكاملة والمصححة)

import { state } from './state.js';
import { hexToRgb } from './utils.js';

// الدالة الرئيسية لرسم المشهد بالكامل
export function drawScene() {
    if (!state.ctx) return;
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    drawLightingEffects();
    state.ctx.save();
    state.ctx.translate(state.panX, state.panY);
    state.ctx.scale(state.scale, state.scale);
    drawGrid();
    drawWalls();
    drawDoors();
    drawWindows();
    drawFurniture();
    drawLights();
    state.ctx.restore();
    drawSnapIndicator();
}

export function resizeCanvas() {
    const canvasContainer = document.getElementById('canvas-container');
    if (state.canvas && canvasContainer) {
        state.canvas.width = canvasContainer.offsetWidth;
        state.canvas.height = canvasContainer.offsetHeight;
        drawScene();
    }
}

// --- دوال الرسم المساعدة ---

function drawLightingEffects() {
    if (!state.canvas || state.canvas.width === 0 || state.canvas.height === 0) return;
    state.ctx.globalCompositeOperation = 'source-over';
    state.ctx.fillStyle = '#303030';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    state.ctx.globalCompositeOperation = 'lighter';
    for (let light of state.lights) {
        const screenX = light.x * state.scale + state.panX;
        const screenY = light.y * state.scale + state.panY;
        const lightRadius = (light.intensity / 3) * state.scale;
        const lightColor = hexToRgb(light.color);
        if (!lightColor) continue;
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = state.canvas.width;
        offscreenCanvas.height = state.canvas.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');
        let gradient = offscreenCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, lightRadius);
        gradient.addColorStop(0, `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, 0.9)`);
        gradient.addColorStop(1, `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, 0)`);
        offscreenCtx.fillStyle = gradient;
        offscreenCtx.beginPath();
        offscreenCtx.arc(screenX, screenY, lightRadius, 0, 2 * Math.PI);
        offscreenCtx.fill();
        const obstacles = [...state.walls, ...state.furniture];
        offscreenCtx.globalCompositeOperation = 'destination-out';
        offscreenCtx.fillStyle = 'black';
        for(const obstacle of obstacles) {
            if (obstacle.type === 'furniture') {
                const translatedX = light.x - obstacle.x;
                const translatedY = light.y - obstacle.y;
                const cos = Math.cos(-obstacle.rotation * Math.PI / 180);
                const sin = Math.sin(-obstacle.rotation * Math.PI / 180);
                const rotatedLightX = translatedX * cos - translatedY * sin;
                const rotatedLightY = translatedX * sin + translatedY * cos;
                if (rotatedLightX >= 0 && rotatedLightX <= obstacle.width && rotatedLightY >= 0 && rotatedLightY <= obstacle.height) { continue; }
            }
            let points = [];
            if (obstacle.type === 'furniture') {
                const cos = Math.cos(obstacle.rotation * Math.PI / 180);
                const sin = Math.sin(obstacle.rotation * Math.PI / 180);
                const w = obstacle.width; const h = obstacle.height;
                const p1 = { x: obstacle.x, y: obstacle.y };
                const p2 = { x: obstacle.x + w * cos, y: obstacle.y + w * sin };
                const p3 = { x: obstacle.x + w * cos - h * sin, y: obstacle.y + w * sin + h * cos };
                const p4 = { x: obstacle.x - h * sin, y: obstacle.y + h * cos };
                points = [p1, p2, p3, p4].map(p => ({ x: p.x * state.scale + state.panX, y: p.y * state.scale + state.panY }));
            } else if (obstacle.type === 'wall') {
                const p1 = { x: obstacle.startX, y: obstacle.startY };
                const p2 = { x: obstacle.endX, y: obstacle.endY };
                points = [p1, p2].map(p => ({ x: p.x * state.scale + state.panX, y: p.y * state.scale + state.panY }));
            }
            if (points.length < 2) continue;
            const segments = (obstacle.type === 'wall') ? 1 : points.length;
            for (let i = 0; i < segments; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                const v1x = p1.x - screenX, v1y = p1.y - screenY;
                const v2x = p2.x - screenX, v2y = p2.y - screenY;
                offscreenCtx.beginPath();
                offscreenCtx.moveTo(p1.x, p1.y);
                offscreenCtx.lineTo(p1.x + v1x * 100, p1.y + v1y * 100);
                offscreenCtx.lineTo(p2.x + v2x * 100, p2.y + v2y * 100);
                offscreenCtx.lineTo(p2.x, p2.y);
                offscreenCtx.closePath();
                offscreenCtx.fill();
            }
        }
        state.ctx.drawImage(offscreenCanvas, 0, 0);
    }
    state.ctx.globalCompositeOperation = 'source-over';
}

function drawGrid() { 
    state.ctx.strokeStyle = '#555'; 
    state.ctx.lineWidth = 0.5 / state.scale; 
    for (let x = -state.panX / state.scale; x < (state.canvas.width - state.panX) / state.scale; x += 20) { 
        state.ctx.beginPath(); 
        state.ctx.moveTo(x, -state.panY / state.scale); 
        state.ctx.lineTo(x, (state.canvas.height - state.panY) / state.scale); 
        state.ctx.stroke(); 
    } 
    for (let y = -state.panY / state.scale; y < (state.canvas.height - state.panY) / state.scale; y += 20) { 
        state.ctx.beginPath(); 
        state.ctx.moveTo(0, y); 
        state.ctx.lineTo((state.canvas.width - state.panX) / state.scale, y); 
        state.ctx.stroke(); 
    } 
}

function drawWalls() {
    state.ctx.strokeStyle = '#ddd';
    state.ctx.lineWidth = 5 / state.scale;
    state.ctx.lineCap = 'round';

    for (let i = 0; i < state.walls.length; i++) {
        const wall = state.walls[i];

        if (wall === state.selectedObject) {
            state.ctx.strokeStyle = '#ff0000';
        } else {
            state.ctx.strokeStyle = '#ddd';
        }

        // 1. رسم الجدار
        state.ctx.beginPath();
        state.ctx.moveTo(wall.startX, wall.startY);
        state.ctx.lineTo(wall.endX, wall.endY);
        state.ctx.stroke();

        // 2. رسم طول الجدار
        const length = Math.hypot(wall.endX - wall.startX, wall.endY - wall.startY);
        const lengthInMeters = (length / 100).toFixed(2) + 'm';
        const midX = (wall.startX + wall.endX) / 2;
        const midY = (wall.startY + wall.endY) / 2;
        const angle = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX);

        state.ctx.save();
        state.ctx.translate(midX, midY);
        state.ctx.rotate(angle);
        if (angle < -Math.PI / 2 || angle > Math.PI / 2) {
            state.ctx.rotate(Math.PI);
        }
        state.ctx.fillStyle = '#fff';
        state.ctx.font = `${12 / state.scale}px Arial`;
        state.ctx.textAlign = 'center';
        state.ctx.textBaseline = 'bottom';
        state.ctx.fillText(lengthInMeters, 0, -8 / state.scale);
        state.ctx.restore();

        // 3. رسم زاوية الركن بشكل دائم
        if (i > 0) {
            const prevWall = state.walls[i - 1];
            if (wall.startX === prevWall.endX && wall.startY === prevWall.endY) {
                const p0 = { x: prevWall.startX, y: prevWall.startY };
                const p1 = { x: wall.startX, y: wall.startY }; // الركن
                const p2 = { x: wall.endX, y: wall.endY };

                const anglePrev = Math.atan2(p1.y - p0.y, p1.x - p0.x);
                const angleCurr = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                let cornerAngle = (angleCurr - anglePrev) * (180 / Math.PI);
                if (cornerAngle < 0) {
                    cornerAngle += 360;
                }
                
                const angleText = cornerAngle.toFixed(1) + '°';
                
                state.ctx.fillStyle = '#00BFFF';
                state.ctx.font = `bold ${10 / state.scale}px Arial`;
                state.ctx.textAlign = 'center';
                state.ctx.textBaseline = 'middle';
                state.ctx.fillText(angleText, p1.x, p1.y - 15 / state.scale);
            }
        }
    }
    state.ctx.strokeStyle = '#ddd';
}

function drawDoors() { 
    state.ctx.lineWidth = 2 / state.scale; 
    for (let door of state.doors) { 
        // للعثور على الجدار الصحيح، نحتاج للبحث عنه بالـ ID
        const wall = state.walls.find(w => w.id === door.wallId);
        if (!wall) continue; // إذا تم حذف الجدار، لا ترسم الباب

        const wallAngle = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX); 
        state.ctx.save(); 
        state.ctx.translate(door.x, door.y); 
        state.ctx.rotate(wallAngle); 
        state.ctx.strokeStyle = '#CD853F'; 
        state.ctx.fillStyle = '#CD853F'; 
        state.ctx.beginPath(); 
        state.ctx.moveTo(0, 0); 
        state.ctx.lineTo(door.width, 0); 
        state.ctx.stroke(); 
        state.ctx.lineWidth = 1 / state.scale; 
        state.ctx.beginPath(); 
        state.ctx.arc(0, 0, door.width, 0, Math.PI / 2); 
        state.ctx.stroke(); 
        state.ctx.restore(); 
    } 
}

function drawWindows() { 
    state.ctx.strokeStyle = '#00BFFF'; 
    state.ctx.lineWidth = 7 / state.scale; 
    state.ctx.lineCap = 'butt'; 
    for (let win of state.windows) { 
        state.ctx.beginPath(); 
        state.ctx.moveTo(win.x, win.y); 
        state.ctx.lineTo(win.x + win.dx, win.y + win.dy); 
        state.ctx.stroke(); 
    } 
}

function drawFurniture() {
    state.ctx.strokeStyle = '#654321';
    state.ctx.lineWidth = 2 / state.scale;
    for (let item of state.furniture) {
        state.ctx.fillStyle = item.color || '#A0522D';
        state.ctx.save();
        state.ctx.translate(item.x, item.y);
        state.ctx.rotate(item.rotation * Math.PI / 180);
        state.ctx.fillRect(0, 0, item.width, item.height);
        state.ctx.strokeRect(0, 0, item.width, item.height);
        if (item === state.selectedObject) {
            state.ctx.strokeStyle = '#ff0000';
            state.ctx.lineWidth = 2 / state.scale;
            state.ctx.strokeRect(-1, -1, item.width + 2, item.height + 2);
            state.ctx.strokeStyle = '#654321';
        }
        state.ctx.restore();
    }
}

function drawLights() { 
    for (let light of state.lights) { 
        state.ctx.save(); 
        state.ctx.translate(light.x, light.y); 
        state.ctx.fillStyle = light.color; 
        state.ctx.strokeStyle = '#333'; 
        state.ctx.lineWidth = 1 / state.scale; 
        switch(light.lightType) { 
            case 'wall-light': 
                state.ctx.beginPath(); 
                state.ctx.moveTo(0, -10 / state.scale); 
                state.ctx.lineTo(0, 10 / state.scale); 
                state.ctx.stroke(); 
                state.ctx.beginPath(); 
                state.ctx.arc(0, 0, 8 / state.scale, -Math.PI / 2, Math.PI / 2); 
                state.ctx.fill(); 
                state.ctx.stroke(); 
                break; 
            case 'table-lamp': 
                state.ctx.beginPath(); 
                state.ctx.arc(0, 0, 8 / state.scale, 0, 2 * Math.PI); 
                state.ctx.fill(); 
                state.ctx.stroke(); 
                state.ctx.beginPath(); 
                state.ctx.moveTo(-6 / state.scale, 8 / state.scale); 
                state.ctx.lineTo(6 / state.scale, 8 / state.scale); 
                state.ctx.stroke(); 
                break; 
            default: 
                state.ctx.beginPath(); 
                state.ctx.arc(0, 0, 8 / state.scale, 0, 2 * Math.PI); 
                state.ctx.fill(); 
                state.ctx.stroke(); 
        } 
        if (light === state.selectedObject) { 
            state.ctx.strokeStyle = '#ff0000'; 
            state.ctx.lineWidth = 2 / state.scale; 
            state.ctx.beginPath(); 
            state.ctx.arc(0, 0, 10 / state.scale, 0, 2 * Math.PI); 
            state.ctx.stroke(); 
        } 
        state.ctx.restore(); 
    } 
}

// داخل canvas2D.js

function drawSnapIndicator() {
    if (state.snappedPoint) {
        state.ctx.save();
        state.ctx.translate(state.panX, state.panY);
        state.ctx.scale(state.scale, state.scale);
        
        state.ctx.strokeStyle = '#00BFFF'; // لون أزرق سماوي
        state.ctx.lineWidth = 2 / state.scale;
        state.ctx.beginPath();
        state.ctx.arc(state.snappedPoint.x, state.snappedPoint.y, state.SNAP_DISTANCE / state.scale, 0, 2 * Math.PI);
        state.ctx.stroke();
        
        state.ctx.restore();
    }
}