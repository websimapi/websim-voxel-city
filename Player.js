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
        document.body.addEventListener('click', () => {
            this.controls.lock().catch(err => {
                // This can happen if the user denies the request or it's not in a trusted context.
                // It's not a critical error, so we can just log it.
                console.log("Could not lock pointer:", err);
            });
        });

        this.keys = {};
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Input vectors
        this.moveDirection = new THREE.Vector3();
        this.lookDirection = new THREE.Vector2();

        this.initMobileControls();
    }

    initMobileControls() {
        if (!isMobile) return;

        // Left joystick for movement
        const joystickContainerLeft = document.getElementById('joystick-container-left');
        const joystickMove = nipplejs.create({
            zone: joystickContainerLeft,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
        });

        joystickMove.on('move', (evt, data) => {
            if (data.vector) {
                this.moveDirection.set(data.vector.x, 0, -data.vector.y);
            }
        });

        joystickMove.on('end', () => {
            this.moveDirection.set(0, 0, 0);
        });

        // Right joystick for looking
        const joystickContainerRight = document.getElementById('joystick-container-right');
        const joystickLook = nipplejs.create({
            zone: joystickContainerRight,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
        });

        joystickLook.on('move', (evt, data) => {
             if (data.vector) {
                this.lookDirection.set(data.vector.x, data.vector.y);

                const movementX = data.vector.x * 5; // Sensitivity multiplier
                const movementY = data.vector.y * 5; // Sensitivity multiplier

                const euler = new THREE.Euler(0, 0, 0, 'YXZ');
                euler.setFromQuaternion(this.camera.quaternion);

                euler.y -= movementX * 0.002;
                euler.x -= movementY * 0.002;

                // Clamp vertical rotation
                const PI_2 = Math.PI / 2;
                euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));

                this.camera.quaternion.setFromEuler(euler);
            }
        });

        joystickLook.on('end', () => {
            this.lookDirection.set(0, 0);
        });
        
        // Remove old touch listeners
    }

    handleCollisions(world, moveVector) {
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
        
        // --- X-AXIS (HORIZONTAL) COLLISION ---
        playerPos.x += moveVector.x;
        let playerBoxX = new THREE.Box3().setFromCenterAndSize(
            playerPos,
            new THREE.Vector3(0.5, this.height, 0.5)
        );
        for (const box of worldBoxes) {
            if (playerBoxX.intersectsBox(box)) {
                 playerPos.x -= moveVector.x; // Revert x movement
                 break;
            }
        }

        // --- Z-AXIS (HORIZONTAL) COLLISION ---
        playerPos.z += moveVector.z;
        let playerBoxZ = new THREE.Box3().setFromCenterAndSize(
            playerPos,
            new THREE.Vector3(0.5, this.height, 0.5)
        );

        for (const box of worldBoxes) {
             if (playerBoxZ.intersectsBox(box)) {
                 playerPos.z -= moveVector.z; // Revert z movement
                 break;
             }
        }
    }

    update(delta, world) {
        this.delta = delta; // Store delta for use in other methods

        // --- Handle Rotation ---
        if (isMobile) {
            // Rotation is now handled directly in joystickLook's 'move' event
            // by calling this.controls.onMouseMove(e).
            // This ensures consistent behavior with mouse look.
        }

        // --- Handle Movement Input ---
        if (!isMobile) {
            this.moveDirection.z = -(Number(this.keys['KeyW']) - Number(this.keys['KeyS']));
            this.moveDirection.x = Number(this.keys['KeyD']) - Number(this.keys['KeyA']);
        }

        // --- Calculate Movement Vector ---
        const moveVector = new THREE.Vector3();
        if (this.moveDirection.lengthSq() > 0) {
            const direction = this.moveDirection.clone().normalize();
            this.controls.moveForward(direction.z * this.speed * delta);
            this.controls.moveRight(direction.x * this.speed * delta);

            // Copy the movement to moveVector for collision detection
            const currentPos = this.controls.getObject().position.clone();
            const forwardMove = new THREE.Vector3();
            this.controls.getObject().getWorldDirection(forwardMove);
            forwardMove.y = 0;
            forwardMove.normalize().multiplyScalar(direction.z * this.speed * delta);
            
            const rightMove = new THREE.Vector3();
            this.controls.getObject().getWorldDirection(rightMove);
            rightMove.cross(this.camera.up).normalize().multiplyScalar(direction.x * this.speed * delta);

            moveVector.add(forwardMove).add(rightMove);
            
            // Reset position because we will re-apply it in handleCollisions
            this.controls.getObject().position.copy(currentPos);
        }

        // --- Apply Physics and Collisions ---
        this.velocity.y -= this.gravity * delta;

        if ((this.keys['Space']) && this.onGround) {
            this.velocity.y = this.jumpHeight;
            this.onGround = false;
        }

        this.handleCollisions(world, moveVector);

        // Fallback respawn
        if (this.controls.getObject().position.y < -20) {
            this.velocity.y = 0;
            this.controls.getObject().position.set(0, this.height, 10);
        }
    }
}