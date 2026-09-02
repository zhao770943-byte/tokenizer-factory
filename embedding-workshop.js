const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const VECTOR_METHODS = {
  onehot: {
    family: 'static', badge: '身份编码', heading: 'One-hot · 逐词稀疏向量', title: '每个词独占一个维度',
    summary: '它只说明 Token 是谁；不同词彼此正交，没有“苹果接近香蕉”的结构。',
    memory: 'One-hot 是身份牌，不是语义地图；词表有 V 个词，向量就有 V 维。', operation: '词表索引', vector: '[0, 0, 1, …]', meaning: '身份向量'
  },
  word2vec: {
    family: 'static', badge: '局部窗口预测', heading: 'Word2Vec · Skip-gram / CBOW 训练器', title: '两种任务的预测方向完全相反',
    summary: 'Skip-gram 用一个中心词分别预测多个上下文词；CBOW 先汇总多个上下文词，再预测唯一的中心词。',
    memory: '两者都学习 W 与 W′；训练结束后通常取 W（或相关组合）作为静态词向量。', operation: '中心词 ↔ 上下文', vector: 'W 中的词向量', meaning: '局部语义'
  },
  fasttext: {
    family: 'static', badge: '子词增强 CBOW', heading: 'FastText · CBOW + Hierarchical Softmax', title: '先组装子词，再进行多对一预测',
    summary: '每个上下文词先生成“整词 + n-gram”增强向量；多个增强向量进入投影层，最终预测一个 target。',
    memory: 'FastText 可搭配 CBOW 或 Skip-gram；这里演示 FastText-CBOW 与可选的分层 Softmax，而不是把整个词表一次性归一化。', operation: 'word + n-gram → HS', vector: '子词增强词向量', meaning: '形态语义'
  },
  glove: {
    family: 'static', badge: '全局共现回归', heading: 'GloVe · 加权最小二乘训练器', title: '把全局共现次数拟合成词向量',
    summary: '先统计整个语料的词—上下文共现矩阵，再只采样非零单元，用加权最小二乘逼近 log(Xᵢⱼ)。',
    memory: '训练结束后，同一个词的目标向量与上下文向量相加，得到最终静态表示。', operation: '全局矩阵 → 回归', vector: 'wᵢ + w̃ᵢ', meaning: '全局语义'
  },
  elmo: {
    family: 'dynamic', badge: '深层双向语言模型', heading: 'ELMo · 多层 BiLSTM 特征融合', title: '同一 Token 汇合左右语境与不同层特征',
    summary: '字符 CNN 先产生上下文无关表示，两层双向 LSTM 分别编码前后文，任务再学习各层混合权重。',
    memory: 'ELMo 通常把预训练 biLM 的多层状态作为特征加入下游模型，而不是只取最后一层。', operation: '字符 CNN → 2×BiLSTM', vector: 'γΣsⱼhₖⱼ', meaning: '双向词义'
  },
  gpt: {
    family: 'dynamic', badge: '生成式预训练', heading: 'GPT · 因果 Decoder 训练流水线', title: '用左侧历史预测下一个 Token',
    summary: 'Token 与位置向量进入多层 Transformer Decoder；因果遮罩让第 t 个位置只能读取 1…t。',
    memory: '先用无标注文本做语言模型预训练，再复用同一 Transformer 进行任务微调。', operation: '因果注意力 → LM Head', vector: '当前位置隐藏状态', meaning: '左侧语境'
  },
  bert: {
    family: 'dynamic', badge: '掩码双向预训练', heading: 'BERT · 双向 Encoder 训练流水线', title: '每个位置同时聚合左右文',
    summary: 'Token、Segment、Position 三路表示逐位置相加，再进入多层 Transformer Encoder。',
    memory: '原始 BERT 通过 MLM 预测被遮住的 Token，并用 NSP 学习句间关系。', operation: '全可见注意力 → MLM / NSP', vector: '双向隐藏状态', meaning: '双向语境'
  }
};

const POINT_COLORS = {
  target: '#f1ce77', fruit: '#70eea8', tech: '#bd7cff', input: '#68e5fb', system: '#67a9ff', ghost: '#a894d4'
};

const OCTANTS = [
  [.78, .70, .68], [-.76, .72, .66], [.74, -.68, .70], [-.78, -.66, .68],
  [.76, .68, -.70], [-.74, .70, -.68], [.78, -.69, -.67], [-.76, -.71, -.69]
];

let vectorFamily = 'static';
let vectorMethod = 'onehot';
let vectorContext = 'fruit';
let word2vecMode = 'skipgram';
let representationView = 'process';
let inputTokens = [];
let targetToken = '苹果';
let selectedPointId = 'target';
let positionMode = 'absolute';
let absolutePositionVariant = 'sinusoidal';
let positionIndex = 2;
let relativeQueryIndex = 2;
let ropeAngle = 30;
let vectorSpace = null;

