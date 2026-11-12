// --- Données et Configuration des Niveaux par Défaut ---
let defaultLevels = [
    {
        id: 1,
        name: "Niveau 1 - Rue Principale",
        length: 150,
        elements: [
            { type: "gate_add", z: 30, val: 10, x: -2 },
            { type: "gate_mult", z: 30, val: 2, x: 2 },
            { type: "enemy", z: 60, count: 15, x: 0 },
            { type: "obstacle", z: 90, type_obs: "tire", x: 0 },
            { type: "gate_mult", z: 110, val: 3, x: 0 },
            { type: "boss", z: 140, hp: 100, x: 0 }
        ]
    },
    {
        id: 2,
        name: "Niveau 2 - Avenue Industrielle",
        length: 200,
        elements: [
            { type: "gate_add", z: 30, val: 15, x: -2 },
            { type: "gate_mult", z: 30, val: 2, x: 2 },
            { type: "enemy", z: 70, count: 30, x: 0 },
            { type: "obstacle", z: 100, type_obs: "wall", x: 0 },
            { type: "gate_mult", z: 130, val: 4, x: 0 },
            { type: "enemy", z: 160, count: 50, x: 0 },
            { type: "boss", z: 190, hp: 250, x: 0 }
        ]
    },
    {
        id: 3,
        name: "Niveau 3 - Quartier du Boss Final",
        length: 250,
        elements: [
            { type: "gate_mult", z: 40, val: 3, x: -2 },
            { type: "gate_mult", z: 40, val: 3, x: 2 },
            { type: "enemy", z: 80, count: 60, x: 0 },
            { type: "obstacle", z: 120, type_obs: "tire", x: -1 },
            { type: "obstacle", z: 120, type_obs: "tire", x: 1 },
            { type: "gate_mult", z: 160, val: 5, x: 0 },
            { type: "boss", z: 230, hp: 500, x: 0 }
        ]
    }
];

let levels = JSON.parse(localStorage.getItem('mob_runner_levels')) || defaultLevels;

