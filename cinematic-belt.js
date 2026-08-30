const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const factory = $('#factoryStage');
const cargoLayer = $('#cargoLayer');
const sourceText = $('#sourceText');
const startButton = $('#startProcess');
const resetButton = $('#resetProcess');
const colors = ['blue', 'purple', 'green', 'gold', 'red', 'cyan', 'violet', 'emerald', 'amber', 'rose', 'azure', 'lime'];

const STAGES = [
  { status: '自然语言原料已装载', code: 'RAW MATERIAL / 01', progress: 8 },
  { status: '原料正在扫描字符类型与边界', code: 'BOUNDARY SCAN / 02', progress: 28 },
  { status: 'Token 正在一对一接受激光切分', code: '1:1 TOKEN CUT / 03', progress: 52 },
  { status: '编码器正在查询模型词表', code: 'VOCABULARY MAP / 04', progress: 76 },
  { status: 'Token ID 正在进入 Embedding 反应舱', code: 'EMBEDDING INPUT / 05', progress: 92 }
];

const LESSONS = [
  {
    number: '01', kicker: 'RAW MATERIAL', title: '自然语言是加工原料',
    description: '模型不会直接处理汉字、单词和标点。完整文本先作为一个整体原料箱贴着传送带进入扫描舱。',
    steps: ['装载完整文本', '保持字符顺序', '沿传送带送检'],
    details: ['输入仍是人类可读文字。', '字符的先后顺序不能被打乱。', '原料箱开始向右进入扫描舱。'],
    formula: '文本 → Unicode 字符序列'
  },
  {
    number: '02', kicker: 'BOUNDARY SCAN', title: '规则扫描与边界判断',
    description: '扫描舱逐个读取字符，判断中文、英文、数字和标点，并标记候选边界；这一工位不会真正切开文本。',
    steps: ['读取字符类型', '标记候选边界', '完整文本送往切分机'],
    details: ['扫描光束读取每个字符的类型。', 'Tokenizer 用不同颜色标记候选 Token 区域，但它们仍属于同一个完整原料箱。', '彩色标记和完整文本一起送往切分机，尚未生成独立 Token 块。'],
    formula: '字符序列 → 类型识别 + 候选边界标记'
  },
  {
    number: '03', kicker: '1:1 TOKEN CUT', title: '一对一激光切分',
    description: '每个 Token 块在对应激光槽位停靠。激光完成切分和封装后，Token 继续沿同一条传送带向右移动。',
    steps: ['读取边界标记', '激光执行切分', '封装标准 Token 块'],
    details: ['完整文本依据上一步标记在切分工位停靠。', '激光在候选边界处执行真正的 Token 切分。', '切分结果成为保持原顺序的标准 Token 块。'],
    formula: 'Tokenᵢ ↔ Laser Headᵢ'
  },
  {
    number: '04', kicker: 'VOCABULARY MAP', title: '查询词表并映射 ID',
    description: '模型词表给每个 Token 分配一个整数编号。编码塔逐块查询，并把 Token 外壳上的文字替换为数字 ID。',
    steps: ['Token 排队入塔', '查询模型词表', '写入离散 ID'],
    details: ['Token 沿传送带进入紫色编码塔。', '同一个 Token 在同一词表中对应固定编号。', '输出仍保持输入 Token 的原始顺序。'],
    formula: 'token_id = vocabulary[token]'
  },
  {
    number: '05', kicker: 'DENSE VECTOR', title: '送入 Embedding 向量化',
    description: '离散 ID 还不能表达语义关系。Embedding 表把每个 ID 转换成一组可以参与 Transformer 计算的连续数值。',
    steps: ['ID 沿传送带入舱', '查询 Embedding 表', '得到稠密向量'],
    details: ['ID 块按原顺序进入反应舱。', '每个 ID 选中 Embedding 矩阵中的一行。', '输出向量会继续进入 Transformer 层。'],
    formula: 'embeddingᵢ = E[token_idᵢ] ∈ ℝᵈ'
  }
];

let currentStage = 0;
let currentLessonStep = 0;
let runVersion = 0;
let pipelineRunning = false;
let cargoItems = [];

function wait(ms, version = runVersion) {
  return new Promise(resolve => setTimeout(() => resolve(version === runVersion), ms));
}