function tokenizeEmbeddingText(text) {
  const raw = text.match(/[\u4e00-\u9fff]+|[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[^\s]/g) || [];
  const result = [];
  raw.forEach(part => {
    if (/^[\u4e00-\u9fff]+$/.test(part) && part.length > 1 && typeof Intl !== 'undefined' && Intl.Segmenter) {
      [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(part)].forEach(segment => result.push(segment.segment));
    } else result.push(part);
  });
  return result.slice(0, 10);
}

function unique(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function oneHotVocabulary() {
  return unique(inputTokens);
}

function hashValue(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function referencePoints() {
  if (targetToken === '苹果') {
    return [
      { id: 'target', label: '苹果', category: 'target' },
      { id: 'banana', label: '香蕉', category: 'fruit' },
      { id: 'orange', label: '橙子', category: 'fruit' },
      { id: 'grape', label: '葡萄', category: 'fruit' },
      { id: 'microsoft', label: '微软', category: 'tech' },
      { id: 'phone', label: '手机', category: 'tech' },
      { id: 'chip', label: '芯片', category: 'tech' },
      { id: 'sentence', label: vectorContext === 'fruit' ? '喜欢吃' : '发布', category: 'input' }
    ];
  }
  const companions = unique(inputTokens.filter(token => token !== targetToken).concat(['上下文', '模型', '向量', '注意力', '词表', '语义'])).slice(0, 7);
  return [{ id: 'target', label: targetToken, category: 'target' }].concat(companions.map((label, index) => ({
    id: `related-${index}`,
    label,
    category: inputTokens.includes(label) ? 'input' : 'system'
  })));
}

function methodLayout(method = vectorMethod) {
  if (method === 'onehot') {
    return oneHotVocabulary().map((label, index) => ({
      id: label === targetToken ? 'target' : `onehot-${index}`,
      label,
      category: label === targetToken ? 'target' : 'input',
      onehotIndex: index,
      coords: [0, 0, 0]
    }));
  }

  const points = referencePoints();

  if (method === 'fasttext') {
    return points.map((point, index) => {
      const seed = hashValue(`${point.label}:fasttext`);
      const angle = (seed % 628) / 100;
      const radius = index === 0 ? .58 : .30 + ((seed >> 4) % 48) / 100;
      return {
        ...point,
        coords: [
          Math.cos(angle) * radius,
          (((seed >> 9) % 150) / 100 - .75),
          Math.sin(angle) * radius
        ]
      };
    });
  }

  if (method === 'word2vec' && targetToken === '苹果') {
    const layout = {
      target: [-.62, .44, .46], banana: [-.78, .55, .33], orange: [-.55, .69, .27], grape: [-.80, .26, .62],
      microsoft: [.63, .53, -.42], phone: [.78, .22, -.55], chip: [.52, .70, -.65], sentence: [-.28, -.42, .35]
    };
    return points.map(point => ({ ...point, coords: layout[point.id] }));
  }

  if (method === 'glove' && targetToken === '苹果') {
    const layout = {
      target: [.06, .35, .14], banana: [-.68, .62, .38], orange: [-.48, .76, .21], grape: [-.73, .28, .56],
      microsoft: [.66, .55, -.34], phone: [.77, .12, -.49], chip: [.49, .72, -.58], sentence: [-.06, -.55, .62]
    };
    return points.map(point => ({ ...point, coords: layout[point.id] }));
  }

  if (['elmo', 'gpt', 'bert'].includes(method) && targetToken === '苹果') {
    const transform = {
      elmo: coords => [coords[0] * .90, coords[1] * .76 + .08, coords[2] * .94],
      gpt: coords => [coords[0] * .78 + .12, coords[1] * .84 - .08, coords[2] * .74 + .10],
      bert: coords => [coords[0] * 1.04 - .07, coords[1] * .90 + .12, coords[2] * 1.08]
    }[method];
    const rawActive = vectorContext === 'fruit' ? [-.70, .48, .43] : [.68, .43, -.43];
    const rawAlternate = vectorContext === 'fruit' ? [.68, .43, -.43] : [-.70, .48, .43];
    const active = transform(rawActive);
    const alternate = transform(rawAlternate);
    const base = methodLayout(vectorContext === 'fruit' ? 'word2vec' : 'glove').map(point => ({
      ...point,
      label: point.id === 'target' ? `${point.label} · ${vectorContext === 'fruit' ? '水果义' : '公司义'}` : point.label,
      coords: point.id === 'target' ? active : transform(point.coords)
    }));
    if (method === 'elmo') {
      base.push({ id: 'alternate', label: vectorContext === 'fruit' ? '苹果 · 公司义' : '苹果 · 水果义', category: 'ghost', coords: alternate, ghost: true });
    }
    return base;
  }

  if (['word2vec', 'fasttext', 'glove', 'elmo', 'gpt', 'bert'].includes(method)) {
    return points.map((point, index) => {
      const targetLayouts = {
        word2vec: [-.58, .48, .43], glove: [.02, .40, .12], elmo: [-.50, .58, .31],
        gpt: [-.27, .66, -.20], bert: [-.67, .31, .57]
      };
      const techLayouts = { elmo: [.56, .54, -.35], gpt: [.70, .26, -.52], bert: [.48, .64, -.58] };
      if (index === 0) return { ...point, coords: techLayouts[method] && vectorContext === 'tech' ? techLayouts[method] : targetLayouts[method] };
      const sameInput = point.category === 'input';
      const phase = { word2vec: 0, glove: .55, elmo: .92, gpt: 1.34, bert: 1.78 }[method] || 0;
      const angle = index * .83 + phase;
      const dynamicMethod = ['elmo', 'gpt', 'bert'].includes(method);
      const center = sameInput ? (dynamicMethod ? [-.34, .44, .22] : [-.48, .38, .32]) : (dynamicMethod ? [.40, -.24, -.42] : [.48, -.34, -.35]);
      return { ...point, coords: [center[0] + Math.cos(angle) * .20, center[1] + Math.sin(angle) * .22, center[2] + Math.cos(angle * 1.4) * .20] };
    });
  }

  return points.map((point, index) => ({ ...point, coords: [...OCTANTS[index % 8]] }));
}

function vectorComponents(point) {
  if (vectorMethod === 'onehot') {
    const vocabulary = oneHotVocabulary();
    const values = Array(Math.max(1, vocabulary.length)).fill(0);
    const index = Number.isInteger(point.onehotIndex) ? point.onehotIndex : vocabulary.indexOf(point.label);
    values[Math.max(0, index)] = 1;
    return values;
  }
  const seed = hashValue(`${vectorMethod}:${point.label}:${vectorContext}`);
  return Array.from({ length: 6 }, (_, index) => {
    const coordinate = point.coords[index % 3];
    return Math.max(-.99, Math.min(.99, coordinate * .72 + Math.sin(seed * .0001 + index * 1.37) * .24));
  });
}

function pointSimilarity(source, target) {
  if (vectorMethod === 'onehot') return 0;
  const distance = Math.hypot(
    source.coords[0] - target.coords[0],
    source.coords[1] - target.coords[1],
    source.coords[2] - target.coords[2]
  );
  return Math.max(0, 1 - distance / 2.25);
}

function selectedPoint(points) {
  return points.find(point => point.id === selectedPointId) || points.find(point => point.id === 'target') || points[0];
}

function renderOneHotMatrix(points) {
  const vocabulary = oneHotVocabulary();
  const size = Math.max(1, vocabulary.length);
  const columns = Array.from({ length: size }, (_, index) => `<span>d<sub>${index}</sub></span>`).join('');
  $('#oneHotIndex').style.setProperty('--vocab-size', size);
  $('#oneHotIndex').innerHTML = `<span>词 / 维度</span>${columns}`;
  $('#oneHotMatrix').innerHTML = points.map(point => {
    const values = vectorComponents(point);
    const cells = values.map((value, index) => `<span class="${value === 1 ? 'hot' : ''}" data-dimension="d${index}">${value}</span>`).join('');
    return `<button class="onehot-row${point.id === selectedPointId ? ' active' : ''}" style="--vocab-size:${size}" data-onehot-id="${point.id}" aria-label="${escapeHTML(point.label)} 的 One-hot 向量：${values.join(', ')}"><b><small>IDX ${String(point.onehotIndex).padStart(2, '0')}</small><strong>${escapeHTML(point.label)}</strong></b>${cells}</button>`;
  }).join('');
  $('#oneHotVocabSize').textContent = String(size);
  $('#oneHotDimension').textContent = `${size} 维`;
}

function visualTokens(limit = 6) {
  return (inputTokens.length ? inputTokens : ['我', '喜欢', '吃', '苹果']).slice(0, limit);
}

function fastTextFragments(sourceValue = '') {
  const source = sourceValue || inputTokens.find(token => /^[A-Za-z]{3,}$/.test(token)) || (/^[A-Za-z]{3,}$/.test(targetToken) ? targetToken : 'apple');
  const characters = ['<', ...String(source).toLowerCase(), '>'];
  const fragments = [];
  [3, 4, 5].forEach(size => {
    for (let index = 0; index <= characters.length - size; index += 1) {
      fragments.push(characters.slice(index, index + size).join(''));
    }
  });
  return {
    source,
    fragments: unique(fragments).slice(0, 4).length ? unique(fragments).slice(0, 4) : [`<${String(source).toLowerCase()}>`]
  };
}

function processFrame(kicker, title, body, controls = '') {
  return `<section class="process-frame" role="img" aria-label="${escapeHTML(title)}原理可视化">
    <header><div>${kicker ? `<span>${kicker}</span>` : ''}<b>${title}</b></div>${controls}</header>
    <div class="process-visual">${body}</div>
  </section>`;
}

function neuronLayer(label, count, activeIndices = [], tone = 'cyan', footer = '') {
  const active = new Set(activeIndices);
  const nodes = Array.from({ length: count }, (_, index) => `<i class="${active.has(index) ? 'active' : ''}" style="--node:${index}"><span>${active.has(index) ? '1' : index % 3 === 0 ? '0' : ''}</span></i>`).join('');
  return `<div class="neural-layer ${tone}"><small>${label}</small><div class="neuron-stack">${nodes}</div>${footer ? `<em>${footer}</em>` : ''}</div>`;
}

function neuralBridge(label, tone = 'cyan', from = 7, to = 6) {
  const lines = [];
  for (let source = 0; source < from; source += 1) {
    for (let target = 0; target < to; target += 1) {
      if ((source + target) % 2 === 0 || source === target) {
        const y1 = 8 + (source * 104 / Math.max(1, from - 1));
        const y2 = 8 + (target * 104 / Math.max(1, to - 1));
        lines.push(`<line x1="2" y1="${y1.toFixed(1)}" x2="98" y2="${y2.toFixed(1)}"></line>`);
      }
    }
  }
  return `<div class="neural-bridge ${tone}"><b>${label}</b><svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg><small>可训练权重</small></div>`;
}

function wordTopologyLines(inputCount, outputCount) {
  const distribute = count => count === 1
    ? [105]
    : Array.from({ length: count }, (_, index) => 30 + index * (150 / Math.max(1, count - 1)));
  const inputY = distribute(inputCount);
  const hiddenY = distribute(7);
  const outputY = distribute(outputCount);
  const forward = [];
  inputY.forEach(y1 => hiddenY.forEach(y2 => forward.push(`<line class="input-wire" x1="118" y1="${y1}" x2="488" y2="${y2}"></line>`)));
  hiddenY.forEach(y1 => outputY.forEach(y2 => forward.push(`<line class="output-wire" x1="512" y1="${y1}" x2="882" y2="${y2}"></line>`)));
  return `<svg class="word-network-wires" viewBox="0 0 1000 210" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="w2vInputWire" x1="0" x2="1"><stop stop-color="#67e8ff" stop-opacity=".18"></stop><stop offset="1" stop-color="#67e8ff" stop-opacity=".72"></stop></linearGradient><linearGradient id="w2vOutputWire" x1="0" x2="1"><stop stop-color="#b87aed" stop-opacity=".65"></stop><stop offset="1" stop-color="#b87aed" stop-opacity=".18"></stop></linearGradient></defs>
    ${forward.join('')}
  </svg>`;
}

function probabilityHead(words, activeWord) {
  return `<div class="probability-head">${words.map((word, index) => {
    const active = word === activeWord || (!activeWord && index === 0);
    return `<span class="${active ? 'active' : ''}" style="--prob-order:${index}"><b>${escapeHTML(word)}</b><i style="--prob:${active ? 82 : 18 + (index * 11) % 35}%"></i><em>${active ? '.82' : `.${18 + (index * 7) % 31}`}</em></span>`;
  }).join('')}</div>`;
}

function renderMethodVisualizer(method) {
  const tokens = visualTokens(5);
  const target = escapeHTML(targetToken);
  const trainControl = '<div class="micro-switch"><button class="train-pulse-button" data-train-pulse>播放一次训练</button></div>';
  let content = '';

  if (method === 'word2vec') {
    const contexts = unique(tokens.filter(token => token !== targetToken).concat(['喜欢', '吃'])).filter(token => token !== targetToken).slice(0, 4);
    const windowTokens = unique(tokens.concat(contexts)).slice(0, 7);
    const inputWords = word2vecMode === 'skipgram' ? [targetToken] : contexts;
    const outputWords = word2vecMode === 'skipgram' ? contexts : [targetToken];
    const controls = `<div class="micro-switch"><button data-w2v-mode="skipgram" aria-pressed="${word2vecMode === 'skipgram'}">Skip-gram</button><button data-w2v-mode="cbow" aria-pressed="${word2vecMode === 'cbow'}">CBOW</button><button class="train-pulse-button" data-train-pulse>播放一次训练</button></div>`;
    content = processFrame('WORD2VEC', word2vecMode === 'skipgram' ? 'Skip-gram · 1 → N' : 'CBOW · N → 1', `
      <div class="w2v-workbench ${word2vecMode}">
        <div class="w2v-window"><div>${windowTokens.map(word => `<button type="button" class="${word === targetToken ? 'center' : 'context'}" data-workbench-token="${escapeHTML(word)}" aria-pressed="${word === targetToken}" title="点击设为中心词">${escapeHTML(word)}</button>`).join('')}</div></div>
        <div class="w2v-connected-network ${word2vecMode}">
          ${wordTopologyLines(inputWords.length, outputWords.length)}
          <div class="topology-layer input ${inputWords.length === 1 ? 'singular' : 'plural'}"><b class="nn-layer-label">输入层</b><div>${inputWords.map((word, index) => `<span class="word-neuron" style="--node:${index}"><b>${escapeHTML(word)}</b></span>`).join('')}</div></div>
          <div class="topology-hidden standard-hidden-layer"><b class="hidden-title">隐藏层</b><div class="standard-hidden-column">${Array.from({ length: 7 }, (_, index) => `<i class="${index === 3 ? 'active' : ''}" style="--node:${index}"><span>h${index + 1}</span></i>`).join('')}</div><strong>${word2vecMode === 'skipgram' ? 'h = Wᵀx' : 'h = mean(Wᵀx)'}</strong></div>
          <div class="topology-layer output ${outputWords.length === 1 ? 'singular' : 'plural'}"><b class="nn-layer-label">输出层</b><div>${outputWords.map((word, index) => `<span class="word-neuron target" style="--node:${index}"><b>${escapeHTML(word)}</b></span>`).join('')}</div></div>
          <span class="matrix-label input-matrix"><b>W</b></span><span class="matrix-label output-matrix"><b>W′</b></span>
        </div>
        <div class="w2v-status-strip"><b>${word2vecMode === 'skipgram' ? '1 → N' : 'N → 1'}</b><span>${word2vecMode === 'skipgram' ? '中心词预测上下文' : '上下文预测中心词'}</span><em>点击上方 Token 切换中心词</em></div>
      </div>`, controls);
  } else if (method === 'fasttext') {
    const contexts = unique(tokens.filter(token => token !== targetToken).concat(['我', '喜欢', '学习'])).filter(token => token !== targetToken).slice(0, 3);
    const contextAssemblies = contexts.map((word, wordIndex) => {
      const fragments = fastTextFragments(word).fragments.slice(0, 2);
      return `<article class="fasttext-assembly-card" style="--context:${wordIndex}">
        <b>${escapeHTML(word)}</b><span class="word-vector-cell"><strong>v<sub>w</sub></strong></span><i>＋</i><div class="ngram-vector-cells">${fragments.map(fragment => `<span>${escapeHTML(fragment)}</span>`).join('')}</div><em>＝ u<sub>${wordIndex + 1}</sub></em>
      </article>`;
    }).join('');
    const enhancedInputs = contexts.map((word, wordIndex) => `<span class="fasttext-input-vector" style="--context:${wordIndex}"><b>u<sub>${wordIndex + 1}</sub></b><strong>${escapeHTML(word)}</strong><i>${Array.from({ length: 6 }, (_, bar) => `<em style="--h:${24 + ((wordIndex * 19 + bar * 13) % 62)}%"></em>`).join('')}</i></span>`).join('');
    const hiddenNodes = Array.from({ length: 15 }, (_, index) => `<i class="${index % 4 !== 3 ? 'active' : ''}" style="--node:${index}"><span>h${index + 1}</span></i>`).join('');
    const leafWords = unique([contexts[0] || '我', targetToken, contexts[1] || '模型', contexts[2] || '学习']).slice(0, 4);
    while (leafWords.length < 4) leafWords.push(`候选${leafWords.length + 1}`);
    content = processFrame('', '先装配字符片段，再用多个增强词向量预测一个目标词', `
      <div class="fasttext-rig fasttext-cbow-rig">
        <section class="fasttext-assembler"><header><b>词 + 字符片段</b></header><div>${contextAssemblies}</div></section>
        <div class="fasttext-flow-rail assembly-rail" aria-hidden="true"><i></i></div>
        <section class="fasttext-input-layer"><header><b>${contexts.length} 路增强词向量</b></header><div class="fasttext-input-vectors">${enhancedInputs}</div></section>
        <div class="fasttext-flow-rail input-rail" aria-hidden="true"><i></i></div>
        <section class="fasttext-hidden-layer"><b class="fasttext-layer-title">隐藏层</b><div class="fasttext-mean-reactor"><b>Σ / 平均</b><code>h = mean(u₁ … u<sub>${contexts.length}</sub>)</code></div><div class="fasttext-hidden-field"><div>${hiddenNodes}</div></div></section>
        <div class="fasttext-flow-rail output-rail" aria-hidden="true"><i></i><b>σ(h·q)</b></div>
        <section class="hs-output-layer"><header><b>分层 Softmax · 霍夫曼树</b></header><div class="hs-tree">
          <svg viewBox="0 0 330 194" preserveAspectRatio="none" aria-hidden="true">
            <line class="hs-edge active" style="--edge:0" x1="31" y1="97" x2="103" y2="55"></line><line class="hs-edge" x1="31" y1="97" x2="103" y2="143"></line>
            <line class="hs-edge" x1="103" y1="55" x2="177" y2="31"></line><line class="hs-edge active" style="--edge:1" x1="103" y1="55" x2="177" y2="76"></line><line class="hs-edge" x1="103" y1="143" x2="177" y2="121"></line><line class="hs-edge" x1="103" y1="143" x2="177" y2="166"></line>
            <line class="hs-edge" x1="177" y1="31" x2="280" y2="22"></line><line class="hs-edge active" style="--edge:2" x1="177" y1="76" x2="280" y2="67"></line><line class="hs-edge" x1="177" y1="121" x2="280" y2="116"></line><line class="hs-edge" x1="177" y1="166" x2="280" y2="166"></line>
          </svg>
          <span class="hs-node root active" style="--x:31;--y:97"><b>σ₀</b></span><span class="hs-node branch active" style="--x:103;--y:55"><b>σ₁</b></span><span class="hs-node branch" style="--x:103;--y:143"><b>σ</b></span><span class="hs-node branch" style="--x:177;--y:31"><b>σ</b></span><span class="hs-node branch active" style="--x:177;--y:76"><b>σ₂</b></span><span class="hs-node branch" style="--x:177;--y:121"><b>σ</b></span><span class="hs-node branch" style="--x:177;--y:166"><b>σ</b></span>
          ${leafWords.map((word, index) => `<span class="hs-leaf ${index === 1 ? 'target active' : ''}" style="--x:280;--y:${[22, 67, 116, 166][index]}"><b>${escapeHTML(word)}</b>${index === 1 ? '<em>目标</em>' : ''}</span>`).join('')}
          <div class="hs-path-code"><span>路径</span><b>0</b><i>→</i><b>1</b><i>→</i><b>0</b></div>
        </div></section>
        <div class="fasttext-gradient"><span>N → 1</span><b>输入：词向量 + n-gram</b><code>隐藏：mean(u₁ … u<sub>${contexts.length}</sub>)</code><em>输出：树路径 → ${target}</em></div>
      </div>`, trainControl);
  } else if (method === 'glove') {
    const words = ['苹果', '水果', '手机', '公司'];
    const counts = [[18, 14, 2, 4], [14, 21, 1, 2], [2, 1, 17, 15], [4, 2, 15, 20]];
    const matrix = words.map((word, row) => `<div class="glove-matrix-row"><b>${word}</b>${counts[row].map((value, column) => `<span class="${row === 0 && column === 1 ? 'selected' : ''}" style="--heat:${value / 22}">${value}</span>`).join('')}</div>`).join('');
    content = processFrame('GLOVE · 全局共现回归', '统计整个语料，再让向量内积逼近 log(Xᵢⱼ)', `
      <div class="glove-factory">
        <section class="glove-global-stage">
          <header><span>①</span><b>构建全局共现矩阵</b><em>窗口 ±2</em></header>
          <div class="glove-corpus-window"><i>我</i><i>喜欢</i><i class="context">吃</i><i class="focus">苹果</i><i class="context">和</i><i>香蕉</i><span></span></div>
          <div class="glove-matrix"><div class="glove-matrix-row heading"><b>Xᵢⱼ</b>${words.map(word => `<span>${word}</span>`).join('')}</div>${matrix}</div>
          <div class="glove-sample-pick"><span>非零样本</span><b>X<sub>苹果, 水果</sub> = 14</b><i>全局累计次数</i></div>
        </section>

        <section class="glove-regression-stage">
          <header><span>②</span><b>加权最小二乘拟合</b><em>只训练 Xᵢⱼ &gt; 0</em></header>
          <div class="glove-vector-pair"><span><i>目标参数</i><b>wᵢ</b><em>苹果</em></span><strong>·</strong><span class="context"><i>上下文参数</i><b>w̃ⱼ</b><em>水果</em></span><strong>＋</strong><span class="glove-bias"><b>bᵢ + b̃ⱼ</b></span></div>
          <div class="glove-loss-core">
            <span>预测值</span><b>wᵢᵀw̃ⱼ + bᵢ + b̃ⱼ</b><i>逼近</i><strong>log Xᵢⱼ</strong>
            <div class="glove-error-beam"><em></em><small>平方误差</small></div>
          </div>
          <div class="glove-equations">
            <b>J = Σ f(Xᵢⱼ) (wᵢᵀw̃ⱼ + bᵢ + b̃ⱼ − log Xᵢⱼ)²</b>
            <span><i>f(x) = (x / x<sub>max</sub>)<sup>α</sup></i><em>x &lt; x<sub>max</sub></em><i>f(x) = 1</i><em>否则</em></span>
            <small>x<sub>max</sub> = 100　·　α = 0.75</small>
          </div>
        </section>

        <section class="glove-update-stage">
          <header><span>③</span><b>AdaGrad 更新参数</b><em>learning rate 0.05</em></header>
          <div class="glove-optimizer"><div class="optimizer-ring"><b>∇J</b><i></i><i></i><i></i></div><span>随机遍历非零矩阵单元</span><em>&lt; 300 维：50 轮　·　其余：100 轮</em></div>
          <div class="glove-final-vector"><span><b>w<sub>苹果</sub></b><i>目标向量</i></span><strong>＋</strong><span class="context"><b>w̃<sub>苹果</sub></b><i>上下文向量</i></span><strong>＝</strong><span class="result"><b>e<sub>苹果</sub></b><i>最终词向量</i></span></div>
          <div class="glove-convergence"><i style="--step:18%"></i><i style="--step:38%"></i><i style="--step:62%"></i><i style="--step:81%"></i><i style="--step:94%"></i><span>损失收敛</span></div>
        </section>

        <div class="glove-compare-deck">
          <b>GloVe 对比 Word2Vec</b>
          <span><i>训练信号</i><em>Word2Vec：局部窗口预测</em><strong>GloVe：全局共现计数</strong></span>
          <span><i>目标函数</i><em>负采样 / 分层 Softmax</em><strong>加权最小二乘</strong></span>
          <span><i>数据方式</i><em>可持续采样、支持在线更新</em><strong>先统计固定语料矩阵</strong></span>
          <span><i>最终表示</i><em>通常取输入词向量</em><strong>wᵢ + w̃ᵢ</strong></span>
        </div>
      </div>`, trainControl);
  } else if (method === 'elmo') {
    const elmoTokens = tokens.slice(0, 5);
    const lstmTrack = (layer, direction) => {
      const layerClass = layer.includes('1') ? 'layer-one' : 'layer-two';
      return `<div class="elmo-lstm-track ${direction} ${layerClass}"><b>${layer}</b><div>${elmoTokens.map((token, index) => `<span class="${token === targetToken ? 'target' : ''}" style="--node:${index};--reverse:${elmoTokens.length - 1 - index}"><i>c</i><em>h</em><small>${escapeHTML(token)}</small></span>`).join(direction === 'forward' ? '<strong>→</strong>' : '<strong>←</strong>')}</div><i class="lstm-packet"></i></div>`;
    };
    content = processFrame('ELMO · 深层双向语言模型', '每个词都汇合左文、右文与不同网络层', `
      <div class="elmo-blueprint">
        <section class="elmo-token-foundry">
          <header><span>①</span><b>字符 CNN 产生词表示</b></header>
          <div>${elmoTokens.map(token => `<article class="${token === targetToken ? 'target' : ''}"><b>${escapeHTML(token)}</b><span>${[...token].slice(0, 5).map(char => `<i>${escapeHTML(char)}</i>`).join('')}</span><em>卷积 + Max Pool</em></article>`).join('')}</div>
        </section>
        <section class="elmo-bilm-tower">
          <header><span>②</span><b>两层双向 LSTM</b><em>两个方向分别训练语言模型</em></header>
          ${lstmTrack('第 2 层', 'backward')}${lstmTrack('第 2 层', 'forward')}${lstmTrack('第 1 层', 'backward')}${lstmTrack('第 1 层', 'forward')}
          <div class="elmo-target-beam"><i></i><span>${target}</span></div>
        </section>
        <section class="elmo-mixer-console">
          <header><span>③</span><b>按任务融合各层</b></header>
          <div class="elmo-state-bank"><span><b>h⁰</b><i style="--weight:38%"></i><em>字符词层</em></span><span><b>h¹</b><i style="--weight:67%"></i><em>句法层</em></span><span><b>h²</b><i style="--weight:91%"></i><em>语义层</em></span></div>
          <div class="elmo-formula"><b>ELMo<sub>k</sub> = γ Σ sⱼ h<sub>k,j</sub></b><span>sⱼ 由下游任务学习</span></div>
          <div class="elmo-output-orb"><i></i><b>${target}</b><span>${vectorContext === 'fruit' ? '水果语境向量' : '科技语境向量'}</span></div>
        </section>
        <div class="model-principle-strip elmo-strip"><span><b>预训练</b>双向语言模型</span><span><b>迁移方式</b>提取多层特征</span><span><b>关键限制</b>LSTM 顺序计算</span></div>
      </div>`, trainControl);
  } else if (method === 'gpt') {
    const gptTokens = tokens.slice(0, 5);
    const mask = gptTokens.map((_, row) => gptTokens.map((__, column) => `<i class="${column <= row ? 'open' : 'blocked'}" style="--cell:${row + column}"></i>`).join('')).join('');
    const gptQueryIndex = Math.max(1, gptTokens.length - 2);
    const gptStep = 240 / Math.max(1, gptTokens.length - 1);
    const gptBeamLines = gptTokens.map((_, index) => index <= gptQueryIndex ? `<line style="--beam:${index}" x1="${30 + index * gptStep}" y1="34" x2="${30 + gptQueryIndex * gptStep}" y2="116"></line>` : '').join('');
    content = processFrame('GPT · 因果 Transformer Decoder', '当前位置只看左侧历史，逐步预测下一个 Token', `
      <div class="gpt-blueprint">
        <section class="gpt-sequence-stage">
          <header><span>①</span><b>右移一位构造监督信号</b></header>
          <div class="gpt-token-rail">${gptTokens.map((token, index) => `<span class="${token === targetToken ? 'target' : ''}"><i>t${index + 1}</i><b>${escapeHTML(token)}</b><em>E<sub>tok</sub> + E<sub>pos</sub></em></span>`).join('<strong>→</strong>')}</div>
          <div class="gpt-shift-row"><b>输入</b>${gptTokens.slice(0, -1).map(token => `<i>${escapeHTML(token)}</i>`).join('')}<span>预测下一词</span></div>
          <div class="gpt-shift-row target"><b>标签</b>${gptTokens.slice(1).map(token => `<i>${escapeHTML(token)}</i>`).join('')}<span>交叉熵</span></div>
        </section>
        <section class="gpt-attention-stage">
          <header><span>②</span><b>因果自注意力</b><em>未来位置被遮住</em></header>
          <div class="gpt-causal-web"><svg viewBox="0 0 300 145" preserveAspectRatio="none" aria-hidden="true">${gptBeamLines}</svg><div>${gptTokens.map((token, index) => `<span class="${index <= gptQueryIndex ? 'visible' : 'future'}" style="--x:${30 + index * gptStep};--beam:${index}"><b>${escapeHTML(token)}</b><i>${index <= gptQueryIndex ? `t${index + 1}` : '未来'}</i></span>`).join('')}</div><strong style="--x:${30 + gptQueryIndex * gptStep}"><b>Q<sub>t${gptQueryIndex + 1}</sub></b><i>只汇聚左侧</i></strong></div>
          <div class="gpt-mask-board"><div class="causal-mask" style="--mask-size:${gptTokens.length}">${mask}</div><span>可见</span><span>遮挡</span></div>
          <div class="gpt-head-bank"><i>Q</i><i>K</i><i>V</i><b>Multi-Head</b></div>
        </section>
        <section class="gpt-decoder-tower">
          <header><span>③</span><b>Decoder 堆叠</b><em>× N</em></header>
          <div class="decoder-layer-card"><span>Masked Multi-Head Attention</span><i>残差连接 + LayerNorm</i><span>Feed Forward Network</span><i>残差连接 + LayerNorm</i></div>
          <div class="decoder-depth"><i></i><i></i><i></i><b>N 层共享结构</b></div>
        </section>
        <section class="gpt-prediction-stage">
          <header><span>④</span><b>预测下一个 Token</b></header>
          <div class="gpt-hidden-orb"><i></i><b>h<sub>t</sub></b><span>当前位置隐藏状态</span></div>
          <div class="gpt-logits">${probabilityHead(['AI', '模型', '学习', '。'], '学习')}</div>
        </section>
        <div class="gpt-transfer-rail"><span><b>生成式预训练</b><em>海量无标注文本 · 左到右语言模型</em></span><i>→</i><strong>同一套 Transformer 参数</strong><i>→</i><span><b>任务微调</b><em>分类、相似度、问答等任务输入变换</em></span></div>
      </div>`, trainControl);
  } else if (method === 'bert') {
    const bertTokens = ['[CLS]', ...tokens.slice(0, 3), '[SEP]'];
    const maskedIndex = Math.min(2, bertTokens.length - 2);
    const visibleTokens = bertTokens.map((token, index) => index === maskedIndex ? '[MASK]' : token);
    const row = (kind, labels, tone) => `<div class="bert-embedding-row ${tone}"><b>${kind}</b>${labels.map((label, index) => `<span class="${index === maskedIndex ? 'focus' : ''}">${escapeHTML(label)}</span>`).join('')}</div>`;
    const bertStep = 240 / Math.max(1, bertTokens.length - 1);
    const bertBeamLines = bertTokens.map((_, index) => `<line style="--beam:${index}" x1="${30 + index * bertStep}" y1="34" x2="${30 + maskedIndex * bertStep}" y2="116"></line>`).join('');
    content = processFrame('BERT · 双向 Transformer Encoder', '遮住一个词，但 Encoder 仍可同时读取它左右两边', `
      <div class="bert-blueprint">
        <section class="bert-input-foundry">
          <header><span>①</span><b>三路输入逐位置相加</b></header>
          ${row('Token', visibleTokens, 'token')}${row('Segment', bertTokens.map((_, index) => index < 3 ? 'Eₐ' : 'Eᵦ'), 'segment')}${row('Position', bertTokens.map((_, index) => `E${index}`), 'position')}
          <div class="bert-sum-beam"><i>＋</i><b>输入表示</b><span>E<sub>token</sub> + E<sub>segment</sub> + E<sub>position</sub></span></div>
        </section>
        <section class="bert-attention-stage">
          <header><span>②</span><b>双向自注意力</b><em>没有因果遮罩</em></header>
          <div class="bert-query-web"><svg viewBox="0 0 300 145" preserveAspectRatio="none" aria-hidden="true">${bertBeamLines}</svg><div>${bertTokens.map((token, index) => `<span class="${index === maskedIndex ? 'masked' : ''}" style="--x:${30 + index * bertStep};--beam:${index}"><b>${escapeHTML(token)}</b><i>${index < maskedIndex ? '左文' : index > maskedIndex ? '右文' : '目标'}</i></span>`).join('')}</div><strong style="--x:${30 + maskedIndex * bertStep}"><b>Q<sub>[MASK]</sub></b><i>同时汇聚左右</i></strong></div>
          <div class="bert-visibility"><i>左文</i><b>[MASK]</b><i>右文</i><span>全部可见</span></div>
        </section>
        <section class="bert-encoder-tower">
          <header><span>③</span><b>Encoder 堆叠</b><em>× N</em></header>
          <div class="encoder-layer-card"><span>Multi-Head Self-Attention</span><i>残差连接 + LayerNorm</i><span>Feed Forward Network</span><i>残差连接 + LayerNorm</i></div>
          <div class="encoder-output-rail">${bertTokens.map((token, index) => `<span class="${index === maskedIndex ? 'focus' : ''}" style="--encoder-node:${index}"><b>h${index}</b><i>${escapeHTML(token)}</i></span>`).join('')}</div>
        </section>
        <section class="bert-objective-stage">
          <header><span>④</span><b>原始预训练任务</b></header>
          <div class="bert-objective mlm"><span>MLM</span><b>[MASK] → ${target}</b><em>预测被遮住词</em></div>
          <div class="bert-objective nsp"><span>NSP</span><b>[CLS] → IsNext?</b><em>判断句子 B 是否接在 A 后</em></div>
          <div class="bert-loss-core"><b>L = L<sub>MLM</sub> + L<sub>NSP</sub></b><span>联合反向传播</span></div>
        </section>
        <div class="model-principle-strip bert-strip"><span><b>上下文方向</b>左文 + 右文</span><span><b>骨干网络</b>Transformer Encoder</span><span><b>迁移方式</b>整网微调 + 任务头</span></div>
      </div>`, trainControl);
  }

  $('#methodVisualizer').innerHTML = content;
}

function positionTokens() {
  const pageText = $('#embeddingText')?.value || new URLSearchParams(location.search).get('text') || localStorage.getItem('embeddingFactoryInput') || '我喜欢吃苹果';
  const tokens = inputTokens.length ? inputTokens : tokenizeEmbeddingText(pageText);
  return (tokens.length ? tokens : ['我', '喜欢', '吃', '苹果']).slice(0, 6);
}

function positionVector(position, dimension = 8) {
  return Array.from({ length: dimension }, (_, index) => {
    const frequency = Math.pow(10000, (2 * Math.floor(index / 2)) / dimension);
    return index % 2 === 0 ? Math.sin(position / frequency) : Math.cos(position / frequency);
  });
}

function toyEmbedding(token, dimension = 4) {
  return Array.from({ length: dimension }, (_, index) => ((hashValue(`token-vector-${token}-${index}`) % 160) - 80) / 100);
}

function formatVector(vector) {
  return `[${vector.map(value => value.toFixed(2)).join(', ')}]`;
}

function normalizedWeights(values) {
  const max = Math.max(...values);
  const exps = values.map(value => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map(value => value / sum);
}

function syncModuleLinks(text) {
  const safeText = (text || '我喜欢吃苹果').trim() || '我喜欢吃苹果';
  $$('[data-position-link]').forEach(link => { link.href = `position.html?text=${encodeURIComponent(safeText)}`; });
  $$('[data-embedding-link]').forEach(link => { link.href = `embedding.html?text=${encodeURIComponent(safeText)}`; });
}

function relativeBucket(distance) {
  return Math.max(-4, Math.min(4, distance));
}

function positionTokenRail(tokens, activeIndex) {
  return `<div class="position-token-rail">${tokens.map((token, index) => `<button type="button" class="${index === activeIndex ? 'active' : ''}" data-position-index="${index}"><i>${index}</i><b>${escapeHTML(token)}</b><small>p${index}</small></button>`).join('<span class="rail-arrow">→</span>')}</div>`;
}

function absolutePositionView(tokens) {
  const rows = tokens.map((token, tokenIndex) => {
    const vector = absolutePositionVariant === 'sinusoidal'
      ? positionVector(tokenIndex)
      : Array.from({ length: 8 }, (_, index) => ((hashValue(`learned-position-${tokenIndex}-${index}`) % 180) - 90) / 100);
    return `<div class="absolute-vector-row ${tokenIndex === positionIndex ? 'active' : ''}" style="--row:${tokenIndex}" data-position-index="${tokenIndex}"><b>p${tokenIndex}</b><span>${escapeHTML(token)}</span><div>${vector.map((value, index) => `<i style="--value:${value};--dim:${index}" title="维度 ${index + 1}: ${value.toFixed(2)}"><em></em></i>`).join('')}</div><code>[${vector.slice(0, 4).map(value => value.toFixed(2)).join(', ')}, …]</code></div>`;
  }).join('');
  const activeVector = absolutePositionVariant === 'sinusoidal' ? positionVector(positionIndex) : Array.from({ length: 8 }, (_, index) => ((hashValue(`learned-position-${positionIndex}-${index}`) % 180) - 90) / 100);
  const activeToken = tokens[positionIndex] || tokens[0];
  const tokenVector = toyEmbedding(activeToken);
  const positionSlice = activeVector.slice(0, 4);
  const injectedVector = tokenVector.map((value, index) => value + positionSlice[index]);
  return `<div class="absolute-lab-grid">
    <section class="position-machine absolute-machine">
      <header class="lab-section-head"><span>STATION A</span><b>位置向量注入器</b><em>Position → Embedding</em><div class="absolute-variant-tabs"><button class="${absolutePositionVariant === 'sinusoidal' ? 'active' : ''}" data-absolute-variant="sinusoidal">固定三角</button><button class="${absolutePositionVariant === 'learned' ? 'active' : ''}" data-absolute-variant="learned">可学习</button></div></header>
      <div class="embedding-add-stage"><div class="add-source"><span>Token Embedding</span><b>E<sub>tok</sub></b><i>语义</i></div><strong>＋</strong><div class="add-source position-source"><span>Position Embedding</span><b>E<sub>pos</sub></b><i>位置</i></div><strong>＝</strong><div class="add-result"><span>Transformer Input</span><b>E<sub>tok</sub> + E<sub>pos</sub></b><i>注入后表示</i></div></div>
      <div class="position-calculation-trace"><span>当前加工件 · p${positionIndex}「${escapeHTML(activeToken)}」</span><div><b>E<sub>tok</sub> ${formatVector(tokenVector)}</b><i>＋</i><b>E<sub>pos</sub> ${formatVector(positionSlice)}</b><i>＝</i><strong>X<sub>p${positionIndex}</sub> ${formatVector(injectedVector)}</strong></div></div>
      <div class="absolute-wave"><span class="wave-label">${absolutePositionVariant === 'sinusoidal' ? '固定三角位置编码 · sin / cos' : '可学习绝对位置编码 · Position Embedding'}</span><div class="wave-lines"><i></i><i></i><i></i><i></i></div><span class="wave-axis">position 0　　1　　2　　3　　4　　5</span></div>
    </section>
    <section class="position-machine absolute-table-machine">
      <header class="lab-section-head"><span>STATION B</span><b>序列位置扫描</b><em>点击任意位置查看向量</em></header>
      <div class="absolute-vector-table"><div class="absolute-table-head"><span>位置</span><span>Token</span><b>8 维位置向量的维度能量</b><code>向量片段</code></div>${rows}</div>
    </section>
    <section class="position-explain-card absolute-explain">
      <div class="formula-plaque"><span>位置 p 的固定编码</span><b>PE<sub>(p, 2i)</sub> = sin(p / 10000<sup>2i/d</sup>)</b><b>PE<sub>(p, 2i+1)</sub> = cos(p / 10000<sup>2i/d</sup>)</b></div>
      <div class="position-meter"><span>当前 p${positionIndex}</span><div>${activeVector.map((value, index) => `<i style="--value:${value};--dim:${index}"><em>${index % 2 ? 'cos' : 'sin'}</em></i>`).join('')}</div></div>
      <p>${absolutePositionVariant === 'sinusoidal' ? '固定三角编码不需要为每个位置另存参数；它可按公式计算任意位置，但“能计算”不等于模型一定能泛化到远超训练长度的序列。' : '可学习编码为每个位置分配一个可训练向量，表达能力强，但位置表通常设有最大长度，超出训练过的位置必须扩展或重新训练。'}</p>
      <div class="absolute-limit-grid"><span><b>关系可能被稀释</b><em>位置信号先混进输入向量；进入多层注意力后，关系并不是被显式保存的。</em></span><span><b>绝对坐标不等于关系</b><em>Token 在 p=8 不代表它与 p=7、p=2 的距离关系已被直接建模。</em></span><span><b>两类长度边界不同</b><em>可学习表有明确最大位置；三角编码可外推计算，但模型仍可能不擅长超长分布。</em></span></div>
    </section>
  </div>`;
}

function relativePositionView(tokens) {
  const matrix = tokens.map((_, row) => `<div class="relative-matrix-row">${tokens.map((__, column) => {
    const distance = column - row;
    const bucket = relativeBucket(distance);
    return `<button type="button" class="${row === relativeQueryIndex ? 'query-row' : ''} ${column === relativeQueryIndex ? 'query-column' : ''} ${row === relativeQueryIndex && column === relativeQueryIndex ? 'query-cell' : ''}" data-relative-query="${row}" style="--distance:${bucket};--cell:${row + column}" title="相对距离 ${distance}"><b>${distance > 0 ? '+' : ''}${distance}</b><small>${bucket < 0 ? '左' : bucket > 0 ? '右' : '同位'}</small></button>`;
  }).join('')}</div>`).join('');
  const biasBars = tokens.map((token, index) => {
    const distance = index - relativeQueryIndex;
    const penalty = Math.abs(distance) * 18;
    return `<span class="bias-bar ${index === relativeQueryIndex ? 'active' : ''}" style="--bar:${Math.max(18, 100 - penalty)}%;--bar-index:${index}"><b>${escapeHTML(token)}</b><i></i><em>${distance === 0 ? '0' : `−${Math.abs(distance)}m`}</em></span>`;
  }).join('');
  const attentionLogits = tokens.map((_, index) => -Math.abs(index - relativeQueryIndex) * .7);
  const attentionWeights = normalizedWeights(attentionLogits);
  const attentionTrace = tokens.map((token, index) => `<span class="${index === relativeQueryIndex ? 'active' : ''}" style="--attention:${Math.round(attentionWeights[index] * 100)}%"><b>${escapeHTML(token)}</b><i>${Math.round(attentionWeights[index] * 100)}%</i></span>`).join('');
  return `<div class="relative-lab-grid">
    <section class="position-machine relative-attention-machine">
      <header class="lab-section-head"><span>STATION A</span><b>相对距离矩阵</b><em>点击行选择 Query 位置</em></header>
      ${positionTokenRail(tokens, relativeQueryIndex)}
      <div class="relative-matrix-wrap"><div class="matrix-axis matrix-axis-top">Key →</div><div class="matrix-axis matrix-axis-left">Query ↓</div><div class="relative-matrix"><div class="relative-matrix-head">${tokens.map((token, index) => `<span>p${index}<b>${escapeHTML(token)}</b></span>`).join('')}</div>${matrix}</div></div>
      <div class="relative-query-readout"><b>Q · p${relativeQueryIndex}</b><span>当前关注：${escapeHTML(tokens[relativeQueryIndex])}</span><em>每个格子只记录 Key 与 Query 的相对距离</em></div>
    </section>
    <section class="position-machine alibi-machine">
      <header class="lab-section-head"><span>STATION B</span><b>ALiBi 注意力偏置</b><em>直接修正 Attention Score</em></header>
      <div class="attention-formula"><span>score<sub>ij</sub> = q<sub>i</sub>k<sub>j</sub><sup>T</sup> / √d</span><b>− m<sub>h</sub> · (i − j)</b><i>ALiBi 的因果注意力中 j ≤ i：越久远的历史，线性惩罚越大</i></div>
      <div class="bias-bars">${biasBars}</div>
      <div class="attention-trace"><span>示意：加入距离偏置后，Q<sub>p${relativeQueryIndex}</sub> 对各 Key 的 Softmax 权重</span><div>${attentionTrace}</div></div>
      <div class="length-chip"><b>长度外推</b><span>没有固定位置矩阵，序列变长也能继续计算</span></div>
    </section>
    <section class="relative-family-card">
      <header><span>相对位置家族</span><b>从“坐标”转向“关系”</b></header>
      <div class="relative-method-grid"><article class="selected"><b>ALiBi</b><span>线性距离偏置</span><em>在每个头的 Attention Logit 上减去距离惩罚；没有位置表，擅长长度外推。</em></article><article><b>XLNet</b><span>R<sub>i−j</sub> 相对向量</span><em>内容—内容、内容—位置等项共同计算；u、v 用来区分内容和位置贡献。</em></article><article><b>T5</b><span>相对位置桶</span><em>先把距离 b(i−j) 映射到桶，再给每个注意力头加入一个可学习标量偏置。</em></article><article><b>DeBERTa</b><span>解耦注意力</span><em>保留内容—内容、内容—位置、位置—内容三项；常以 √(3d) 缩放注意力。</em></article></div>
      <p>相对位置编码不先问“你在第几格”，而是直接把 i 与 j 的距离或相对向量交给 Attention。它更贴近语言中的邻接、依赖和顺序关系。</p>
    </section>
  </div>`;
}

function ropePositionView(tokens) {
  const activeToken = tokens[Math.min(positionIndex, tokens.length - 1)] || tokens[0];
  const angle = Number(ropeAngle);
  const radians = angle * Math.PI / 180;
  const x = Math.cos(radians) * 76;
  const y = Math.sin(radians) * 76;
  const keyAngle = angle + 28;
  const keyRadians = keyAngle * Math.PI / 180;
  const kx = Math.cos(keyRadians) * 76;
  const ky = Math.sin(keyRadians) * 76;
  return `<div class="rope-lab-grid">
    <section class="position-machine rope-rotor-machine">
      <header class="lab-section-head"><span>STATION A</span><b>二维旋转舱</b><em>选择位置，观察角度变化</em></header>
      ${positionTokenRail(tokens, positionIndex)}
      <div class="rope-rotor-stage"><div class="rope-plane"><span class="rope-axis-x">x₁</span><span class="rope-axis-y">x₂</span><i class="rope-orbit"></i><svg viewBox="0 0 220 220" aria-label="RoPE 二维向量旋转"><line class="rope-guide" x1="110" y1="110" x2="${110 + x}" y2="${110 - y}"></line><line class="rope-key-guide" x1="110" y1="110" x2="${110 + kx}" y2="${110 - ky}"></line><circle class="rope-origin" cx="110" cy="110" r="4"></circle><circle class="rope-tip" cx="${110 + x}" cy="${110 - y}" r="7"></circle><circle class="rope-key-tip" cx="${110 + kx}" cy="${110 - ky}" r="7"></circle><path class="rope-angle-arc" d="M 146 110 A 36 36 0 0 0 ${110 + Math.cos(radians) * 36} ${110 - Math.sin(radians) * 36}"></path></svg><b class="rope-q-label" style="--x:${x};--y:${y}">Q′ · p${positionIndex}</b><b class="rope-k-label" style="--x:${kx};--y:${ky}">K′ · p${Math.min(tokens.length - 1, positionIndex + 1)}</b><span class="rope-angle-label">θ = ${angle}°</span></div></div>
      <label class="rope-angle-control" for="ropeAngle"><span>旋转角 θ</span><input id="ropeAngle" type="range" min="0" max="180" value="${angle}" data-rope-angle><b>${angle}°</b></label>
    </section>
    <section class="position-machine rope-equation-machine">
      <header class="lab-section-head"><span>STATION B</span><b>Q / K 旋转编码器</b><em>V 不需要旋转</em></header>
      <div class="rope-flow"><div><span>原始 Query</span><b>q<sub>m</sub></b><i>语义方向</i></div><strong>R<sub>θ,m</sub></strong><div class="rotated"><span>旋转后 Query</span><b>q′<sub>m</sub></b><i>带绝对位置角度</i></div></div>
      <div class="rope-flow"><div><span>原始 Key</span><b>k<sub>n</sub></b><i>语义方向</i></div><strong>R<sub>θ,n</sub></strong><div class="rotated"><span>旋转后 Key</span><b>k′<sub>n</sub></b><i>带绝对位置角度</i></div></div>
      <div class="rope-dot-product"><span>q′<sub>m</sub><sup>T</sup> k′<sub>n</sub></span><b>≈</b><strong>相对距离 m − n</strong><i>位置信息进入内积，但不改动 V</i></div>
    </section>
    <section class="rope-explain-card">
      <header><span>ROTARY POSITION EMBEDDING</span><b>绝对形式，得到相对效果</b></header>
      <div class="rope-token-meaning"><b>${escapeHTML(activeToken)}</b><span>p${positionIndex}</span><i>→</i><strong>旋转 ${angle}°</strong><em>→</em><label>Q′ / K′</label></div>
      <div class="rope-principles"><span><b>① 两两分组</b>实际 d 维向量会拆成 d / 2 个二维平面；这里仅演示其中一个平面。</span><span><b>② 位置决定角度</b>每组角频率通常来自 θ<sub>i</sub> = base<sup>−2i/d</sup>，经典实现常取 base = 10000。</span><span><b>③ 内积显现距离</b>Q、K 分别按 m、n 旋转后，内积对 m − n 敏感；V 不旋转。</span></div>
      <p>RoPE 用绝对位置 m、n 的旋转来得到相对位移效果。经典 RoPE 的 base 通常是设定值；扩展方法会调整频率或缩放，xPOS 还为长距离引入尺度衰减。</p>
    </section>
  </div>`;
}

function positionKnowledgeDeck() {
  return `<section class="position-knowledge-deck" aria-label="位置编码方法总览">
    <header><span>POSITION METHOD MAP</span><b>同一条序列，三处不同的“位置注入点”</b><em>避免把所有位置编码都理解成“给词加一个编号”</em></header>
    <div class="position-knowledge-grid">
      <article class="knowledge-absolute"><span>绝对位置</span><b>输入端相加</b><code>X<sub>p</sub> = E<sub>token</sub> + E<sub>position</sub></code><p><strong>固定三角：</strong>无额外位置参数，可按公式计算任意 p。<br><strong>可学习表：</strong>每个 p 是训练参数，通常受最大长度约束。</p><i>代表：原始 Transformer、BERT、GPT-2</i></article>
      <article class="knowledge-relative"><span>相对位置</span><b>注意力分数修正</b><code>A<sub>ij</sub> = Q<sub>i</sub>K<sub>j</sub><sup>T</sup>/√d + bias(i−j)</code><p><strong>核心：</strong>直接建模 i 与 j 的距离或相对向量。<br><strong>分支：</strong>ALiBi 线性偏置、T5 距离分桶、XLNet / DeBERTa 解耦项。</p><i>优势：关系显式、常具更好的长度泛化</i></article>
      <article class="knowledge-rope"><span>旋转位置</span><b>Q / K 投影后旋转</b><code>q′<sub>m</sub> = R<sub>m</sub>q<sub>m</sub>， k′<sub>n</sub> = R<sub>n</sub>k<sub>n</sub></code><p><strong>核心：</strong>位置成为旋转角，Q′·K′ 对 m−n 敏感。<br><strong>边界：</strong>V 不旋转；长上下文通常还需频率或尺度扩展策略。</p><i>代表：LLaMA 等现代 Decoder 系列</i></article>
    </div>
  </section>`;
}

function updateModuleTransfer(tokens) {
  const compactTokens = tokens.slice(0, 5);
  const ids = compactTokens.map((token, index) => 100 + (hashValue(`token-id-${token}-${index}`) % 890));
  const labels = {
    absolute: ['E_position', '把位置向量与 E_token 相加'],
    relative: ['bias(i − j)', '把相对距离直接写进 Attention Score'],
    rope: ['R_m Q · R_n K', '只旋转 Q / K，让内积感知 m − n']
  }[positionMode];
  const tokenNode = $('#transferTokens');
  const idNode = $('#transferIds');
  const positionNode = $('#transferPositionSignal');
  const detailNode = $('#transferPositionDetail');
  if (tokenNode) tokenNode.textContent = compactTokens.join(' · ');
  if (idNode) idNode.textContent = `[ ${ids.join(', ')} ]`;
  if (positionNode) positionNode.innerHTML = labels[0];
  if (detailNode) detailNode.textContent = labels[1];
}

function renderPositionWorkbench() {
  if (!$('#positionLabBody')) return;
  const tokens = positionTokens();
  positionIndex = Math.min(positionIndex, tokens.length - 1);
  relativeQueryIndex = Math.min(relativeQueryIndex, tokens.length - 1);
  let body = '';
  if (positionMode === 'absolute') body = absolutePositionView(tokens);
  if (positionMode === 'relative') body = relativePositionView(tokens);
  if (positionMode === 'rope') body = ropePositionView(tokens);
  body += positionKnowledgeDeck();
  $('#positionLabBody').innerHTML = body;
  updateModuleTransfer(tokens);
  $$('.position-mode-tabs button').forEach(button => {
    const active = button.dataset.positionMode === positionMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const signals = {
    absolute: absolutePositionVariant === 'sinusoidal' ? ['固定三角位置向量', 'sin / cos · dmodel = 8'] : ['可学习绝对位置向量', 'trained table · dmodel = 8'],
    relative: ['相对距离注意力偏置', 'ALiBi · XLNet · T5 · DeBERTa'],
    rope: ['旋转位置编码', `Q / K rotation · θ = ${ropeAngle}°`]
  }[positionMode];
  $('#positionSignalName').innerHTML = signals[0];
  $('#positionSignalDetail').innerHTML = signals[1];
  const memories = {
    absolute: '绝对位置把位置向量直接加进输入表示；固定三角编码不增加训练参数，可学习编码则为每个位置训练一张向量表。',
    relative: '相对位置不急着给 Token 一个坐标，而是把两个 Token 的距离直接交给 Attention；ALiBi 用线性偏置鼓励关注近邻。',
    rope: 'RoPE 不旋转 V，只旋转 Q / K；绝对旋转角通过内积转化为 m − n 的相对位置信息。'
  };
  $('#positionMemory').textContent = memories[positionMode];
  $('#positionLabStatus').textContent = `${positionMode === 'absolute' ? '位置向量正在注入 Embedding' : positionMode === 'relative' ? '相对距离正在修正 Attention Score' : 'Q / K 正在进入旋转位置编码器'} · ${tokens.length} 个 Token 在线`;
}

function updateOutput(points) {
  const point = selectedPoint(points);
  if (!point) return;
  selectedPointId = point.id;
  const components = vectorComponents(point);
  $('#activeVectorToken').textContent = point.label;
  $('#vectorComponents').style.setProperty('--onehot-columns', Math.min(5, components.length));

  if (vectorMethod === 'onehot') {
    const completeVector = `[${components.join(', ')}]`;
    $('#activeVectorCoords').textContent = completeVector;
    $('#flowVector').textContent = completeVector;
    $('#vectorComponents').innerHTML = components.map((value, index) => `<b class="${value === 1 ? 'hot' : ''}" style="--i:${index}">${value}</b>`).join('');
    $('#vectorNeighbors').innerHTML = '';
    return;
  }

  const magnitude = Math.hypot(...(representationView === 'process' ? components : point.coords));
  const neighbors = points
    .filter(candidate => candidate.id !== point.id && !candidate.ghost)
    .map(candidate => ({ point: candidate, score: pointSimilarity(point, candidate) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  $('#activeVectorCoords').textContent = representationView === 'process'
    ? `[${components.map(value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`).join(', ')}]`
    : `(${point.coords.map(value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`).join(', ')})`;
  $('#vectorMagnitude').textContent = magnitude.toFixed(2);
  $('#vectorMagnitudeBar').style.width = `${Math.min(100, magnitude / (representationView === 'process' ? 2.2 : 1.35) * 100)}%`;
  $('#vectorComponents').innerHTML = components.map((value, index) => `<b style="--i:${index}">${value >= 0 ? '+' : ''}${value.toFixed(2)}</b>`).join('');
  $('#vectorNeighbors').innerHTML = neighbors.map((neighbor, index) => `<li style="--score:${Math.max(5, neighbor.score * 100).toFixed(0)}%"><b>0${index + 1}</b><span>${neighbor.point.label}</span><em>${neighbor.score.toFixed(2)}</em></li>`).join('');
}

function updateRepresentation(points, instant = false) {
  const oneHotMode = vectorMethod === 'onehot';
  document.body.dataset.representationView = oneHotMode ? 'onehot' : representationView;
  $('#representationSwitch').hidden = oneHotMode;
  $('#spaceToolbar').hidden = oneHotMode || representationView !== 'space';
  $('#methodStage').hidden = oneHotMode || representationView !== 'process';
  $('#octantStage').hidden = oneHotMode || representationView !== 'space';
  $$('#representationSwitch button').forEach(button => {
    const active = button.dataset.representationView === representationView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  if (oneHotMode || representationView === 'process') {
    vectorSpace.setPoints([], true);
  } else {
    vectorSpace.setPoints(points, instant);
    requestAnimationFrame(() => vectorSpace.resize());
  }
  $('#spaceFamilyLabel').textContent = oneHotMode
    ? '词表身份编码'
    : representationView === 'process'
      ? '算法训练机制'
      : `${vectorFamily === 'static' ? '静态词向量' : '动态表示'} · 三维降维投影`;
  $('#outputBayTitle').textContent = oneHotMode
    ? '逐词编码结果'
    : representationView === 'process'
      ? '训练后向量读数'
      : '坐标与近邻实时联动';
  $('#componentLabel').textContent = oneHotMode
    ? '完整 One-hot 向量'
    : representationView === 'process'
      ? '训练后高维向量片段'
      : '三维投影对应的向量片段';
}

function updateMethod(method, instant = false) {
  if (!VECTOR_METHODS[method]) return;
  vectorMethod = method;
  vectorFamily = VECTOR_METHODS[method].family;
  const info = VECTOR_METHODS[method];
  document.body.dataset.vectorFamily = vectorFamily;
  document.body.dataset.vectorMethod = method;
  $$('.family-switch button').forEach(button => {
    const active = button.dataset.vectorFamily === vectorFamily;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('[data-method-family]').forEach(bank => { bank.hidden = bank.dataset.methodFamily !== vectorFamily; });
  $$('.method-bank button').forEach(button => button.classList.toggle('active', button.dataset.vectorMethod === method));
  $('#dynamicControls').hidden = vectorFamily !== 'dynamic';
  $('#contextPresets').hidden = !['elmo', 'gpt', 'bert'].includes(method);
  $('#spaceHeading').textContent = info.heading;
  $('#methodBadge').textContent = info.badge;
  $('#methodTitle').textContent = info.title;
  $('#methodSummary').textContent = info.summary;
  $('#coreMemory').textContent = info.memory;
  $('#flowInput').textContent = targetToken;
  $('#flowOperation').textContent = info.operation;
  $('#flowVector').textContent = info.vector;
  $('#flowMeaning').textContent = info.meaning;
  const oneHotMode = method === 'onehot';
  $('#oneHotStage').hidden = !oneHotMode;
  $('#componentLabel').textContent = oneHotMode ? '完整 One-hot 向量' : '向量片段';
  $('#spaceStatus').textContent = ['elmo', 'gpt', 'bert'].includes(method)
    ? '切换语境，观察同一目标向量在水果簇与科技簇之间移动。'
    : '所有端点都由原点 O 发出，线段方向与长度共同构成向量。';
  const points = methodLayout(method);
  selectedPointId = 'target';
  if (oneHotMode) {
    renderOneHotMatrix(points);
  } else {
    representationView = 'process';
    renderMethodVisualizer(method);
  }
  updateRepresentation(points, instant);
  updateOutput(points);
  $('#vectorDeck').classList.remove('method-firing');
  requestAnimationFrame(() => $('#vectorDeck').classList.add('method-firing'));
  setTimeout(() => $('#vectorDeck').classList.remove('method-firing'), 700);
}

function renderTokenSelector(preferred = '') {
  const text = $('#embeddingText').value.trim() || '我喜欢吃苹果';
  syncModuleLinks(text);
  inputTokens = tokenizeEmbeddingText(text);
  if (!inputTokens.length) inputTokens = ['苹果'];
  const teachingCandidate = inputTokens.includes('苹果')
    ? '苹果'
    : inputTokens.find(token => /^[A-Za-z]{3,}$/.test(token))
      || [...inputTokens].filter(token => /[\p{L}\p{N}]/u.test(token)).sort((left, right) => right.length - left.length)[0]
      || inputTokens[0];
  targetToken = inputTokens.includes(preferred) ? preferred : teachingCandidate;
  $('#contextPresets').querySelector('[data-context="fruit"] b').textContent = targetToken === '苹果' ? '我喜欢吃苹果' : text;
  $('#contextPresets').querySelector('[data-context="tech"] b').textContent = targetToken === '苹果' ? '苹果发布了新手机' : `${targetToken} 出现在另一段语境中`;
  updateMethod(vectorMethod, true);
  if ($('#positionLabBody')) renderPositionWorkbench();
}

class OctantVectorSpace {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.points = [];
    this.projected = [];
    this.yaw = -.68;
    this.pitch = -.34;
    this.zoom = 1;
    this.dragging = false;
    this.autoRotate = false;
    this.lastPointer = { x: 0, y: 0 };
    this.lastTime = performance.now();
    this.phase = 0;
    this.stars = Array.from({ length: 86 }, (_, index) => ({
      x: ((hashValue(`star-x-${index}`) % 1000) / 1000),
      y: ((hashValue(`star-y-${index}`) % 1000) / 1000),
      radius: .35 + (hashValue(`star-r-${index}`) % 14) / 10,
      phase: (hashValue(`star-p-${index}`) % 628) / 100
    }));
    this.needsDraw = true;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bind();
    this.resize();
    this.loop();
  }

  bind() {
    this.canvas.addEventListener('pointerdown', event => {
      this.dragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
      $('#octantStage').classList.add('dragging');
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.dragging) return;
      this.yaw += (event.clientX - this.lastPointer.x) * .0065;
      this.pitch = Math.max(-1.08, Math.min(.85, this.pitch + (event.clientY - this.lastPointer.y) * .006));
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.needsDraw = true;
    });
    const release = event => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      $('#octantStage').classList.remove('dragging');
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.zoom = Math.max(.68, Math.min(1.7, this.zoom * (event.deltaY > 0 ? .92 : 1.08)));
      this.needsDraw = true;
    }, { passive: false });
    this.canvas.addEventListener('click', event => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = this.projected
        .map(projected => ({ projected, distance: Math.hypot(projected.x - x, projected.y - y) }))
        .filter(item => item.distance <= 26)
        .sort((a, b) => a.distance - b.distance)[0];
      if (!hit) return;
      selectedPointId = hit.projected.point.id;
      updateOutput(this.points.map(item => item.data));
      this.needsDraw = true;
    });
    new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.needsDraw = true;
  }

  setPoints(points, instant = false) {
    const previous = new Map(this.points.map(item => [item.data.id, item.current]));
    const fallback = previous.get('target') || [0, 0, 0];
    this.points = points.map(point => ({
      data: point,
      current: instant ? [...point.coords] : [...(previous.get(point.id) || fallback)],
      target: [...point.coords]
    }));
    this.needsDraw = true;
  }

  reset() {
    this.yaw = -.68;
    this.pitch = -.34;
    this.zoom = 1;
    this.needsDraw = true;
  }

  project(coords) {
    const [x, y, z] = coords;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const cx = Math.cos(this.pitch), sx = Math.sin(this.pitch);
    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    const perspective = 1 / (1.24 - z2 * .21);
    const scale = Math.min(this.width, this.height) * .40 * this.zoom;
    return { x: this.width * .5 + x1 * scale * perspective, y: this.height * .50 - y1 * scale * perspective, depth: z2, perspective };
  }

  line3D(start, end, color, width = 1, alpha = 1, dash = []) {
    const a = this.project(start), b = this.project(end), context = this.context;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.setLineDash(dash);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
    context.restore();
    return { a, b };
  }

  polygon3D(vertices, fill, stroke, alpha = 1) {
    const projected = vertices.map(vertex => this.project(vertex));
    const context = this.context;
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    context.lineWidth = .7;
    context.beginPath();
    projected.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }

  drawStarfield() {
    const context = this.context;
    context.save();
    this.stars.forEach(star => {
      const pulse = .28 + (Math.sin(this.phase * .75 + star.phase) + 1) * .22;
      context.globalAlpha = pulse;
      context.fillStyle = star.phase % 2 > 1 ? '#b980ff' : '#72e9ff';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = star.radius * 4;
      context.beginPath();
      context.arc(star.x * this.width, star.y * this.height, star.radius, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  }

  drawRing3D(plane, radius, color, rotation = 0) {
    const points = Array.from({ length: 65 }, (_, index) => {
      const angle = index / 64 * Math.PI * 2 + rotation;
      const a = Math.cos(angle) * radius, b = Math.sin(angle) * radius;
      if (plane === 'xy') return [a, b, 0];
      if (plane === 'xz') return [a, 0, b];
      return [0, a, b];
    }).map(point => this.project(point));
    const context = this.context;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = .75;
    context.globalAlpha = .22;
    context.setLineDash([5, 8]);
    context.lineDashOffset = -this.phase * 9;
    context.shadowColor = color;
    context.shadowBlur = 5;
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.stroke();
    context.restore();
  }

  drawHologramRings() {
    this.drawRing3D('xy', .42, '#64e8ff', this.phase * .05);
    this.drawRing3D('xz', .72, '#b878f0', -this.phase * .04);
    this.drawRing3D('yz', 1.04, '#6ceaa7', this.phase * .025);
  }

  drawGrid() {
    this.polygon3D([[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], '#3d7ca90c', '#4c71853d', 1);
    this.polygon3D([[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]], '#6e4da50a', '#6e5c9138', 1);
    this.polygon3D([[0, -1, -1], [0, 1, -1], [0, 1, 1], [0, -1, 1]], '#4cab7b08', '#4b806939', 1);
    for (let value = -1; value <= 1.001; value += .25) {
      this.line3D([value, -1, 0], [value, 1, 0], '#61bedf', .75, .24);
      this.line3D([-1, value, 0], [1, value, 0], '#61bedf', .75, .24);
      this.line3D([value, 0, -1], [value, 0, 1], '#a875d6', .75, .21);
      this.line3D([-1, 0, value], [1, 0, value], '#a875d6', .75, .21);
      this.line3D([0, value, -1], [0, value, 1], '#62bc8d', .75, .19);
      this.line3D([0, -1, value], [0, 1, value], '#62bc8d', .75, .19);
    }
    this.drawCube();
    this.drawAxis([-1.18, 0, 0], [1.18, 0, 0], '#ff7382', '−X', '+X');
    this.drawAxis([0, -1.18, 0], [0, 1.18, 0], '#6ceda6', '−Y', '+Y');
    this.drawAxis([0, 0, -1.18], [0, 0, 1.18], '#62e5ff', '−Z', '+Z');
    this.drawOctantLabels();
  }

  drawCube() {
    const corners = [];
    [-1, 1].forEach(x => [-1, 1].forEach(y => [-1, 1].forEach(z => corners.push([x, y, z]))));
    corners.forEach((a, index) => corners.slice(index + 1).forEach(b => {
      const differences = [0, 1, 2].filter(axis => a[axis] !== b[axis]).length;
      if (differences === 1) this.line3D(a, b, '#79bad6', 1, .30);
    }));
  }

  drawAxis(start, end, color, startLabel, endLabel) {
    const { a, b } = this.line3D(start, end, color, 2.2, 1);
    const context = this.context;
    context.save();
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 8;
    context.font = '700 12px ui-monospace, Consolas, monospace';
    context.fillText(startLabel, a.x + 4, a.y - 5);
    context.fillText(endLabel, b.x + 4, b.y - 5);
    context.restore();
  }

  drawOctantLabels() {
    const context = this.context;
    context.save();
    context.fillStyle = '#a9d9e8';
    context.globalAlpha = .58;
    context.font = '700 11px ui-monospace, Consolas, monospace';
    OCTANTS.forEach((coords, index) => {
      const point = this.project(coords.map(value => value * .72));
      const signs = coords.map(value => value > 0 ? '+' : '−').join('');
      context.fillText(`${index + 1} · ${signs}`, point.x, point.y);
    });
    context.restore();
  }

  drawOrigin() {
    const origin = this.project([0, 0, 0]), context = this.context;
    const glow = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, 25);
    glow.addColorStop(0, '#fff6ca');
    glow.addColorStop(.22, '#efc968b8');
    glow.addColorStop(1, '#efc96800');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(origin.x, origin.y, 25, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff8d5';
    context.beginPath();
    context.arc(origin.x, origin.y, 4.2, 0, Math.PI * 2);
    context.fill();
  }

  drawVector(item, projected) {
    const point = item.data;
    const selected = point.id === selectedPointId || (selectedPointId === 'target' && point.id === 'target');
    const color = POINT_COLORS[point.category] || POINT_COLORS.system;
    const origin = this.project([0, 0, 0]);
    const alpha = point.ghost ? .28 : selected ? 1 : .44;
    const width = selected ? 3 : point.ghost ? 1 : 1.2;
    const context = this.context;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.shadowColor = color;
    context.shadowBlur = selected ? 16 : 6;
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(projected.x, projected.y);
    context.stroke();
    if (selected) {
      context.globalAlpha = .34;
      context.lineWidth = 8;
      context.shadowBlur = 24;
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(projected.x, projected.y);
      context.stroke();
      context.globalAlpha = alpha;
      context.lineWidth = width;
    }
    const angle = Math.atan2(projected.y - origin.y, projected.x - origin.x);
    const arrow = selected ? 11 : 7;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(projected.x, projected.y);
    context.lineTo(projected.x - Math.cos(angle - .48) * arrow, projected.y - Math.sin(angle - .48) * arrow);
    context.lineTo(projected.x - Math.cos(angle + .48) * arrow, projected.y - Math.sin(angle + .48) * arrow);
    context.closePath();
    context.fill();
    const travel = (this.phase * .22 + (hashValue(point.id) % 100) / 100) % 1;
    const pulseX = origin.x + (projected.x - origin.x) * travel;
    const pulseY = origin.y + (projected.y - origin.y) * travel;
    context.fillStyle = '#ffffff';
    context.shadowColor = color;
    context.shadowBlur = selected ? 18 : 9;
    context.beginPath();
    context.arc(pulseX, pulseY, selected ? 3.1 : 1.8, 0, Math.PI * 2);
    context.fill();
    const radius = selected ? 8 : point.ghost ? 4 : 5.3;
    const glow = context.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius * 3.5);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(.22, color);
    glow.addColorStop(1, `${color}00`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(projected.x, projected.y, radius * 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f6ffff';
    context.beginPath();
    context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    context.fill();
    const label = point.label;
    context.font = selected ? '700 14px "Microsoft YaHei", sans-serif' : '600 11px "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    const labelWidth = context.measureText(label).width + 14;
    const labelY = projected.y - radius - 22;
    context.globalAlpha = point.ghost ? .32 : selected ? .92 : .58;
    context.fillStyle = '#020910';
    context.strokeStyle = color;
    context.lineWidth = .8;
    context.fillRect(projected.x - labelWidth / 2, labelY, labelWidth, 18);
    context.strokeRect(projected.x - labelWidth / 2, labelY, labelWidth, 18);
    context.globalAlpha = alpha;
    context.fillStyle = selected ? '#fff0bc' : '#d9f3f8';
    context.fillText(label, projected.x, labelY + 13);
    context.restore();
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    const ambient = context.createRadialGradient(this.width * .5, this.height * .5, 12, this.width * .5, this.height * .5, this.width * .56);
    ambient.addColorStop(0, vectorFamily === 'dynamic' ? '#572c8830' : '#174e7438');
    ambient.addColorStop(1, '#02050a00');
    context.fillStyle = ambient;
    context.fillRect(0, 0, this.width, this.height);
    this.drawStarfield();
    this.drawHologramRings();
    this.drawGrid();
    this.drawOrigin();
    const ordered = this.points.map(item => ({ item, ...this.project(item.current) })).sort((a, b) => a.depth - b.depth);
    ordered.forEach(projected => this.drawVector(projected.item, projected));
    this.projected = ordered.map(projected => ({ point: projected.item.data, x: projected.x, y: projected.y }));
  }

  loop(time = performance.now()) {
    const elapsed = Math.min(40, time - this.lastTime);
    this.lastTime = time;
    this.phase = time * .001;
    let moving = false;
    this.points.forEach(item => {
      item.current = item.current.map((value, index) => {
        const delta = item.target[index] - value;
        if (Math.abs(delta) > .001) moving = true;
        return value + delta * Math.min(.23, elapsed * .012);
      });
      item.data.coords = [...item.current];
    });
    if (this.autoRotate && !this.dragging && !this.reducedMotion) {
      this.yaw += elapsed * .00019;
      moving = true;
    }
    if (vectorMethod !== 'onehot' && !this.reducedMotion) moving = true;
    if (moving || this.needsDraw) {
      this.draw();
      this.needsDraw = false;
    }
    requestAnimationFrame(next => this.loop(next));
  }
}

const isEmbeddingWorkshop = Boolean($('#embeddingText'));
const isPositionWorkshop = Boolean($('#positionLabBody'));
const params = new URLSearchParams(location.search);
const syncedText = params.get('text') || localStorage.getItem('embeddingFactoryInput') || '我喜欢吃苹果';

if (isEmbeddingWorkshop) {
  vectorSpace = new OctantVectorSpace($('#vectorSpaceCanvas'));
  $('#embeddingText').value = syncedText;

  $('#loadEmbeddingInput').addEventListener('click', () => {
    localStorage.setItem('embeddingFactoryInput', $('#embeddingText').value.trim());
    renderTokenSelector(targetToken);
  });

  $('#embeddingText').addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') $('#loadEmbeddingInput').click();
  });

  $('#oneHotMatrix').addEventListener('click', event => {
    const row = event.target.closest('[data-onehot-id]');
    if (!row) return;
    selectedPointId = row.dataset.onehotId;
    const points = methodLayout('onehot');
    renderOneHotMatrix(points);
    updateOutput(points);
  });

  $('#methodVisualizer').addEventListener('click', event => {
    const tokenButton = event.target.closest('[data-workbench-token]');
    if (tokenButton) {
      targetToken = tokenButton.dataset.workbenchToken;
      selectedPointId = 'target';
      renderTokenSelector(targetToken);
      return;
    }
    const modeButton = event.target.closest('[data-w2v-mode]');
    if (modeButton) {
      word2vecMode = modeButton.dataset.w2vMode;
      renderMethodVisualizer('word2vec');
      return;
    }
    const pulseButton = event.target.closest('[data-train-pulse]');
    if (!pulseButton) return;
    const visualizer = $('#methodVisualizer');
    visualizer.classList.remove('training-pulse');
    requestAnimationFrame(() => visualizer.classList.add('training-pulse'));
    setTimeout(() => visualizer.classList.remove('training-pulse'), 5200);
  });

  $('#representationSwitch').addEventListener('click', event => {
    const button = event.target.closest('[data-representation-view]');
    if (!button || vectorMethod === 'onehot') return;
    representationView = button.dataset.representationView;
    const points = methodLayout(vectorMethod);
    updateRepresentation(points);
    updateOutput(points);
  });

  $$('.family-switch button').forEach(button => button.addEventListener('click', () => {
    const family = button.dataset.vectorFamily;
    updateMethod(family === 'static' ? 'onehot' : 'elmo');
  }));

  $$('.method-bank button').forEach(button => button.addEventListener('click', () => updateMethod(button.dataset.vectorMethod)));

  $$('.context-presets button').forEach(button => button.addEventListener('click', () => {
    vectorContext = button.dataset.context;
    $$('.context-presets button').forEach(item => item.classList.toggle('active', item === button));
    updateMethod(vectorMethod);
  }));

  $('#rotateVectorSpace').addEventListener('click', event => {
    vectorSpace.autoRotate = !vectorSpace.autoRotate;
    event.currentTarget.setAttribute('aria-pressed', String(vectorSpace.autoRotate));
    event.currentTarget.textContent = vectorSpace.autoRotate ? '停止旋转' : '自动旋转';
    vectorSpace.needsDraw = true;
  });

  $('#resetVectorView').addEventListener('click', () => vectorSpace.reset());

  $('.back-factory').addEventListener('click', event => {
    event.preventDefault();
    document.body.classList.add('page-shifting-left');
    setTimeout(() => { location.href = 'index.html'; }, 360);
  });

  renderTokenSelector();
  updateMethod('onehot', true);
}

if (isPositionWorkshop) {
  inputTokens = tokenizeEmbeddingText(syncedText);
  syncModuleLinks(syncedText);

  $$('.position-mode-tabs button').forEach(button => button.addEventListener('click', () => {
    positionMode = button.dataset.positionMode;
    renderPositionWorkbench();
  }));

  $('#positionLabBody').addEventListener('click', event => {
    const variantButton = event.target.closest('[data-absolute-variant]');
    if (variantButton) {
      absolutePositionVariant = variantButton.dataset.absoluteVariant;
      positionMode = 'absolute';
      renderPositionWorkbench();
      return;
    }
    const positionButton = event.target.closest('[data-position-index]');
    if (positionButton) {
      positionIndex = Number(positionButton.dataset.positionIndex);
      if (positionButton.closest('.relative-attention-machine')) relativeQueryIndex = positionIndex;
      renderPositionWorkbench();
      return;
    }
    const queryButton = event.target.closest('[data-relative-query]');
    if (queryButton) {
      relativeQueryIndex = Number(queryButton.dataset.relativeQuery);
      positionMode = 'relative';
      renderPositionWorkbench();
    }
  });

  $('#positionLabBody').addEventListener('input', event => {
    if (!event.target.matches('[data-rope-angle]')) return;
    ropeAngle = Number(event.target.value);
    renderPositionWorkbench();
  });

  renderPositionWorkbench();
}
