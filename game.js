// --- Niveaux par défaut (fidèles à la vidéo) ---
const DEFAULT_LEVELS = [
    {
        id: 1,
        length: 220,
        elements: [
            { type: 'enemies', z: 32, x: 0, val: 6 },
            { type: 'gate', z: 58, x: -2.1, val: -15 },
            { type: 'gate', z: 58, x: 2.1, val: 5 },
            { type: 'enemies', z: 85, x: 0, val: 14 },
            { type: 'gate', z: 115, x: -2.1, val: 8 },
            { type: 'gate', z: 115, x: 2.1, val: -20 },
            { type: 'tires', z: 148, x: 1.8, val: 120 },
            { type: 'enemies', z: 175, x: 0, val: 22 },
            { type: 'boss', z: 205, x: 0, val: 450 }
        ]
    },
    {
        id: 2,
        length: 280,
        elements: [
            { type: 'gate', z: 35, x: -2.1, val: -25 },
            { type: 'gate', z: 35, x: 2.1, val: 10 },
            { type: 'enemies', z: 68, x: 0, val: 18 },
            { type: 'gate', z: 102, x: -2.1, val: 12 },
            { type: 'gate', z: 102, x: 2.1, val: -12 },
            { type: 'tires', z: 138, x: -2.0, val: 250 },
            { type: 'tires', z: 138, x: 2.0, val: 250 },
            { type: 'enemies', z: 175, x: 0, val: 35 },
            { type: 'gate', z: 210, x: 0, val: -30 },
            { type: 'boss', z: 255, x: 0, val: 1200 }
        ]
    },
    {
        id: 3,
        length: 340,
        elements: [
            { type: 'gate', z: 35, x: -2.1, val: 15 },
            { type: 'gate', z: 35, x: 2.1, val: -40 },
            { type: 'enemies', z: 75, x: 0, val: 28 },
            { type: 'tires', z: 115, x: -2.2, val: 400 },
            { type: 'tires', z: 115, x: 0, val: 400 },
            { type: 'tires', z: 115, x: 2.2, val: 400 },
            { type: 'gate', z: 160, x: -2.1, val: -55 },
            { type: 'gate', z: 160, x: 2.1, val: 20 },
            { type: 'enemies', z: 205, x: 0, val: 45 },
            { type: 'tires', z: 250, x: -1.5, val: 600 },
            { type: 'tires', z: 250, x: 1.5, val: 600 },
            { type: 'boss', z: 310, x: 0, val: 2800 }
        ]
    }
];

class MobShooterGame {
    constructor() {
        this.levels = JSON.parse(localStorage.getItem('ms3d_levels')) || JSON.parse(JSON.stringify(DEFAULT_LEVELS));
        this.currentLevelIdx = parseInt(localStorage.getItem('ms3d_lvl_idx')) || 0;
        if (this.currentLevelIdx >= this.levels.length) this.currentLevelIdx = 0;

        this.coins = parseInt(localStorage.getItem('ms3d_coins')) || 250;
        this.upgrades = JSON.parse(localStorage.getItem('ms3d_upgrades')) || {
            fireRate: 1,
            damage: 1,
            income: 1
        };

        this.state = 'LOBBY'; // LOBBY, PLAYING, END
        this.godMode = false;
        this.playerX = 0;
        this.playerZ = 0;
        this.forwardSpeed = 11;
        this.shootTimer = 0;
        this.levelCoinsEarned = 0;

        this.soldiers = [];
        this.bullets = [];
        this.gates = [];
        this.enemies = [];
        this.tires = [];
        this.particles = [];
        this.floatingCoins = [];
        this.boss = null;

        this.initThree();
        this.buildEnvironment();
        this.bindInputs();
        this.spawnInitialSquad(1);
        this.updateLobbyUI();
        this.animate();
    }

