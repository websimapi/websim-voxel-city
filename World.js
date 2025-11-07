import * as THREE from 'three';

export class World {
    constructor() {
        this.group = new THREE.Group();
        this.tileSize = 2;
        this.citySize = 60; // In tiles
        this.maxBuildingHeight = 30;
        this.roadWidth = 4; // In tiles
        this.sidewalkWidth = 2; // In tiles
        this.blockSize = 16; // In tiles
        this.blockAndRoadSize = this.blockSize + this.roadWidth;
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
        const sidewalkUv = this.getUv(0, 0, 2, 3);
        const roadUv = this.getUv(1, 0, 2, 3);
        const buildingUv = this.getUv(0, 1, 2, 3);
        const windowUv = this.getUv(1, 1, 2, 3);
        const grassUv = this.getUv(0, 2, 2, 3);

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

                const blockX = Math.floor(tileX / this.blockAndRoadSize);
                const blockZ = Math.floor(tileZ / this.blockAndRoadSize);
                const xInBlock = tileX - blockX * this.blockAndRoadSize;
                const zInBlock = tileZ - blockZ * this.blockAndRoadSize;
                
                let uvSet = grassUv; // Default to grass

                const isRoadX = xInBlock >= this.blockSize;
                const isRoadZ = zInBlock >= this.blockSize;

                if(isRoadX || isRoadZ) {
                    uvSet = roadUv;
                } else {
                    const isSidewalkX = xInBlock < this.sidewalkWidth || xInBlock >= this.blockSize - this.sidewalkWidth;
                    const isSidewalkZ = zInBlock < this.sidewalkWidth || zInBlock >= this.blockSize - this.sidewalkWidth;
                    if(isSidewalkX || isSidewalkZ) {
                        uvSet = sidewalkUv;
                    }
                }
                
                const quadIndex = j * this.citySize + i;
                const triangleIndex = quadIndex * 2;
                const vertexIndex = triangleIndex * 3;

                const vIdx1 = groundGeometry.index.getX(vertexIndex);
                const vIdx2 = groundGeometry.index.getY(vertexIndex);
                const vIdx3 = groundGeometry.index.getZ(vertexIndex);
                const vIdx4 = groundGeometry.index.getY(vertexIndex + 3);

                uvs.setXY(vIdx1, uvSet[0].x, uvSet[0].y);
                uvs.setXY(vIdx2, uvSet[1].x, uvSet[1].y);
                uvs.setXY(vIdx3, uvSet[3].x, uvSet[3].y);
                uvs.setXY(vIdx4, uvSet[2].x, uvSet[2].y);
            }
        }
        uvs.needsUpdate = true;

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.group.add(ground);
        const groundBox = new THREE.Box3().setFromObject(ground);
        groundBox.min.y = -0.1; groundBox.max.y = 0.1;
        this.collisionBoxes.push(groundBox);

        for (let i = -cityLimit; i < cityLimit; i += this.blockAndRoadSize) {
            for (let j = -cityLimit; j < cityLimit; j += this.blockAndRoadSize) {
                if (Math.random() > 0.1) { // 90% chance of being a building block, 10% park
                    this.createBuildingBlock(i, j, buildingUv, windowUv);
                }
            }
        }
    }

    createBuildingBlock(blockTileX, blockTileZ, buildingUv, windowUv) {
        const s = this.tileSize;
        const blockWorldX = blockTileX * s;
        const blockWorldZ = blockTileZ * s;
        const buildingPlotSize = (this.blockSize - 2 * this.sidewalkWidth) * s;

        const buildingX = blockWorldX + this.sidewalkWidth * s;
        const buildingZ = blockWorldZ + this.sidewalkWidth * s;

        const height = Math.floor(Math.random() * this.maxBuildingHeight) + 10;
        
        const buildingGeo = new THREE.BoxGeometry(buildingPlotSize, height * s, buildingPlotSize);
        const buildingMat = new THREE.MeshStandardMaterial({color: 0xcccccc});
        const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);

        buildingMesh.position.set(
            buildingX + buildingPlotSize / 2,
            height * s / 2,
            buildingZ + buildingPlotSize / 2
        );
        this.group.add(buildingMesh);
        this.collisionBoxes.push(new THREE.Box3().setFromObject(buildingMesh));
    }


    getCollisionBoxes(centerPoint) {
        // Simple optimization: only return boxes near the player
        const closeBoxes = [];
        const range = 10; // Increased range due to larger city scale
        for (const box of this.collisionBoxes) {
            if (box.distanceToPoint(centerPoint) < range) {
                closeBoxes.push(box);
            }
        }
        return closeBoxes;
    }
}