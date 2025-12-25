// ===============================
// CONFIGURAZIONE BLE
// ===============================

const BLE_SERVICE_UUID        = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

let bleDevice = null;
let bleServer = null;
let bleCharacteristic = null;

let selectedProfile = null;

// ===============================
// UTILITY
// ===============================

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

// ===============================
// INVIO COMANDI
// ===============================

async function sendCommand(cmd) {
    console.log("TX →", cmd);

    if (!bleCharacteristic) {
        console.warn("BLE non connesso");
        return;
    }

    try {
        const data = new TextEncoder().encode(cmd);
        await bleCharacteristic.writeValue(data);
    } catch (e) {
        console.error("Errore invio BLE:", e);
    }
}

// ===============================
// CONNESSIONE BLE
// ===============================

async function connectBLE() {
    try {
        bleDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [BLE_SERVICE_UUID]
        });

        bleServer = await bleDevice.gatt.connect();
        const service = await bleServer.getPrimaryService(BLE_SERVICE_UUID);
        bleCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

        console.log("BLE connesso");
        $("#connectBtn").textContent = "Connesso";

    } catch (err) {
        console.error("Errore BLE:", err);
    }
}

// ===============================
// EVENTI UI
// ===============================

function setupUI() {

    // CONNETTI
    $("#connectBtn").addEventListener("click", connectBLE);

    // VELOCITÀ
    $all(".vent-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const speed = btn.dataset.speed; // V1, V2, V3...
            sendCommand(`VENT:${speed}`);
        });
    });

    // PROFILI
    $("#btnP1").addEventListener("click", () => {
        selectedProfile = "P1";
        sendCommand("LOAD:P1");
    });

    $("#btnP2").addEventListener("click", () => {
        selectedProfile = "P2";
        sendCommand("LOAD:P2");
    });

    $("#btnP3").addEventListener("click", () => {
        selectedProfile = "P3";
        sendCommand("LOAD:P3");
    });

    // SALVA
    $("#btnSaveProfile").addEventListener("click", () => {
        if (!selectedProfile) return;
        sendCommand(`SAVE:${selectedProfile}`);
    });

    // RESET
    $("#btnResetProfile").addEventListener("click", () => {
        if (!selectedProfile) return;
        sendCommand(`RESET:${selectedProfile}`);
    });
}

// ===============================
// INIT
// ===============================

window.addEventListener("DOMContentLoaded", () => {
    setupUI();
});




