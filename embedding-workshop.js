const EMBEDDING_METHODS = {
  onehot: {
    serial: 'ROUTE 01 · SPARSE BASELINE',
    name: 'One-hot · 身份编码基线',
    definition: '词表中的每个 Token 占据一个独立维度。三维图只是高维稀疏向量的教学投影，不代表学到了语义。',
    type: '稀疏', training: '不需要', dynamic: '否', mode: 'ONE-HOT SPACE', dimension: '1 × |V| 维',
    steps: [['Token 输入', '苹果'], ['查询词表', 'vocab[苹果]'], ['生成稀疏码', '只有一位为 1'], ['三维投影', '仅用于观察']],
    verdict: ['One-hot 只标记“它是谁”', '所有词彼此正交，本身没有“水果更接近香蕉”这样的语义结构。'],
    distance: 'One-hot 中不同词的余弦相似度为 0；三维投影里的远近不携带训练得到的语义。',
    formula: 'one_hot(token_id) ∈ {0,1}<sup>|V|</sup>',
    takeaway: 'One-hot 是词表身份牌，不是语义地图。'
  },
  token: {
    serial: 'ROUTE 02 · TRAINABLE LOOKUP',
    name: 'Token Embedding · 可训练向量表',
    definition: 'Token ID 直接选择 Embedding 矩阵中的一行。训练开始前近似随机，随后随语言模型目标一起更新。',
    type: '稠密', training: '端到端', dynamic: '层前不变', mode: 'TOKEN LOOKUP SPACE', dimension: '1 × 16 维示意',
    steps: [['Token ID', '101'], ['查矩阵行', 'E[101]'], ['读取稠密向量', '16 维示意'], ['送入模型', '与位置相加']],
    verdict: ['ID 已经变成可计算的连续向量', '同一个 Token ID 在进入 Transformer 之前查询到同一行；语义结构来自训练，而不是编号大小。'],
    distance: '训练会把具有相似使用方式的 Token 向量拉近；但一词多义仍共享同一个输入向量。',
    formula: 'x<sub>token</sub> = E[token_id] ∈ ℝ<sup>d</sup>',
    takeaway: 'Token Embedding 是模型学出来的查表结果，ID 的数值大小没有语义。'
  },
  word2vec: {
    serial: 'ROUTE 03 · LOCAL CONTEXT PREDICTION',
    name: 'Word2Vec · 局部上下文静态向量',
    definition: 'CBOW 或 Skip-gram 根据局部上下文窗口进行预测，使经常出现在相似邻域中的词获得相近向量。',
    type: '稠密静态', training: '单独训练', dynamic: '否', mode: 'WORD2VEC SEMANTIC SPACE', dimension: '1 × 16 维示意',
    steps: [['滑动窗口', '读取局部邻词'], ['预测任务', 'CBOW / Skip-gram'], ['更新词向量', '拉近相似用法'], ['形成语义簇', '静态坐标']],
    verdict: ['局部共现形成可观察的语义邻域', '水果、科技、动物等词开始聚成不同簇，但“苹果”仍只有一个固定向量。'],
    distance: '余弦相似度反映局部上下文使用方式是否相近；距离近不等于两个词完全同义。',
    formula: 'maximize log P(context | word)',
    takeaway: 'Word2Vec 能画出语义地图，但同一个词仍只有一个固定坐标。'
  },
  glove: {
    serial: 'ROUTE 04 · GLOBAL CO-OCCURRENCE',
    name: 'GloVe · 全局统计静态向量',
    definition: 'GloVe 统计整个语料中的词语共现次数，通过共现比率学习全局语义结构，而不是逐窗口完成预测。',
    type: '稠密静态', training: '统计训练', dynamic: '否', mode: 'GLOVE GLOBAL SPACE', dimension: '1 × 16 维示意',
    steps: [['扫描全语料', '统计共现'], ['构建矩阵', 'Xᵢⱼ'], ['拟合共现比', '全局统计'], ['输出词向量', '静态坐标']],
    verdict: ['全局统计让“苹果”处在多种含义之间', '当语料同时包含水果和公司用法时，一个固定向量可能落在两个语义簇之间。'],
    distance: 'GloVe 的几何关系来自全局共现统计；一个多义词仍会把不同含义压缩在同一坐标中。',
    formula: 'wᵢᵀwⱼ + bᵢ + bⱼ ≈ log Xᵢⱼ',
    takeaway: 'GloVe 看全局共现，但仍无法为每个句子单独生成词义坐标。'
  },
  position: {
    serial: 'ROUTE 05 · SEQUENCE ORDER SIGNAL',
    name: '位置编码 · 给 Token 注入顺序',
    definition: '自注意力本身不会天然知道先后顺序。位置编码为序列中的每个位置生成信号，并与 Token Embedding 组合。',
    type: '顺序信号', training: '固定或可学', dynamic: '随位置', mode: 'POSITION TRAJECTORY', dimension: '1 × 16 维示意',
    steps: [['Token 向量', 'E[苹果]'], ['读取位置', 'position = 3'], ['生成位置码', 'sin / cos'], ['向量相加', 'Token + Position']],
    verdict: ['同一个 Token 放在不同位置会得到不同输入表示', '拖动“Token 所在位置”，可以看到苹果沿位置轨迹移动；这表示顺序变化，不等于词义变化。'],
    distance: '位置相近通常具有较相似的位置模式；它描述序列顺序，不直接代表语义类别。',
    formula: 'xᵢ = E[tokenᵢ] + P(i)',
    takeaway: '位置编码回答“它排在哪里”，上下文编码才回答“它在这里是什么意思”。'
  },
  contextual: {
    serial: 'ROUTE 06 · TRANSFORMER CONTEXT MIXING',
    name: '上下文 Embedding · 当前语义向量',
    definition: 'Transformer 让每个 Token 通过注意力读取整句信息。经过多层更新，同一个词会因上下文不同而得到不同表示。',
    type: '稠密动态', training: '预训练模型', dynamic: '是', mode: 'CONTEXTUAL SEMANTIC SPACE', dimension: '1 × 16 维示意',
    steps: [['Token + 位置', '输入序列'], ['自注意力', '读取整句关系'], ['多层更新', '上下文混合'], ['当前语义', '动态坐标']],
    verdict: ['“苹果”会被当前句子的其他词拉向不同语义簇', '在“喜欢吃苹果”中靠近水果；在“苹果发布手机”中靠近科技公司。'],
    distance: '上下文向量比较的是当前句子里的具体用法，因此更适合处理一词多义、指代和语境差异。',
    formula: 'hᵢ<sup>(L)</sup> = Transformer(x₁, …, xₙ)ᵢ',
    takeaway: '现代 LLM 不只给词一个坐标，而是根据整句话实时重算当前语义。'
  }
};