// --- Classe Principale du Jeu ---
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.isRunning = false;
        this.currentLevelIndex = 0;
        this.coins = parseInt(localStorage.getItem('mob_coins')) || 100;
        
        // Upgrades
        this.upgrades = {
            cadence: { level: 1, cost: 50 },
            damage: { level: 1, cost: 50 },
            revenue: { level: 1, cost: 50 }
        };

        // Player / Mob state
        this.playerGroup = [];
        this.playerX = 0;
        this.playerZ = 0;
        this.speed = 12;
        this.maxZ = 150;

        this.initThree();
        this.initEvents();
        this.updateUI();
    }

    initThree() {
        const container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a24);
        this.scene.fog = new THREE.FogExp2(0x1a1a24, 0.015);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 12, -15);
        this.camera.lookAt(0, 2, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Lumières
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 40, -20);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Sol route
        const roadGeo = new THREE.PlaneGeometry(12, 1000);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.8 });
        this.road = new THREE.Mesh(roadGeo, roadMat);
        this.road.rotation.x = -Math.PI / 2;
        this.road.receiveShadow = true;
        this.scene.add(this.road);

        // Trottoirs / décors
        const sideGeo = new THREE.BoxGeometry(20, 1, 1000);
        const sideMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44 });
        const leftSide = new THREE.Mesh(sideGeo, sideMat);
        leftSide.position.set(-16, -0.5, 500);
        this.scene.add(leftSide);

        const rightSide = new THREE.Mesh(sideGeo, sideMat);
        rightSide.position.set(16, -0.5, 500);
        this.scene.add(rightSide);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initEvents() {
        let isDragging = false;
        let lastX = 0;

        window.addEventListener('pointerdown', (e) => {
            isDragging = true;
            lastX = e.clientX;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDragging || !this.isRunning) return;
            const deltaX = e.clientX - lastX;
            lastX = e.clientX;
            this.playerX += deltaX * 0.03;
            this.playerX = Math.max(-5, Math.min(5, this.playerX));
        });

        window.addEventListener('pointerup', () => {
            isDragging = false;
        });
    }

    startLevel() {
        document.getElementById('screen-overlay').classList.add('hidden');
        document.getElementById('shop-container').style.display = 'none';

        // Nettoyer les anciens objets de jeu
        if (this.levelObjects) {
            this.levelObjects.forEach(obj => this.scene.remove(obj));
        }
        this.levelObjects = [];

        const lvlData = levels[this.currentLevelIndex];
        this.maxZ = lvlData.length;
        document.getElementById('level-display').innerText = lvlData.name;

        // Créer les unités du joueur (commencer avec 1)
        this.playerGroup.forEach(p => this.scene.remove(p));
        this.playerGroup = [];
        this.playerZ = 0;
        this.playerX = 0;
        this.addPlayerUnits(1);

        // Générer les objets du niveau
        lvlData.elements.forEach(el => {
            if (el.type === 'gate_add' || el.type === 'gate_mult') {
                this.createGate(el);
            } else if (el.type === 'enemy') {
                this.createEnemyGroup(el);
            } else if (el.type === 'obstacle') {
                this.createObstacle(el);
            } else if (el.type === 'boss') {
                this.createBoss(el);
            }
        });

        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop();
    }

    addPlayerUnits(count) {
        for (let i = 0; i < count; i++) {
            const group = new THREE.Group();
            
            // Corps (vert style style jeu)
            const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.3 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.6;
            body.castShadow = true;
            group.add(body);

            // Tête
            const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 1.3;
            group.add(head);

            group.position.set(
                this.playerX + (Math.random() - 0.5) * 1.5,
                0,
                this.playerZ + (Math.random() - 0.5) * 1.5
            );

            this.scene.add(group);
            this.playerGroup.push(group);
            this.levelObjects.push(group);
        }
    }

    createGate(data) {
        const isMult = data.type === 'gate_mult';
        const color = isMult ? 0x27ae60 : 0x2980b9;
        const text = (isMult ? 'x' : '+') + data.val;

        const frameGeo = new THREE.BoxGeometry(4, 3, 0.2);
        const mat = new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: 0.7 });
        const mesh = new THREE.Mesh(frameGeo, mat);
        mesh.position.set(data.x, 1.5, data.z);
        mesh.userData = { type: data.type, val: data.val, passed: false };
        
        this.scene.add(mesh);
        this.levelObjects.push(mesh);
    }

    createEnemyGroup(data) {
        const group = new THREE.Group();
        for (let i = 0; i < data.count; i++) {
            const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.6;
            
            const offsetX = (Math.random() - 0.5) * 4;
            const offsetZ = (Math.random() - 0.5) * 4;
            body.position.set(offsetX, 0, offsetZ);
            group.add(body);
        }
        group.position.set(data.x, 0, data.z);
        group.userData = { type: 'enemy', count: data.count };
        this.scene.add(group);
        this.levelObjects.push(group);
    }

    createObstacle(data) {
        const obsGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.8, 16);
        const obsMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
        const mesh = new THREE.Mesh(obsGeo, obsMat);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(data.x, 0.6, data.z);
        mesh.userData = { type: 'obstacle' };
        this.scene.add(mesh);
        this.levelObjects.push(mesh);
    }

    createBoss(data) {
        const bossGeo = new THREE.ConeGeometry(1.5, 3, 16);
        const bossMat = new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.2 });
        const mesh = new THREE.Mesh(bossGeo, bossMat);
        mesh.position.set(data.x, 1.5, data.z);
        mesh.userData = { type: 'boss', hp: data.hp, maxHp: data.hp };
        this.scene.add(mesh);
        this.levelObjects.push(mesh);
    }

    loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Avancer
        this.playerZ += this.speed * dt;
        this.camera.position.z = this.playerZ - 15;
        this.camera.position.x = this.playerX * 0.5;
        this.camera.lookAt(this.playerX, 2, this.playerZ + 5);
        this.road.position.z = this.playerZ + 400;

        // Mettre à jour la position des unités du joueur
        this.playerGroup.forEach((unit, idx) => {
            const targetX = this.playerX + (idx % 5 - 2) * 0.5;
            unit.position.x += (targetX - unit.position.x) * 10 * dt;
            unit.position.z = this.playerZ + Math.floor(idx / 5) * 0.5;
        });

        // Collisions et interactions avec les objets du niveau
        this.levelObjects.forEach(obj => {
            if (!obj.parent) return;
            const dz = obj.position.z - this.playerZ;

            if (Math.abs(dz) < 2) {
                // Portes
                if (obj.userData.type === 'gate_add' || obj.userData.type === 'gate_mult') {
                    if (!obj.userData.passed && Math.abs(this.playerX - obj.position.x) < 2.5) {
                        obj.userData.passed = true;
                        if (obj.userData.type === 'gate_add') {
                            this.addPlayerUnits(obj.userData.val);
                        } else {
                            const currentCount = this.playerGroup.length;
                            const addCount = currentCount * (obj.userData.val - 1);
                            this.addPlayerUnits(Math.floor(addCount));
                        }
                    }
                }
                // Ennemis ou Boss
                if (obj.userData.type === 'enemy') {
                    const damage = this.playerGroup.length * this.upgrades.damage.level;
                    obj.userData.count -= damage * dt * 5;
                    if (obj.userData.count <= 0) {
                        this.scene.remove(obj);
                        obj.userData.type = 'dead';
                        this.coins += 50 * this.upgrades.revenue.level;
                        this.updateUI();
                    }
                }
                if (obj.userData.type === 'boss') {
                    const damage = this.playerGroup.length * this.upgrades.damage.level;
                    obj.userData.hp -= damage * dt * 3;
                    if (obj.userData.hp <= 0) {
                        this.scene.remove(obj);
                        obj.userData.type = 'dead';
                        this.victory();
                    }
                }
            }
        });

        // Fin de niveau si arrivée au bout sans boss ou après boss
        if (this.playerZ >= this.maxZ && this.isRunning) {
            this.victory();
        }

        if (this.playerGroup.length <= 0) {
            this.gameOver();
        }

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.loop());
    }

    victory() {
        this.isRunning = false;
        alert("🎉 Niveau Réussi ! Victoire !");
        this.currentLevelIndex = (this.currentLevelIndex + 1) % levels.length;
        this.resetToMenu();
    }

    gameOver() {
        this.isRunning = false;
        alert("❌ Défaite... Plus d'unités !");
        this.resetToMenu();
    }

    resetToMenu() {
        document.getElementById('screen-overlay').classList.remove('hidden');
        document.getElementById('shop-container').style.display = 'flex';
        document.getElementById('screen-title').innerText = "NIVEAU TERMINÉ";
        this.updateUI();
    }

    upgrade(type) {
        const up = this.upgrades[type];
        if (this.coins >= up.cost) {
            this.coins -= up.cost;
            up.level++;
            up.cost = Math.floor(up.cost * 1.5);
            this.updateUI();
        } else {
            alert("Pas assez de pièces !");
        }
    }

    updateUI() {
        document.getElementById('coin-count').innerText = this.coins;
        document.getElementById('lvl-cadence').innerText = this.upgrades.cadence.level;
        document.getElementById('cost-cadence').innerText = this.upgrades.cadence.cost;
        document.getElementById('lvl-damage').innerText = this.upgrades.damage.level;
        document.getElementById('cost-damage').innerText = this.upgrades.damage.cost;
        document.getElementById('lvl-revenue').innerText = this.upgrades.revenue.level;
        document.getElementById('cost-revenue').innerText = this.upgrades.revenue.cost;

        localStorage.setItem('mob_coins', this.coins);
    }
}

