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

        this.initMobileControls();
    }

    initMobileControls() {
        if (!isMobile) return;

        this.moveVector = new THREE.Vector2();
        this.lookVector = new THREE.Vector2();

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
                this.moveVector.set(data.vector.x, data.vector.y);
            }
        });

        joystickMove.on('end', () => {
            this.moveVector.set(0, 0);
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
                this.lookVector.set(data.vector.x, data.vector.y);
            }
        });

        joystickLook.on('end', () => {
            this.lookVector.set(0, 0);
        });
        
        // Remove old touch listeners
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
        const forward = new THREE.Vector3();
        // Use camera's parent for forward direction, as camera itself is rotated for pitch.
        this.controls.getObject().getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.copy(forward).cross(this.camera.up);

        const forwardMovement = -(Number(this.keys['KeyW']) - Number(this.keys['KeyS'])) || -this.moveVector.y;
        const rightMovement = (Number(this.keys['KeyD']) - Number(this.keys['KeyA'])) || this.moveVector.x;
        
        const moveDirection = new THREE.Vector3()
            .add(forward.multiplyScalar(forwardMovement))
            .add(right.multiplyScalar(rightMovement));

        if (moveDirection.length() > 0) {
            moveDirection.normalize();
        }

        const moveVector = moveDirection.multiplyScalar(this.speed * this.delta);


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
        this.delta = delta; // Store delta for use in handleCollisions

        if (isMobile && this.lookVector.length() > 0) {
            // Horizontal rotation (Yaw)
            this.controls.getObject().rotation.y -= this.lookVector.x * delta * 2;
            
            // Vertical rotation (Pitch)
            this.camera.rotation.x -= this.lookVector.y * delta;
            this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
        }

        this.velocity.y -= this.gravity * delta;

        // This calculation is now handled in handleCollisions, so it's redundant here.
        // this.direction.z = Number(this.keys['KeyW'] || this.moveForward) - Number(this.keys['KeyS'] || this.moveBackward);
        // this.direction.x = Number(this.keys['KeyA'] || this.moveLeft) - Number(this.keys['KeyD'] || this.moveRight);
        // this.direction.normalize(); // Ensure consistent speed in all directions

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