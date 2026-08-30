# Tokenizer 加工厂

一个面向大模型初学者的暗黑机械加工厂风格互动教学网站。自然语言会沿动态传送带依次经历规则识别、Token 切分、词表 ID 映射与 Embedding 向量化，让抽象的 Tokenizer 流程变得可观察、可暂停、可交互。

## 在线体验

**[https://tokenizer-factory.pages.dev/](https://tokenizer-factory.pages.dev/)**

## 网站效果

![Tokenizer 加工厂五工位动态流水线](assets/readme-factory-preview.png)

从首页继续向下滚动，即可进入可训练的 Subword 实验机：

![Subword 可训练小型实验机](assets/readme-training-lab.png)

## 当前教学内容

### Tokenizer 五道加工工序

1. **输入文本**：自然语言作为完整原料进入生产线。
2. **规则识别**：扫描中文、英文、数字、空格与标点，只标记候选边界，不提前切开。
3. **切分 Token**：在激光切分工位生成独立 Token 块。
4. **映射 ID**：通过模型词表把 Token 映射成离散整数。
5. **Embedding**：用 Token ID 查询嵌入矩阵，得到连续向量。

### 三类 Tokenizer 粒度

- **Word-based**：以词为基本单元，序列较短，但词表容易膨胀，并存在未登录词问题。
- **Character-based**：以字符为基本单元，开放词表能力强，但序列通常更长。
- **Subword-based**：在词与字符之间寻找平衡，是现代大语言模型常见选择。

### 四种子词方案

- **BPE**：真实统计迷你语料中的相邻 Pair 频次，每轮合并当前最高频 Pair。
- **Byte-level BPE**：先把语料变成 UTF-8 字节符号，再运行同一套逐轮 Pair 合并实验。
- **WordPiece**：用 `pair_freq / (left_freq × right_freq)` 的课堂可观察评分近似训练过程，逐轮选择更具组合价值的 Pair。
- **Unigram Language Model**：从较大的候选集合出发，比较移除候选前后的语料负对数似然，逐轮剪除 `ΔNLL` 最小的候选。

### 可训练小型实验机

用户可以直接修改多行迷你训练语料，并调节目标词表大小。实验机提供：

- 初始化、训练一轮、自动训练、暂停与逐轮回退。
- 当前语料切分状态和每个词的出现次数。
- BPE / Byte-level BPE 的高频 Pair 排行。
- WordPiece 的 Pair 训练得分排行。
- Unigram 的候选剪枝顺序与 `ΔNLL` 依据。
- 当前词表、每轮机械动作、训练日志和“用当前词表试切”结果。
- 基础符号数量超过用户目标时自动保护字符兜底，避免产生无法编码的词表。
- 教学大屏版界面：核心正文、Token、排行榜和对照表均使用更易读的大字号。
- 点击任意 Pair 或剪枝候选，可以在不执行训练的情况下检查其频次、得分或 `ΔNLL`。
- 训练执行时提供反应堆闪光、进度束扫过和完成状态反馈。

> **教学说明：** 页面中的 Token、ID 与向量用于解释原理，不代表某个线上模型的真实词表结果。真实切分会随模型、训练语料、词表大小、预处理规则和特殊 Token 配置而变化。

> **概念辨析：** SentencePiece 是可直接从原始句子训练的语言无关 tokenizer 工具框架，支持 BPE 与 Unigram 等模型；它不等同于一个独立于 BPE/Unigram 的单一切分算法。

## 交互特点

- 自定义输入中英文、数字与标点。
- 最多展示 12 个 Token，兼顾课堂可读性和流水线空间。
- 规则识别阶段只上色，不提前拆块。
- Token 块沿同一条动态传送带逐站加工。
- 一对一激光切分与多色 Token 封装。
- Token → ID 编码动画。
- ID → Embedding 向量化动画。
- 分步预览、自动演示和重置。
- Word / Character / Subword 三种粒度对比。
- BPE、Byte-level BPE、WordPiece、Unigram 可训练微型实验。
- 词表大小可调、单步训练、自动训练、暂停和回退。

## 项目结构

```text
tokenizer-factory/
├─ index.html
├─ cinematic-belt.css
├─ cinematic-belt.js
├─ README.md
└─ assets/
   ├─ tokenizer-factory-cinematic-v1.png
   ├─ readme-factory-preview.png
   └─ readme-training-lab.png
```

项目为纯静态 HTML、CSS 与 JavaScript，不依赖前端框架、数据库或构建工具。

## 本地运行

直接用浏览器打开 `index.html` 可以查看大部分内容。为避免浏览器对本地资源的限制，推荐在项目目录运行一个静态服务器：

```bash
python -m http.server 4174
```

然后访问：

```text
http://127.0.0.1:4174/
```

## 部署

当前线上版本部署在 Cloudflare Pages。由于项目没有构建步骤，可以直接上传包含 `index.html` 的完整目录：

```bash
npx wrangler pages deploy . --project-name tokenizer-factory
```

## 学术与技术参考

- Sennrich, Haddow & Birch, 2016：[*Neural Machine Translation of Rare Words with Subword Units*](https://aclanthology.org/P16-1162/)
- Schuster & Nakajima, 2012：[*Japanese and Korean Voice Search*](https://research.google/pubs/japanese-and-korean-voice-search/)
- Kudo, 2018：[*Subword Regularization: Improving Neural Network Translation Models with Multiple Subword Candidates*](https://aclanthology.org/P18-1007/)
- Kudo & Richardson, 2018：[*SentencePiece: A simple and language independent subword tokenizer and detokenizer for Neural Text Processing*](https://aclanthology.org/D18-2012/)
- OpenAI：[`tiktoken` educational BPE implementation](https://github.com/openai/tiktoken/blob/main/tiktoken/_educational.py)

## 路线图

- [x] Tokenizer 五工位动态流水线
- [x] Word / Character / Subword 粒度教学
- [x] 四种子词方案互动拆解
- [x] BPE 高频 Pair 逐轮合并训练机
- [x] Unigram 候选逐轮剪枝训练机
- [ ] 真实模型 tokenizer 对照实验
- [ ] Embedding 向量车间
- [ ] Position Encoding 装配站
- [ ] Self-Attention 调度中心
- [ ] Transformer Block 生产线
- [ ] RAG 知识仓库与 Agent 控制中心

## 版权说明

本仓库当前未附加开源许可证，默认保留相关权利。在线演示可用于学习和评估；复制、分发、改编或商业使用前，请先获得项目所有者许可。