    initThree() {
        const container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x60a5fa);
        this.scene.fog = new THREE.Fog(0x60a5fa, 45, 140);

        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.set(0, 11, -13);
        this.camera.lookAt(0, 1.5, 8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Lumières
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.85);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xfffbeb, 0.9);
        dirLight.position.set(18, 35, -15);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 5;
        dirLight.shadow.camera.far = 120;
        const d = 25;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        this.scene.add(dirLight);
        this.dirLight = dirLight;

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    buildEnvironment() {
        // Route principale avec texture procédurale
        const roadTex = TextureGenerator.createRoadTexture();
        const roadGeo = new THREE.PlaneGeometry(10, 1200);
        const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
        this.road = new THREE.Mesh(roadGeo, roadMat);
        this.road.rotation.x = -Math.PI / 2;
        this.road.position.z = 550;
        this.road.receiveShadow = true;
        this.scene.add(this.road);

        // Trottoirs gauche et droit
        const sidewalkGeo = new THREE.BoxGeometry(16, 0.6, 1200);
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
        
        const leftWalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        leftWalk.position.set(-13, 0.3, 550);
        leftWalk.receiveShadow = true;
        this.scene.add(leftWalk);

        const rightWalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        rightWalk.position.set(13, 0.3, 550);
        rightWalk.receiveShadow = true;
        this.scene.add(rightWalk);

        // Immeubles urbains stylisés sur les côtés
        const buildingColors = [0x475569, 0x64748b, 0x3b82f6, 0x6366f1, 0x0ea5e9];
        for (let z = 10; z < 900; z += 22) {
            [-11.5, 11.5].forEach(sideX => {
                const h = 10 + Math.random() * 18;
                const w = 7 + Math.random() * 3;
                const d = 14 + Math.random() * 4;
                const bGeo = new THREE.BoxGeometry(w, h, d);
                const bMat = new THREE.MeshStandardMaterial({
                    color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
                    roughness: 0.7
                });
                const building = new THREE.Mesh(bGeo, bMat);
                building.position.set(sideX + (sideX < 0 ? -w/2 + 2 : w/2 - 2), h / 2, z);
                building.castShadow = true;
                building.receiveShadow = true;
                this.scene.add(building);
            });
        }
    }

    bindInputs() {
        let dragging = false;
        let prevX = 0;

        const onDown = (x) => {
            dragging = true;
            prevX = x;
        };

        const onMove = (x) => {
            if (!dragging || this.state !== 'PLAYING') return;
            const dx = x - prevX;
            prevX = x;
            const sensitivity = 12 / window.innerWidth;
            this.playerX = Math.max(-4.1, Math.min(4.1, this.playerX + dx * sensitivity));
        };

        window.addEventListener('mousedown', e => onDown(e.clientX));
        window.addEventListener('mousemove', e => onMove(e.clientX));
        window.addEventListener('mouseup', () => dragging = false);

        window.addEventListener('touchstart', e => onDown(e.touches[0].clientX), { passive: true });
        window.addEventListener('touchmove', e => onMove(e.touches[0].clientX), { passive: true });
        window.addEventListener('touchend', () => dragging = false);
    }

    createSoldierMesh() {
        const group = new THREE.Group();

        // Corps kaki/vert
        const torso = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.28, 0.75, 10),
            new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.5 })
        );
        torso.position.y = 0.65;
        torso.castShadow = true;
        group.add(torso);

        // Tête verte cartoon
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.3 })
        );
        head.position.y = 1.2;
        head.castShadow = true;
        group.add(head);

        // Casque
        const helmet = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.4 })
        );
        helmet.position.y = 1.24;
        group.add(helmet);

        // Fusil
        const gun = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.14, 0.65),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 })
        );
        gun.position.set(0.22, 0.85, 0.28);
        group.add(gun);

        return group;
    }

    spawnInitialSquad(count) {
        this.soldiers.forEach(s => this.scene.remove(s.mesh));
        this.soldiers = [];
        this.addSoldiers(count);
    }

    addSoldiers(count) {
        const maxSoldiers = 85; // Limite visuelle fluide
        const toAdd = Math.min(count, maxSoldiers - this.soldiers.length);
        for (let i = 0; i < toAdd; i++) {
            const mesh = this.createSoldierMesh();
            mesh.position.set(this.playerX, 0, this.playerZ);
            this.scene.add(mesh);
            this.soldiers.push({
                mesh,
                offsetX: (Math.random() - 0.5) * 0.5,
                offsetZ: (Math.random() - 0.5) * 0.5,
                bobPhase: Math.random() * Math.PI * 2
            });
        }
    }

    removeSoldiers(count) {
        if (this.godMode) return;
        for (let i = 0; i < count && this.soldiers.length > 0; i++) {
            const s = this.soldiers.pop();
            this.spawnExplosion(s.mesh.position, 0x65a30d, 6);
            this.scene.remove(s.mesh);
        }
    }

    clearLevelEntities() {
        [...this.bullets, ...this.gates, ...this.enemies, ...this.tires, ...this.particles, ...this.floatingCoins].forEach(item => {
            if (item.mesh) this.scene.remove(item.mesh);
        });
        if (this.boss) this.scene.remove(this.boss.mesh);

        this.bullets = [];
        this.gates = [];
        this.enemies = [];
        this.tires = [];
        this.particles = [];
        this.floatingCoins = [];
        this.boss = null;
    }

    startLevel() {
        this.clearLevelEntities();
        const lvl = this.levels[this.currentLevelIdx];
        this.playerX = 0;
        this.playerZ = 0;
        this.levelCoinsEarned = 0;
        this.spawnInitialSquad(1);

        // Construire les éléments du niveau
        lvl.elements.forEach(el => {
            if (el.type === 'gate') this.createGate(el);
            else if (el.type === 'enemies') this.createEnemyHorde(el);
            else if (el.type === 'tires') this.createTireStack(el);
            else if (el.type === 'boss') this.createBoss(el);
        });

        document.getElementById('hud-level').innerText = this.currentLevelIdx + 1;
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');
        this.state = 'PLAYING';
    }

    createGate(el) {
        const group = new THREE.Group();
        const isPos = el.val >= 0;
        const tex = TextureGenerator.createGateTexture(el.val, isPos);

        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(3.8, 2.6),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        );
        panel.position.y = 1.4;
        group.add(panel);

        // Poteaux latéraux
        const postMat = new THREE.MeshStandardMaterial({ color: isPos ? 0x16a34a : 0xdc2626 });
        const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.8, 10);
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(-1.95, 1.4, 0);
        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(1.95, 1.4, 0);
        group.add(leftPost, rightPost);

        group.position.set(el.x, 0, el.z);
        this.scene.add(group);

        this.gates.push({
            mesh: group,
            panel,
            x: el.x,
            z: el.z,
            val: el.val,
            triggered: false
        });
    }

    createEnemyHorde(el) {
        const count = Math.max(1, Math.floor(el.val));
        for (let i = 0; i < count; i++) {
            const group = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25, 0.28, 0.8, 8),
                new THREE.MeshStandardMaterial({ color: 0xef4444 })
            );
            body.position.y = 0.6;
            body.castShadow = true;

            const head = new THREE.Mesh(
                new THREE.SphereGeometry(0.28, 10, 10),
                new THREE.MeshStandardMaterial({ color: 0xdc2626 })
            );
            head.position.y = 1.2;

            group.add(body, head);
            const spreadX = (Math.random() - 0.5) * 6.5;
            const spreadZ = (Math.random() - 0.5) * 6;
            group.position.set(Math.max(-4, Math.min(4, el.x + spreadX)), 0, el.z + spreadZ);
            this.scene.add(group);

            this.enemies.push({
                mesh: group,
                hp: 2 + this.currentLevelIdx * 1.5,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    createTireStack(el) {
        const group = new THREE.Group();
        const tireTex = TextureGenerator.createTireTexture();
        const tireMat = new THREE.MeshStandardMaterial({ map: tireTex, roughness: 0.7 });

        for (let i = 0; i < 3; i++) {
            const tire = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.35, 10, 20), tireMat);
            tire.rotation.x = Math.PI / 2;
            tire.position.y = 0.35 + i * 0.65;
            tire.castShadow = true;
            group.add(tire);
        }

        const label = TextureGenerator.createLabelSprite(Math.floor(el.val), '#dc2626');
        label.position.set(0, 2.7, 0);
        group.add(label);

        group.position.set(el.x, 0, el.z);
        this.scene.add(group);

        this.tires.push({
            mesh: group,
            label,
            x: el.x,
            z: el.z,
            hp: el.val
        });
    }

    createBoss(el) {
        const group = new THREE.Group();

        // Corps géant
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 1.3, 2.8, 14),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
        );
        body.position.y = 2.0;
        body.castShadow = true;
        group.add(body);

        // Bonnet rouge géant (comme dans la vidéo)
        const beanie = new THREE.Mesh(
            new THREE.SphereGeometry(1.15, 14, 12),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
        );
        beanie.position.y = 3.8;
        group.add(beanie);

        const label = TextureGenerator.createLabelSprite(Math.floor(el.val), '#b91c1c', '#fef08a');
        label.position.set(0, 5.6, 0);
        label.scale.set(3.4, 1.2, 1);
        group.add(label);

        group.position.set(el.x, 0, el.z);
        this.scene.add(group);

        this.boss = {
            mesh: group,
            label,
            x: el.x,
            z: el.z,
            hp: el.val
        };
    }

    fireBullets() {
        const bulletGeo = new THREE.SphereGeometry(0.14, 6, 6);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

        this.soldiers.forEach(s => {
            const b = new THREE.Mesh(bulletGeo, bulletMat);
            b.position.set(s.mesh.position.x, 0.9, s.mesh.position.z + 0.6);
            this.scene.add(b);
            this.bullets.push({
                mesh: b,
                damage: 1 + (this.upgrades.damage - 1) * 0.65
            });
        });
    }

    spawnExplosion(pos, colorHex, count = 8) {
        const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const mat = new THREE.MeshBasicMaterial({ color: colorHex });
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.position.y += 0.8;
            this.scene.add(p);
            this.particles.push({
                mesh: p,
                vx: (Math.random() - 0.5) * 7,
                vy: Math.random() * 6 + 2,
                vz: (Math.random() - 0.5) * 7,
                life: 0.45
            });
        }
    }

    spawnCoinDrop(pos) {
        const coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12),
            new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.2 })
        );
        coin.rotation.x = Math.PI / 2;
        coin.position.set(pos.x, 1.2, pos.z);
        this.scene.add(coin);
        this.floatingCoins.push({ mesh: coin, life: 0.6 });

        const gain = Math.floor((15 + this.currentLevelIdx * 10) * (1 + (this.upgrades.income - 1) * 0.4));
        this.coins += gain;
        this.levelCoinsEarned += gain;
        document.getElementById('hud-coins').innerText = this.formatNumber(this.coins);
    }

    updatePlaying(dt) {
        const lvl = this.levels[this.currentLevelIdx];

        // Avancée du joueur
        this.playerZ += this.forwardSpeed * dt;
        const pct = Math.min(100, Math.floor((this.playerZ / lvl.length) * 100));
        document.getElementById('progress-bar').style.width = pct + '%';
        document.getElementById('progress-text').innerText = pct + '%';

        // Caméra fluide qui suit l'armée
        this.camera.position.z = this.playerZ - 12.5;
        this.camera.position.x += (this.playerX * 0.45 - this.camera.position.x) * 6 * dt;
        this.camera.lookAt(this.playerX * 0.3, 1.2, this.playerZ + 9);
        this.dirLight.position.z = this.playerZ - 15;

        // Formation en cercle serré des soldats
        const total = this.soldiers.length;
        this.soldiers.forEach((s, idx) => {
            const angle = idx * 2.39996; // Angle d'or pour répartition uniforme
            const radius = Math.min(2.6, Math.sqrt(idx) * 0.36);
            const targetX = Math.max(-4.2, Math.min(4.2, this.playerX + Math.cos(angle) * radius));
            const targetZ = this.playerZ + Math.sin(angle) * radius * 0.85;

            s.mesh.position.x += (targetX - s.mesh.position.x) * 12 * dt;
            s.mesh.position.z += (targetZ - s.mesh.position.z) * 12 * dt;
            s.bobPhase += dt * 14;
            s.mesh.position.y = Math.abs(Math.sin(s.bobPhase)) * 0.14;
        });

        // Cadence de tir
        const fireInterval = Math.max(0.08, 0.34 - (this.upgrades.fireRate - 1) * 0.025);
        this.shootTimer += dt;
        if (this.shootTimer >= fireInterval) {
            this.shootTimer = 0;
            this.fireBullets();
        }

        // Déplacement & Collisions des balles
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.mesh.position.z += 38 * dt;
            let hit = false;

            if (b.mesh.position.z > this.playerZ + 48) {
                hit = true;
            }

            // Collision avec les portails (augmente la valeur du portail !)
            if (!hit) {
                for (const g of this.gates) {
                    if (!g.triggered && Math.abs(b.mesh.position.z - g.z) < 0.8 && Math.abs(b.mesh.position.x - g.x) < 1.9) {
                        g.val += b.damage;
                        const newTex = TextureGenerator.createGateTexture(g.val, g.val >= 0);
                        g.panel.material.map.dispose();
                        g.panel.material.map = newTex;
                        g.panel.material.needsUpdate = true;
                        hit = true;
                        break;
                    }
                }
            }

            // Collision avec les ennemis
            if (!hit) {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const e = this.enemies[j];
                    if (Math.abs(b.mesh.position.z - e.mesh.position.z) < 0.7 && Math.abs(b.mesh.position.x - e.mesh.position.x) < 0.6) {
                        e.hp -= b.damage;
                        hit = true;
                        if (e.hp <= 0) {
                            this.spawnExplosion(e.mesh.position, 0xef4444, 6);
                            this.spawnCoinDrop(e.mesh.position);
                            this.scene.remove(e.mesh);
                            this.enemies.splice(j, 1);
                        }
                        break;
                    }
                }
            }

            // Collision avec les piles de pneus
            if (!hit) {
                for (let j = this.tires.length - 1; j >= 0; j--) {
                    const t = this.tires[j];
                    if (Math.abs(b.mesh.position.z - t.z) < 1.0 && Math.abs(b.mesh.position.x - t.x) < 1.1) {
                        t.hp -= b.damage * 4;
                        hit = true;
                        if (t.hp <= 0) {
                            this.spawnExplosion(t.mesh.position, 0x334155, 12);
                            this.spawnCoinDrop(t.mesh.position);
                            this.scene.remove(t.mesh);
                            this.tires.splice(j, 1);
                        } else {
                            t.mesh.remove(t.label);
                            t.label = TextureGenerator.createLabelSprite(Math.ceil(t.hp), '#dc2626');
                            t.label.position.set(0, 2.7, 0);
                            t.mesh.add(t.label);
                        }
                        break;
                    }
                }
            }

            // Collision avec le Boss
            if (!hit && this.boss) {
                if (Math.abs(b.mesh.position.z - this.boss.z) < 1.4 && Math.abs(b.mesh.position.x - this.boss.x) < 1.6) {
                    this.boss.hp -= b.damage * 5;
                    hit = true;
                    if (this.boss.hp <= 0) {
                        this.spawnExplosion(this.boss.mesh.position, 0xdc2626, 25);
                        this.spawnCoinDrop(this.boss.mesh.position);
                        this.scene.remove(this.boss.mesh);
                        this.boss = null;
                        this.finishLevel(true);
                        return;
                    } else {
                        this.boss.mesh.remove(this.boss.label);
                        this.boss.label = TextureGenerator.createLabelSprite(Math.ceil(this.boss.hp), '#b91c1c', '#fef08a');
                        this.boss.label.position.set(0, 5.6, 0);
                        this.boss.label.scale.set(3.4, 1.2, 1);
                        this.boss.mesh.add(this.boss.label);
                    }
                }
            }

            if (hit) {
                this.scene.remove(b.mesh);
                this.bullets.splice(i, 1);
            }
        }

        // Passage dans les portails
        for (const g of this.gates) {
            if (!g.triggered && Math.abs(this.playerZ - g.z) < 0.9 && Math.abs(this.playerX - g.x) < 2.1) {
                g.triggered = true;
                g.mesh.visible = false;
                const amount = Math.round(g.val);
                if (amount > 0) this.addSoldiers(amount);
                else if (amount < 0) this.removeSoldiers(Math.abs(amount));
            }
        }

        // Mouvement des ennemis vers l'armée
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const distZ = e.mesh.position.z - this.playerZ;
            if (distZ < 24 && distZ > -2) {
                e.mesh.position.z -= 4.2 * dt;
                e.mesh.position.x += (this.playerX - e.mesh.position.x) * 1.5 * dt;
            }
            if (Math.abs(distZ) < 1.1 && Math.abs(e.mesh.position.x - this.playerX) < 2.2) {
                this.removeSoldiers(1);
                this.spawnExplosion(e.mesh.position, 0xef4444, 5);
                this.scene.remove(e.mesh);
                this.enemies.splice(i, 1);
            }
        }

        // Impact direct avec les pneus
        for (let i = this.tires.length - 1; i >= 0; i--) {
            const t = this.tires[i];
            if (Math.abs(this.playerZ - t.z) < 1.1 && Math.abs(this.playerX - t.x) < 1.4) {
                this.removeSoldiers(Math.min(this.soldiers.length, 8));
                this.spawnExplosion(t.mesh.position, 0x334155, 10);
                this.scene.remove(t.mesh);
                this.tires.splice(i, 1);
            }
        }

        // Vérification défaite ou arrivée
        if (this.soldiers.length === 0) {
            this.finishLevel(false);
            return;
        }

        if (this.playerZ >= lvl.length) {
            this.finishLevel(true);
        }
    }

    updateEffects(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.vy -= 18 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.floatingCoins.length - 1; i >= 0; i--) {
            const c = this.floatingCoins[i];
            c.life -= dt;
            c.mesh.position.y += 4 * dt;
            c.mesh.rotation.z += 8 * dt;
            if (c.life <= 0) {
                this.scene.remove(c.mesh);
                this.floatingCoins.splice(i, 1);
            }
        }
    }

    finishLevel(won) {
        this.state = 'END';
        this.saveProgress();

        const title = document.getElementById('end-title');
        if (won) {
            title.innerText = 'NIVEAU TERMINÉ !';
            title.style.color = '#fbbf24';
            this.currentLevelIdx = (this.currentLevelIdx + 1) % this.levels.length;
        } else {
            title.innerText = 'ARMÉE DÉTRUITE !';
            title.style.color = '#ef4444';
        }

        document.getElementById('end-reward').innerText = this.formatNumber(this.levelCoinsEarned);
        document.getElementById('end-screen').classList.remove('hidden');
    }

    nextLevel() {
        this.clearLevelEntities();
        this.playerX = 0;
        this.playerZ = 0;
        this.camera.position.set(0, 11, -13);
        this.camera.lookAt(0, 1.5, 8);
        this.spawnInitialSquad(1);
        this.state = 'LOBBY';
        document.getElementById('end-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        this.updateLobbyUI();
    }

    buyUpgrade(type) {
        const lvl = this.upgrades[type];
        const cost = Math.floor(100 * Math.pow(1.45, lvl - 1));
        if (this.coins >= cost) {
            this.coins -= cost;
            this.upgrades[type]++;
            this.saveProgress();
            this.updateLobbyUI();
        }
    }

    updateLobbyUI() {
        document.getElementById('hud-level').innerText = this.currentLevelIdx + 1;
        document.getElementById('hud-coins').innerText = this.formatNumber(this.coins);
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('progress-text').innerText = '0%';

        ['fireRate', 'damage', 'income'].forEach(type => {
            const lvl = this.upgrades[type];
            const cost = Math.floor(100 * Math.pow(1.45, lvl - 1));
            document.getElementById('lvl-' + type).innerText = lvl;
            document.getElementById('cost-' + type).innerText = this.formatNumber(cost);
        });
    }

    saveProgress() {
        localStorage.setItem('ms3d_coins', this.coins);
        localStorage.setItem('ms3d_upgrades', JSON.stringify(this.upgrades));
        localStorage.setItem('ms3d_lvl_idx', this.currentLevelIdx);
        localStorage.setItem('ms3d_levels', JSON.stringify(this.levels));
    }

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return Math.floor(n);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const dt = Math.min(0.05, (now - (this.lastFrame || now)) / 1000);
        this.lastFrame = now;

        if (this.state === 'PLAYING') {
            this.updatePlaying(dt);
        }
        this.updateEffects(dt);
        this.renderer.render(this.scene, this.camera);
    }
}

