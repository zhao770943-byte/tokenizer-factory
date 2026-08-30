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
    family: 'static', badge: '子词静态编码', heading: 'FastText · 字符 n-gram 合成', title: '词向量由字符片段共同装配',
    summary: '单词被拆成多个字符 n-gram，再把片段向量与整词向量相加，因此低频词和未登录词也能得到表示。',
    memory: 'FastText 仍是静态词向量，但它利用词内部的字符结构缓解 OOV。', operation: 'word + n-grams', vector: '子词向量和', meaning: '形态语义'
  },
  glove: {
    family: 'static', badge: '全局共现', heading: 'GloVe · 全局统计向量', title: '多义词落在语义之间',
    summary: '全局共现让“苹果”同时受到水果和科技语料影响，因此固定坐标会落在两个簇之间。',
    memory: 'GloVe 看全局统计，但仍把多个词义压进同一个坐标。', operation: '共现矩阵', vector: '静态词向量', meaning: '全局语义'
  },
  position: {
    family: 'dynamic', badge: '顺序编码', heading: '位置编码 · 八位置向量轨迹', title: '位置改变，向量随之改变',
    summary: '拖动序列位置，目标 Token 会沿轨迹跨越不同象限；这表达先后顺序，不代表词义改变。',
    memory: '位置编码回答“它排在哪里”，不是“它是什么意思”。', operation: 'Token + Position', vector: '位置向量', meaning: '顺序坐标'
  },
  elmo: {
    family: 'dynamic', badge: '双向序列编码', heading: 'ELMo · 双向 LSTM 上下文表示', title: '前向与后向语境在目标词汇合',
    summary: '前向 LSTM 读取左侧上下文，后向 LSTM 读取右侧上下文，再加权融合多层隐藏状态。',
    memory: 'ELMo 让一个词拥有多个上下文表示，但依赖双向 LSTM 顺序计算。', operation: 'BiLSTM 多层融合', vector: '上下文状态', meaning: '双向词义'
  },
  gpt: {
    family: 'dynamic', badge: '因果上下文', heading: 'GPT · 单向 Transformer 表示', title: '当前位置只能读取左侧历史',
    summary: '因果掩码挡住未来 Token，每个位置只聚合自己和前文信息，适合逐 Token 生成。',
    memory: 'GPT 是单向上下文模型：预测下一个 Token 时不能偷看未来。', operation: 'Masked Self-Attention', vector: '因果隐藏状态', meaning: '左侧语境'
  },
  bert: {
    family: 'dynamic', badge: '双向上下文', heading: 'BERT · 双向 Transformer 表示', title: 'Token、Segment、Position 三路装配',
    summary: '输入表示由词、句段和位置向量相加，再通过双向自注意力同时利用左右文。',
    memory: 'BERT 编码时可以同时看左右两边；输入是三类 Embedding 的逐位置相加。', operation: '三路相加 + Encoder', vector: '双向隐藏状态', meaning: '双向语境'
  },
  contextual: {
    family: 'dynamic', badge: '上下文编码', heading: '上下文 Embedding · 当前语义向量', title: '整句话会移动同一个词',
    summary: '“吃苹果”把目标拉向水果簇；“苹果发布手机”则把它拉向科技簇。',
    memory: '现代 LLM 会根据当前句子，实时重算 Token 的语义坐标。', operation: 'Transformer', vector: '上下文向量', meaning: '当前词义'
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
let vectorPosition = 3;
let word2vecMode = 'skipgram';
let representationView = 'process';
let inputTokens = [];
let targetToken = '苹果';
let selectedPointId = 'target';

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

  if (method === 'position') {
    return points.map((point, index) => {
      const position = index === 0 ? vectorPosition : ((index + vectorPosition - 1) % 8) + 1;
      const angle = position * Math.PI / 4 + .18;
      return {
        ...point,
        label: index === 0 ? `${point.label}@${vectorPosition}` : point.label,
        coords: [Math.cos(angle) * .76, (position - 4.5) * .18, Math.sin(angle) * .76],
        position
      };
    });
  }

  if (['elmo', 'gpt', 'bert', 'contextual'].includes(method) && targetToken === '苹果') {
    const transform = {
      elmo: coords => [coords[0] * .90, coords[1] * .76 + .08, coords[2] * .94],
      gpt: coords => [coords[0] * .78 + .12, coords[1] * .84 - .08, coords[2] * .74 + .10],
      bert: coords => [coords[0] * 1.04 - .07, coords[1] * .90 + .12, coords[2] * 1.08],
      contextual: coords => [...coords]
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
    if (method === 'contextual' || method === 'elmo') {
      base.push({ id: 'alternate', label: vectorContext === 'fruit' ? '苹果 · 公司义' : '苹果 · 水果义', category: 'ghost', coords: alternate, ghost: true });
    }
    return base;
  }

  if (['word2vec', 'fasttext', 'glove', 'elmo', 'gpt', 'bert', 'contextual'].includes(method)) {
    return points.map((point, index) => {
      const targetLayouts = {
        word2vec: [-.58, .48, .43], glove: [.02, .40, .12], elmo: [-.50, .58, .31],
        gpt: [-.27, .66, -.20], bert: [-.67, .31, .57], contextual: [-.58, .48, .43]
      };
      const techLayouts = { elmo: [.56, .54, -.35], gpt: [.70, .26, -.52], bert: [.48, .64, -.58], contextual: [.62, .44, -.46] };
      if (index === 0) return { ...point, coords: techLayouts[method] && vectorContext === 'tech' ? techLayouts[method] : targetLayouts[method] };
      const sameInput = point.category === 'input';
      const phase = { word2vec: 0, glove: .55, elmo: .92, gpt: 1.34, bert: 1.78, contextual: 2.12 }[method] || 0;
      const angle = index * .83 + phase;
      const dynamicMethod = ['elmo', 'gpt', 'bert', 'contextual'].includes(method);
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
  const seed = hashValue(`${vectorMethod}:${point.label}:${vectorContext}:${point.position || vectorPosition}`);
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

function fastTextFragments() {
  const source = inputTokens.find(token => /^[A-Za-z]{3,}$/.test(token)) || (/^[A-Za-z]{3,}$/.test(targetToken) ? targetToken : 'apple');
  const marked = `<${source.toLowerCase()}>`;
  return {
    source,
    fragments: Array.from({ length: Math.max(1, marked.length - 2) }, (_, index) => marked.slice(index, index + 3)).slice(0, 7)
  };
}

function processFrame(kicker, title, body, controls = '') {
  return `<section class="process-frame" role="img" aria-label="${escapeHTML(title)}原理可视化">
    <header><div><span>${kicker}</span><b>${title}</b></div>${controls}</header>
    <div class="process-visual">${body}</div>
  </section>`;
}

function renderMethodVisualizer(method) {
  const tokens = visualTokens(5);
  const target = escapeHTML(targetToken);
  let content = '';

  if (method === 'word2vec') {
    const contexts = unique(tokens.filter(token => token !== targetToken).concat(['喜欢', '吃'])).filter(token => token !== targetToken).slice(0, 4);
    const windowTokens = unique(tokens.concat(contexts)).slice(0, 7);
    const inputWords = word2vecMode === 'skipgram' ? [targetToken] : contexts;
    const outputWords = word2vecMode === 'skipgram' ? contexts : [targetToken];
    const sampleText = word2vecMode === 'skipgram'
      ? contexts.map(word => `<span>(${escapeHTML(targetToken)} → ${escapeHTML(word)})</span>`).join('')
      : `<span>([${contexts.map(escapeHTML).join(', ')}] → ${target})</span>`;
    const controls = `<div class="micro-switch"><button data-w2v-mode="skipgram" aria-pressed="${word2vecMode === 'skipgram'}">Skip-gram</button><button data-w2v-mode="cbow" aria-pressed="${word2vecMode === 'cbow'}">CBOW</button></div>`;
    content = processFrame('WORD2VEC · LOCAL WINDOW OBJECTIVE', word2vecMode === 'skipgram' ? 'Skip-gram：一个中心词，分别预测每个上下文词' : 'CBOW：汇总多个上下文词，只预测一个中心词', `
      <div class="w2v-workbench ${word2vecMode}">
        <div class="w2v-window"><small>训练窗口 · CONTEXT WINDOW</small><div>${windowTokens.map(word => `<span class="${word === targetToken ? 'center' : 'context'}"><i>${word === targetToken ? 'TARGET' : 'CONTEXT'}</i>${escapeHTML(word)}</span>`).join('')}</div></div>
        <div class="w2v-network-detailed">
          <div class="w2v-column input"><small>${word2vecMode === 'skipgram' ? '一个输入 xᶜ' : '多个输入 xʲ'}</small>${inputWords.map(word => `<span><b>${escapeHTML(word)}</b><em>one-hot</em></span>`).join('')}</div>
          <i class="network-wire">→</i>
          <div class="weight-matrix"><small>输入矩阵</small><b>W</b><em>V × N</em><span>查表取向量</span></div>
          <i class="network-wire">→</i>
          <div class="hidden-state"><small>隐藏层</small><b>${word2vecMode === 'skipgram' ? 'vᶜ' : 'h̄'}</b><em>${word2vecMode === 'skipgram' ? 'Wᵀxᶜ' : '(1/C) Σ Wᵀxʲ'}</em></div>
          <i class="network-wire">→</i>
          <div class="weight-matrix output"><small>输出矩阵</small><b>W′</b><em>N × V</em><span>Softmax / Negative Sampling</span></div>
          <i class="network-wire">→</i>
          <div class="w2v-column output"><small>${word2vecMode === 'skipgram' ? '每个 context 都是目标' : '唯一中心词目标'}</small>${outputWords.map(word => `<span><b>${escapeHTML(word)}</b><em>target</em></span>`).join('')}</div>
        </div>
        <div class="w2v-samples"><b>${word2vecMode === 'skipgram' ? `${contexts.length} 个训练样本` : '1 个训练样本'}</b><div>${sampleText}</div><p>${word2vecMode === 'skipgram' ? '同一个中心词会拆成多对 (center, context)，分别优化输出概率。' : '多个 context 的词向量先求和或平均，再用一次 Softmax 预测 center。'}</p></div>
      </div>`, controls);
  } else if (method === 'fasttext') {
    const data = fastTextFragments();
    content = processFrame('CHARACTER SUBWORD ASSEMBLY', `${escapeHTML(data.source)} 的字符零件`, `
      <div class="word-capsule"><small>完整词</small><b>${escapeHTML(data.source)}</b></div><i class="signal-arrow">+</i>
      <div class="ngram-rack">${data.fragments.map((part, index) => `<span style="--i:${index}">${escapeHTML(part)}</span>`).join('')}</div>
      <i class="signal-arrow">→</i><div class="sum-reactor"><b>Σ</b><small>向量相加</small></div><i class="signal-arrow">→</i>
      <div class="fasttext-output"><div class="dense-vector-mini">${Array.from({ length: 8 }, (_, index) => `<i style="--h:${35 + (hashValue(data.source + index) % 55)}%"></i>`).join('')}</div><code>v(word) = v整词 + Σ v(n-gram)</code><small>低频词与 OOV 仍可由字符零件组装</small></div>`);
  } else if (method === 'glove') {
    const words = ['苹果', '水果', '手机', '公司'];
    const counts = [[18, 14, 2, 4], [14, 21, 1, 2], [2, 1, 17, 15], [4, 2, 15, 20]];
    const matrix = words.map((word, row) => `<div class="co-row"><b>${word}</b>${counts[row].map(value => `<span style="--heat:${value / 22}">${value}</span>`).join('')}</div>`).join('');
    content = processFrame('GLOBAL CO-OCCURRENCE', '共现次数压缩成全局词向量', `
      <div class="co-matrix"><div class="co-row heading"><b>Xᵢⱼ</b>${words.map(word => `<span>${word}</span>`).join('')}</div>${matrix}</div>
      <i class="signal-arrow">→</i><div class="glove-objective"><b>J = Σ f(Xᵢⱼ)(vᵢᵀvⱼ + bᵢ + bⱼ − log Xᵢⱼ)²</b><small>对全局共现矩阵做加权最小二乘拟合</small></div><i class="signal-arrow">→</i>
      <div class="semantic-split"><span>水果簇</span><b>${target}</b><span>科技簇</span></div>`);
  } else if (method === 'position') {
    content = processFrame('ORDER SIGNAL', `位置 ${vectorPosition} 的正弦 / 余弦编码`, `
      <div class="position-token"><b>${target}</b><small>POSITION ${String(vectorPosition).padStart(2, '0')}</small></div><i class="signal-arrow">+</i>
      <div class="wave-bank">${[0, 1, 2, 3].map(index => `<span style="--phase:${index * 18}px"><i></i><small>dim ${index * 2}/${index * 2 + 1}</small></span>`).join('')}</div><i class="signal-arrow">→</i>
      <div class="position-result"><b>顺序坐标</b><small>词义不变，位置改变</small></div>`);
  } else if (method === 'elmo') {
    const row = tokens.map(token => `<span class="${token === targetToken ? 'target' : ''}">${escapeHTML(token)}</span>`).join('<i>→</i>');
    const reverse = [...tokens].reverse().map(token => `<span class="${token === targetToken ? 'target' : ''}">${escapeHTML(token)}</span>`).join('<i>←</i>');
    content = processFrame('BIDIRECTIONAL LSTM', '左右语境双向汇流', `
      <div class="bilstm-lines"><div><small>前向 LSTM</small>${row}</div><div><small>后向 LSTM</small>${reverse}</div></div>
      <i class="signal-arrow">→</i><div class="layer-fusion"><b>γ Σ sₖhₖ</b><small>多层状态加权</small></div><i class="signal-arrow">→</i><div class="context-node"><b>${target}</b><small>当前语境向量</small></div>`);
  } else if (method === 'gpt') {
    const mask = tokens.map((_, row) => tokens.map((__, column) => `<i class="${column <= row ? 'open' : 'blocked'}"></i>`).join('')).join('');
    content = processFrame('CAUSAL TRANSFORMER', '当前位置只读取自己和左侧历史', `
      <div class="causal-sequence">${tokens.map((token, index) => `<span class="${token === targetToken ? 'target' : ''}"><small>t${index + 1}</small>${escapeHTML(token)}</span>`).join('<i>→</i>')}</div>
      <div class="causal-mask" style="--mask-size:${tokens.length}">${mask}</div><i class="signal-arrow">→</i><div class="next-token"><small>NEXT TOKEN</small><b>?</b></div>`);
  } else if (method === 'bert') {
    const bertTokens = ['[CLS]', ...tokens.slice(0, 3), '[SEP]'];
    const row = (kind, labels) => `<div><b>${kind}</b>${labels.map(label => `<span>${escapeHTML(label)}</span>`).join('')}</div>`;
    content = processFrame('BIDIRECTIONAL ENCODER INPUT', '三路 Embedding 逐位置相加', `
      <div class="bert-stack">${row('TOKEN', bertTokens)}<i>＋</i>${row('SEGMENT', bertTokens.map(() => 'Eₐ'))}<i>＋</i>${row('POSITION', bertTokens.map((_, index) => `E${index}`))}</div>
      <i class="signal-arrow">→</i><div class="encoder-reactor"><b>ENCODER</b><small>双向 Self-Attention</small></div>`);
  } else if (method === 'contextual') {
    content = processFrame('SAME WORD · DIFFERENT CONTEXT', '同一个词在两句话中移动到不同语义簇', `
      <div class="context-compare"><div><span>我喜欢吃 <b>苹果</b></span><i>→</i><em class="fruit-vector">水果语义向量</em></div><div><span><b>苹果</b> 发布了新手机</span><i>→</i><em class="tech-vector">公司语义向量</em></div></div>`);
  }

  $('#methodVisualizer').innerHTML = content;
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
  $('#positionSlider').hidden = method !== 'position';
  $('#contextPresets').hidden = !['elmo', 'gpt', 'bert', 'contextual'].includes(method);
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
  $('#spaceStatus').textContent = ['elmo', 'gpt', 'bert', 'contextual'].includes(method)
    ? '切换语境，观察同一目标向量在水果簇与科技簇之间移动。'
    : method === 'position'
      ? '拖动序列位置，目标向量会沿位置轨迹跨越不同象限。'
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
  inputTokens = tokenizeEmbeddingText(text);
  if (!inputTokens.length) inputTokens = ['苹果'];
  const teachingCandidate = inputTokens.includes('苹果')
    ? '苹果'
    : inputTokens.find(token => /^[A-Za-z]{3,}$/.test(token))
      || [...inputTokens].filter(token => /[\p{L}\p{N}]/u.test(token)).sort((left, right) => right.length - left.length)[0]
      || inputTokens[0];
  targetToken = inputTokens.includes(preferred) ? preferred : teachingCandidate;
  $('#embeddingTokens').innerHTML = inputTokens.map(token => `<button class="${token === targetToken ? 'active' : ''}" data-target-token="${escapeHTML(token)}">${escapeHTML(token)}</button>`).join('');
  $('#contextPresets').querySelector('[data-context="fruit"] b').textContent = targetToken === '苹果' ? '我喜欢吃苹果' : text;
  $('#contextPresets').querySelector('[data-context="tech"] b').textContent = targetToken === '苹果' ? '苹果发布了新手机' : `${targetToken} 出现在另一段语境中`;
  updateMethod(vectorMethod, true);
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

const vectorSpace = new OctantVectorSpace($('#vectorSpaceCanvas'));

const params = new URLSearchParams(location.search);
const syncedText = params.get('text') || localStorage.getItem('embeddingFactoryInput') || '我喜欢吃苹果';
$('#embeddingText').value = syncedText;

$('#loadEmbeddingInput').addEventListener('click', () => {
  localStorage.setItem('embeddingFactoryInput', $('#embeddingText').value.trim());
  renderTokenSelector(targetToken);
});

$('#embeddingText').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') $('#loadEmbeddingInput').click();
});

$('#embeddingTokens').addEventListener('click', event => {
  const button = event.target.closest('[data-target-token]');
  if (!button) return;
  targetToken = button.dataset.targetToken;
  selectedPointId = 'target';
  $$('#embeddingTokens button').forEach(item => item.classList.toggle('active', item === button));
  renderTokenSelector(targetToken);
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
  const button = event.target.closest('[data-w2v-mode]');
  if (!button) return;
  word2vecMode = button.dataset.w2vMode;
  renderMethodVisualizer('word2vec');
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

$('#vectorPosition').addEventListener('input', event => {
  vectorPosition = Number(event.target.value);
  $('#vectorPositionValue').textContent = String(vectorPosition);
  updateMethod('position');
});

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
