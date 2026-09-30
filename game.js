/**
 * NEON REPAIR BAY — Cyberpunk 3D 裝置修理遊戲
 * 全新 3D 引擎：CSS 3D 立體零件、外殼、WASD 鏡頭、動態散開爆炸效果
 */
'use strict';

// ══════════════════════════════════════════════════════════
//  1. 零件知識庫
// ══════════════════════════════════════════════════════════
const PARTS_DB = {
  epd: {
    id:'epd', name:'E Ink 電子紙面板', nameEn:'Electronic Paper Display', icon:'⬡', color:'#00f5ff',
    desc:'電泳式顯示面板，利用微膠囊中帶電的白色與黑色粒子形成影像。雙穩態特性使其無需持續供電即可保持畫面。',
    stats:{'解析度':'300 PPI','灰階':'16 階','更新時間':'< 500ms','類型':'反射式顯示'},
    failModes:['ghosting','partial_update_fail','display_bleed'],
  },
  tft: {
    id:'tft', name:'TFT 背板', nameEn:'Thin-Film Transistor Backplane', icon:'◫', color:'#39ff14',
    desc:'薄膜電晶體矩陣，控制每一像素的電場，驅動電子墨水粒子移動至正確位置以形成影像。',
    stats:{'技術':'非晶矽 TFT','像素電極':'ITO 透明電極','閘極線':'水平掃描線','資料線':'垂直資料線'},
    failModes:['pixel_dead','line_fault','electrode_corrosion'],
  },
  driverIc: {
    id:'driverIc', name:'驅動 IC', nameEn:'Display Driver IC', icon:'▣', color:'#ffe600',
    desc:'產生像素更新所需的高電壓波形序列（Waveform），精確控制粒子移動、灰階與更新速度。',
    stats:{'輸出電壓':'±15V','波形類型':'GL16 / DU / GC16','介面':'SPI / I2C','廠商':'SSD1680 等'},
    failModes:['waveform_error','voltage_unstable','ic_overheat'],
  },
  mcu: {
    id:'mcu', name:'主控 MCU/SoC', nameEn:'Microcontroller Unit', icon:'⬢', color:'#00f5ff',
    desc:'裝置大腦，負責協調 BLE 通訊、顯示控制器、記憶體存取、觸控輸入與電源管理。',
    stats:{'架構':'ARM Cortex-M4','主頻':'64 MHz','RAM':'256 KB','介面':'SPI / UART / I2C'},
    failModes:['firmware_corrupt','watchdog_reset','boot_fail'],
  },
  ble: {
    id:'ble', name:'BLE 模組', nameEn:'Bluetooth Low Energy Module', icon:'◎', color:'#0064ff',
    desc:'Bluetooth Low Energy 無線通訊模組，讓手機 App 可推送畫面更新指令至電子紙裝置。峰值電流 < 15mA。',
    stats:{'規格':'BLE 5.0','頻段':'2.4 GHz','峰值電流':'< 15 mA','待機功耗':'~1 µA'},
    failModes:['pairing_fail','signal_weak','antenna_break'],
  },
  battery: {
    id:'battery', name:'電池', nameEn:'Power Cell', icon:'▭', color:'#ffe600',
    desc:'為裝置提供電力。依更新頻率選擇 CR2032 紐扣電池（極低功耗）或小型鋰聚合物電池（可充電）。',
    stats:{'類型':'LiPo 可充電','容量':'200 mAh','電壓':'3.7V','充電方式':'USB-C / 無線'},
    failModes:['low_capacity','cell_swell','charge_circuit_fail'],
  },
  pmic: {
    id:'pmic', name:'PMIC 電源管理', nameEn:'Power Management IC', icon:'◉', color:'#39ff14',
    desc:'電源管理 IC，協調電池、充電電路與各子系統的電壓轉換，實現深度睡眠與喚醒策略。',
    stats:{'輸入':'3.0V ~ 5.5V','輸出':'1.8V / 3.3V','效率':'> 90%','待機':'< 1 µA'},
    failModes:['voltage_drop','regulator_fail','thermal_shutdown'],
  },
  flash: {
    id:'flash', name:'Flash 記憶體', nameEn:'Flash Storage', icon:'▤', color:'#c864ff',
    desc:'儲存韌體、最後一幀畫面與裝置設定。斷線後仍可維持顯示最後畫面的關鍵元件。',
    stats:{'容量':'8 ~ 32 MB','介面':'SPI','讀取速度':'80 MHz','寫入耐久':'10萬次'},
    failModes:['read_error','wear_out','data_corruption'],
  },
};

const FAIL_MODE_DESC = {
  ghosting:            {label:'殘影',        desc:'前幀畫面殘留於新畫面中，需執行全螢幕刷新清除',          severity:'medium'},
  partial_update_fail: {label:'局部更新失敗', desc:'部分區域無法正常更新，波形資料錯誤',                    severity:'high'},
  display_bleed:       {label:'顯示溢色',    desc:'像素邊緣出現模糊或顏色溢出',                           severity:'low'},
  pixel_dead:          {label:'壞點',        desc:'固定黑色或白色像素，TFT 電晶體損壞',                   severity:'high'},
  line_fault:          {label:'整行故障',    desc:'閘極掃描線短路，導致整行顯示異常',                      severity:'high'},
  electrode_corrosion: {label:'電極腐蝕',    desc:'ITO 透明電極氧化，影響驅動能力',                       severity:'medium'},
  waveform_error:      {label:'波形錯誤',    desc:'驅動時序資料損毀，顯示輸出混亂',                       severity:'high'},
  voltage_unstable:    {label:'電壓不穩',    desc:'高電壓輸出不穩定，影響粒子移動',                       severity:'medium'},
  ic_overheat:         {label:'IC 過熱',     desc:'驅動 IC 溫度過高，觸發過熱保護',                       severity:'medium'},
  firmware_corrupt:    {label:'韌體損毀',    desc:'主控 Flash 中的韌體程式碼損毀，無法正常開機',           severity:'high'},
  watchdog_reset:      {label:'看門狗重啟',  desc:'主控持續重啟，程式陷入無限循環',                        severity:'medium'},
  boot_fail:           {label:'開機失敗',    desc:'裝置無法完成開機自檢程序',                             severity:'high'},
  pairing_fail:        {label:'配對失敗',    desc:'BLE 無法與手機 App 建立穩定連線',                      severity:'medium'},
  signal_weak:         {label:'訊號微弱',    desc:'RF 射頻輸出功率不足，連線距離縮短',                     severity:'low'},
  antenna_break:       {label:'天線斷線',    desc:'PCB 天線走線斷裂，完全無法連線',                       severity:'high'},
  low_capacity:        {label:'電容衰減',    desc:'電池容量降低至額定值 70% 以下',                        severity:'medium'},
  cell_swell:          {label:'電池膨脹',    desc:'鋰聚合物電池氣脹，存在安全風險',                       severity:'high'},
  charge_circuit_fail: {label:'充電電路故障', desc:'無法正常充電，充電 IC 損毀',                           severity:'high'},
  voltage_drop:        {label:'電壓跌落',    desc:'負載時電源電壓不穩，系統異常重啟',                      severity:'medium'},
  regulator_fail:      {label:'穩壓器故障',  desc:'LDO 或 DC-DC 轉換器輸出異常',                         severity:'high'},
  thermal_shutdown:    {label:'熱保護關機',  desc:'PMIC 溫度超過閾值，執行保護性關機',                     severity:'medium'},
  read_error:          {label:'讀取錯誤',    desc:'SPI 通訊故障，無法正常讀取 Flash 資料',                 severity:'medium'},
  wear_out:            {label:'磨損壽命耗盡', desc:'寫入次數超過 Flash 耐久上限',                          severity:'high'},
  data_corruption:     {label:'資料損毀',    desc:'Flash 儲存區塊損毀，需重新燒錄韌體',                   severity:'high'},
};

