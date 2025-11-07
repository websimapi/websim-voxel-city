import * as THREE from 'three';
import { Player } from './Player.js';
import { World } from './World.js';
import { Car } from './Car.js';
import { Multiplayer } from './Multiplayer.js';
import { UI } from './UI.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        this.peers = {}

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        const skyTexture = new THREE.TextureLoader().load('sky.png');
        skyTexture.magFilter = THREE.NearestFilter;
        this.scene.background = skyTexture;

        const light = new THREE.AmbientLight(0xaaaaaa);
        this.scene.add(light);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 5);
        this.scene.add(directionalLight);

        this.player = new Player(this.camera);
        this.scene.add(this.player.controls.getObject());

        this.world = new World();
        this.world.generate();
        this.scene.add(this.world.group);

        this.cars = [];
        this.setupCars();

        this.multiplayer = new Multiplayer(this.player, this.onPlayerConnect.bind(this), this.onPlayerDisconnect.bind(this), this.onPlayerData.bind(this));
        this.ui = new UI(this.multiplayer);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        this.animate();
    }

    setupCars() {
        const carPaths = [
            [{ x: -40, z: -5 }, { x: 40, z: -5 }],
            [{ x: 40, z: 5 }, { x: -40, z: 5 }],
            [{ x: -5, z: -40 }, { x: -5, z: 40 }],
            [{ x: 5, z: 40 }, { x: 5, z: -40 }],
        ];       

        carPaths.forEach(path => {
            const car = new Car(path);
            this.cars.push(car);
            this.scene.add(car.mesh);
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onPlayerConnect(id) {
        console.log(`Player connected: ${id}`);
        const peerGeometry = new THREE.CapsuleGeometry(0.5, 1);
        const peerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const peerMesh = new THREE.Mesh(peerGeometry, peerMaterial);
        this.scene.add(peerMesh);
        this.peers[id] = { mesh: peerMesh };
    }

    onPlayerDisconnect(id) {
        console.log(`Player disconnected: ${id}`);
        if (this.peers[id]) {
            this.scene.remove(this.peers[id].mesh);
            this.peers[id].mesh.geometry.dispose();
            this.peers[id].mesh.material.dispose();
            delete this.peers[id];
        }
    }

    onPlayerData(id, data) {
        if (this.peers[id] && data.position && data.rotation) {
            this.peers[id].mesh.position.copy(data.position);
            // We only care about Y-axis rotation for the capsule
            this.peers[id].mesh.rotation.y = data.rotation.y;
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();

        this.player.update(delta, this.world);
        this.cars.forEach(car => car.update(delta));
        this.multiplayer.sendPlayerData();

        this.renderer.render(this.scene, this.camera);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Game();
});