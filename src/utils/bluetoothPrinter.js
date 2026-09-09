// ============================================================
// utils/bluetoothPrinter.js
//
// Conexao direta com a impressora via Web Bluetooth (API do navegador),
// sem precisar instalar nenhum app externo no celular.
//
// IMPORTANTE — leia antes de alterar:
// A Web Bluetooth API só enxerga servicos/caracteristicas GATT que o
// navegador foi explicitamente autorizado a acessar (por seguranca, o
// Chrome bloqueia leitura de qualquer servico nao declarado). Por isso
// pedimos acesso a uma lista de servicos "candidatos" conhecidos, que sao
// os mais usados por impressoras termicas/de etiqueta Bluetooth baratas
// (a familia de protocolo usada por apps como Eleph-Label, Phomemo,
// NIIMBOT, "cat printers" etc). Isso NAO garante que a impressora use
// exatamente um desses servicos — é a melhor tentativa possivel sem
// documentacao oficial do fabricante.
//
// O fluxo é:
//   1. conectarImpressora() -> pede pareamento e abre a conexao GATT
//   2. listarServicosECaracteristicas() -> devolve tudo que foi encontrado
//      (use isso para descobrir o servico/caracteristica REAL da sua
//      impressora — normalmente a que tem propriedade "write" ou
//      "writeWithoutResponse" e nao é um servico padrao do Bluetooth)
//   3. enviarTesteTexto() -> tenta mandar um texto simples em ESC/POS
//      básico pela primeira caracteristica gravável encontrada. É uma
//      tentativa experimental, não uma garantia.
// ============================================================

// Servicos GATT padrao do Bluetooth (não são canal de impressão, mas
// aparecem em quase todo dispositivo — úteis para identificar o nome).
const SERVICOS_PADRAO_BLUETOOTH = new Set([
  "00001800-0000-1000-8000-00805f9b34fb", // Generic Access
  "00001801-0000-1000-8000-00805f9b34fb", // Generic Attribute
  "0000180a-0000-1000-8000-00805f9b34fb", // Device Information
  "0000180f-0000-1000-8000-00805f9b34fb", // Battery Service
]);

// Servicos "candidatos" usados por impressoras térmicas/etiqueta BLE
// baratas conhecidas (compilado de projetos open-source de engenharia
// reversa dessa família de impressoras — não é documentação oficial da
// Baihuo/Eleph-Label).
export const SERVICOS_CANDIDATOS = [
  "0000ae30-0000-1000-8000-00805f9b34fb", // família "cat printer" (GB01/GB02/D30 etc.)
  "0000ff00-0000-1000-8000-00805f9b34fb", // vários clones genéricos
  "0000ffe0-0000-1000-8000-00805f9b34fb", // módulo serial estilo HM-10
  "0000fff0-0000-1000-8000-00805f9b34fb", // outro clone comum
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // UART transparente ISSC
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service
  "000018f0-0000-1000-8000-00805f9b34fb", // visto em impressoras POS-58 clone
  ...SERVICOS_PADRAO_BLUETOOTH,
];

let dispositivoConectado = null;
let servidorGatt = null;

export function suportaWebBluetooth() {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

/** Abre o seletor nativo do navegador para escolher/parear a impressora. */
export async function conectarImpressora() {
  if (!suportaWebBluetooth()) {
    throw new Error(
      "Este navegador não suporta Web Bluetooth. Use o Chrome (Android, Windows ou Mac) em uma conexão segura (https ou localhost)."
    );
  }

  const dispositivo = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICOS_CANDIDATOS,
  });

  const servidor = await dispositivo.gatt.connect();

  dispositivoConectado = dispositivo;
  servidorGatt = servidor;

  return {
    nome: dispositivo.name || "Dispositivo sem nome",
    id: dispositivo.id,
  };
}

export function desconectarImpressora() {
  if (dispositivoConectado?.gatt?.connected) {
    dispositivoConectado.gatt.disconnect();
  }
  dispositivoConectado = null;
  servidorGatt = null;
}

export function estaConectado() {
  return Boolean(dispositivoConectado?.gatt?.connected);
}

/**
 * Varre todos os serviços que o navegador tem permissão de enxergar e
 * lista as características de cada um, com suas propriedades reais
 * (read/write/writeWithoutResponse/notify). Isso é o que revela qual
 * canal a impressora realmente usa para receber dados de impressão.
 */
export async function listarServicosECaracteristicas() {
  if (!servidorGatt) throw new Error("Nenhuma impressora conectada ainda.");

  const servicos = await servidorGatt.getPrimaryServices();
  const resultado = [];

  for (const servico of servicos) {
    const caracteristicas = await servico.getCharacteristics();

    resultado.push({
      servicoUuid: servico.uuid,
      padraoBluetooth: SERVICOS_PADRAO_BLUETOOTH.has(servico.uuid),
      caracteristicas: caracteristicas.map((c) => ({
        uuid: c.uuid,
        propriedades: {
          read: c.properties.read,
          write: c.properties.write,
          writeWithoutResponse: c.properties.writeWithoutResponse,
          notify: c.properties.notify,
          indicate: c.properties.indicate,
        },
        referencia: c,
      })),
    });
  }

  return resultado;
}

/** Acha a primeira característica gravável fora dos serviços padrão do Bluetooth. */
export function encontrarCaracteristicaGravavel(servicos) {
  for (const servico of servicos) {
    if (servico.padraoBluetooth) continue;

    const gravavel = servico.caracteristicas.find(
      (c) => c.propriedades.write || c.propriedades.writeWithoutResponse
    );

    if (gravavel) {
      return { servicoUuid: servico.servicoUuid, caracteristica: gravavel };
    }
  }

  return null;
}

/**
 * Tentativa experimental: monta um texto simples em ESC/POS básico
 * (ESC @ para inicializar + texto + avanço de linha) e envia pela
 * característica gravável encontrada. Pode não funcionar — depende do
 * protocolo real da impressora, que só é confirmado testando.
 */
export async function enviarTesteTexto(caracteristicaGravavel, texto) {
  if (!caracteristicaGravavel) {
    throw new Error("Nenhuma característica gravável foi encontrada.");
  }

  const encoder = new TextEncoder();

  const ESC = 0x1b;
  const INICIALIZAR = new Uint8Array([ESC, 0x40]); // ESC @
  const AVANCO_LINHAS = new Uint8Array([0x0a, 0x0a, 0x0a]);

  const corpo = encoder.encode(texto + "\n");

  const pacote = new Uint8Array([
    ...INICIALIZAR,
    ...corpo,
    ...AVANCO_LINHAS,
  ]);

  const c = caracteristicaGravavel.referencia;

  if (c.properties.writeWithoutResponse) {
    await c.writeValueWithoutResponse(pacote);
  } else {
    await c.writeValue(pacote);
  }
}
