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

    $("#connectBtn").addEventListener("click", connectBLE);

    // ===============================
    // START / STOP
    // ===============================
    $("#btnStart").addEventListener("click", () => {
        console.log("CLICK START");
        sendCommand("START");
    });

    $("#btnStop").addEventListener("click", () => {
        console.log("CLICK STOP");
        sendCommand("STOP");
    });

    // ===============================
    // VENTOLA
    // ===============================
    $all(".vent-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendCommand(`VENT:${btn.dataset.speed}`);
        });
    });

    // ===============================
    // TEMPO ON
    // ===============================
    $all(".ton-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const val = btn.dataset.ton;
            console.log("CLICK TON", val);
            sendCommand(`TON:${val}`);
        });
    });

    // ===============================
    // TEMPO OFF
    // ===============================
    $all(".toff-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const val = btn.dataset.toff;
            console.log("CLICK TOFF", val);
            sendCommand(`TOFF:${val}`);
        });
    });

    // ===============================
    // MODALITÀ POMPA
    // ===============================
    $("#modeManual").addEventListener("click", () => {
        console.log("CLICK MODE MAN");
        sendCommand("MODE:MAN");
    });

    $("#modeAuto").addEventListener("click", () => {
        console.log("CLICK MODE AUTO");
        sendCommand("MODE:AUTO");
    });

    // ===============================
    // PROFILI
    // ===============================
    $("#btnP1").addEventListener("click", () => {
        selectedProfile = "P1";
        console.log("Profilo selezionato:", selectedProfile);
        sendCommand("LOAD:P1");
    });

    $("#btnP2").addEventListener("click", () => {
        selectedProfile = "P2";
        console.log("Profilo selezionato:", selectedProfile);
        sendCommand("LOAD:P2");
    });

    $("#btnP3").addEventListener("click", () => {
        selectedProfile = "P3";
        console.log("Profilo selezionato:", selectedProfile);
        sendCommand("LOAD:P3");
    });

    // ===============================
    // SALVA PROFILO
    // ===============================
    $("#btnSaveProfile").addEventListener("click", () => {
        console.log("CLICK SALVA", selectedProfile);
        if (!selectedProfile) return;
        sendCommand(`SAVE:${selectedProfile}`);
    });

    // ===============================
    // RESET PROFILO
    // ===============================
    $("#btnResetProfile").addEventListener("click", () => {
        console.log("CLICK RESET", selectedProfile);
        if (!selectedProfile) return;
        sendCommand(`RESET:${selectedProfile}`);
    });
}

window.addEventListener("DOMContentLoaded", setupUI);


