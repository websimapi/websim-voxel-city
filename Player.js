import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import nipplejs from 'nipplejs';

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export class Player {
    constructor(camera) {
        this.camera = camera;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 8;
        this.gravity = 9.8;
        this.jumpHeight = 8;
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
        // Broad phase: get nearby collidable objects
        const worldBoxes = world.getCollisionBoxes(this.controls.getObject().position);
        if (worldBoxes.length === 0) return;

        // Store original position
        const playerPos = this.controls.getObject().position;
        const originalY = playerPos.y;

        // --- Y-AXIS (VERTICAL) COLLISION ---
        this.onGround = false;
        playerPos.y += this.velocity.y * this.delta;

        let playerBoxY = new THREE.Box3().setFromCenterAndSize(
            playerPos,
            new THREE.Vector3(0.5, this.height, 0.5)
        );

        for (const box of worldBoxes) {
            if (playerBoxY.intersectsBox(box)) {
                if (this.velocity.y <= 0) { // Moving down
                    playerPos.y = box.max.y + this.height / 2;
                    this.onGround = true;
                } else { // Moving up
                    playerPos.y = box.min.y - this.height / 2;
                }
                this.velocity.y = 0;
                // Re-calculate box after position correction
                playerBoxY = new THREE.Box3().setFromCenterAndSize(
                    playerPos,
                    new THREE.Vector3(0.5, this.height, 0.5)
                );
            }
        }
        
        // After Y-axis is resolved, we handle X and Z
        const playerVelocity = new THREE.Vector3();
        this.controls.getDirection(playerVelocity);
        playerVelocity.y = 0;
        playerVelocity.normalize();
        playerVelocity.multiplyScalar(
             (Number(this.keys['KeyW'] || this.moveForward) - Number(this.keys['KeyS'] || this.moveBackward)) * this.speed * this.delta
        );

        const rightVelocity = new THREE.Vector3();
        rightVelocity.copy(playerVelocity).cross(this.camera.up).normalize();
        rightVelocity.multiplyScalar(
            (Number(this.keys['KeyA'] || this.moveLeft) - Number(this.keys['KeyD'] || this.moveRight)) * this.speed * this.delta
        );


        // --- X-AXIS (HORIZONTAL) COLLISION ---
        playerPos.x += playerVelocity.x + rightVelocity.x;
        let playerBoxX = new THREE.Box3().setFromCenterAndSize(
            playerPos,
            new THREE.Vector3(0.5, this.height, 0.5)
        );
        for (const box of worldBoxes) {
            if (playerBoxX.intersectsBox(box)) {
                 playerPos.x -= (playerVelocity.x + rightVelocity.x); // Revert x movement
                 break;
            }
        }

        // --- Z-AXIS (HORIZONTAL) COLLISION ---
        playerPos.z += playerVelocity.z + rightVelocity.z;
        let playerBoxZ = new THREE.Box3().setFromCenterAndSize(
            playerPos,
            new THREE.Vector3(0.5, this.height, 0.5)
        );

        for (const box of worldBoxes) {
             if (playerBoxZ.intersectsBox(box)) {
                 playerPos.z -= (playerVelocity.z + rightVelocity.z); // Revert z movement
                 break;
             }
        }
    }

    update(delta, world) {
        this.delta = delta; // Store delta for use in handleCollisions

        this.velocity.y -= this.gravity * delta;

        this.direction.z = Number(this.keys['KeyW'] || this.moveForward) - Number(this.keys['KeyS'] || this.moveBackward);
        this.direction.x = Number(this.keys['KeyA'] || this.moveLeft) - Number(this.keys['KeyD'] || this.moveRight);
        this.direction.normalize(); // Ensure consistent speed in all directions

        if ((this.keys['Space']) && this.onGround) {
            this.velocity.y = this.jumpHeight;
            this.onGround = false;
        }

        this.handleCollisions(world);

        // Fallback respawn
        if (this.controls.getObject().position.y < -20) {
            this.velocity.y = 0;
            this.controls.getObject().position.set(0, this.height, 10);
        }
    }
}