// --- Éditeur de Niveau / Mode Admin ---
class AdminEditor {
    constructor() {
        this.currentLevelIdx = 0;
        this.initUI();
    }

    initUI() {
        document.getElementById('admin-toggle-btn').addEventListener('click', () => {
            document.getElementById('admin-panel').classList.toggle('hidden');
            this.loadLevel(0);
        });
    }

    loadLevel(idx) {
        this.currentLevelIdx = parseInt(idx);
        const lvl = levels[this.currentLevelIdx];
        const listDiv = document.getElementById('admin-elements-list');
        listDiv.innerHTML = '';

        lvl.elements.forEach((el, i) => {
            const item = document.createElement('div');
            item.className = 'element-item';
            item.innerHTML = `
                <span><b>${el.type}</b> (Z: ${el.z}, Val/Count: ${el.val || el.count || el.hp})</span>
                <button class="btn danger-btn" style="padding: 2px 8px; font-size:11px;" onclick="adminEditor.removeElement(${i})">X</button>
            `;
            listDiv.appendChild(item);
        });
    }

    addElement() {
        const type = document.getElementById('admin-element-type').value;
        const z = parseFloat(document.getElementById('admin-element-z').value) || 50;
        const val = parseFloat(document.getElementById('admin-element-val').value) || 10;

        const lvl = levels[this.currentLevelIdx];
        let newEl = { type, z, x: 0 };
        if (type.startsWith('gate')) newEl.val = val;
        else if (type === 'enemy') newEl.count = val;
        else if (type === 'boss') newEl.hp = val * 10;
        else if (type === 'obstacle') newEl.type_obs = 'tire';

        lvl.elements.push(newEl);
        lvl.elements.sort((a, b) => a.z - b.z);
        this.loadLevel(this.currentLevelIdx);
    }

    removeElement(index) {
        levels[this.currentLevelIdx].elements.splice(index, 1);
        this.loadLevel(this.currentLevelIdx);
    }

    addNewLevel() {
        const newId = levels.length + 1;
        levels.push({
            id: newId,
            name: `Niveau ${newId} - Personnalisé`,
            length: 200,
            elements: [
                { type: "gate_mult", z: 40, val: 2, x: 0 },
                { type: "boss", z: 180, hp: 300, x: 0 }
            ]
        });
        const select = document.getElementById('admin-level-select');
        const opt = document.createElement('option');
        opt.value = levels.length - 1;
        opt.innerText = `Niveau ${newId}`;
        select.appendChild(opt);
        select.value = levels.length - 1;
        this.loadLevel(levels.length - 1);
    }

    saveLevels() {
        localStorage.setItem('mob_runner_levels', JSON.stringify(levels));
        alert("✅ Niveaux sauvegardés dans le navigateur !");
        document.getElementById('admin-panel').classList.add('hidden');
    }

    exportJSON() {
        const jsonStr = JSON.stringify(levels, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'levels.json';
        a.click();
    }

    close() {
        document.getElementById('admin-panel').classList.add('hidden');
    }
}

let game;
let adminEditor;

window.addEventListener('DOMContentLoaded', () => {
    game = new Game();
    adminEditor = new AdminEditor();
});
