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
// FUNZIONI DI SELEZIONE VERDE
// ===============================

function clearSelection(selectors) {
    selectors.forEach(sel => {
        document.querySelector(sel)?.classList.remove("selected");
    });
}

function selectButton(selector) {
    document.querySelector(selector)?.classList.add("selected");
}

// ===============================
// VENTOLA (OFF, V1, V2, V3, V4, V5)
// ===============================

function evidenziaVentola(mode) {
    $all(".vent-btn").forEach(btn => {
        btn.classList.remove("selected");
        if (btn.dataset.speed === mode) {
            btn.classList.add("selected");
        }
    });
}

// ===============================
// TON (tempi ON)
// ===============================

function evidenziaTon(value) {
    $all(".ton-btn").forEach(btn => {
        btn.classList.remove("selected");
        if (btn.dataset.ton === value) {
            btn.classList.add("selected");
        }
    });
}

// ===============================
// TOFF (tempi OFF)
// ===============================

function evidenziaToff(value) {
    $all(".toff-btn").forEach(btn => {
        btn.classList.remove("selected");
        if (btn.dataset.toff === value) {
            btn.classList.add("selected");
        }
    });
}

// ===============================
// PROFILI
// ===============================

function evidenziaProfilo(p) {
    clearSelection(["#btnP1", "#btnP2", "#btnP3"]);
    selectButton("#btnP" + p);
}

// ===============================
// MODALITÀ (MAN/AUTO)
// ===============================

function evidenziaModalita(mode) {
    clearSelection(["#modeManual", "#modeAuto"]);
    selectButton(mode === "MAN" ? "#modeManual" : "#modeAuto");
}

// ===============================
// START / STOP
// ===============================

function evidenziaSistema(isOn) {
    clearSelection(["#startBtn", "#stopBtn"]);
    selectButton(isOn ? "#startBtn" : "#stopBtn");
}

// ===============================
// RICEZIONE NOTIFICHE BLE
// ===============================

function handleIncoming(msg) {
    console.log("RX ←", msg);

    if (msg.startsWith("PROFILE:")) return;

    if (msg.startsWith("VENT:")) {
        const mode = msg.split(":")[1];
        $("#statusVentola").textContent = mode;
        evidenziaVentola(mode);
        return;
    }

    if (msg.startsWith("TON:")) {
        const value = msg.replace("TON:", "");
        evidenziaTon(value);
        return;
    }

    if (msg.startsWith("TOFF:")) {
        const value = msg.replace("TOFF:", "");
        evidenziaToff(value);
        return;
    }

    if (msg.startsWith("MODE:")) {
        const mode = msg.split(":")[1];
        $("#statusMode").textContent = mode;
        evidenziaModalita(mode);
        return;
    }

    if (msg.startsWith("ACTIVE:P")) {
        const p = msg.replace("ACTIVE:P", "");
        $("#statusProfile").textContent = "P" + p;
        evidenziaProfilo(p);
        return;
    }

    if (msg === "SYS:ON") {
        evidenziaSistema(true);
        return;
    }

    if (msg === "SYS:OFF") {
        evidenziaSistema(false);
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
    $("#startBtn").addEventListener("click", () => {
        sendCommand("START");
        evidenziaSistema(true);
    });

    $("#stopBtn").addEventListener("click", () => {
        sendCommand("STOP");
        evidenziaSistema(false);
    });

    // VENTOLA
    $all(".vent-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendCommand(`VENT:${btn.dataset.speed}`);
            evidenziaVentola(btn.dataset.speed);
        });
    });

    // TON
    $all(".ton-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendCommand(`TON:${btn.dataset.ton}`);
            evidenziaTon(btn.dataset.ton);
        });
    });

    // TOFF
    $all(".toff-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sendCommand(`TOFF:${btn.dataset.toff}`);
            evidenziaToff(btn.dataset.toff);
        });
    });

    // MODALITÀ
    $("#modeManual").addEventListener("click", () => {
        sendCommand("MODE:MAN");
        evidenziaModalita("MAN");
    });

    $("#modeAuto").addEventListener("click", () => {
        sendCommand("MODE:AUTO");
        evidenziaModalita("AUTO");
    });

    // PROFILI
    $("#btnP1").addEventListener("click", () => {
        selectedProfile = "P1";
        sendCommand("LOAD:P1");
        evidenziaProfilo(1);
    });

    $("#btnP2").addEventListener("click", () => {
        selectedProfile = "P2";
        sendCommand("LOAD:P2");
        evidenziaProfilo(2);
    });

    $("#btnP3").addEventListener("click", () => {
        selectedProfile = "P3";
        sendCommand("LOAD:P3");
        evidenziaProfilo(3);
    });

    // SALVA / RESET
    $("#btnSaveProfile").addEventListener("click", () => {
        if (selectedProfile) sendCommand(`SAVE:${selectedProfile}`);
    });

    $("#btnResetProfile").addEventListener("click", () => {
        if (selectedProfile) sendCommand(`RESET:${selectedProfile}`);
    });
}

window.addEventListener("DOMContentLoaded", setupUI);

