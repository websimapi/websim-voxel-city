import * as THREE from 'three';

export class World {
    constructor() {
        this.group = new THREE.Group();
        this.tileSize = 2;
        this.citySize = 50; // In tiles
        this.buildingHeight = 10;
        this.roadWidth = 2;
        this.blockSize = 8;
        this.collisionBoxes = [];

        const loader = new THREE.TextureLoader();
        this.texture = loader.load('texture_atlas.png');
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.minFilter = THREE.NearestFilter;
    }

    getUv(x, y, w, h) {
        return [
            new THREE.Vector2(x / w, (h - y - 1) / h), // bl
            new THREE.Vector2((x + 1) / w, (h - y - 1) / h), // br
            new THREE.Vector2((x + 1) / w, (h - y) / h), // tr
            new THREE.Vector2(x / w, (h - y) / h), // tl
        ];
    }

    generate() {
        const grassUv = this.getUv(0, 0, 2, 2);
        const roadUv = this.getUv(1, 0, 2, 2);
        const buildingUv = this.getUv(0, 1, 2, 2);
        const windowUv = this.getUv(1, 1, 2, 2);

        const groundGeometry = new THREE.PlaneGeometry(
            this.citySize * this.tileSize, 
            this.citySize * this.tileSize,
            this.citySize,
            this.citySize
        );
        const groundMaterial = new THREE.MeshStandardMaterial({ map: this.texture, side: THREE.DoubleSide });
        
        const cityLimit = this.citySize / 2;
        const uvs = groundGeometry.attributes.uv;
        
        for (let j = 0; j < this.citySize; j++) {
            for (let i = 0; i < this.citySize; i++) {
                const tileX = i - cityLimit;
                const tileZ = j - cityLimit;

                const inXRoad = Math.abs(tileX % this.blockSize) < this.roadWidth / 2;
                const inZRoad = Math.abs(tileZ % this.blockSize) < this.roadWidth / 2;

                const uvSet = (inXRoad || inZRoad) ? roadUv : grassUv;
                
                const quadIndex = j * this.citySize + i;
                const triangleIndex = quadIndex * 2;
                const vertexIndex = triangleIndex * 3;

                // For a PlaneGeometry, the index buffer is ordered.
                // We can find the 4 vertices of a quad.
                const vIdx1 = groundGeometry.index.getX(vertexIndex);
                const vIdx2 = groundGeometry.index.getY(vertexIndex);
                const vIdx3 = groundGeometry.index.getZ(vertexIndex);
                const vIdx4 = groundGeometry.index.getY(vertexIndex + 3); // The fourth vertex of the quad

                uvs.setXY(vIdx1, uvSet[0].x, uvSet[0].y); // BL
                uvs.setXY(vIdx2, uvSet[1].x, uvSet[1].y); // BR
                uvs.setXY(vIdx3, uvSet[3].x, uvSet[3].y); // TL
                uvs.setXY(vIdx4, uvSet[2].x, uvSet[2].y); // TR
            }
        }

        uvs.needsUpdate = true;

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.group.add(ground);
        const groundBox = new THREE.Box3().setFromObject(ground);
        groundBox.min.y = -0.1; groundBox.max.y = 0.1;
        this.collisionBoxes.push(groundBox);

        const instancedBuilding = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ map: this.texture }),
            100000 // A large number
        );
        instancedBuilding.count = 0;
        this.group.add(instancedBuilding);

        const cityLimit = this.citySize / 2;
        for (let i = -cityLimit; i < cityLimit; i++) {
            for (let j = -cityLimit; j < cityLimit; j++) {
                const inXRoad = Math.abs(i % this.blockSize) < this.roadWidth / 2;
                const inZRoad = Math.abs(j % this.blockSize) < this.roadWidth / 2;

                if (inXRoad || inZRoad) {
                    // It's a road - this is handled by the ground texture for now
                } else {
                    const isBuilding = Math.abs(i % this.blockSize) > 0 && Math.abs(j % this.blockSize) > 0;
                    if (isBuilding && Math.random() > 0.1) {
                        const height = Math.floor(Math.random() * this.buildingHeight) + 5;
                        this.createBuilding(i, j, height, buildingUv, windowUv);
                    }
                }
            }
        }
    }

    createBuilding(tileX, tileZ, height, buildingUv, windowUv) {
        const x = tileX * this.tileSize;
        const z = tileZ * this.tileSize;
        const s = this.tileSize;

        const buildingMaterial = new THREE.MeshStandardMaterial({color: 0x888888});

        for (let y = 0; y < height; y++) {
            const isWallX = Math.abs(tileX % this.blockSize) === 1 || Math.abs(tileX % this.blockSize) === this.blockSize - 2;
            const isWallZ = Math.abs(tileZ % this.blockSize) === 1 || Math.abs(tileZ % this.blockSize) === this.blockSize - 2;

            if (isWallX || isWallZ) {
                const geometry = new THREE.BoxGeometry(s,s,s);
                const mesh = new THREE.Mesh(geometry, buildingMaterial);
                mesh.position.set(x + s/2, y * s + s/2, z + s/2);
                this.group.add(mesh);
                this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
            }
        }
    }

    getCollisionBoxes(centerPoint) {
        // Simple optimization: only return boxes near the player
        const closeBoxes = [];
        const range = 5;
        for (const box of this.collisionBoxes) {
            if (box.distanceToPoint(centerPoint) < range) {
                closeBoxes.push(box);
            }
        }
        return closeBoxes;
    }
}