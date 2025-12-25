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

let selectedProfile = null;   // P1 / P2 / P3
let profileStates = { P1: "EMPTY", P2: "EMPTY", P3: "EMPTY" };

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

function syncActiveButtonsUI() {
    setActiveButton($all('.vent-btn'), btn => btn.dataset.speed === currentVentola);
    setActiveButton($all('.ton-btn'), btn => parseInt(btn.dataset.ton, 10) === currentTon);
    setActiveButton($all('.toff-btn'), btn => parseInt(btn.dataset.toff, 10) === currentToff);

    $('#modeManual').classList.toggle('active', currentMode === 'MAN');
    $('#modeAuto').classList.toggle('active', currentMode === 'AUTO');

    $('#startBtn').classList.toggle('active', systemRunning);
    $('#stopBtn').classList.toggle('active', !systemRunning);

    updateProfileButtonsUI();
}

function setActiveButton(buttons, predicate) {
    buttons.forEach(btn => {
        if (predicate(btn)) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// ===============================
// PROFILI: UI
// ===============================

function updateProfileButtonsUI() {
    ["P1","P2","P3"].forEach(p => {
        const btn = $("#btn" + p);

        btn.classList.remove("selected", "valid", "empty");

        if (selectedProfile === p) btn.classList.add("selected");
        if (profileStates[p] === "VALID") btn.classList.add("valid");
        if (profileStates[p] === "EMPTY") btn.classList.add("empty");
    });
}

// ===============================
// INVIO COMANDI AL FIRMWARE
// ===============================

async function sendCommand(command) {
    console.log("Comando →", command);

    handleLocalCommand(command);

    if (!bleCharacteristic) {
        console.warn("BLE non connesso, comando solo locale.");
        return;
    }

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(command + "\n");
        await bleCharacteristic.writeValue(data);
    } catch (err) {
        console.error("Errore invio BLE:", err);
    }
}

// ===============================
// GESTIONE COMANDI IN LOCALE
// ===============================

function handleLocalCommand(cmd) {

    if (cmd === "START") systemRunning = true;
    else if (cmd === "STOP") systemRunning = false;

    else if (cmd === "MODE:MAN") currentMode = "MAN";
    else if (cmd === "MODE:AUTO") currentMode = "AUTO";

    else if (cmd.startsWith("VENT:")) currentVentola = cmd.split(":")[1];
    else if (cmd.startsWith("TON:")) currentTon = parseInt(cmd.split(":")[1]);
    else if (cmd.startsWith("TOFF:")) currentToff = parseInt(cmd.split(":")[1]);

    else if (cmd.startsWith("SELECT:P")) {
        selectedProfile = cmd.split(":")[1];
    }

    else if (cmd === "SAVE:SEL" && selectedProfile) {
        profileStates[selectedProfile] = "VALID";
    }

    else if (cmd === "RESET:SEL" && selectedProfile) {
        profileStates[selectedProfile] = "EMPTY";
    }

    updateStatusUI();
    syncActiveButtonsUI();
}

// ===============================
// CONNESSIONE BLE
// ===============================

function isWebBluetoothAvailable() {
    return navigator.bluetooth && navigator.bluetooth.requestDevice;
}

async function connectBLE() {
    if (bleDevice && bleServer && bleCharacteristic) return;

    if (isWebBluetoothAvailable()) return connectWebBluetooth();
    return connectLegacyBLE();
}

async function connectWebBluetooth() {
    try {
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [BLE_SERVICE_UUID]
        });

        bleDevice = device;
        bleDevice.addEventListener("gattserverdisconnected", onBLEDisconnect);

        const server = await device.gatt.connect();
        bleServer = server;

        const service = await server.getPrimaryService(BLE_SERVICE_UUID);
        bleCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

        updateBLEButtonState(true);

    } catch (err) {
        console.error("Errore BLE:", err);
        updateBLEButtonState(false);
    }
}

async function connectLegacyBLE() {
    if (!window.LegacyBLE) {
        alert("Errore: ble-legacy.js non caricato");
        return;
    }

    bleDriver = new LegacyBLE();
    await bleDriver.connect();

    bleDevice = bleDriver.device;
    bleServer = bleDriver.server;
    bleCharacteristic = bleDriver.tx;

    updateBLEButtonState(true);
}

function onBLEDisconnect() {
    bleDevice = null;
    bleServer = null;
    bleCharacteristic = null;
    updateBLEButtonState(false);
}

function updateBLEButtonState(connected) {
    const btn = $("#connectBtn");
    btn.classList.toggle("connected", connected);
    btn.textContent = connected ? "BLE connesso" : "Connetti BLE";
}

// ===============================
// EVENTI UI
// ===============================

function setupUIEvents() {

    $("#connectBtn").addEventListener("click", () => connectBLE());

    $all(".vent-btn").forEach(btn =>
        btn.addEventListener("click", () => sendCommand(`VENT:${btn.dataset.speed}`))
    );

    $all(".ton-btn").forEach(btn =>
        btn.addEventListener("click", () => sendCommand(`TON:${btn.dataset.ton}`))
    );

    $all(".toff-btn").forEach(btn =>
        btn.addEventListener("click", () => sendCommand(`TOFF:${btn.dataset.toff}`))
    );

    $("#modeManual").addEventListener("click", () => sendCommand("MODE:MAN"));
    $("#modeAuto").addEventListener("click", () => sendCommand("MODE:AUTO"));

    $("#startBtn").addEventListener("click", () => sendCommand("START"));
    $("#stopBtn").addEventListener("click", () => sendCommand("STOP"));

    // PROFILI: selezione
    $("#btnP1").addEventListener("click", () => sendCommand("SELECT:P1"));
    $("#btnP2").addEventListener("click", () => sendCommand("SELECT:P2"));
    $("#btnP3").addEventListener("click", () => sendCommand("SELECT:P3"));

    // PROFILI: azioni
    $("#btnSaveProfile").addEventListener("click", () => sendCommand("SAVE:SEL"));
    $("#btnResetProfile").addEventListener("click", () => sendCommand("RESET:SEL"));
}

// ===============================
// INIT
// ===============================

window.addEventListener("DOMContentLoaded", () => {
    setupUIEvents();
    updateStatusUI();
    syncActiveButtonsUI();
});