const DEVICES_DB = [
  {
    id:'esl-kaleido', name:'ESL-3100 彩色電子貨架標籤', type:'Electronic Shelf Label', model:'Spectra 3100 Plus',
    desc:'零售商店使用的低功耗電子價格標籤，支援黑、白、紅、黃四色顯示，適合促銷與折扣資訊。',
    parts:['epd','tft','driverIc','mcu','ble','flash'], damageCount:2, reward:1200, severity:'medium',
    techRef:'E Ink Spectra 3100 Plus — 有限色彩電子紙，針對電子貨架標籤設計',
  },
  {
    id:'ereader-carta', name:'EReader-HD 電子書閱讀器', type:'E-Reader Device', model:'E Ink Carta HD',
    desc:'採用 E Ink Carta HD 顯示面板的電子書閱讀器，提供 300 PPI 高解析度黑白顯示，適合長時間閱讀。',
    parts:['epd','tft','driverIc','mcu','battery','pmic','flash'], damageCount:3, reward:2400, severity:'high',
    techRef:'E Ink Carta HD — 300 PPI 黑白電子紙，廣泛用於電子書閱讀器市場',
  },
  {
    id:'ebadge-gallery', name:'eBadge-NFC 電子識別證', type:'Smart Badge', model:'E Ink Gallery Palette',
    desc:'整合 E Ink Gallery Palette 全彩顯示與無線充電的電子識別證，可在無電池狀態下透過 NFC 點亮畫面。',
    parts:['epd','tft','driverIc','mcu','ble','pmic'], damageCount:2, reward:1800, severity:'medium',
    techRef:'E Ink Gallery Palette — 全彩電子紙，支援無線充電與 NFC，可無電池使用',
  },
  {
    id:'signage-acep', name:'SignagePro-65 電子紙看板', type:'ePaper Signage', model:'E Ink Gallery 3 ACeP',
    desc:'採用 E Ink Gallery 3 ACeP 全彩架構的大型電子紙看板，以四色粒子直接混色，適合博物館與商業展示。',
    parts:['epd','tft','driverIc','mcu','ble','battery','pmic','flash'], damageCount:4, reward:5500, severity:'high',
    techRef:'ACeP — 多色電子墨水粒子全彩技術，適合看板與藝術展示',
  },
  {
    id:'enote-kaleido', name:'eNote-C3 彩色電子筆記本', type:'eNote Device', model:'E Ink Kaleido 3',
    desc:'結合 E Ink Kaleido 3 彩色顯示與電磁筆輸入的書寫裝置，彩色解析度 150 PPI，黑白 300 PPI。',
    parts:['epd','tft','driverIc','mcu','battery','pmic','flash','ble'], damageCount:3, reward:3200, severity:'medium',
    techRef:'E Ink Kaleido 3 — 彩色濾光片搭配黑白電子紙，提供 4096 色閱讀體驗',
  },
];

const KNOWLEDGE_BASE = [
  {icon:'⬡',title:'電泳式顯示原理',desc:'微膠囊內含帶負電白色粒子與帶正電黑色粒子，透過 TFT 像素電極施加電場，驅動不同顏色粒子移動至視線側，形成白色或黑色像素。',tags:['電泳','微膠囊','EPD','顯示原理']},
  {icon:'◉',title:'雙穩態特性',desc:'粒子移動至穩定位置後，即使移除電源，畫面仍可維持。電子紙主要在「更新畫面」時耗電，靜態維持畫面基本上不需要電力。',tags:['雙穩態','低功耗','Bi-stability']},
  {icon:'◈',title:'波形（Waveform）控制',desc:'驅動 IC 輸出精密的電壓序列（Waveform），控制粒子移動速度、灰階層次與殘影消除。GL16、DU、GC16 等波形適用於不同場景。',tags:['波形','驅動IC','Waveform','灰階']},
  {icon:'▣',title:'Kaleido 彩色濾光片',desc:'E Ink Kaleido 在黑白電子紙上加入 RGB 彩色濾光片（CFA），利用混色形成彩色畫面。Kaleido 3 可達彩色 150 PPI、黑白 300 PPI。',tags:['Kaleido','彩色濾光片','CFA','4096色']},
  {icon:'✦',title:'ACeP 全彩電子紙',desc:'Advanced Color ePaper 使用青色、洋紅、黃色與白色等多色電子墨水粒子，透過電壓控制粒子位置與混色，不需傳統 RGB 濾光片。',tags:['ACeP','Gallery','全彩','多色粒子']},
  {icon:'◎',title:'BLE 低功耗藍牙',desc:'BLE 讓手機 App 扮演中央裝置，電子紙作為周邊裝置。峰值電流 < 15mA，平均功耗可達約 1µA，適合低頻率推送更新的電子紙產品。',tags:['BLE','藍牙','低功耗','手機協同']},
  {icon:'▭',title:'電源方案選擇',desc:'CR2032 紐扣電池適合低頻率文字更新；小型鋰聚合物電池適合頻繁更新；無電池 NFC 適合免維護識別證場景。',tags:['CR2032','LiPo','NFC','PMIC']},
  {icon:'◫',title:'混合運算架構',desc:'最佳設計：電子紙負責低功耗畫面保持，手機負責語音辨識、AI 對話與 UI 互動，雲端負責高算力任務，BLE 負責低功耗同步。',tags:['混合架構','BLE','AI','手機協同']},
];

