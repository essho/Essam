// scene3D.js: لإدارة كل ما يتعلق بـ Three.js والمشهد ثلاثي الأبعاد (النسخة الكاملة والمصححة)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state } from './state.js';
import { resizeCanvas } from './canvas2D.js';

let scene, camera, renderer, renderLoopId, controls;

export function switchTo3DView() {
    state.appContainer.style.display = 'none';
    state.view3DContainer.style.display = 'block';
    init3D();
    buildSceneFrom2D();
    animate();
    
    const exposureSlider = document.getElementById('exposure-slider');
    if (exposureSlider) {
        exposureSlider.value = renderer.toneMappingExposure;
        exposureSlider.addEventListener('input', (event) => {
            const newExposure = parseFloat(event.target.value);
            if (renderer) {
                renderer.toneMappingExposure = newExposure;
            }
        });
    }
}

export function close3DView() {
    cancelAnimationFrame(renderLoopId);
    state.view3DContainer.style.display = 'none';
    state.appContainer.style.display = 'block';
    if (renderer) {
        renderer.dispose();
        state.rendererContainer.innerHTML = '';
    }
    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    resizeCanvas();
}

export function exportRendererAsPNG() {
    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'view-3d.png';
    link.click();
}

function init3D() { 
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x282c34); 
    camera = new THREE.PerspectiveCamera(75, state.rendererContainer.clientWidth / state.rendererContainer.clientHeight, 1, 10000); 
    camera.position.set(300, 450, 500); 
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); 
    renderer.setSize(state.rendererContainer.clientWidth, state.rendererContainer.clientHeight); 
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 0.1;
    state.rendererContainer.appendChild(renderer.domElement); 
    controls = new OrbitControls(camera, renderer.domElement); 
    controls.enableDamping = true; 
    controls.target.set(200, 0, -200); 
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    scene.add(ambientLight); 
}

function createWall(startX, startY, endX, endY, height, thickness, material) { 
    const wallLength = Math.hypot(endX - startX, endY - startY); 
    const wallAngle = Math.atan2(endY - startY, endX - startX); 
    const shape = new THREE.Shape(); 
    shape.moveTo(0, 0); 
    shape.lineTo(wallLength, 0); 
    shape.lineTo(wallLength, height); 
    shape.lineTo(0, height); 
    shape.lineTo(0, 0); 
    const extrudeSettings = { depth: thickness, bevelEnabled: false }; 
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings); 
    geometry.translate(0, 0, -thickness / 2); 
    const mesh = new THREE.Mesh(geometry, material); 
    mesh.rotation.y = wallAngle; 
    mesh.position.set(startX, 0, -startY); 
    mesh.castShadow = true; 
    mesh.receiveShadow = true; 
    return mesh; 
}

function buildSceneFrom2D() {
    const WALL_HEIGHT = 250, WALL_THICKNESS = 15;
    const DOOR_HEIGHT = 210, WINDOW_HEIGHT = 100, WINDOW_SILL_HEIGHT = 90;
    const textureLoader = new THREE.TextureLoader();
    
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1.0 });
    textureLoader.load('assets/textures/wood.jpg', (texture) => { 
        texture.wrapS = THREE.RepeatWrapping; 
        texture.wrapT = THREE.RepeatWrapping; 
        texture.repeat.set(10, 10); 
        floorMaterial.map = texture; 
        floorMaterial.color.set(0xffffff); 
        floorMaterial.needsUpdate = true; 
    }, undefined, () => { console.error('Could not load wood.jpg.'); });
    
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    state.walls.forEach(wall => {
        const singleWallMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 1.0
        });

        if (wall.color) {
            singleWallMaterial.color.set(wall.color);
        } else {
            textureLoader.load('assets/textures/wall.jpg', (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(0.02, 0.02);
                singleWallMaterial.map = texture;
                singleWallMaterial.color.set(0xffffff);
                singleWallMaterial.needsUpdate = true;
            }, undefined, () => {
                console.error(`Could not load wall.jpg for wall.`);
            });
        }
        
        const wallMesh = createWall(wall.startX, wall.startY, wall.endX, wall.endY, WALL_HEIGHT, WALL_THICKNESS, singleWallMaterial);
        scene.add(wallMesh);
    });

    state.doors.forEach(door => { 
        const wall = state.walls.find(w => w.id === door.wallId);
        if (!wall) return;
        const len = Math.hypot(wall.endX - wall.startX, wall.endY - wall.startY); 
        if (len === 0) return; 
        const geom = new THREE.BoxGeometry(door.width, DOOR_HEIGHT, WALL_THICKNESS + 1); 
        geom.translate(0, DOOR_HEIGHT / 2, 0); 
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.1 }); 
        const mesh = new THREE.Mesh(geom, doorMaterial); 
        const dirX = (wall.endX - wall.startX) / len; 
        const dirY = (wall.endY - wall.startY) / len; 
        const wallAngle = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX); 
        const midX = door.x + dirX * (door.width / 2); 
        const midY = door.y + dirY * (door.width / 2); 
        mesh.rotation.y = wallAngle; 
        mesh.position.set(midX, 0, -midY); 
        mesh.castShadow = true; 
        mesh.receiveShadow = true; 
        scene.add(mesh); 
    });

    state.windows.forEach(win => { 
        const wall = state.walls.find(w => w.id === win.wallId);
        if (!wall) return;
        const len = Math.hypot(wall.endX - wall.startX, wall.endY - wall.startY); 
        if (len === 0) return; 
        const w = win.width ?? Math.hypot(win.dx || 0, win.dy || 0); 
        const geom = new THREE.BoxGeometry(w, WINDOW_HEIGHT, WALL_THICKNESS + 1); 
        geom.translate(0, WINDOW_HEIGHT / 2, 0); 
        const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x60A3D9, transparent: true, opacity: 0.5, roughness: 0.1 }); 
        const mesh = new THREE.Mesh(geom, windowMaterial); 
        mesh.name = "window_mesh"; 
        const dirX = (wall.endX - wall.startX) / len; 
        const dirY = (wall.endY - wall.startY) / len; 
        const wallAngle = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX); 
        const midX = win.x + dirX * (w / 2); 
        const midY = win.y + dirY * (w / 2); 
        mesh.rotation.y = wallAngle; 
        mesh.position.set(midX, WINDOW_SILL_HEIGHT, -midY); 
        mesh.castShadow = false; 
        mesh.receiveShadow = true; 
        scene.add(mesh); 
    });

