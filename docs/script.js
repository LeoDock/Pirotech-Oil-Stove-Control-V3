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
// STATO LOCALE DELL'APP
// ===============================

let currentVentola = 'V1';
let currentTon = 5;
let currentToff = 3;
let currentMode = 'MAN';
let systemRunning = false;

let selectedProfile = null;                 // "P1" / "P2" / "P3"
let profileStates   = { P1: "EMPTY", P2: "EMPTY", P3: "EMPTY" };  // VALID / EMPTY

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
    $('#statusMode').textContent    = (currentMode === 'MAN') ? 'Manuale' : 'Automatica';
    $('#statusProfile').textContent = selectedProfile ?? '-';
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

function updateProfileButtonsUI() {
    ["P1","P2","P3"].forEach(p => {
        const btn = $("#btn" + p);
        if (!btn) return;

        btn.classList.remove("selected", "valid", "empty");

        // Stato salvato/vuoto
        if (profileStates[p] === "VALID") btn.classList.add("valid");
        else btn.classList.add("empty");

        // Profilo selezionato = verde
        if (selectedProfile === p) btn.classList.add("selected");
    });
}

function syncActiveButtonsUI() {
    setActiveButton($all('.vent-btn'), btn => btn.dataset.speed === currentVentola);
    setActiveButton($all('.ton-btn'),  btn => parseInt(btn.dataset.ton, 10)  === currentTon);
    setActiveButton($all('.toff-btn'), btn => parseInt(btn.dataset.toff, 10) === currentToff);

    $('#modeManual').classList.toggle('active', currentMode === 'MAN');
    $('#modeAuto').classList.toggle('active',  currentMode === 'AUTO');

    $('#startBtn').classList.toggle('active', systemRunning);
    $('#stopBtn').classList.toggle('active', !systemRunning);

    updateProfileButtonsUI();
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
        const p = 'P' + cmd.split('P')[1];
        selectedProfile = p;

    } else if (cmd.startsWith('SAVE:P')) {
        const p = 'P' + cmd.split('P')[1];
        selectedProfile = p;
        profileStates[p] = "VALID";

    } else if (cmd.startsWith('RESET:P')) {
        const p = 'P' + cmd.split('P')[1];
        profileStates[p] = "EMPTY";
    }

    updateStatusUI();
    syncActiveButtonsUI();
}

// ===============================
// CONNESSIONE BLE (WEB BLUETOOTH + LEGACY)
// ===============================

function isWebBluetoothAvailable() {
    return navigator.bluetooth && navigator.bluetooth.requestDevice;
}

async function connectBLE() {
    if (bleDevice && bleServer && bleCharacteristic) {
        console.log('BLE già connesso.');
        return;
    }

    if (isWebBluetoothAvailable()) {
        console.log("Web Bluetooth disponibile → uso BLE ufficiale");
        return connectWebBluetooth();
    }

    console.log("Web Bluetooth NON disponibile → uso BLE Legacy");
    return connectLegacyBLE();
}

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

async function connectLegacyBLE() {
    if (!window.LegacyBLE) {
        alert("Errore: ble-legacy.js non caricato");
        return;
    }

    console.log("Connessione tramite Legacy BLE...");

    bleDriver = new LegacyBLE();
    await bleDriver.connect();

    bleDevice = bleDriver.device;
    bleServer = bleDriver.server;
    bleCharacteristic = bleDriver.tx;

    updateBLEButtonState(true);
}

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

    // PROFILI: P1 / P2 / P3
    $('#btnP1').addEventListener('click', () => {
        selectedProfile = "P1";
        sendCommand('LOAD:P1');
    });

    $('#btnP2').addEventListener('click', () => {
        selectedProfile = "P2";
        sendCommand('LOAD:P2');
    });

    $('#btnP3').addEventListener('click', () => {
        selectedProfile = "P3";
        sendCommand('LOAD:P3');
    });

    // SALVA / RESET sul profilo selezionato
    $('#btnSaveProfile').addEventListener('click', () => {
        if (!selectedProfile) return;
        sendCommand(`SAVE:${selectedProfile}`);
    });

    $('#btnResetProfile').addEventListener('click', () => {
        if (!selectedProfile) return;
        sendCommand(`RESET:${selectedProfile}`);
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