// --- Contrôleur du Mode Admin ---
class AdminController {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.editingIdx = 0;

        document.getElementById('btn-open-admin').addEventListener('click', () => this.open());
    }

    open() {
        this.editingIdx = this.game.currentLevelIdx;
        this.refreshSelect();
        this.loadLevelData();
        document.getElementById('admin-modal').classList.remove('hidden');
    }

    close() {
        document.getElementById('admin-modal').classList.add('hidden');
    }

    addCoins(amount) {
        this.game.coins += amount;
        this.game.saveProgress();
        this.game.updateLobbyUI();
    }

    spawnSoldiers(count) {
        this.game.addSoldiers(count);
    }

    toggleGodMode() {
        this.game.godMode = !this.game.godMode;
        document.getElementById('god-status').innerText = this.game.godMode ? 'ON' : 'OFF';
    }

    refreshSelect() {
        const sel = document.getElementById('admin-level-select');
        sel.innerHTML = '';
        this.game.levels.forEach((l, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = `Niveau ${i + 1} (${l.elements.length} objets)`;
            sel.appendChild(opt);
        });
        sel.value = this.editingIdx;
    }

    selectLevel(idx) {
        this.editingIdx = parseInt(idx);
        this.loadLevelData();
    }

    loadLevelData() {
        const lvl = this.game.levels[this.editingIdx];
        document.getElementById('admin-lvl-length').value = lvl.length;
        document.getElementById('el-count').innerText = lvl.elements.length;

        const list = document.getElementById('admin-el-list');
        list.innerHTML = '';
        lvl.elements.sort((a, b) => a.z - b.z).forEach((el, idx) => {
            const div = document.createElement('div');
            div.className = 'el-item';
            const names = { gate: '🚪 Portail', enemies: '👹 Ennemis', tires: '🛞 Pneus', boss: '👑 Boss' };
            div.innerHTML = `
                <span><b>${names[el.type] || el.type}</b> | Z: ${el.z}m | X: ${el.x} | Val: <b>${el.val}</b></span>
                <button class="adm-btn danger" style="padding:4px 8px;" onclick="admin.removeElement(${idx})">🗑️</button>
            `;
            list.appendChild(div);
        });
    }

    updateLevelProps() {
        const len = parseInt(document.getElementById('admin-lvl-length').value) || 200;
        this.game.levels[this.editingIdx].length = len;
        this.game.saveProgress();
    }

    addElement() {
        const type = document.getElementById('el-type').value;
        const z = parseFloat(document.getElementById('el-z').value) || 50;
        const x = parseFloat(document.getElementById('el-x').value) || 0;
        const val = parseFloat(document.getElementById('el-val').value) || 10;

        this.game.levels[this.editingIdx].elements.push({ type, z, x, val });
        this.loadLevelData();
        this.refreshSelect();
    }

    removeElement(idx) {
        this.game.levels[this.editingIdx].elements.splice(idx, 1);
        this.loadLevelData();
        this.refreshSelect();
    }

    createNewLevel() {
        const newLvl = {
            id: this.game.levels.length + 1,
            length: 250,
            elements: [
                { type: 'gate', z: 40, x: -2, val: -10 },
                { type: 'gate', z: 40, x: 2, val: 10 },
                { type: 'enemies', z: 90, x: 0, val: 20 },
                { type: 'boss', z: 220, x: 0, val: 800 }
            ]
        };
        this.game.levels.push(newLvl);
        this.editingIdx = this.game.levels.length - 1;
        this.refreshSelect();
        this.loadLevelData();
    }

    deleteCurrentLevel() {
        if (this.game.levels.length <= 1) return;
        this.game.levels.splice(this.editingIdx, 1);
        this.editingIdx = 0;
        this.refreshSelect();
        this.loadLevelData();
    }

    saveAndReload() {
        this.game.currentLevelIdx = this.editingIdx;
        this.game.saveProgress();
        this.close();
        this.game.startLevel();
    }

    resetDefaults() {
        this.game.levels = JSON.parse(JSON.stringify(DEFAULT_LEVELS));
        this.editingIdx = 0;
        this.game.currentLevelIdx = 0;
        this.game.saveProgress();
        this.refreshSelect();
        this.loadLevelData();
    }
}

let game, admin;
window.addEventListener('DOMContentLoaded', () => {
    game = new MobShooterGame();
    admin = new AdminController(game);
});