const loader = new GLTFLoader();
    const furnitureModels = {
        'sofa': 'assets/models/sofa.glb',
        'table': 'assets/models/coffeetable.glb',
        'bed': 'assets/models/bed.glb'
    };
    const MODEL_TARGET_HEIGHTS = {
        'sofa': 75,
        'table': 45,
        'bed': 60
    };

    state.furniture.forEach(item => {
        const modelPath = furnitureModels[item.itemType];
        const defaultColor = '#A0522D';
        const hasCustomColor = item.color && item.color.toUpperCase() !== defaultColor;

        if (modelPath && !hasCustomColor) {
            loader.load(modelPath, (gltf) => {
                const model = gltf.scene;
                const group = new THREE.Group();

                model.traverse(function (node) {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                const targetHeight = MODEL_TARGET_HEIGHTS[item.itemType] || 70;
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const scale = targetHeight / size.y;
                model.scale.set(scale, scale, scale);
                
                // === التعديل المهم يبدأ هنا ===
                // نعيد حساب الصندوق بعد تغيير الحجم للحصول على الأبعاد الصحيحة
                const newBox = new THREE.Box3().setFromObject(model);
                const center = newBox.getCenter(new THREE.Vector3());
                
                // بدلاً من توسيط النموذج عند الصفر، نقوم بتعديل موضعه
                // بحيث تكون أدنى نقطة فيه (newBox.min.y) هي نقطة الصفر
                model.position.set(
                    -center.x,
                    -newBox.min.y, // <-- هذا هو التغيير الرئيسي: يرفع النموذج ليقف على الأرض
                    -center.z
                );
                // === التعديل المهم ينتهي هنا ===

                group.add(model);
                group.position.set(item.x, 0, -item.y);
                group.rotation.y = (item.rotation * Math.PI / 180);

                scene.add(group);
            });
        } 
        else {
            // الكود البديل لرسم الصناديق يبقى كما هو
            const FURNITURE_HEIGHTS = { 'sofa': 70, 'bed': 60, 'table': 75 };
            const itemHeight = FURNITURE_HEIGHTS[item.itemType] || 50;
            const furnitureGeom = new THREE.BoxGeometry(item.width, itemHeight, item.height);
            furnitureGeom.translate(item.width / 2, itemHeight / 2, -item.height / 2);
            const furnitureMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(item.color || defaultColor), roughness: 0.8, metalness: 0.1 });
            const furnitureMesh = new THREE.Mesh(furnitureGeom, furnitureMaterial);
            furnitureMesh.castShadow = true;
            furnitureMesh.receiveShadow = true;
            furnitureMesh.position.set(item.x, 0, -item.y);
            furnitureMesh.rotation.y = (item.rotation * Math.PI / 180);
            scene.add(furnitureMesh);
        }
    });    
    const sortedLights = [...state.lights].sort((a, b) => b.intensity - a.intensity);
    const limitedLights = sortedLights.slice(0, 15);
    
    if (state.lights.length > 15) {
        alert(`تحذير: لقد تجاوزت الحد المسموح به وهو 15 مصباحاً. سيتم عرض أكثر 15 مصباحاً سطوعاً فقط في المشهد ثلاثي الأبعاد.`);
    }

    limitedLights.forEach(light => {
        let lightYPosition = WALL_HEIGHT - 40;
        if (light.lightType === 'wall-light') { lightYPosition = 180; }
        else if (light.lightType === 'table-lamp') { lightYPosition = 85; }
        const lightColor = new THREE.Color(light.color);
        const pointLight = new THREE.PointLight(lightColor, light.intensity * 5, 1500, 1);
        pointLight.position.set(light.x, lightYPosition, -light.y);
        pointLight.castShadow = true;
        pointLight.shadow.mapSize.width = 1024;
        pointLight.shadow.mapSize.height = 1024;
        scene.add(pointLight);
        const bulbGeom = new THREE.SphereGeometry(5);
        const bulbMat = new THREE.MeshBasicMaterial({ color: lightColor });
        const bulb = new THREE.Mesh(bulbGeom, bulbMat);
        bulb.position.copy(pointLight.position);
        scene.add(bulb);
    });
}

function animate() { 
    renderLoopId = requestAnimationFrame(animate); 
    if(controls) controls.update(); 
    renderer.render(scene, camera); 
}