// ══════════════════════════════════════════════════════════
//  2. 3D 零件場景定義（世界座標 + 爆炸座標）
//  x/y/z = 組裝位置，ex/ey/ez = 爆炸後位置
//  W/H/D = 寬/高/深（像素）
// ══════════════════════════════════════════════════════════
const PART_3D = {
  shellFront: {
    // 前蓋外殼
    W:266, H:196, D:9,
    x:0,   y:0,   z:84,
    ex:0,  ey:-50, ez:260,
    front:'rgba(16,24,42,0.97)', back:'rgba(8,12,22,0.97)',
    top:'rgba(24,36,62,0.97)', right:'rgba(12,18,32,0.97)',
    glow:'rgba(0,245,255,0.4)',
    label:'前蓋', isShell:true, order:0,
    frontDeco:'shell-front',
  },
  epd: {
    // E Ink 電子紙面板
    W:222, H:172, D:5,
    x:0,   y:0,   z:62,
    ex:0,  ey:0,  ez:150,
    front:'#c8d0c0', back:'rgba(5,15,10,0.95)',
    top:'rgba(0,245,255,0.15)', right:'rgba(12,22,18,0.9)',
    glow:'rgba(0,245,255,0.5)',
    label:'E Ink EPD 面板', order:1,
    frontDeco:'epd-display',
  },
  tft: {
    // TFT 背板
    W:220, H:170, D:3,
    x:0,   y:0,   z:46,
    ex:0,  ey:0,  ez:80,
    front:'rgba(3,18,8,0.97)', back:'rgba(2,10,5,0.97)',
    top:'rgba(0,150,60,0.25)', right:'rgba(3,14,6,0.9)',
    glow:'rgba(57,255,20,0.4)',
    label:'TFT 背板', order:2,
    frontDeco:'tft-traces',
  },
  driverIc: {
    // 驅動 IC 晶片
    W:54, H:36, D:8,
    x:115, y:22, z:28,
    ex:190, ey:60, ez:50,
    front:'rgba(8,8,10,0.98)', back:'rgba(4,4,6,0.98)',
    top:'rgba(255,210,0,0.3)', right:'rgba(6,6,8,0.9)',
    glow:'rgba(255,220,0,0.55)',
    label:'驅動 IC', order:3,
    frontDeco:'ic-chip',
  },
  mcu: {
    // 主控 MCU
    W:64, H:64, D:8,
    x:115, y:-40, z:14,
    ex:190, ey:-80, ez:20,
    front:'rgba(6,8,14,0.98)', back:'rgba(4,5,10,0.98)',
    top:'rgba(0,200,255,0.2)', right:'rgba(5,6,12,0.9)',
    glow:'rgba(0,245,255,0.55)',
    label:'MCU / SoC', order:4,
    frontDeco:'mcu-chip',
  },
  ble: {
    // BLE 模組
    W:44, H:28, D:6,
    x:115, y:68, z:8,
    ex:195, ey:110, ez:-10,
    front:'rgba(4,8,24,0.98)', back:'rgba(2,5,16,0.98)',
    top:'rgba(0,80,255,0.3)', right:'rgba(3,6,20,0.9)',
    glow:'rgba(0,120,255,0.55)',
    label:'BLE 模組', order:5,
    frontDeco:'ble-module',
  },
  battery: {
    // 電池模組
    W:186, H:64, D:18,
    x:0,   y:35,  z:-8,
    ex:0,  ey:100, ez:-140,
    front:'rgba(8,12,5,0.98)', back:'rgba(5,8,3,0.98)',
    top:'rgba(255,230,0,0.22)', right:'rgba(6,10,4,0.9)',
    glow:'rgba(255,230,0,0.55)',
    label:'電池', order:6,
    frontDeco:'battery-cell',
  },
  pmic: {
    // PMIC 電源管理 IC
    W:36, H:36, D:7,
    x:-90, y:-65, z:-8,
    ex:-150, ey:-110, ez:-65,
    front:'rgba(6,14,6,0.98)', back:'rgba(4,9,4,0.98)',
    top:'rgba(80,255,80,0.2)', right:'rgba(5,11,5,0.9)',
    glow:'rgba(80,255,80,0.5)',
    label:'PMIC', order:7,
    frontDeco:'pmic-chip',
  },
  flash: {
    // Flash 記憶體
    W:26, H:26, D:5,
    x:-90, y:65, z:-8,
    ex:-150, ey:105, ez:-65,
    front:'rgba(14,6,20,0.98)', back:'rgba(9,4,14,0.98)',
    top:'rgba(180,80,255,0.2)', right:'rgba(11,5,17,0.9)',
    glow:'rgba(180,80,255,0.5)',
    label:'Flash', order:8,
    frontDeco:'flash-chip',
  },
  shellBack: {
    // 後蓋外殼
    W:266, H:196, D:11,
    x:0,   y:0,   z:-35,
    ex:0,  ey:50, ez:-260,
    front:'rgba(10,14,24,0.97)', back:'rgba(6,9,16,0.97)',
    top:'rgba(16,22,38,0.97)', right:'rgba(8,12,20,0.97)',
    glow:'rgba(0,245,255,0.2)',
    label:'後蓋', isShell:true, order:9,
    frontDeco:'shell-back',
  },
};

// 裝置 parts 到 PART_3D 的對應關係（包含固定零件：外殼）
const DEVICE_FIXED_PARTS = ['shellFront', 'shellBack'];
const PART_ID_TO_3D = {
  epd:'epd', tft:'tft', driverIc:'driverIc', mcu:'mcu',
  ble:'ble', battery:'battery', pmic:'pmic', flash:'flash',
};

// ══════════════════════════════════════════════════════════
//  3. 遊戲狀態
// ══════════════════════════════════════════════════════════
const state = {
  playerCredits: 48390,
  playerRep: 1247,
  currentDevice: null,
  currentView: 'assembled',
  selectedPart: null,
  deviceDamage: {},
  repairProgress: 0,
  repairedParts: new Set(),
  jobAccepted: false,
  repairLog: [],
  // 相機狀態
  camX: -28,
  camY: 22,
  camScale: 0.88,
  isDragging: false,
  lastMX: 0,
  lastMY: 0,
  keysDown: {},
  rafId: null,
  // 場景狀態
  isExploded: false,
};

