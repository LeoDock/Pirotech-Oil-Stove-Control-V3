// ===============================
// CONFIGURAZIONE BLE (UUID CORRETTI)
// ===============================

const BLE_SERVICE_UUID        = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

let bleDevice = null;
let bleServer = null;
let bleCharacteristic = null;

// Driver BLE (Web Bluetooth o Legacy)
let bleDriver = null;

// ===============================
// RILEVAMENTO WEB BLUETOOTH
// ===============================

function isWebBluetoothAvailable() {
    return navigator.bluetooth && navigator.bluetooth.requestDevice;
}

// ===============================
// STATO LOCALE DELL'APP
// ===============================

let currentVentola = 'V1';
let currentTon = 5;
let currentToff = 3;
let currentMode = 'MAN';
let systemRunning = false;
let currentProfile = '-';

const LONG_PRESS_MS = 800;
const VERY_LONG_PRESS_MS = 2000;
let profilePressTimers = {};
let profilePressStart = {};

// ===============================
// UTILITY DOM
// ===============================

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
}

// ===============================
// AGGIORNAMENTO STATO UI
// ===============================

function updateStatusUI() {
    $('#statusVentola').textContent = currentVentola;
    $('#statusPompa').textContent   = systemRunning ? 'ON' : 'OFF';
    $('#statusMode').textContent    = (currentMode === 'MAN') ? 'Manualale' : 'Automatica';
    $('#statusProfile').textContent = currentProfile;
}

