import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import nipplejs from 'nipplejs';

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export class Player {
    constructor(camera) {
        this.camera = camera;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 5;
        this.gravity = 9.8;
        this.jumpHeight = 6;
        this.onGround = false;

        this.height = 1.8;
        this.camera.position.set(0, this.height, 10);

        this.controls = new PointerLockControls(this.camera, document.body);
        this.controls.addEventListener('lock', () => console.log('Pointer locked'));
        this.controls.addEventListener('unlock', () => console.log('Pointer unlocked'));
        document.body.addEventListener('click', () => this.controls.lock());

        this.keys = {};
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);

        this.initMobileControls();
    }

    initMobileControls() {
        if (!isMobile) return;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        const joystickContainer = document.getElementById('joystick-container');
        const joystick = nipplejs.create({
            zone: joystickContainer,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
        });

        joystick.on('move', (evt, data) => {
            const angle = data.angle.radian;
            this.moveForward = Math.sin(angle) > 0.3;
            this.moveBackward = Math.sin(angle) < -0.3;
            this.moveLeft = Math.cos(angle) < -0.3;
            this.moveRight = Math.cos(angle) > 0.3;
        });

        joystick.on('end', () => {
            this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;
        });

        let lastTouchX = 0;
        let lastTouchY = 0;
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1 && e.touches[0].clientX > window.innerWidth / 2) {
                 lastTouchX = e.touches[0].clientX;
                 lastTouchY = e.touches[0].clientY;
            }
        });
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && e.touches[0] && e.touches[0].clientX > window.innerWidth / 2) {
                const dx = e.touches[0].clientX - lastTouchX;
                const dy = e.touches[0].clientY - lastTouchY;
                this.controls.moveRight(-dx * 0.005); // Use moveRight for yaw
                this.camera.rotation.x -= dy * 0.002; // Rotate camera directly for pitch
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x)); // Clamp pitch
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            }
        });
    }

    handleCollisions(world) {
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            this.controls.getObject().position,
            new THREE.Vector3(0.5, this.height, 0.5)
        );

        this.onGround = false;
        const worldBoxes = world.getCollisionBoxes(this.controls.getObject().position);

        worldBoxes.forEach(box => {
            if (playerBox.intersectsBox(box)) {
                const intersection = new THREE.Box3().copy(playerBox).intersect(box);
                const size = intersection.getSize(new THREE.Vector3());

                if (size.y > size.x && size.y > size.z) { // Vertical collision
                    if (playerBox.min.y < box.max.y && this.velocity.y < 0) {
                        this.velocity.y = 0;
                        this.controls.getObject().position.y = box.max.y + this.height / 2;
                        this.onGround = true;
                    }
                } else { // Horizontal collision
                     if (size.x > size.z) {
                        if (playerBox.getCenter(new THREE.Vector3()).x < box.getCenter(new THREE.Vector3()).x) {
                           this.controls.getObject().position.x -= size.x;
                        } else {
                           this.controls.getObject().position.x += size.x;
                        }
                    } else {
                        if (playerBox.getCenter(new THREE.Vector3()).z < box.getCenter(new THREE.Vector3()).z) {
                           this.controls.getObject().position.z -= size.z;
                        } else {
                           this.controls.getObject().position.z += size.z;
                        }
                    }
                }
            }
        });
    }

    update(delta, world) {
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= this.gravity * delta;

        this.direction.z = Number(this.keys['KeyW'] || this.moveForward) - Number(this.keys['KeyS'] || this.moveBackward);
        this.direction.x = Number(this.keys['KeyD'] || this.moveRight) - Number(this.keys['KeyA'] || this.moveLeft);
        this.direction.normalize();

        if (this.keys['KeyW'] || this.keys['KeyS'] || this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * this.speed * 10.0 * delta;
        }
        if (this.keys['KeyA'] || this.keys['KeyD'] || this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * this.speed * 10.0 * delta;
        }

        if ((this.keys['Space']) && this.onGround) {
            this.velocity.y = this.jumpHeight;
        }

        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        this.controls.getObject().position.y += this.velocity.y * delta;

        this.handleCollisions(world);

        if (this.controls.getObject().position.y < -10) {
            this.velocity.y = 0;
            this.controls.getObject().position.set(0, this.height, 10);
        }
    }
}