// ══════════════════════════════════════════════════════════
//  4. DOM 快取
// ══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const DOM = {
  navItems: document.querySelectorAll('.nav-item'),
  screens: { workshop:$('screen-workshop'), devices:$('screen-devices'), log:$('screen-log') },
  deviceQueue: $('device-queue'),
  queueCount: $('queue-count'),
  btnAcceptJob: $('btn-accept-job'),
  deviceViewTitle: $('device-view-title'),
  viewportPlaceholder: $('viewport-placeholder'),
  deviceScene: $('device-scene'),
  device3dWrapper: $('device-3d-wrapper'),
  btnViewAssembled: $('btn-view-assembled'),
  btnViewExplode: $('btn-view-explode'),
  btnViewScan: $('btn-view-scan'),
  scanOverlay: $('scan-overlay'),
  scanResult: $('scan-result'),
  repairProgressBar: $('repair-progress-bar'),
  progressFill: $('progress-fill'),
  progressPct: $('progress-pct'),
  partsInfo: $('parts-info'),
  btnDiagnose: $('btn-diagnose'),
  btnReplace: $('btn-replace-part'),
  btnCalibrate: $('btn-calibrate'),
  btnComplete: $('btn-complete-repair'),
  terminal: $('terminal'),
  playerCredits: $('player-credits'),
  playerRep: $('player-rep'),
  kbGrid: $('kb-grid'),
  logList: $('log-list'),
  partModalOverlay: $('part-modal-overlay'),
  partModalTitle: $('part-modal-title'),
  partModalBody: $('part-modal-body'),
  partModalClose: $('part-modal-close'),
  completeOverlay: $('complete-overlay'),
  completeDeviceName: $('complete-device-name'),
  completeReward: $('complete-reward'),
  btnCompleteOk: $('btn-complete-ok'),
};

// ══════════════════════════════════════════════════════════
//  5. 終端機日誌
// ══════════════════════════════════════════════════════════
function termLog(msg, type = 'info') {
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  const prefix = {info:'[ INFO ]',warn:'[ WARN ]',error:'[ ERR  ]',success:'[ OK   ]',system:'[ SYS  ]',prompt:'[ CMD  ]'}[type] || '[ ??? ]';
  line.textContent = `${prefix} ${msg}`;
  DOM.terminal.appendChild(line);
  DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
}

// ══════════════════════════════════════════════════════════
//  6. 導覽邏輯
// ══════════════════════════════════════════════════════════
function switchScreen(screenId) {
  DOM.navItems.forEach(n => n.classList.toggle('active', n.dataset.screen === screenId));
  Object.entries(DOM.screens).forEach(([id, el]) => {
    if (id === screenId) { el.removeAttribute('hidden'); el.classList.add('active'); }
    else { el.setAttribute('hidden',''); el.classList.remove('active'); }
  });
}
DOM.navItems.forEach(item => item.addEventListener('click', () => switchScreen(item.dataset.screen)));

// ══════════════════════════════════════════════════════════
//  7. 裝置佇列
// ══════════════════════════════════════════════════════════
function renderDeviceQueue() {
  DOM.deviceQueue.innerHTML = '';
  DEVICES_DB.forEach(device => {
    const card = document.createElement('div');
    card.className = `device-card ${state.currentDevice?.id === device.id ? 'selected' : ''}`;
    card.setAttribute('role','listitem');
    card.dataset.deviceId = device.id;
    card.innerHTML = `
      <div class="dc-name">${device.name}</div>
      <div class="dc-type">${device.type} · ${device.model}</div>
      <span class="dc-severity severity-${device.severity}">
        ${device.severity==='high' ? '⚠ 緊急' : device.severity==='medium' ? '◈ 一般' : '○ 輕微'}
      </span>
      <div class="dc-reward">NC¥ ${device.reward.toLocaleString()}</div>`;
    card.addEventListener('click', () => selectDevice(device));
    DOM.deviceQueue.appendChild(card);
  });
  DOM.queueCount.textContent = `${DEVICES_DB.length} 件`;
}

// ══════════════════════════════════════════════════════════
//  8. 選取裝置
// ══════════════════════════════════════════════════════════
function selectDevice(device) {
  state.currentDevice = device;
  state.jobAccepted = false;
  state.repairedParts = new Set();
  state.repairProgress = 0;
  state.selectedPart = null;
  state.isExploded = false;

  // 隨機分配故障零件
  state.deviceDamage = {};
  const shuffled = [...device.parts].sort(() => Math.random() - 0.5);
  for (let i = 0; i < device.damageCount && i < shuffled.length; i++) {
    const pId = shuffled[i];
    const modes = PARTS_DB[pId]?.failModes || [];
    if (modes.length) state.deviceDamage[pId] = modes[Math.floor(Math.random() * modes.length)];
  }

  renderDeviceQueue();
  DOM.deviceViewTitle.textContent = `// 裝置：${device.name}`;
  DOM.viewportPlaceholder.hidden = true;
  DOM.deviceScene.removeAttribute('hidden');
  DOM.repairProgressBar.hidden = true;

  setActionEnabled(false);
  renderPartsInfo(null);
  switchView('assembled');
  render3DScene(device);
  updateRepairProgress();

  termLog(`已選取裝置：${device.name}`, 'info');
  termLog(`型號：${device.model}`, 'system');
  termLog(`偵測到 ${device.damageCount} 處故障，請接受委託後點選零件`, 'warn');
  termLog('WASD 旋轉鏡頭 · Q/E 縮放 · R 重置視角', 'system');
}

