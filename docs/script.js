console.log("SCRIPT.JS CARICATO");

// ===============================
// CONFIGURAZIONE BLE
// ===============================

const BLE_SERVICE_UUID        = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

let bleDevice = null;
let bleServer = null;
let bleCharacteristic = null;

let selectedProfile = null;

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
// RICEZIONE NOTIFICHE
// ===============================

function handleIncoming(msg) {
    console.log("RX ←", msg);

    if (msg.startsWith("PROFILE:")) return;

    if (msg.startsWith("VENT:")) {
        $("#statusVentola").textContent = msg.split(":")[1];
        return;
    }

    if (msg.startsWith("TON:")) return;
    if (msg.startsWith("TOFF:")) return;

    if (msg.startsWith("MODE:")) {
        $("#statusMode").textContent = msg.split(":")[1];
        return;
    }

    if (msg.startsWith("ACTIVE:")) {
        $("#statusProfile").textContent = msg.split(":")[1];
        return;
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

        // ATTIVA NOTIFICHE
        await bleCharacteristic.startNotifications();
        bleCharacteristic.addEventListener("characteristicvaluechanged", event => {
            const msg = new TextDecoder().decode(event.target.value).trim();
            handleIncoming(msg);
        });

    } catch (err) {
        console.error("Errore BLE:", err);
    }
}

// ===============================
// EVENTI UI
// ===============================

function setupUI() {

    $("#connectBtn").addEventListener("click", connectBLE);

    // START / STOP
    $("#startBtn").addEventListener("click", () => sendCommand("START"));
    $("#stopBtn").addEventListener("click", () => sendCommand("STOP"));

    // VENTOLA
    $all(".vent-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendCommand(`VENT:${btn.dataset.speed}`);
        });
    });

    // TON
    $all(".ton-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendCommand(`TON:${btn.dataset.ton}`);
        });
    });

    // TOFF
    $all(".toff-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendCommand(`TOFF:${btn.dataset.toff}`);
        });
    });

    // MODALITÀ
    $("#modeManual").addEventListener("click", () => sendCommand("MODE:MAN"));
    $("#modeAuto").addEventListener("click", () => sendCommand("MODE:AUTO"));

    // PROFILI
    $("#btnP1").addEventListener("click", () => { selectedProfile = "P1"; sendCommand("LOAD:P1"); });
    $("#btnP2").addEventListener("click", () => { selectedProfile = "P2"; sendCommand("LOAD:P2"); });
    $("#btnP3").addEventListener("click", () => { selectedProfile = "P3"; sendCommand("LOAD:P3"); });

    // SALVA / RESET
    $("#btnSaveProfile").addEventListener("click", () => {
        if (selectedProfile) sendCommand(`SAVE:${selectedProfile}`);
    });

    $("#btnResetProfile").addEventListener("click", () => {
        if (selectedProfile) sendCommand(`RESET:${selectedProfile}`);
    });
}

window.addEventListener("DOMContentLoaded", setupUI);