function safe(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function recognitionMarkup(text, tokens = getTokens()) {
  let cursor = 0;
  let markup = '';
  tokens.forEach((token, index) => {
    const tokenStart = text.indexOf(token, cursor);
    if (tokenStart < 0) return;
    markup += safe(text.slice(cursor, tokenStart));
    markup += `<span class="recognized-segment ${colors[index % colors.length]}">${safe(token)}</span>`;
    cursor = tokenStart + token.length;
  });
  markup += safe(text.slice(cursor));
  return markup;
}

function applyRecognitionColors(rawCargo, tokens = getTokens()) {
  const label = rawCargo?.querySelector('b');
  if (!label) return;
  label.classList.add('recognized-material');
  label.innerHTML = recognitionMarkup(sourceText.value.trim(), tokens);
  rawCargo.classList.add('recognized-raw');
}

function allTokens(text) {
  const raw = text.match(/[\u4e00-\u9fff]+|[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[^\s]/g) || [];
  const result = [];
  raw.forEach(part => {
    if (part === '我喜欢') result.push('我', '喜欢');
    else if (/^[\u4e00-\u9fff]+$/.test(part) && part.length > 1 && typeof Intl !== 'undefined' && Intl.Segmenter) {
      [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(part)].forEach(segment => result.push(segment.segment));
    } else result.push(part);
  });
  return result;
}

function getTokens() {
  return allTokens(sourceText.value.trim()).slice(0, 12);
}

function classify(token) {
  if (/^[\u4e00-\u9fff]+$/.test(token)) return '中文';
  if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(token)) return '英文';
  if (/^\d/.test(token)) return '数字';
  if (/^[.,!?，。！？；;:：、]+$/.test(token)) return '标点';
  return '符号';
}

function inspectCharacterTypes(text) {
  const counters = new Map([
    ['中文', 0], ['英文', 0], ['数字', 0], ['标点', 0], ['空格', 0], ['符号', 0]
  ]);
  [...text].forEach(character => {
    let type = '符号';
    if (/^[\u4e00-\u9fff]$/.test(character)) type = '中文';
    else if (/^[A-Za-z]$/.test(character)) type = '英文';
    else if (/^\d$/.test(character)) type = '数字';
    else if (/^[.,!?，。！？；;:：、]$/.test(character)) type = '标点';
    else if (/^\s$/.test(character)) type = '空格';
    counters.set(type, counters.get(type) + 1);
  });
  return [...counters.entries()].filter(([, count]) => count > 0);
}

function idFor(token, index) {
  let hash = 29;
  for (const char of token) hash = (hash * 41 + char.codePointAt(0)) % 10009;
  return 100 + (hash + index * 193) % 8900;
}

function updateLesson(stage, step = 0, detailOverride = '') {
  const lesson = LESSONS[stage];
  currentLessonStep = Math.max(0, Math.min(2, step));
  $('#lessonNumber').textContent = lesson.number;
  $('#lessonKicker').textContent = lesson.kicker;
  $('#lessonTitle').textContent = lesson.title;
  $('#lessonDescription').textContent = detailOverride || `${lesson.description} ${lesson.details[currentLessonStep]}`;
  $('#lessonFormula').textContent = lesson.formula;
  $('#microSteps').innerHTML = lesson.steps.map((item, index) => `
    <li class="${index < currentLessonStep ? 'done' : index === currentLessonStep ? 'active' : ''}">${item}</li>
  `).join('');
  factory.dataset.lessonStep = String(currentLessonStep);
}

function setStage(stage, lessonStep = 0, statusOverride = '') {
  currentStage = Math.max(0, Math.min(4, stage));
  const data = STAGES[currentStage];
  factory.dataset.stage = String(currentStage);
  factory.dataset.activeStage = String(currentStage);
  $$('.station-nav button').forEach((button, index) => {
    button.classList.toggle('active', index === currentStage);
    button.classList.toggle('done', index < currentStage);
  });
  $('#statusText').textContent = statusOverride || data.status;
  $('#statusCode').textContent = data.code;
  $('#progressBar').style.width = `${data.progress}%`;
  updateLesson(currentStage, lessonStep);
}

function refreshPreview() {
  const tokens = getTokens();
  const total = allTokens(sourceText.value.trim()).length;
  $('#tokenPreview').textContent = tokens.length
    ? `预计切分：${tokens.join(' / ')}${total > 12 ? ' / …（展示前 12 个）' : ''}`
    : '请输入自然语言加工原料';
}

function layoutFor(stage, index = 0, total = 1) {
  if (stage === 0) return { x: 9.5, y: 67.2 };
  const centers = [9.5, 29.2, 51.8, 72.1, 88.8];
  const maxColumns = total > 6 ? 6 : Math.max(1, total);
  const row = total > 6 ? Math.floor(index / 6) : 0;
  const column = total > 6 ? index % 6 : index;
  const itemsInRow = total > 6 && row === 1 ? total - 6 : maxColumns;
  const normalizedColumn = column - (itemsInRow - 1) / 2;
  const spacing = stage === 1 ? 2.35 : stage === 2 ? 2.55 : stage === 3 ? 2.2 : 1.4;
  const baseY = stage === 1 ? 66.4 : stage === 2 ? 66.8 : stage === 3 ? 67.1 : 66.2;
  return { x: centers[stage] + normalizedColumn * spacing, y: baseY - row * 4.6 };
}

function positionCargo(element, position) {
  element.style.left = `${position.x}%`;
  element.style.top = `${position.y}%`;
  element.dataset.x = String(position.x);
  element.dataset.y = String(position.y);
}

function makeCargo(text, index = 0, type = 'token', startPosition = layoutFor(0)) {
  const element = document.createElement('div');
  const longToken = String(text).length > 6;
  element.className = `cargo ${type} ${colors[index % colors.length]}`;
  if (type === 'token') element.style.setProperty('--cargo-width', `${longToken ? 112 : String(text).length > 2 ? 92 : 72}px`);
  element.innerHTML = `<b>${safe(text)}</b>`;
  element.dataset.index = String(index);
  element.dataset.value = String(text);
  cargoLayer.appendChild(element);
  positionCargo(element, startPosition);
  return element;
}

function clearCargo() {
  cargoItems.forEach(item => item.remove());
  cargoItems = [];
  cargoLayer.innerHTML = '';
  factory.dataset.cargoCount = '0';
}

function makeRawCargo() {
  const value = sourceText.value.trim();
  const label = value.length > 20 ? `${value.slice(0, 20)}…` : value;
  const raw = makeCargo(label || 'EMPTY', 0, 'raw', layoutFor(0));
  cargoItems = [raw];
  factory.dataset.cargoCount = '1';
  return raw;
}

function makeTokenCargo(tokens, startPosition) {
  clearCargo();
  cargoItems = tokens.map((token, index) => makeCargo(token, index, 'token', startPosition));
  factory.dataset.cargoCount = String(cargoItems.length);
  factory.dataset.tokenCount = String(tokens.length);
  return cargoItems;
}

async function moveCargo(items, stage, duration, version, options = {}) {
  factory.classList.add('belt-running');
  factory.dataset.transportFrom = items[0]?.dataset.stage || '0';
  factory.dataset.transportTo = String(stage);
  const animations = items.map((item, index) => {
    const from = { x: Number(item.dataset.x), y: Number(item.dataset.y) };
    const to = options.singleTarget || layoutFor(stage, index, items.length);
    const delay = (options.delay ?? 78) * index;
    item.classList.add('riding');
    const animation = item.animate([
      { left: `${from.x}%`, top: `${from.y}%`, offset: 0 },
      { left: `${from.x + (to.x - from.x) * .35}%`, top: `${from.y - .55}%`, offset: .36 },
      { left: `${from.x + (to.x - from.x) * .72}%`, top: `${to.y - .28}%`, offset: .73 },
      { left: `${to.x}%`, top: `${to.y}%`, offset: 1 }
    ], { duration, delay, easing: 'cubic-bezier(.45,.05,.22,1)', fill: 'forwards' });
    return animation.finished.catch(() => null).then(() => {
      if (version !== runVersion) return;
      positionCargo(item, to);
      item.dataset.stage = String(stage);
      item.classList.remove('riding');
      animation.cancel();
    });
  });
  await Promise.all(animations);
  return version === runVersion;
}

function renderDetected(text) {
  const characterTypes = inspectCharacterTypes(text);
  $('#scannedText').innerHTML = recognitionMarkup(text);
  $('#scanCounter').textContent = `${[...text].length} CHAR`;
  $('#detectedTypes').innerHTML = characterTypes.map(([type, count], index) => `
    <span class="${colors[index % colors.length]}" style="animation-delay:${index * 70}ms"><b>${type}</b><i>${count} 字符</i></span>
  `).join('');
}

function renderLasers(tokens) {
  const columns = Math.min(6, Math.max(1, tokens.length));
  $('#laserOverlay').innerHTML = tokens.map((_, index) => {
    const row = Math.floor(index / 6);
    const column = index % 6;
    const itemsInRow = row === 1 ? tokens.length - 6 : columns;
    const left = 50 + (column - (itemsInRow - 1) / 2) * (78 / Math.max(1, itemsInRow - 1));
    return `<i class="${colors[index % colors.length]}" style="left:${left}%;--laser-top:${row * 18}%;--laser-height:${row ? 78 : 100}%"></i>`;
  }).join('');
}

function renderEncoder(tokens, visibleCount = tokens.length) {
  $('#encoderRows').innerHTML = tokens.slice(0, visibleCount).map((token, index) => `
    <div class="id-row ${colors[index % colors.length]}" style="animation-delay:${index * 45}ms">
      <b>${safe(token)}</b><i>→</i><span>${idFor(token, index)}</span>
    </div>
  `).join('') || '<p>等待 Token 输入</p>';
}

function renderEmbedding(tokens) {
  const ids = tokens.map(idFor);
  $('#embeddingInput').textContent = `输入 ID：[${ids.join(', ')}]`;
  const bars = ids.flatMap((id, tokenIndex) => Array.from({ length: ids.length > 8 ? 2 : 3 }, (_, part) => {
    const height = 12 + ((id * (part + 3) + tokenIndex * 17) % 35);
    return `<i style="--h:${height}px;--i:${tokenIndex * 3 + part}"></i>`;
  }));
  $('#vectorBars').innerHTML = bars.join('');
}

function clearMachineOutputs() {
  $('#scannedText').textContent = '等待原料进入扫描舱';
  $('#scanCounter').textContent = '0 UNIT';
  $('#detectedTypes').innerHTML = '';
  $('#encoderRows').innerHTML = '<p>等待 Token 输入</p>';
  $('#embeddingInput').textContent = '输入 ID：—';
  $('#vectorBars').innerHTML = '';
  $('#laserOverlay').innerHTML = '';
  factory.classList.remove('scanning', 'laser-active', 'embedding-active', 'belt-running');
}

function cancelRun() {
  runVersion += 1;
  pipelineRunning = false;
  factory.dataset.running = 'false';
  startButton.disabled = false;
  startButton.querySelector('span').textContent = '送上生产线';
  cargoItems.forEach(item => item.getAnimations().forEach(animation => animation.cancel()));
  factory.classList.remove('scanning', 'laser-active', 'embedding-active', 'belt-running');
}

function resetFactory(increment = true) {
  if (increment) cancelRun();
  else {
    cargoItems.forEach(item => item.getAnimations().forEach(animation => animation.cancel()));
    clearCargo();
    clearMachineOutputs();
  }
  clearCargo();
  clearMachineOutputs();
  makeRawCargo();
  setStage(0, 0);
  $('#progressBar').style.width = '8%';
}

async function splitRawIntoTokens(rawCargo, tokens, version, targetStage = 2) {
  const origin = { x: Number(rawCargo.dataset.x), y: Number(rawCargo.dataset.y) };
  rawCargo.classList.add('processing');
  await wait(380, version);
  if (version !== runVersion) return false;
  makeTokenCargo(tokens, origin);
  cargoItems.forEach(item => { item.style.opacity = '0'; item.style.transform = 'translate(-50%, -100%) scale(.28)'; });
  requestAnimationFrame(() => cargoItems.forEach(item => {
    item.style.transition = 'opacity .35s ease, transform .5s cubic-bezier(.2,.8,.2,1)';
    item.style.opacity = '1';
    item.style.transform = 'translate(-50%, -100%) scale(1)';
  }));
  await wait(420, version);
  cargoItems.forEach(item => { item.style.transition = ''; item.style.transform = ''; });
  return moveCargo(cargoItems, targetStage, 760, version, { delay: 45 });
}

async function runFactory() {
  const tokens = getTokens();
  if (!tokens.length) {
    sourceText.focus();
    $('#statusText').textContent = '请先装载自然语言原料';
    $('#statusCode').textContent = 'NO MATERIAL';
    return;
  }

  cancelRun();
  const version = runVersion;
  clearCargo();
  clearMachineOutputs();
  const rawCargo = makeRawCargo();
  pipelineRunning = true;
  factory.dataset.running = 'true';
  startButton.disabled = true;
  startButton.querySelector('span').textContent = '生产线运行中';
  setStage(0, 0);
  if (!await wait(420, version)) return;

  updateLesson(0, 1);
  if (!await wait(360, version)) return;
  setStage(1, 0, '完整文本原料正在沿传送带进入规则扫描舱');
  if (!await moveCargo([rawCargo], 1, 2050, version, { delay: 0, singleTarget: layoutFor(1) })) return;

  factory.classList.add('scanning');
  updateLesson(1, 0);
  if (!await wait(700, version)) return;
  updateLesson(1, 1);
  renderDetected(sourceText.value.trim());
  applyRecognitionColors(rawCargo, tokens);
  if (!await wait(1100, version)) return;
  factory.classList.remove('scanning');
  updateLesson(1, 2, '识别完成：中文、英文、数字和标点类型已标记，但完整文本仍保持原样，没有在这一工位切开。');
  if (!await wait(900, version)) return;

  setStage(2, 0, '带有边界标记的完整文本正在进入 Token 切分工位');
  if (!await moveCargo([rawCargo], 2, 1950, version, { delay: 0, singleTarget: layoutFor(2) })) return;
  if (!await splitRawIntoTokens(rawCargo, tokens, version, 2)) return;
  renderLasers(tokens);
  updateLesson(2, 1);
  factory.classList.add('laser-active');
  cargoItems.forEach(item => item.classList.add('processing'));
  if (!await wait(1450, version)) return;
  factory.classList.remove('laser-active');
  cargoItems.forEach(item => item.classList.remove('processing'));
  updateLesson(2, 2);
  if (!await wait(420, version)) return;

  setStage(3, 0, '标准 Token 块继续向右进入 TOKEN ID 编码塔');
  if (!await moveCargo(cargoItems, 3, 2050, version)) return;
  updateLesson(3, 1);
  for (let index = 0; index < cargoItems.length; index += 1) {
    if (version !== runVersion) return;
    renderEncoder(tokens, index + 1);
    const item = cargoItems[index];
    item.classList.add('flip', 'id');
    await wait(105, version);
    item.querySelector('b').textContent = String(idFor(tokens[index], index));
    item.dataset.value = String(idFor(tokens[index], index));
    await wait(90, version);
    item.classList.remove('flip');
  }
  updateLesson(3, 2);
  if (!await wait(520, version)) return;

  setStage(4, 0, 'Token ID 队列沿传送带驶向 Embedding 反应舱');
  if (!await moveCargo(cargoItems, 4, 1850, version)) return;
  updateLesson(4, 1);
  factory.classList.add('embedding-active');
  renderEmbedding(tokens);
  const absorbed = cargoItems.map((item, index) => {
    const fromX = Number(item.dataset.x);
    const fromY = Number(item.dataset.y);
    const animation = item.animate([
      { left: `${fromX}%`, top: `${fromY}%`, opacity: 1, transform: 'translate(-50%, -100%) scale(1)' },
      { left: `${89.5 + (index % 3 - 1) * .5}%`, top: '60%', opacity: .95, transform: 'translate(-50%, -100%) scale(.78)', offset: .55 },
      { left: '89.5%', top: '51%', opacity: 0, transform: 'translate(-50%, -100%) scale(.12) rotate(22deg)' }
    ], { duration: 1050, delay: index * 80, easing: 'cubic-bezier(.45,.02,.3,1)', fill: 'forwards' });
    return animation.finished.catch(() => null);
  });
  await Promise.all(absorbed);
  if (version !== runVersion) return;
  clearCargo();
  updateLesson(4, 2, `向量化完成：${tokens.length} 个 Token ID 已转换成可供 Transformer 计算的稠密向量。`);
  $('#statusText').textContent = 'Embedding 向量化完成 · Tokenizer 流水线加工结束';
  $('#statusCode').textContent = 'PIPELINE COMPLETE / 100%';
  $('#progressBar').style.width = '100%';
  factory.classList.remove('belt-running');
  factory.dataset.running = 'false';
  pipelineRunning = false;
  startButton.disabled = false;
  startButton.querySelector('span').textContent = '重新运行';
}

function previewStage(stage) {
  cancelRun();
  clearCargo();
  clearMachineOutputs();
  const tokens = getTokens();
  if (!tokens.length) return resetFactory(false);
  if (stage === 0) makeRawCargo();
  if (stage >= 1) renderDetected(sourceText.value.trim());
  if (stage === 1) {
    const raw = makeRawCargo();
    positionCargo(raw, layoutFor(1));
    raw.dataset.stage = '1';
    applyRecognitionColors(raw, tokens);
  }
  if (stage === 2) {
    makeTokenCargo(tokens, layoutFor(2, 0, 1));
    cargoItems.forEach((item, index) => positionCargo(item, layoutFor(2, index, tokens.length)));
    renderLasers(tokens);
  }
  if (stage === 3) {
    renderEncoder(tokens);
    makeTokenCargo(tokens, layoutFor(3, 0, 1));
    cargoItems.forEach((item, index) => {
      positionCargo(item, layoutFor(3, index, tokens.length));
      item.classList.add('id');
      item.querySelector('b').textContent = String(idFor(tokens[index], index));
    });
  }
  if (stage === 4) {
    renderEncoder(tokens);
    renderEmbedding(tokens);
    factory.classList.add('embedding-active');
    makeTokenCargo(tokens, layoutFor(4, 0, 1));
    cargoItems.forEach((item, index) => {
      positionCargo(item, layoutFor(4, index, tokens.length));
      item.classList.add('id');
      item.querySelector('b').textContent = String(idFor(tokens[index], index));
    });
  }
  setStage(stage, stage === 0 ? 0 : 2);
}

startButton.addEventListener('click', runFactory);
resetButton.addEventListener('click', () => resetFactory(true));
sourceText.addEventListener('input', () => {
  cancelRun();
  refreshPreview();
  resetFactory(false);
});

$$('.station-nav button').forEach(button => button.addEventListener('click', () => previewStage(Number(button.dataset.go))));
$('#prevStage').addEventListener('click', () => previewStage(Math.max(0, currentStage - 1)));
$('#nextStage').addEventListener('click', () => previewStage(Math.min(4, currentStage + 1)));
$('#autoDemo').addEventListener('click', runFactory);

const MODE_INFO = {
  word: {
    route: 'WORD UNIT', kicker: 'WORD-BASED', title: '一个词就是一个 Token？',
    description: '按空格、标点或语言分词器得到完整词。序列通常较短，但每个词形都可能占一个词表位置，新词与拼写变化容易落到词表之外。',
    summary: '完整词直接入库，序列短但词表压力大', formula: '句子 → 完整词 → 词表 ID',
    gauges: [92, 28, 78], values: ['大', '短', '高'],
    points: [['优势', 'Token 语义完整，序列通常更短'], ['代价', '词表膨胀，罕见词与新词容易 OOV'], ['示例', 'unhappiness 作为一个完整 Token']],
    takeaway: '一个单词并不等于一个稳定、通用的模型 Token；不同语言的“词边界”本身就可能很复杂。'
  },
  character: {
    route: 'CHARACTER UNIT', kicker: 'CHARACTER-BASED', title: '字符兜底为什么可靠？',
    description: '把文字拆到 Unicode 字符或更底层单元。它更容易覆盖新词，但一句话会产生更多 Token，注意力计算和上下文占用随之增加。',
    summary: '字符覆盖稳定，但序列明显变长', formula: '句子 → 字符 / 码点 → 词表 ID',
    gauges: [24, 94, 8], values: ['小', '长', '低'],
    points: [['优势', '词表较小，组合能力强，未知词风险低'], ['代价', '序列长，单个 Token 承载的语义较弱'], ['示例', 'unhappiness → u / n / h / …']],
    takeaway: 'Character-based 解决了开放词表问题，却把更多计算压力留给了后面的 Transformer。'
  },
  subword: {
    route: 'SUBWORD UNIT', kicker: 'SUBWORD-BASED', title: '为什么现代 LLM 常用子词？',
    description: '常见片段可以合并成较长 Token，罕见词又能退回到更小单元，因此不需要为每个完整词都准备词表项。',
    summary: '兼顾词表覆盖与序列长度', formula: '词 / 子词 / 字符 → 固定词表',
    gauges: [55, 55, 12], values: ['中', '中', '低'],
    points: [['优势', '开放词表、长度适中、可复用词根词缀'], ['代价', '切分依赖训练语料与具体词表'], ['示例', 'un + happi + ness']],
    takeaway: 'Tokenizer 不是按语义“理解”后切词，而是依据已经训练好的词表与规则编码。'
  }
};

const ALGORITHM_INFO = {
  bpe: {
    serial: 'ROUTE 01', name: 'BPE · Byte Pair Encoding',
    definition: '从字符或基础符号开始，统计训练语料中最常见的相邻对，将其合并成新符号；重复直到达到目标词表规模。',
    tags: ['频次驱动', '贪心合并', '固定 merge rules'],
    caution: '真实结果由模型自己的 merge rules、预切分规则与词表决定。'
  },
  bytebpe: {
    serial: 'ROUTE 02', name: 'Byte-level BPE · 字节级 BPE',
    definition: '先把文本编码为 UTF-8 字节，以 256 个字节值作为可逆的基础字母表，再学习常见字节片段的 BPE 合并。',
    tags: ['UTF-8 字节兜底', '可逆', '任意文本覆盖'],
    caution: '一个汉字包含多个 UTF-8 字节，Token 边界不一定与人眼看到的字符边界对齐。'
  },
  wordpiece: {
    serial: 'ROUTE 03', name: 'WordPiece · 词片匹配',
    definition: '训练阶段依据语料与词表目标选择有用片段；编码时通常从当前位置寻找词表中可匹配的最长片段，延续片段常用 ## 标记。',
    tags: ['词表驱动', '最长匹配', '## 延续标记'],
    caution: '## 是常见 WordPiece 显示约定，并非所有实现都使用相同的可视标记。'
  },
  unigram: {
    serial: 'ROUTE 04', name: 'Unigram Language Model · 一元语言模型',
    definition: '先准备较大的候选子词集合，为每个子词估计概率，再逐步删除对语料似然影响较小的候选；编码时寻找概率更高的切分路径。',
    tags: ['概率模型', '候选剪枝', '最佳路径'],
    caution: '页面概率仅用于讲解；真实概率来自 tokenizer 在训练语料上学习的模型。'
  }
};

let tokenizerMode = 'subword';
let subwordAlgorithm = 'bpe';

function lexicalUnits(text) {
  return text.match(/[\u3400-\u9fff]+|[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[^\s]/gu) || [];
}

function splitLatinSubword(word) {
  const lower = word.toLowerCase();
  const known = {
    unhappiness: ['un', 'happi', 'ness'], happiness: ['happi', 'ness'],
    transformer: ['transform', 'er'], tokenizer: ['token', 'izer'],
    studying: ['study', 'ing'], playing: ['play', 'ing'], lowest: ['low', 'est'],
    unbelievable: ['un', 'believ', 'able'], internationalization: ['international', 'ization']
  };
  if (known[lower]) {
    const parts = [...known[lower]];
    if (word[0] === word[0]?.toUpperCase()) parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
    return parts;
  }
  if (word.length <= 6) return [word];
  const suffixes = ['ization', 'ation', 'ness', 'able', 'ment', 'ingly', 'ing', 'ers', 'er', 'ed', 'ly', 's'];
  const suffix = suffixes.find(item => lower.endsWith(item) && word.length - item.length >= 3);
  if (suffix) return [word.slice(0, -suffix.length), word.slice(-suffix.length)];
  const pivot = Math.max(3, Math.min(word.length - 2, Math.round(word.length * .58)));
  return [word.slice(0, pivot), word.slice(pivot)];
}

function splitUnitToSubwords(unit) {
  if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(unit)) return splitLatinSubword(unit);
  if (/^[\u3400-\u9fff]+$/u.test(unit)) return allTokens(unit);
  return [unit];
}

function bpeTokens(text) {
  return lexicalUnits(text).flatMap(splitUnitToSubwords);
}

function byteBpeTokens(text) {
  const chunks = text.match(/\s+|[\u3400-\u9fff]+|[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[^\s]/gu) || [];
  let afterSpace = false;
  const result = [];
  chunks.forEach(chunk => {
    if (/^\s+$/u.test(chunk)) { afterSpace = true; return; }
    const pieces = splitUnitToSubwords(chunk);
    pieces.forEach((piece, index) => result.push(`${afterSpace && index === 0 ? 'Ġ' : ''}${piece}`));
    afterSpace = false;
  });
  return result;
}

function wordPieceTokens(text) {
  return lexicalUnits(text).flatMap(unit => splitUnitToSubwords(unit).map((piece, index) => index ? `##${piece}` : piece));
}

function unigramTokens(text) {
  const chunks = text.match(/\s+|[\u3400-\u9fff]+|[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[^\s]/gu) || [];
  let atBoundary = true;
  const result = [];
  chunks.forEach(chunk => {
    if (/^\s+$/u.test(chunk)) { atBoundary = true; return; }
    const pieces = splitUnitToSubwords(chunk);
    const isPunctuation = /^[^A-Za-z0-9\u3400-\u9fff]+$/u.test(chunk);
    pieces.forEach((piece, index) => result.push(`${atBoundary && index === 0 && !isPunctuation ? '▁' : ''}${piece}`));
    atBoundary = false;
  });
  return result;
}

function tokenizeForLab(text, mode = tokenizerMode, algorithm = subwordAlgorithm) {
  if (mode === 'word') return lexicalUnits(text);
  if (mode === 'character') return [...text].map(char => /^\s$/u.test(char) ? '␠' : char);
  if (algorithm === 'bytebpe') return byteBpeTokens(text);
  if (algorithm === 'wordpiece') return wordPieceTokens(text);
  if (algorithm === 'unigram') return unigramTokens(text);
  return bpeTokens(text);
}

function renderLabTokens(tokens) {
  const limited = tokens.slice(0, 36);
  $('#labOutput').innerHTML = limited.map((token, index) => `<span class="lab-token" style="--token-index:${index}">${safe(token)}</span>`).join('') || '<span class="lab-token">EMPTY</span>';
  $('#labTokenCount').textContent = String(tokens.length);
}

function renderMode(mode = tokenizerMode) {
  tokenizerMode = mode;
  const info = MODE_INFO[mode];
  $$('.mode-tab').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $('#routeMode').textContent = info.route;
  $('#conceptKicker').textContent = info.kicker;
  $('#conceptTitle').textContent = info.title;
  $('#conceptDescription').textContent = info.description;
  $('#labModeSummary').textContent = info.summary;
  $('#labFormula').textContent = info.formula;
  $('#conceptTakeaway').textContent = info.takeaway;
  $('#conceptPoints').innerHTML = info.points.map(([label, value]) => `<li><b>${safe(label)}</b><span>${safe(value)}</span></li>`).join('');
  ['vocab', 'sequence', 'unknown'].forEach((name, index) => {
    $(`#${name}Gauge`).style.width = `${info.gauges[index]}%`;
    $(`#${name}Value`).textContent = info.values[index];
  });
  const tokens = tokenizeForLab($('#labText').value, mode);
  renderLabTokens(tokens);
}

function timelineForAlgorithm(algorithm, sample) {
  const pieces = splitLatinSubword(sample);
  const chars = [...sample].join(' · ');
  if (algorithm === 'bytebpe') {
    const bytes = [...new TextEncoder().encode(sample)].map(byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    return [
      ['编码', '文本 → UTF-8', bytes],
      ['映射', '字节作为基础单元', [...sample].join(' | ')],
      ['合并', '按 merge rank 融合', pieces.join(' + ')]
    ];
  }
  if (algorithm === 'wordpiece') return [
    ['装载', '待编码词', sample],
    ['匹配', '从当前位置查最长词片', pieces.map((part, index) => index ? `##${part}` : part).join(' | ')],
    ['完成', '全部字符被词表覆盖', pieces.map((part, index) => index ? `##${part}` : part).join(' + ')]
  ];
  if (algorithm === 'unigram') {
    const alternative = pieces.length > 1 ? [pieces[0], pieces.slice(1).join('')].join(' + ') : [...sample].join(' + ');
    return [
      ['候选', '建立多条切分路径', `${pieces.join(' + ')}  /  ${alternative}`],
      ['评分', '计算路径概率（示意）', 'P(path A)=0.42  >  P(path B)=0.17'],
      ['选择', 'Viterbi / 最佳路径', pieces.join(' + ')]
    ];
  }
  return [
    ['初始', '基础符号序列', chars],
    ['统计', '寻找高频相邻对', `${pieces[0] || sample}  ← pair merge`],
    ['重复', '按规则持续合并', pieces.join(' + ')]
  ];
}

function renderAlgorithm(algorithm = subwordAlgorithm) {
  subwordAlgorithm = algorithm;
  const info = ALGORITHM_INFO[algorithm];
  $$('.algorithm-card').forEach(button => {
    const active = button.dataset.algorithm === algorithm;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $('#algorithmSerial').textContent = info.serial;
  $('#algorithmName').textContent = info.name;
  $('#algorithmDefinition').textContent = info.definition;
  $('#algorithmTags').innerHTML = info.tags.map(tag => `<span>${safe(tag)}</span>`).join('');
  $('#algorithmCaution').textContent = info.caution;
  const sampleMatch = $('#labText').value.match(/[A-Za-z]{5,}/);
  const sample = sampleMatch ? sampleMatch[0] : 'tokenizer';
  const timeline = timelineForAlgorithm(algorithm, sample);
  $('#algorithmTimeline').innerHTML = timeline.map(([label, action, result], index) => `
    <div class="timeline-step" style="--step-index:${index}"><b>${index + 1}</b><span>${safe(label)} · ${safe(action)}</span><code>${safe(result)}</code></div>
  `).join('');
  const tokens = tokenizeForLab($('#labText').value, 'subword', algorithm);
  $('#algorithmResult').innerHTML = tokens.slice(0, 18).map(token => `<b>${safe(token)}</b>`).join('');
}

function runTokenizerLab() {
  const lab = $('#tokenizerLab');
  lab.classList.remove('lab-running');
  void lab.offsetWidth;
  lab.classList.add('lab-running');
  renderMode(tokenizerMode);
  renderAlgorithm(subwordAlgorithm);
}

$$('.mode-tab').forEach(button => button.addEventListener('click', () => renderMode(button.dataset.mode)));
$$('.algorithm-card').forEach(button => button.addEventListener('click', () => {
  renderAlgorithm(button.dataset.algorithm);
  renderMode('subword');
}));
$('#runLab').addEventListener('click', runTokenizerLab);
$('#labText').addEventListener('keydown', event => { if (event.key === 'Enter') runTokenizerLab(); });
$('#labText').addEventListener('input', () => {
  renderMode(tokenizerMode);
  renderAlgorithm(subwordAlgorithm);
});

const canvas = $('#particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeParticles() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  particles = Array.from({ length: 38 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.4 + .3, v: Math.random() * .18 + .05, a: Math.random() * .35 + .08 }));
}
function drawParticles() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles.forEach(particle => {
    particle.y -= particle.v;
    if (particle.y < -4) { particle.y = innerHeight + 4; particle.x = Math.random() * innerWidth; }
    ctx.fillStyle = `rgba(85,221,255,${particle.a})`;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2); ctx.fill();
  });
  requestAnimationFrame(drawParticles);
}
window.addEventListener('resize', resizeParticles);

factory.dataset.transportMode = 'continuous-belt-2d';
factory.dataset.maxTokens = '12';
window.factoryDebug = {
  renderer: '2D cinematic composite',
  get state() {
    return {
      activeStage: currentStage,
      lessonStep: currentLessonStep,
      pipelineRunning,
      transportMode: factory.dataset.transportMode,
      cargoCount: cargoItems.length,
      tokenCount: getTokens().length,
      cargoPositions: cargoItems.map(item => ({ value: item.dataset.value, x: Number(item.dataset.x), y: Number(item.dataset.y) }))
    };
  }
};

refreshPreview();
resetFactory(false);
renderMode('subword');
renderAlgorithm('bpe');
resizeParticles();
drawParticles();
