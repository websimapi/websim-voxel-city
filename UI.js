import QRCode from 'qrcode';

export class UI {
    constructor(multiplayer) {
        this.multiplayer = multiplayer;
        
        this.connectBtn = document.getElementById('connect-btn');
        this.modalBackdrop = document.getElementById('modal-backdrop');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.myPeerIdEl = document.getElementById('my-peer-id');
        this.qrCodeEl = document.getElementById('qrcode');
        this.peerIdInput = document.getElementById('peer-id-input');
        this.connectToPeerBtn = document.getElementById('connect-to-peer-btn');

        this.connectBtn.addEventListener('click', () => this.showModal());
        this.closeModalBtn.addEventListener('click', () => this.hideModal());
        this.modalBackdrop.addEventListener('click', (e) => {
            if (e.target === this.modalBackdrop) this.hideModal();
        });

        this.connectToPeerBtn.addEventListener('click', () => {
            const peerId = this.peerIdInput.value.trim();
            if (peerId) {
                this.multiplayer.connect(peerId);
                this.hideModal();
            }
        });

        window.onPeerId = async (id) => {
            this.myPeerIdEl.textContent = id;
            try {
                await QRCode.toCanvas(this.qrCodeEl, id);
                console.log('QR code generated!');
            } catch (error) {
                console.error('Error generating QR code:', error);
            }
        };
    }

    showModal() {
        this.modalBackdrop.classList.remove('hidden');
    }

    hideModal() {
        this.modalBackdrop.classList.add('hidden');
    }
}