// ══════════════════════════════════════════════════════════
//  9. CSS 3D 立體盒子建立器
//  ── 使用零尺寸樞紐點（pivot），6 個面用 margin 置中 ──
// ══════════════════════════════════════════════════════════
function createBox3D(cfg) {
  const { W, H, D, front, back, top, right, glow, frontDeco, label, partId } = cfg;
  const bottom = 'rgba(2,3,6,0.99)';
  const left = right;
  const hw = W / 2, hh = H / 2, hd = D / 2;

  // 樞紐容器（零大小）
  const pivot = document.createElement('div');
  pivot.className = 'box3d-pivot';

  // 建立單個面
  function makeFace(cls, fw, fh, transform, bg, extraContent) {
    const face = document.createElement('div');
    face.className = `box3d-face ${cls}`;
    face.style.cssText = [
      `width:${fw}px`, `height:${fh}px`,
      `margin-left:${-fw/2}px`, `margin-top:${-fh/2}px`,
      `transform:${transform}`,
      `background:${bg}`,
      glow ? `border:1px solid ${glow.replace(/[\d.]+\)$/, '0.25)')}` : 'border:1px solid rgba(0,245,255,0.08)',
    ].join(';');
    if (glow) face.style.boxShadow = `inset 0 0 12px ${glow.replace(/[\d.]+\)$/, '0.06)')}, 0 0 4px ${glow.replace(/[\d.]+\)$/, '0.2)')}`;
    if (extraContent) face.innerHTML = extraContent;
    return face;
  }

  // 6 個面
  pivot.appendChild(makeFace('face-front',  W, H, `translateZ(${hd}px)`,                           front,  getFrontDecoration(frontDeco, W, H)));
  pivot.appendChild(makeFace('face-back',   W, H, `rotateY(180deg) translateZ(${hd}px)`,            back));
  pivot.appendChild(makeFace('face-right',  D, H, `rotateY(90deg) translateZ(${hw}px)`,             right,  getSideDecoration(frontDeco, D, H)));
  pivot.appendChild(makeFace('face-left',   D, H, `rotateY(-90deg) translateZ(${hw}px)`,            left));
  pivot.appendChild(makeFace('face-top',    W, D, `rotateX(90deg) translateZ(${hh}px)`,             top,    getTopDecoration(frontDeco, W, D)));
  pivot.appendChild(makeFace('face-bottom', W, D, `rotateX(-90deg) translateZ(${hh}px)`,            bottom));

  // 浮動標籤（爆炸模式才顯示）
  if (label) {
    const lbl = document.createElement('div');
    lbl.className = 'part-label-3d';
    lbl.textContent = label;
    lbl.style.cssText = `margin-left:${-80}px;margin-top:${hh + 14}px;transform:translateZ(${hd+2}px) rotateX(${-state.camX}deg) rotateY(${-state.camY}deg);`;
    lbl.dataset.labelFor = partId;
    pivot.appendChild(lbl);
  }

  return pivot;
}

// 前面裝飾 HTML 產生器
function getFrontDecoration(type, W, H) {
  switch (type) {
    case 'epd-display':
      return `<div class="deco-epd" style="width:${W-6}px;height:${H-6}px;left:3px;top:3px;"></div>`;
    case 'tft-traces':
      return `<div class="deco-tft" style="width:100%;height:100%;"></div>`;
    case 'ic-chip': case 'mcu-chip': case 'pmic-chip': case 'flash-chip':
      return `<div class="deco-chip" style="width:70%;height:70%;left:15%;top:15%;"><div class="chip-die"></div></div>`;
    case 'ble-module':
      return `<div class="deco-ble" style="width:80%;height:70%;left:10%;top:15%;"></div>`;
    case 'battery-cell':
      return `<div class="deco-battery" style="width:90%;height:70%;left:5%;top:15%;"><div class="batt-level"></div></div>`;
    case 'shell-front':
      return `<div class="deco-shell-front" style="width:100%;height:100%;"></div>`;
    case 'shell-back':
      return `<div class="deco-shell-back" style="width:100%;height:100%;"></div>`;
    default: return '';
  }
}

function getSideDecoration(type, D, H) {
  if (['ic-chip','mcu-chip','pmic-chip','flash-chip','driverIc'].includes(type)) {
    const pinCount = Math.floor(H / 8);
    return Array.from({length:pinCount}, (_, i) =>
      `<div style="position:absolute;left:${D-3}px;top:${i*8+2}px;width:3px;height:4px;background:rgba(255,210,50,0.7);"></div>`
    ).join('');
  }
  return '';
}

function getTopDecoration(type, W, D) {
  if (type === 'battery-cell') {
    return `<div style="position:absolute;width:12px;height:${D-2}px;top:1px;right:4px;background:rgba(255,230,0,0.5);border:1px solid rgba(255,230,0,0.7);"></div>`;
  }
  return '';
}

// ══════════════════════════════════════════════════════════
//  10. 渲染 3D 場景
// ══════════════════════════════════════════════════════════
function render3DScene(device) {
  // 清空
  DOM.device3dWrapper.innerHTML = '';

  // 要渲染的零件列表：外殼 + 裝置零件
  const partsToRender = [
    ...DEVICE_FIXED_PARTS,
    ...device.parts.map(p => PART_ID_TO_3D[p]).filter(Boolean),
  ];

  // 按 order 排序
  partsToRender.sort((a, b) => (PART_3D[a]?.order ?? 99) - (PART_3D[b]?.order ?? 99));

  partsToRender.forEach(p3dId => {
    const cfg = PART_3D[p3dId];
    if (!cfg) return;

    // 外層零件容器（樞紐點）
    const part = document.createElement('div');
    part.className = 'device-part';
    part.dataset.partId = p3dId;
    const partDbId = Object.keys(PART_ID_TO_3D).find(k => PART_ID_TO_3D[k] === p3dId) || p3dId;
    part.dataset.partDbId = partDbId;

    // 組裝位置
    part.style.transform = `translate3d(${cfg.x}px, ${cfg.y}px, ${cfg.z}px)`;
    part.style.transitionDelay = `${cfg.order * 55}ms`;

    // 故障狀態 class
    if (state.deviceDamage[partDbId] && !state.repairedParts.has(partDbId)) {
      part.classList.add('damaged');
    }

    // 是外殼則不可點擊診斷
    if (!cfg.isShell) {
      part.setAttribute('role','button');
      part.setAttribute('tabindex','0');
      part.setAttribute('aria-label', `${cfg.label}${state.deviceDamage[partDbId] ? '（故障）' : ''}`);
      part.addEventListener('click', e => { e.stopPropagation(); onPartClick(p3dId, partDbId); });
      part.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') onPartClick(p3dId, partDbId); });
    } else {
      part.style.cursor = 'default';
    }

    // 建立 3D 盒子
    const box = createBox3D({ ...cfg, partId: p3dId });
    part.appendChild(box);

    DOM.device3dWrapper.appendChild(part);
  });

  // 重置爆炸狀態
  state.isExploded = false;
  applyCamera();
}

// ══════════════════════════════════════════════════════════
//  11. 相機系統（WASD + 滑鼠拖曳 + 滾輪）
// ══════════════════════════════════════════════════════════
function applyCamera() {
  DOM.device3dWrapper.style.transform =
    `rotateX(${state.camX}deg) rotateY(${state.camY}deg) scale(${state.camScale})`;
}

