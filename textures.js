// Générateur de textures procédurales haute qualité sur Canvas
const TextureGenerator = {
    createRoadTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Asphalte texturé
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, 512, 512);

        // Grain de bitume
        for (let i = 0; i < 6000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const shade = Math.random() > 0.5 ? '#1e293b' : '#475569';
            ctx.fillStyle = shade;
            ctx.fillRect(x, y, 2, 2);
        }

        // Fissures réalistes
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        for (let c = 0; c < 6; c++) {
            ctx.beginPath();
            let cx = Math.random() * 450 + 30;
            let cy = Math.random() * 512;
            ctx.moveTo(cx, cy);
            for (let s = 0; s < 6; s++) {
                cx += (Math.random() - 0.5) * 40;
                cy += Math.random() * 35;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }

        // Bordures jaunes et blanches sur les côtés
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(10, 0, 12, 512);
        ctx.fillRect(490, 0, 12, 512);

        // Ligne centrale discontinue
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(250, 40, 12, 160);
        ctx.fillRect(250, 300, 12, 160);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 40);
        return tex;
    },

    createGateTexture(value, isPositive) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Fond dégradé semi-transparent
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        if (isPositive) {
            grad.addColorStop(0, 'rgba(34, 197, 94, 0.85)');
            grad.addColorStop(1, 'rgba(21, 128, 61, 0.92)');
        } else {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
            grad.addColorStop(1, 'rgba(185, 28, 28, 0.92)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        // Motifs chevrons en arrière-plan
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 10;
        for (let y = -50; y < 300; y += 50) {
            ctx.beginPath();
            ctx.moveTo(20, y + 30);
            ctx.lineTo(128, y);
            ctx.lineTo(236, y + 30);
            ctx.stroke();
        }

        // Texte central (+15 ou -25)
        const text = (value >= 0 ? '+' : '') + Math.floor(value);
        ctx.font = '900 84px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeText(text, 128, 128);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    },

    createTireTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 256, 256);

        // Crampons de pneu
        ctx.fillStyle = '#0f172a';
        for (let y = 0; y < 256; y += 32) {
            ctx.fillRect(0, y, 256, 14);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    },

    createLabelSprite(text, bgColor = '#0f172a', textColor = '#ffffff') {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(16, 12, 224, 72, 20);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = '900 44px Arial, sans-serif';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 50);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.4, 0.9, 1);
        return sprite;
    }
};
