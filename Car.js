import * as THREE from 'three';

export class Car {
    constructor(path) {
        this.path = path.map(p => new THREE.Vector3(p.x, 0.4, p.z));
        this.speed = 10;
        this.progress = Math.random(); 
        this.currentSegment = 0;

        const geometry = new THREE.BoxGeometry(1.5, 0.8, 3);
        const texture = new THREE.TextureLoader().load('car_texture.png');
        texture.magFilter = THREE.NearestFilter;
        const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true });
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.updatePosition();
    }

    updatePosition() {
        const segmentStart = this.path[this.currentSegment];
        const segmentEnd = this.path[(this.currentSegment + 1) % this.path.length];

        this.mesh.position.lerpVectors(segmentStart, segmentEnd, this.progress);
        
        const direction = new THREE.Vector3().subVectors(segmentEnd, segmentStart);
        this.mesh.lookAt(this.mesh.position.clone().add(direction));
    }

    update(delta) {
        const segmentStart = this.path[this.currentSegment];
        const segmentEnd = this.path[(this.currentSegment + 1) % this.path.length];
        const segmentLength = segmentStart.distanceTo(segmentEnd);

        this.progress += (this.speed / segmentLength) * delta;

        if (this.progress >= 1.0) {
            this.progress = 0;
            this.currentSegment = (this.currentSegment + 1) % this.path.length;
        }

        this.updatePosition();
    }
}