function cameraLoop() {
  const speed = 1.4;
  const zoomSpeed = 0.012;
  let dirty = false;
  // 不在輸入框時才接受 WASD
  const activeTag = document.activeElement?.tagName;
  if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
    if (state.keysDown['w']) { state.camX = Math.min(75, state.camX + speed); dirty = true; }
    if (state.keysDown['s']) { state.camX = Math.max(-75, state.camX - speed); dirty = true; }
    if (state.keysDown['a']) { state.camY -= speed; dirty = true; }
    if (state.keysDown['d']) { state.camY += speed; dirty = true; }
    if (state.keysDown['q']) { state.camScale = Math.min(2.5, state.camScale + zoomSpeed); dirty = true; }
    if (state.keysDown['e']) { state.camScale = Math.max(0.3, state.camScale - zoomSpeed); dirty = true; }
    if (state.keysDown['r']) {
      // 平滑重置
      state.camX += (-28 - state.camX) * 0.1;
      state.camY += (22 - state.camY) * 0.1;
      state.camScale += (0.88 - state.camScale) * 0.1;
      dirty = true;
    }
  }
  if (dirty) applyCamera();
  state.rafId = requestAnimationFrame(cameraLoop);
}

// 鍵盤事件
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  state.keysDown[k] = true;
  if (['w','a','s','d','q','e'].includes(k) && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
  }
});
document.addEventListener('keyup', e => { state.keysDown[e.key.toLowerCase()] = false; });

// 滑鼠拖曳旋轉
const viewport = document.getElementById('device-viewport');
viewport.addEventListener('mousedown', e => {
  if (e.target.classList.contains('device-part') || e.target.closest('.device-part')) return; // 讓零件點擊優先
  state.isDragging = true;
  state.lastMX = e.clientX;
  state.lastMY = e.clientY;
  viewport.style.cursor = 'grabbing';
  e.preventDefault();
});
document.addEventListener('mousemove', e => {
  if (!state.isDragging) return;
  const dx = e.clientX - state.lastMX;
  const dy = e.clientY - state.lastMY;
  state.camY += dx * 0.45;
  state.camX -= dy * 0.45;
  state.camX = Math.max(-75, Math.min(75, state.camX));
  state.lastMX = e.clientX;
  state.lastMY = e.clientY;
  applyCamera();
});
document.addEventListener('mouseup', () => {
  state.isDragging = false;
  viewport.style.cursor = '';
});

// 滾輪縮放
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  state.camScale = Math.max(0.3, Math.min(2.5, state.camScale - e.deltaY * 0.0008));
  applyCamera();
}, { passive:false });

// ══════════════════════════════════════════════════════════
//  12. 視圖切換（組裝 / 爆炸 / 掃描）
// ══════════════════════════════════════════════════════════
function switchView(view) {
  state.currentView = view;
  DOM.btnViewAssembled.classList.toggle('active', view === 'assembled');
  DOM.btnViewExplode.classList.toggle('active',   view === 'explode');
  DOM.btnViewScan.classList.toggle('active',      view === 'scan');
  [DOM.btnViewAssembled, DOM.btnViewExplode, DOM.btnViewScan].forEach(b =>
    b.setAttribute('aria-pressed', b.classList.contains('active'))
  );

  setExploded(view === 'explode');

  if (view === 'scan') {
    DOM.scanOverlay.removeAttribute('hidden');
    runScan();
  } else {
    DOM.scanOverlay.hidden = true;
  }
}

DOM.btnViewAssembled.addEventListener('click', () => { if (state.currentDevice) switchView('assembled'); });
DOM.btnViewExplode.addEventListener('click', () => {
  if (!state.currentDevice) return;
  switchView(state.currentView === 'explode' ? 'assembled' : 'explode');
  termLog(state.currentView === 'explode' ? '已切換至拆解視圖 — 各零件散開' : '已切換至組裝視圖', 'prompt');
});
DOM.btnViewScan.addEventListener('click', () => {
  if (!state.currentDevice) return;
  switchView(state.currentView === 'scan' ? 'assembled' : 'scan');
});

function setExploded(exploded) {
  state.isExploded = exploded;
  const parts = document.querySelectorAll('.device-part');
  parts.forEach(el => {
    const p3dId = el.dataset.partId;
    const cfg = PART_3D[p3dId];
    if (!cfg) return;

    // 爆炸時：延遲依順序錯開，縮回時反向
    const order = cfg.order;
    el.style.transitionDelay = exploded
      ? `${order * 60}ms`
      : `${(9 - order) * 40}ms`;

    el.style.transform = exploded
      ? `translate3d(${cfg.ex}px, ${cfg.ey}px, ${cfg.ez}px)`
      : `translate3d(${cfg.x}px, ${cfg.y}px, ${cfg.z}px)`;

    // 標籤顯示
    const lbl = el.querySelector('.part-label-3d');
    if (lbl) {
      lbl.style.opacity = exploded ? '1' : '0';
      lbl.style.transitionDelay = exploded ? `${order * 60 + 300}ms` : '0ms';
    }
  });
}

function runScan() {
  const damaged = Object.keys(state.deviceDamage).filter(p => !state.repairedParts.has(p));
  if (damaged.length === 0) {
    DOM.scanResult.innerHTML = `<span style="color:var(--neon-green)">◉ 掃描完成<br/>所有系統運行正常</span>`;
    termLog('掃描完成：所有系統正常', 'success');
  } else {
    const lines = damaged.map(p => {
      const fi = FAIL_MODE_DESC[state.deviceDamage[p]];
      return `⚠ ${PARTS_DB[p]?.name || p}: ${fi?.label || state.deviceDamage[p]}`;
    }).join('<br>');
    DOM.scanResult.innerHTML = `<span>◈ 偵測到 ${damaged.length} 處異常<br><br>${lines}</span>`;
    termLog(`掃描完成，偵測到 ${damaged.length} 個問題`, 'warn');
  }
}

