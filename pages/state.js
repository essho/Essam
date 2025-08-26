// state.js: استخدام "State Object" لإدارة كل متغيرات التطبيق.

export const state = {
    // متغيرات الحالة الرئيسية
    walls: [], doors: [], windows: [], furniture: [], lights: [],
    selectedObject: null,
    activeTool: 'select',

    // متغيرات الـ Canvas
    scale: 1.0,
    panX: 0,
    panY: 0,

    // متغيرات الرسم والتفاعل
    isDrawing: false, isPanning: false, isDraggingObject: false,
    lastX: 0, lastY: 0,
    isDrawingPolywall: false,
    polywallPoints: [],

    // متغيرات خاصة باللمس
    lastTap: 0, initialPinchDistance: 0, lastScale: 1,
    touchStartTime: 0,
    touchStartPos: { x: 0, y: 0 },
    isDraggingGesture: false,
    DRAG_THRESHOLD: 10,

    // متغيرات الالتقاط (Snapping)
    SNAP_DISTANCE: 15, // مسافة الالتقاط بالبكسل
    snappedPoint: null, // لتخزين النقطة التي تم الالتقاط إليها
    previewEndpointX: 0,
    previewEndpointY: 0,
    // عناصر الواجهة الرسومية (سيتم ملؤها لاحقاً)
    canvas: null, ctx: null, appContainer: null, view3DContainer: null, 
    rendererContainer: null, modalBackdrop: null, importFileInput: null,
    sidebarFurnitureList: null, sidebarLightingList: null, sidebarFurnitureProps: null, 
    sidebarLightingProps: null, sidebarWallProps: null, modalFurnitureList: null, 
    modalLightingList: null, modalFurnitureProps: null, modalLightingProps: null, 
    modalWallProps: null
};

// دالة لربط المتغيرات بعناصر الصفحة الفعلية
export function initDOM() {
    state.canvas = document.getElementById('drawing-canvas');
    state.ctx = state.canvas.getContext('2d');
    state.appContainer = document.getElementById('app-container');
    state.view3DContainer = document.getElementById('view-3d-container');
    state.rendererContainer = document.getElementById('renderer-container');
    state.modalBackdrop = document.getElementById('modal-backdrop');
    state.importFileInput = document.getElementById('import-file-input');
    state.sidebarFurnitureList = document.getElementById('sidebar-furniture-list');
    state.sidebarLightingList = document.getElementById('sidebar-lighting-list');
    state.sidebarFurnitureProps = document.getElementById('sidebar-furniture-props');
    state.sidebarLightingProps = document.getElementById('sidebar-lighting-props');
    state.sidebarWallProps = document.getElementById('sidebar-wall-props');
    state.modalFurnitureList = document.getElementById('modal-furniture-list');
    state.modalLightingList = document.getElementById('modal-lighting-list');
    state.modalFurnitureProps = document.getElementById('modal-furniture-props');
    state.modalLightingProps = document.getElementById('modal-lighting-props');
    state.modalWallProps = document.getElementById('modal-wall-props');
}