function setActiveButton(buttons, predicate) {
    buttons.forEach(btn => {
        if (predicate(btn)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ===============================
// INVIO COMANDI AL FIRMWARE
// ===============================

async function sendCommand(command) {
    console.log('Comando →', command);

    handleLocalCommand(command);

    if (!bleCharacteristic) {
        console.warn('BLE non connesso, comando solo locale.');
        return;
    }

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(command + '\n');
        await bleCharacteristic.writeValue(data);
    } catch (err) {
        console.error('Errore invio BLE:', err);
    }
}

// ===============================
// GESTIONE COMANDI IN LOCALE (UI)
// ===============================

function handleLocalCommand(cmd) {
    if (cmd === 'START') {
        systemRunning = true;
    } else if (cmd === 'STOP') {
        systemRunning = false;
    } else if (cmd === 'MODE:MAN') {
        currentMode = 'MAN';
    } else if (cmd === 'MODE:AUTO') {
        currentMode = 'AUTO';
    } else if (cmd.startsWith('VENT:')) {
        currentVentola = cmd.split(':')[1];
    } else if (cmd.startsWith('TON:')) {
        currentTon = parseInt(cmd.split(':')[1], 10);
    } else if (cmd.startsWith('TOFF:')) {
        currentToff = parseInt(cmd.split(':')[1], 10);
    } else if (cmd.startsWith('LOAD:P')) {
        currentProfile = 'P' + cmd.split('P')[1];
    } else if (cmd.startsWith('RESET:P')) {
        const p = cmd.split('P')[1];
        if (currentProfile === 'P' + p) currentProfile = '-';
    } else if (cmd.startsWith('SAVE:P')) {
        currentProfile = 'P' + cmd.split('P')[1];
    }

    updateStatusUI();
    syncActiveButtonsUI();
}

function syncActiveButtonsUI() {
    setActiveButton($all('.vent-btn'), btn => btn.dataset.speed === currentVentola);
    setActiveButton($all('.ton-btn'), btn => parseInt(btn.dataset.ton, 10) === currentTon);
    setActiveButton($all('.toff-btn'), btn => parseInt(btn.dataset.toff, 10) === currentToff);

    $('#modeManual').classList.toggle('active', currentMode === 'MAN');
    $('#modeAuto').classList.toggle('active', currentMode === 'AUTO');

    $('#startBtn').classList.toggle('active', systemRunning);
    $('#stopBtn').classList.toggle('active', !systemRunning);
}

// ===============================
// CONNESSIONE BLE (WEB BLUETOOTH + LEGACY)
// ===============================

async function connectBLE() {
    if (bleDevice && bleServer && bleCharacteristic) {
        console.log('BLE già connesso.');
        return;
    }

    // Se Web Bluetooth è disponibile → usa quello
    if (isWebBluetoothAvailable()) {
        console.log("Web Bluetooth disponibile → uso BLE ufficiale");
        return connectWebBluetooth();
    }

    // Altrimenti → fallback Legacy
    console.log("Web Bluetooth NON disponibile → uso BLE Legacy");
    return connectLegacyBLE();
}

// -------------------------------
// WEB BLUETOOTH UFFICIALE
// -------------------------------

async function connectWebBluetooth() {
    try {
        console.log("Richiesta dispositivo BLE...");

        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [BLE_SERVICE_UUID]
        });

        console.log("Dispositivo selezionato:", device.name);

        bleDevice = device;
        bleDevice.addEventListener("gattserverdisconnected", onBLEDisconnect);

        console.log("Connessione GATT...");
        const server = await device.gatt.connect();
        bleServer = server;

        console.log("Recupero servizio...");
        const service = await server.getPrimaryService(BLE_SERVICE_UUID);

        console.log("Recupero caratteristica...");
        const characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
        bleCharacteristic = characteristic;

        console.log("BLE connesso correttamente");
        updateBLEButtonState(true);

    } catch (err) {
        console.error("Errore connessione BLE:", err);
        updateBLEButtonState(false);
    }
}

// -------------------------------
// BLE LEGACY (Xiaomi Fix)
// -------------------------------

async function connectLegacyBLE() {
    if (!window.LegacyBLE) {
        alert("Errore: ble-legacy.js non caricato");
        return;
    }

    console.log("Connessione tramite Legacy BLE...");

    bleDriver = new LegacyBLE();
    await bleDriver.connect();

    // Legacy BLE espone direttamente le caratteristiche
    bleDevice = bleDriver.device;
    bleServer = bleDriver.server;
    bleCharacteristic = bleDriver.tx;

    updateBLEButtonState(true);
}

// -------------------------------
// DISCONNESSIONE
// -------------------------------

function onBLEDisconnect() {
    console.warn('BLE disconnesso');
    bleDevice = null;
    bleServer = null;
    bleCharacteristic = null;
    updateBLEButtonState(false);
}

function updateBLEButtonState(connected) {
    const btn = $('#connectBtn');
    if (!btn) return;
    btn.classList.toggle('connected', connected);
    btn.textContent = connected ? 'BLE connesso' : 'Connetti BLE';
}

// ===============================
// EVENTI UI
// ===============================

function setupUIEvents() {
    $('#connectBtn').addEventListener('click', () => connectBLE());

    $all('.vent-btn').forEach(btn =>
        btn.addEventListener('click', () => sendCommand(`VENT:${btn.dataset.speed}`))
    );

    $all('.ton-btn').forEach(btn =>
        btn.addEventListener('click', () => sendCommand(`TON:${parseInt(btn.dataset.ton, 10)}`))
    );

    $all('.toff-btn').forEach(btn =>
        btn.addEventListener('click', () => sendCommand(`TOFF:${parseInt(btn.dataset.toff, 10)}`))
    );

    $('#modeManual').addEventListener('click', () => sendCommand('MODE:MAN'));
    $('#modeAuto').addEventListener('click', () => sendCommand('MODE:AUTO'));

    $('#startBtn').addEventListener('click', () => sendCommand('START'));
    $('#stopBtn').addEventListener('click', () => sendCommand('STOP'));

    $all('.profile-btn').forEach(btn => {
        const profileId = btn.dataset.profile;

        btn.addEventListener('pointerdown', () => {
            profilePressStart[profileId] = Date.now();
            profilePressTimers[profileId] = setTimeout(() => {}, LONG_PRESS_MS);
        });

        btn.addEventListener('pointerup', () => {
            const start = profilePressStart[profileId];
            profilePressStart[profileId] = null;
            clearTimeout(profilePressTimers[profileId]);

            if (!start) return;

            const diff = Date.now() - start;

            if (diff >= VERY_LONG_PRESS_MS) {
                sendCommand(`RESET:${profileId}`);
            } else if (diff >= LONG_PRESS_MS) {
                sendCommand(`SAVE:${profileId}`);
            } else {
                sendCommand(`LOAD:${profileId}`);
            }
        });

        btn.addEventListener('pointerleave', () => {
            if (profilePressStart[profileId]) {
                profilePressStart[profileId] = null;
                clearTimeout(profilePressTimers[profileId]);
            }
        });
    });
}

// ===============================
// INIT
// ===============================

window.addEventListener('DOMContentLoaded', () => {
    setupUIEvents();
    updateStatusUI();
    syncActiveButtonsUI();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(() => console.log('Service worker registrato'))
            .catch(err => console.error('Errore service worker:', err));
    }
});