// ══════════════════════════════════════════════════════════
//  13. 零件點擊
// ══════════════════════════════════════════════════════════
function onPartClick(p3dId, partDbId) {
  if (!state.jobAccepted) {
    termLog('請先接受委託再開始修理', 'warn');
    // 閃爍提示
    DOM.btnAcceptJob.style.boxShadow = '0 0 20px var(--neon-magenta)';
    setTimeout(() => { DOM.btnAcceptJob.style.boxShadow = ''; }, 600);
    return;
  }

  state.selectedPart = partDbId;
  const part = PARTS_DB[partDbId];
  if (!part) return;

  // 高亮選中
  document.querySelectorAll('.device-part').forEach(el => {
    el.classList.toggle('highlighted', el.dataset.partId === p3dId);
  });

  renderPartsInfo(partDbId);
  setActionEnabled(true);
  termLog(`已選取零件：${part.name}`, 'prompt');

  const failMode = state.deviceDamage[partDbId];
  if (failMode && !state.repairedParts.has(partDbId)) {
    const fi = FAIL_MODE_DESC[failMode];
    termLog(`偵測到故障：${fi?.label} — ${fi?.desc}`, 'error');
  } else if (state.repairedParts.has(partDbId)) {
    termLog(`${part.name} 已修復完畢`, 'success');
  } else {
    termLog(`${part.name} 狀態正常`, 'info');
  }
}