const EMBEDDING_CATEGORIES = {
  target: { label: '目标词', color: '#f1d27f' },
  fruit: { label: '水果', color: '#70eda5' },
  tech: { label: '科技', color: '#bd7cff' },
  animal: { label: '动物', color: '#edbd62' },
  language: { label: '语言模型', color: '#61dff7' },
  ghost: { label: '另一语境', color: '#91a0c6' }
};

const EMBEDDING_BASE_POINTS = [
  { id: 'apple', label: '苹果', category: 'target', coords: [-0.08, 0.28, 0.12] },
  { id: 'banana', label: '香蕉', category: 'fruit', coords: [-0.76, 0.34, 0.30] },
  { id: 'orange', label: '橙子', category: 'fruit', coords: [-0.60, 0.56, 0.06] },
  { id: 'grape', label: '葡萄', category: 'fruit', coords: [-0.88, 0.08, -0.02] },
  { id: 'pear', label: '梨', category: 'fruit', coords: [-0.57, 0.18, 0.52] },
  { id: 'microsoft', label: '微软', category: 'tech', coords: [0.72, 0.42, 0.26] },
  { id: 'phone', label: '手机', category: 'tech', coords: [0.58, 0.12, 0.50] },
  { id: 'chip', label: '芯片', category: 'tech', coords: [0.86, 0.02, 0.10] },
  { id: 'computer', label: '电脑', category: 'tech', coords: [0.54, 0.60, -0.06] },
  { id: 'cat', label: '猫', category: 'animal', coords: [-0.42, -0.48, 0.36] },
  { id: 'dog', label: '狗', category: 'animal', coords: [-0.65, -0.58, 0.12] },
  { id: 'tiger', label: '老虎', category: 'animal', coords: [-0.29, -0.68, -0.06] },
  { id: 'bear', label: '熊', category: 'animal', coords: [-0.78, -0.32, -0.18] },
  { id: 'token', label: 'Token', category: 'language', coords: [0.28, -0.42, 0.33] },
  { id: 'vector', label: '向量', category: 'language', coords: [0.51, -0.55, 0.09] },
  { id: 'model', label: '模型', category: 'language', coords: [0.18, -0.69, -0.14] },
  { id: 'attention', label: '注意力', category: 'language', coords: [0.68, -0.31, -0.20] }
];

