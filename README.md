# Tokenizer 加工厂

一个面向大模型初学者的暗黑机械加工厂风格互动教学网站。自然语言会沿动态传送带依次经历规则识别、Token 切分、词表 ID 映射与 Embedding 向量化，让抽象的 Tokenizer 流程变得可观察、可暂停、可交互。

## 在线体验

**[https://tokenizer-factory.pages.dev/](https://tokenizer-factory.pages.dev/)**

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

- **BPE**：从小单元出发，反复合并高频相邻对。
- **Byte-level BPE**：以 UTF-8 字节作为保底字母表，再执行 BPE 合并，可覆盖任意文本。
- **WordPiece**：通过词表与得分选择子词，编码时常用最长匹配，延续片段常写成 `##piece`。
- **Unigram Language Model**：先建立较大的候选词表，再依据概率逐步剪枝，并选择高概率切分路径。

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
- BPE、Byte-level BPE、WordPiece、Unigram 互动拆解。

## 项目结构

```text
tokenizer-factory/
├─ index.html
├─ cinematic-belt.css
├─ cinematic-belt.js
├─ README.md
└─ assets/
   └─ tokenizer-factory-cinematic-v1.png
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
- [ ] 真实模型 tokenizer 对照实验
- [ ] Embedding 向量车间
- [ ] Position Encoding 装配站
- [ ] Self-Attention 调度中心
- [ ] Transformer Block 生产线
- [ ] RAG 知识仓库与 Agent 控制中心

## 版权说明

本仓库当前未附加开源许可证，默认保留相关权利。在线演示可用于学习和评估；复制、分发、改编或商业使用前，请先获得项目所有者许可。