// ══════════════════════════════════════════════════════════
//  14. 零件資訊面板
// ══════════════════════════════════════════════════════════
function renderPartsInfo(partDbId) {
  if (!partDbId) {
    DOM.partsInfo.innerHTML = '<div class="no-selection-msg">← 點擊零件查看詳情</div>';
    return;
  }
  const part = PARTS_DB[partDbId];
  if (!part) return;
  const failMode = state.deviceDamage[partDbId];
  const repaired = state.repairedParts.has(partDbId);
  const statusCls = repaired ? 'status-ok' : failMode ? 'status-damage' : 'status-ok';
  const statusLabel = repaired ? '已修復' : failMode ? `故障：${FAIL_MODE_DESC[failMode]?.label || failMode}` : '正常';
  const statsHtml = Object.entries(part.stats).map(([k,v]) =>
    `<div class="stat-row"><span class="stat-key">${k}</span><span class="stat-val">${v}</span></div>`
  ).join('');
  DOM.partsInfo.innerHTML = `
    <div class="part-detail">
      <div class="part-detail-name">${part.icon} ${part.name}</div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim);">${part.nameEn}</div>
      <span class="part-detail-status ${statusCls}">${statusLabel}</span>
      <div class="part-detail-desc">${part.desc}</div>
      <div class="part-stats">${statsHtml}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════
//  15. 修理操作
// ══════════════════════════════════════════════════════════
function setActionEnabled(enabled) {
  DOM.btnDiagnose.disabled = !enabled;
  DOM.btnReplace.disabled  = !enabled;
  DOM.btnCalibrate.disabled = !enabled;
}

function checkAllRepairable() {
  if (!state.currentDevice) return;
  const damaged = Object.keys(state.deviceDamage);
  const allDone = damaged.every(p => state.repairedParts.has(p));
  DOM.btnComplete.disabled = !allDone;
  if (allDone && damaged.length > 0) termLog('所有故障已排除！可執行「完成修理」', 'success');
}

// 診斷
DOM.btnDiagnose.addEventListener('click', () => {
  const pId = state.selectedPart;
  if (!pId) return;
  const part = PARTS_DB[pId];
  const fail = state.deviceDamage[pId];
  termLog(`正在診斷 ${part.name}...`, 'prompt');
  setTimeout(() => {
    if (fail && !state.repairedParts.has(pId)) {
      const fi = FAIL_MODE_DESC[fail];
      termLog(`診斷報告：${fi.label}`, 'error');
      termLog(`原因：${fi.desc}`, 'warn');
      openPartModal(pId, fail);
    } else {
      termLog(`${part.name}：所有測試通過，狀態正常`, 'success');
    }
  }, 600);
});

// 更換零件
DOM.btnReplace.addEventListener('click', () => {
  const pId = state.selectedPart;
  if (!pId) return;
  const fail = state.deviceDamage[pId];
  if (!fail || state.repairedParts.has(pId)) { termLog('此零件無需更換', 'info'); return; }
  const part = PARTS_DB[pId];
  termLog(`正在更換 ${part.name}...`, 'prompt');

  // 找到對應的 DOM 元素並做替換動畫
  const p3dId = PART_ID_TO_3D[pId];
  const el = document.querySelector(`[data-part-id="${p3dId}"]`);
  if (el) {
    el.style.filter = 'brightness(3) saturate(0)';
    el.style.opacity = '0.2';
  }
  setTimeout(() => {
    state.repairedParts.add(pId);
    if (el) {
      el.classList.remove('damaged','highlighted');
      el.style.filter = '';
      el.style.opacity = '';
      // 閃爍修復特效
      el.style.filter = 'brightness(2) drop-shadow(0 0 20px var(--neon-cyan))';
      setTimeout(() => { el.style.filter = ''; }, 400);
    }
    termLog(`${part.name} 更換完畢`, 'success');
    updateRepairProgress();
    renderPartsInfo(pId);
    checkAllRepairable();
  }, 1000);
});

// 校準
DOM.btnCalibrate.addEventListener('click', () => {
  const pId = state.selectedPart;
  if (!pId) return;
  const part = PARTS_DB[pId];
  termLog(`正在校準 ${part.name}...`, 'prompt');
  setTimeout(() => {
    if (state.repairedParts.has(pId)) {
      termLog(`${part.name} 校準完成，同步最新波形設定`, 'success');
    } else if (!state.deviceDamage[pId]) {
      termLog(`${part.name} 校準完成，效能優化 +8%`, 'success');
    } else {
      termLog(`${part.name} 仍有故障，請先執行更換零件`, 'warn');
    }
  }, 700);
});

// ══════════════════════════════════════════════════════════
//  16. 接受任務
// ══════════════════════════════════════════════════════════
DOM.btnAcceptJob.addEventListener('click', () => {
  if (!state.currentDevice) { termLog('請先選取裝置', 'warn'); return; }
  if (state.jobAccepted)    { termLog('任務已接受，請繼續修理', 'info'); return; }
  state.jobAccepted = true;
  DOM.repairProgressBar.removeAttribute('hidden');
  DOM.btnAcceptJob.textContent = '進行中...';
  DOM.btnAcceptJob.disabled = true;
  termLog('=== 任務已接受 ===', 'success');
  termLog(`目標裝置：${state.currentDevice.name}`, 'system');
  termLog(`故障數量：${Object.keys(state.deviceDamage).length} 處`, 'system');
  termLog(`預計報酬：NC¥ ${state.currentDevice.reward.toLocaleString()}`, 'system');
  termLog('點擊 ⬡ 切換爆炸視圖，再點選零件進行修理', 'prompt');
});

// ══════════════════════════════════════════════════════════
//  17. 修理進度
// ══════════════════════════════════════════════════════════
function updateRepairProgress() {
  const total = Object.keys(state.deviceDamage).length || 1;
  const done  = [...state.repairedParts].filter(p => state.deviceDamage[p]).length;
  state.repairProgress = Math.round((done / total) * 100);
  DOM.progressFill.style.width = `${state.repairProgress}%`;
  DOM.progressPct.textContent  = `${state.repairProgress}%`;
}

// ══════════════════════════════════════════════════════════
//  18. 完成修理
// ══════════════════════════════════════════════════════════
DOM.btnComplete.addEventListener('click', () => {
  if (!state.currentDevice) return;
  const device = state.currentDevice;
  state.playerCredits += device.reward;
  state.playerRep += Math.floor(device.reward / 100);
  DOM.playerCredits.textContent = state.playerCredits.toLocaleString();
  DOM.playerRep.textContent     = state.playerRep.toLocaleString();
  state.repairLog.unshift({
    time: new Date().toLocaleTimeString('zh-TW',{hour12:false}),
    device: device.name, model: device.model,
    faults: Object.keys(state.deviceDamage).length, reward: device.reward,
  });
  renderRepairLog();
  DOM.completeDeviceName.textContent = `${device.name} · ${device.model}`;
  DOM.completeReward.textContent = `NC¥ ${device.reward.toLocaleString()} + ${Math.floor(device.reward/100)} 聲望`;
  DOM.completeOverlay.removeAttribute('hidden');
  termLog(`=== 修理完成 === NC¥${device.reward.toLocaleString()} ===`, 'success');
});

DOM.btnCompleteOk.addEventListener('click', () => {
  DOM.completeOverlay.hidden = true;
  state.currentDevice = null;
  state.jobAccepted = false;
  state.deviceDamage = {};
  state.repairedParts = new Set();
  state.repairProgress = 0;
  state.selectedPart = null;
  state.isExploded = false;
  DOM.deviceViewTitle.textContent = '// 裝置：未選取';
  DOM.viewportPlaceholder.hidden = false;
  DOM.deviceScene.hidden = true;
  DOM.scanOverlay.hidden = true;
  DOM.repairProgressBar.hidden = true;
  DOM.btnAcceptJob.textContent = '接受委託';
  DOM.btnAcceptJob.disabled = false;
  DOM.btnComplete.disabled = true;
  setActionEnabled(false);
  renderPartsInfo(null);
  renderDeviceQueue();
  termLog('=== 新的任務等待中 ===', 'system');
});

// ══════════════════════════════════════════════════════════
//  19. 零件詳情 Modal
// ══════════════════════════════════════════════════════════
function openPartModal(partDbId, failMode) {
  const part = PARTS_DB[partDbId];
  const fi = FAIL_MODE_DESC[failMode];
  DOM.partModalTitle.textContent = `${part.icon} ${part.name} 診斷報告`;
  DOM.partModalBody.innerHTML = `
    <div class="part-detail" style="gap:12px;">
      <div style="display:flex;gap:10px;align-items:center;">
        <span class="part-detail-status status-damage">⚠ ${fi.label}</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim);">
          嚴重等級：${{high:'高',medium:'中',low:'低'}[fi.severity]}
        </span>
      </div>
      <p class="part-detail-desc">${fi.desc}</p>
      <div class="panel-divider"></div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--neon-cyan);">// 零件說明</div>
      <p class="part-detail-desc">${part.desc}</p>
      <div class="part-stats">${Object.entries(part.stats).map(([k,v]) =>
        `<div class="stat-row"><span class="stat-key">${k}</span><span class="stat-val">${v}</span></div>`
      ).join('')}</div>
      <div class="panel-divider"></div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--neon-yellow);">// 修理建議</div>
      <p class="part-detail-desc">${fi.severity==='high'
        ? '建議立即更換此零件。高嚴重等級故障可能導致整個裝置無法正常運作。'
        : fi.severity==='medium'
        ? '建議執行更換零件並進行校準。中嚴重等級故障會影響裝置效能。'
        : '可先嘗試校準，若問題持續再考慮更換零件。'}</p>
    </div>`;
  DOM.partModalOverlay.removeAttribute('hidden');
}
DOM.partModalClose.addEventListener('click', () => { DOM.partModalOverlay.hidden = true; });
DOM.partModalOverlay.addEventListener('click', e => { if (e.target===DOM.partModalOverlay) DOM.partModalOverlay.hidden=true; });

// ══════════════════════════════════════════════════════════
//  20. 知識庫渲染
// ══════════════════════════════════════════════════════════
function renderKnowledgeBase() {
  DOM.kbGrid.innerHTML = '';
  KNOWLEDGE_BASE.forEach(item => {
    const card = document.createElement('div');
    card.className = 'kb-card';
    card.setAttribute('role','listitem');
    card.innerHTML = `
      <div class="kb-card-icon">${item.icon}</div>
      <div class="kb-card-title">${item.title}</div>
      <div class="kb-card-desc">${item.desc}</div>
      <div class="kb-card-tags">${item.tags.map(t=>`<span class="kb-tag">${t}</span>`).join('')}</div>`;
    DOM.kbGrid.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════
//  21. 修理日誌渲染
// ══════════════════════════════════════════════════════════
function renderRepairLog() {
  if (!state.repairLog.length) { DOM.logList.innerHTML='<div class="log-empty">尚無修理記錄</div>'; return; }
  DOM.logList.innerHTML = state.repairLog.map(e => `
    <div class="log-entry" role="listitem">
      <div class="log-time">${e.time}</div>
      <div class="log-content">
        <div class="log-device">${e.device}</div>
        <div class="log-summary">型號：${e.model}｜排除 ${e.faults} 處故障</div>
      </div>
      <div class="log-reward">NC¥ ${e.reward.toLocaleString()}</div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════
//  22. 初始化
// ══════════════════════════════════════════════════════════
function init() {
  renderDeviceQueue();
  renderKnowledgeBase();
  renderRepairLog();
  cameraLoop(); // 啟動相機更新迴圈
  termLog('系統初始化完成', 'system');
  termLog('歡迎回來，技師 GHOST_7', 'success');
  termLog('WASD 旋轉鏡頭 · Q/E 縮放 · R 重置視角', 'system');
  termLog('今日共 5 件裝置待修，開始接單吧！', 'info');
}

init();