let embeddingMethod = 'onehot';
let embeddingContext = 'fruit';
let embeddingPosition = 3;
let embeddingSelectedId = 'apple';
let contextPlaybackTimer = null;
let embeddingRouteVersion = 0;

function embeddingHash(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function oneHotProjection(index, total) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (index / Math.max(1, total - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * index;
  return [Math.cos(theta) * radius * .9, y * .78, Math.sin(theta) * radius * .9];
}

function methodPoints(method = embeddingMethod, context = embeddingContext, position = embeddingPosition) {
  const base = EMBEDDING_BASE_POINTS.map(point => ({ ...point, coords: [...point.coords] }));
  if (method === 'onehot') {
    return base.map((point, index) => ({ ...point, coords: oneHotProjection(index, base.length) }));
  }

  if (method === 'token') {
    return base.map((point, index) => {
      const noise = ((embeddingHash(point.id) % 100) / 100 - .5) * .24;
      const strength = point.id === 'apple' ? .42 : .74;
      return { ...point, coords: point.coords.map((value, axis) => value * strength + noise * (axis === 1 ? -.7 : 1)) };
    });
  }

  if (method === 'word2vec') {
    return base.map(point => point.id === 'apple' ? { ...point, coords: [-0.48, .33, .27] } : point);
  }

  if (method === 'glove') {
    return base.map(point => point.id === 'apple' ? { ...point, coords: [0.02, .38, .22] } : {
      ...point,
      coords: point.coords.map((value, axis) => value * (axis === 2 ? .84 : .92))
    });
  }

  if (method === 'position') {
    const withoutApple = base.filter(point => point.id !== 'apple').map(point => ({ ...point, muted: true }));
    const positions = Array.from({ length: 8 }, (_, index) => {
      const pos = index + 1;
      const angle = pos * .72;
      return {
        id: `apple-pos-${pos}`,
        label: `苹果@${pos}`,
        category: pos === position ? 'target' : 'ghost',
        coords: [Math.cos(angle) * .60, (pos - 4.5) * .16, Math.sin(angle) * .60],
        position: pos,
        ghost: pos !== position
      };
    });
    return [...withoutApple, ...positions];
  }

  if (method === 'contextual') {
    const activeCoords = context === 'fruit' ? [-0.69, .37, .28] : [.69, .31, .35];
    const alternateCoords = context === 'fruit' ? [.69, .31, .35] : [-0.69, .37, .28];
    return base.map(point => point.id === 'apple' ? {
      ...point,
      label: context === 'fruit' ? '苹果 · 水果义' : '苹果 · 公司义',
      coords: activeCoords
    } : point).concat({
      id: 'apple-alternate',
      label: context === 'fruit' ? '苹果 · 公司义' : '苹果 · 水果义',
      category: 'ghost',
      coords: alternateCoords,
      ghost: true
    });
  }

  return base;
}

function pointVector(point, method = embeddingMethod) {
  if (method === 'onehot') {
    const vector = Array(16).fill(0);
    vector[embeddingHash(point.id) % 16] = 1;
    return vector;
  }
  const categories = ['fruit', 'tech', 'animal', 'language'];
  const categoryIndex = categories.indexOf(point.category);
  const seed = embeddingHash(`${method}:${point.id}`);
  const vector = Array.from({ length: 16 }, (_, index) => {
    if (index < 3) return point.coords[index] || 0;
    if (index >= 3 && index < 7) return index - 3 === categoryIndex ? .82 : -.08;
    const wave = Math.sin((seed % 997 + index * 31) * .017) * .22;
    if (method === 'position') return wave + Math.sin((point.position || embeddingPosition) / Math.pow(10000, (index - 7) / 9)) * .55;
    return wave + (point.coords[index % 3] || 0) * .35;
  });
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => value / magnitude);
}

function cosineSimilarity(pointA, pointB) {
  if (embeddingMethod === 'onehot') return pointA.id === pointB.id ? 1 : 0;
  const a = pointVector(pointA);
  const b = pointVector(pointB);
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function embeddingCategory(point) {
  if (point.id === 'apple' || point.category === 'target') return '目标词';
  return EMBEDDING_CATEGORIES[point.category]?.label || '语义点';
}

function selectedPointFrom(points) {
  if (embeddingMethod === 'position') return points.find(point => point.position === embeddingPosition) || points[0];
  return points.find(point => point.id === embeddingSelectedId) || points.find(point => point.id === 'apple') || points[0];
}

function updateEmbeddingOutput(points) {
  const selected = selectedPointFrom(points);
  if (!selected) return;
  embeddingSelectedId = selected.id;
  const vector = pointVector(selected);
  const neighbors = points
    .filter(point => point.id !== selected.id && !point.ghost && !point.muted)
    .map(point => ({ point, score: cosineSimilarity(selected, point) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  $('#selectedToken').textContent = selected.label;
  $('#selectedCategory').textContent = embeddingCategory(selected);
  $('#selectedCoordinates').textContent = `3D 坐标：[${selected.coords.map(value => value.toFixed(2)).join(', ')}]`;
  $('#selectedExplanation').textContent = embeddingMethod === 'onehot'
    ? '这是高维稀疏码的三维教学投影；点的位置是为了便于观察，不是训练得到的语义。'
    : embeddingMethod === 'position'
      ? `当前显示“苹果”位于序列第 ${embeddingPosition} 位时的位置轨迹。`
      : embeddingMethod === 'contextual' && selected.id === 'apple'
        ? `当前句子把“苹果”解释为${embeddingContext === 'fruit' ? '水果' : '科技公司'}，坐标因此靠近对应语义簇。`
        : `当前路线下，它最接近：${neighbors.map(item => item.point.label).join('、') || '暂无邻居'}。`;

  $('#denseVectorCells').innerHTML = vector.map((value, index) => {
    const strength = Math.min(1, Math.abs(value));
    return `<span class="vector-cell" style="--strength:${strength.toFixed(2)};--cell-index:${index}">${value >= 0 ? '+' : ''}${value.toFixed(2)}</span>`;
  }).join('');

  $('#nearestNeighbors').innerHTML = neighbors.length ? neighbors.map((item, index) => {
    const displayScore = embeddingMethod === 'onehot' ? 0 : Math.max(-1, Math.min(1, item.score));
    const meter = Math.max(3, (displayScore + 1) * 50);
    return `<li style="--similarity:${meter.toFixed(0)}%"><b>0${index + 1}</b><span>${item.point.label}</span><em>${displayScore.toFixed(2)}</em></li>`;
  }).join('') : '<li><b>—</b><span>当前没有可比较邻居</span><em>—</em></li>';
}

function applyEmbeddingMethod(method, options = {}) {
  if (!EMBEDDING_METHODS[method]) return;
  embeddingMethod = method;
  const info = EMBEDDING_METHODS[method];
  embeddingRouteVersion += 1;
  const version = embeddingRouteVersion;
  $$('.encoding-route').forEach(button => {
    const active = button.dataset.embeddingMethod === method;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  $('#embeddingMethodSerial').textContent = info.serial;
  $('#semanticSpaceTitle').textContent = info.name;
  $('#embeddingMethodDefinition').textContent = info.definition;
  $('#vectorType').textContent = info.type;
  $('#vectorTraining').textContent = info.training;
  $('#vectorDynamic').textContent = info.dynamic;
  $('#spaceModeLabel').textContent = info.mode;
  $('#vectorDimension').textContent = info.dimension;
  $('#encodingVerdict').innerHTML = `<span>当前观察</span><b>${info.verdict[0]}</b><p>${info.verdict[1]}</p>`;
  $('#distanceExplanation').textContent = info.distance;
  $('#embeddingFormula').innerHTML = info.formula;
  $('#embeddingTakeaway').textContent = info.takeaway;

  info.steps.forEach((step, index) => {
    $(`#assemblyStep${index + 1}`).textContent = step[0];
    $(`#assemblyDetail${index + 1}`).textContent = step[1];
  });
  if (method === 'position') $('#assemblyDetail2').textContent = `position = ${embeddingPosition}`;
  if (method === 'contextual') $('#assemblyDetail1').textContent = embeddingContext === 'fruit' ? '我喜欢吃苹果' : '苹果发布新手机';

  const lineSteps = $$('.vector-assembly-line > div');
  lineSteps.forEach((step, index) => {
    step.classList.remove('active');
    step.style.setProperty('--step-index', index);
  });
  lineSteps.forEach((step, index) => setTimeout(() => {
    if (version !== embeddingRouteVersion) return;
    lineSteps.forEach(item => item.classList.remove('active'));
    step.classList.add('active');
  }, index * 145));

  $('#embeddingMachine').classList.remove('route-firing');
  requestAnimationFrame(() => $('#embeddingMachine').classList.add('route-firing'));
  setTimeout(() => $('#embeddingMachine').classList.remove('route-firing'), 760);

  const points = methodPoints();
  embeddingSelectedId = method === 'position' ? `apple-pos-${embeddingPosition}` : 'apple';
  embeddingSpace.setPoints(points, options.instant);
  updateEmbeddingOutput(points);
}

function applyEmbeddingContext(context, options = {}) {
  if (!['fruit', 'tech'].includes(context)) return;
  embeddingContext = context;
  $$('.context-switch button').forEach(button => {
    const active = button.dataset.embeddingContext === context;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (embeddingMethod === 'contextual') $('#assemblyDetail1').textContent = context === 'fruit' ? '我喜欢吃苹果' : '苹果发布新手机';
  const points = methodPoints();
  embeddingSelectedId = embeddingMethod === 'position' ? `apple-pos-${embeddingPosition}` : 'apple';
  embeddingSpace.setPoints(points, options.instant);
  updateEmbeddingOutput(points);
  $('#embeddingMachine').classList.remove('context-shift');
  requestAnimationFrame(() => $('#embeddingMachine').classList.add('context-shift'));
  setTimeout(() => $('#embeddingMachine').classList.remove('context-shift'), 850);
}

class EmbeddingSpace3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.points = [];
    this.yaw = -0.55;
    this.pitch = -0.26;
    this.zoom = 1;
    this.dragging = false;
    this.autoRotate = false;
    this.pointer = { x: 0, y: 0 };
    this.projected = [];
    this.needsDraw = true;
    this.lastTime = performance.now();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bind();
    this.resize();
    this.loop();
  }

  bind() {
    this.canvas.addEventListener('pointerdown', event => {
      this.dragging = true;
      this.pointer = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.parentElement.classList.add('dragging');
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.dragging) return;
      this.yaw += (event.clientX - this.pointer.x) * .007;
      this.pitch = Math.max(-1.05, Math.min(.8, this.pitch + (event.clientY - this.pointer.y) * .006));
      this.pointer = { x: event.clientX, y: event.clientY };
      this.needsDraw = true;
    });
    const release = event => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      this.canvas.parentElement.classList.remove('dragging');
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.zoom = Math.max(.68, Math.min(1.65, this.zoom * (event.deltaY > 0 ? .92 : 1.08)));
      this.needsDraw = true;
    }, { passive: false });
    this.canvas.addEventListener('click', event => {
      if (!this.projected.length) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const target = this.projected
        .map(item => ({ item, distance: Math.hypot(item.x - x, item.y - y) }))
        .filter(candidate => candidate.distance < Math.max(24, candidate.item.radius + 9))
        .sort((left, right) => left.distance - right.distance)[0];
      if (!target) return;
      embeddingSelectedId = target.item.point.id;
      updateEmbeddingOutput(this.points.map(item => item.data));
      this.needsDraw = true;
    });
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.canvas.parentElement);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.needsDraw = true;
  }

  setPoints(points, instant = false) {
    const previous = new Map(this.points.map(item => [item.data.id, item]));
    const fallback = previous.get('apple')?.current || [0, 0, 0];
    this.points = points.map(point => {
      const old = previous.get(point.id);
      return {
        data: point,
        current: instant ? [...point.coords] : [...(old?.current || fallback)],
        target: [...point.coords]
      };
    });
    this.needsDraw = true;
  }

  resetView() {
    this.yaw = -0.55;
    this.pitch = -0.26;
    this.zoom = 1;
    this.needsDraw = true;
  }

  project(coords) {
    const [x, y, z] = coords;
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    const cosX = Math.cos(this.pitch);
    const sinX = Math.sin(this.pitch);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    const perspective = 1 / (1.18 - z2 * .20);
    const scale = Math.min(this.width, this.height) * .37 * this.zoom;
    return {
      x: this.width * .51 + x1 * scale * perspective,
      y: this.height * .51 - y1 * scale * perspective,
      depth: z2,
      perspective
    };
  }

  drawLine3D(start, end, color, width = 1, alpha = 1) {
    const a = this.project(start);
    const b = this.project(end);
    const context = this.context;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
    context.restore();
  }

  drawGrid() {
    for (let value = -1; value <= 1.001; value += .25) {
      this.drawLine3D([value, -1, -1], [value, -1, 1], '#416278', .7, .25);
      this.drawLine3D([-1, -1, value], [1, -1, value], '#416278', .7, .25);
      this.drawLine3D([-1, value, -1], [-1, value, 1], '#38516a', .6, .13);
    }
    this.drawLine3D([-1.12, -1, -1], [1.22, -1, -1], '#ff7885', 1.7, .92);
    this.drawLine3D([-1, -1.12, -1], [-1, 1.18, -1], '#6ee9a9', 1.7, .92);
    this.drawLine3D([-1, -1, -1.12], [-1, -1, 1.22], '#69dfff', 1.7, .92);
    this.drawAxisLabel([1.26, -1, -1], 'X', '#ff7885');
    this.drawAxisLabel([-1, 1.24, -1], 'Y', '#6ee9a9');
    this.drawAxisLabel([-1, -1, 1.27], 'Z', '#69dfff');
  }

  drawAxisLabel(coords, label, color) {
    const position = this.project(coords);
    this.context.save();
    this.context.fillStyle = color;
    this.context.font = '700 12px ui-monospace, Consolas, monospace';
    this.context.shadowColor = color;
    this.context.shadowBlur = 8;
    this.context.fillText(label, position.x, position.y);
    this.context.restore();
  }

  drawConnections(projected) {
    const selected = this.points.find(item => item.data.id === embeddingSelectedId) || this.points.find(item => item.data.id === 'apple');
    if (!selected) return;
    const neighbors = this.points
      .filter(item => item !== selected && !item.data.ghost && !item.data.muted)
      .map(item => ({ item, score: cosineSimilarity(selected.data, item.data) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, embeddingMethod === 'onehot' ? 0 : 4);
    neighbors.forEach((neighbor, index) => {
      const color = EMBEDDING_CATEGORIES[neighbor.item.data.category]?.color || '#65dff7';
      this.drawLine3D(selected.current, neighbor.item.current, color, index === 0 ? 1.6 : 1, .28 + Math.max(0, neighbor.score) * .35);
    });
    if (embeddingMethod === 'position') {
      const track = this.points.filter(item => item.data.position).sort((a, b) => a.data.position - b.data.position);
      for (let index = 1; index < track.length; index += 1) this.drawLine3D(track[index - 1].current, track[index].current, '#b47cf1', 1.2, .48);
    }
  }

  drawPoint(item, projected) {
    const point = item.data;
    const selected = point.id === embeddingSelectedId || (embeddingMethod !== 'position' && point.id === 'apple' && embeddingSelectedId === 'apple');
    const category = EMBEDDING_CATEGORIES[point.category] || EMBEDDING_CATEGORIES.ghost;
    const radius = (selected ? 8.5 : point.ghost ? 3.5 : 5.2) * projected.perspective;
    const alpha = point.ghost ? .32 : point.muted ? .30 : 1;
    const context = this.context;
    context.save();
    context.globalAlpha = alpha;
    const glow = context.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius * 3.8);
    glow.addColorStop(0, category.color);
    glow.addColorStop(.23, `${category.color}c0`);
    glow.addColorStop(1, `${category.color}00`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(projected.x, projected.y, radius * 3.8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#efffff';
    context.strokeStyle = category.color;
    context.lineWidth = selected ? 2.4 : 1.4;
    context.shadowColor = category.color;
    context.shadowBlur = selected ? 18 : 10;
    context.beginPath();
    context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (selected) {
      context.strokeStyle = category.color;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(projected.x, projected.y, radius + 6, 0, Math.PI * 2);
      context.stroke();
    }
    context.shadowBlur = 7;
    context.fillStyle = selected ? '#fff4cf' : '#dff7fb';
    context.font = selected ? '700 13px "Microsoft YaHei", sans-serif' : '600 10px "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    context.fillText(point.label, projected.x, projected.y - radius - (selected ? 11 : 7));
    context.restore();
    return radius;
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    const ambient = context.createRadialGradient(this.width * .5, this.height * .48, 10, this.width * .5, this.height * .48, this.width * .55);
    ambient.addColorStop(0, '#173a642e');
    ambient.addColorStop(1, '#02050a00');
    context.fillStyle = ambient;
    context.fillRect(0, 0, this.width, this.height);
    this.drawGrid();
    const projected = this.points.map(item => ({ item, ...this.project(item.current) })).sort((a, b) => a.depth - b.depth);
    this.drawConnections(projected);
    this.projected = projected.map(entry => ({
      point: entry.item.data,
      x: entry.x,
      y: entry.y,
      radius: this.drawPoint(entry.item, entry)
    }));
  }

  loop(time = performance.now()) {
    const elapsed = Math.min(40, time - this.lastTime);
    this.lastTime = time;
    let moving = false;
    this.points.forEach(item => {
      item.current = item.current.map((value, index) => {
        const difference = item.target[index] - value;
        if (Math.abs(difference) > .001) moving = true;
        return value + difference * Math.min(.22, elapsed * .012);
      });
      item.data.coords = [...item.current];
    });
    if (this.autoRotate && !this.dragging && !this.reducedMotion) {
      this.yaw += elapsed * .00018;
      moving = true;
    }
    if (moving || this.needsDraw) {
      this.draw();
      this.needsDraw = false;
    }
    requestAnimationFrame(nextTime => this.loop(nextTime));
  }
}

const embeddingCanvas = $('#embeddingSpaceCanvas');
const embeddingSpace = new EmbeddingSpace3D(embeddingCanvas);

$$('.encoding-route').forEach(button => button.addEventListener('click', () => applyEmbeddingMethod(button.dataset.embeddingMethod)));
$$('.context-switch button').forEach(button => button.addEventListener('click', () => applyEmbeddingContext(button.dataset.embeddingContext)));

$('#tokenPosition').addEventListener('input', event => {
  embeddingPosition = Number(event.target.value);
  $('#tokenPositionValue').textContent = `位置 ${embeddingPosition}`;
  if (embeddingMethod === 'position') {
    $('#assemblyDetail2').textContent = `position = ${embeddingPosition}`;
    embeddingSelectedId = `apple-pos-${embeddingPosition}`;
    const points = methodPoints();
    embeddingSpace.setPoints(points);
    updateEmbeddingOutput(points);
  }
});

$('#toggleSpaceRotation').addEventListener('click', event => {
  embeddingSpace.autoRotate = !embeddingSpace.autoRotate;
  event.currentTarget.setAttribute('aria-pressed', String(embeddingSpace.autoRotate));
  event.currentTarget.innerHTML = embeddingSpace.autoRotate ? '<span>◉</span>停止旋转' : '<span>◉</span>自动旋转';
  embeddingSpace.needsDraw = true;
});

$('#resetSpaceView').addEventListener('click', () => embeddingSpace.resetView());

function stopContextPlayback() {
  clearInterval(contextPlaybackTimer);
  contextPlaybackTimer = null;
  $('#animateContext').innerHTML = '<span>▶</span>播放语境切换';
}

$('#animateContext').addEventListener('click', () => {
  if (contextPlaybackTimer) return stopContextPlayback();
  if (embeddingMethod !== 'contextual') applyEmbeddingMethod('contextual');
  $('#animateContext').innerHTML = '<span>■</span>停止播放';
  applyEmbeddingContext(embeddingContext === 'fruit' ? 'tech' : 'fruit');
  contextPlaybackTimer = setInterval(() => applyEmbeddingContext(embeddingContext === 'fruit' ? 'tech' : 'fruit'), 1900);
});

$('#resetEmbedding').addEventListener('click', () => {
  stopContextPlayback();
  embeddingContext = 'fruit';
  embeddingPosition = 3;
  embeddingSelectedId = 'apple';
  $('#tokenPosition').value = '3';
  $('#tokenPositionValue').textContent = '位置 3';
  embeddingSpace.autoRotate = false;
  $('#toggleSpaceRotation').setAttribute('aria-pressed', 'false');
  $('#toggleSpaceRotation').innerHTML = '<span>◉</span>自动旋转';
  embeddingSpace.resetView();
  applyEmbeddingContext('fruit', { instant: true });
  applyEmbeddingMethod('onehot', { instant: true });
});

applyEmbeddingContext('fruit', { instant: true });
applyEmbeddingMethod('onehot', { instant: true });
