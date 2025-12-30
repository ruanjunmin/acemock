import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { Material, Question, QuestionType, UserAnswer, ChatMessage, StudyGuide, SearchEngine } from "../types";
import { searchBaidu, searchGoogleSerper, searchTavily, getActiveSearchEngine, getBatchSize, getRequestDelay, getShardingMode } from "./externalSearch";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper: Retry Logic ---
const callWithRetry = async <T>(
  fn: () => Promise<T>,
  actionName: string,
  retries: number = 3,
  delay: number = 2000,
  onLog?: (msg: string) => void
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) {
      console.error(`Failed ${actionName} after multiple attempts:`, error);
      throw error;
    }
    
    const attempt = 4 - retries;
    const msg = `API 请求失败 (${actionName})，正在进行第 ${attempt} 次重试...`;
    console.warn(msg, error);
    if (onLog) onLog(msg);

    await new Promise(resolve => setTimeout(resolve, delay));
    return callWithRetry(fn, actionName, retries - 1, delay * 1.5, onLog);
  }
};

// --- Helper: Fetch External Context ---
const fetchExternalContext = async (
    materials: Material[], 
    taskName: string, 
    allowedTypes: QuestionType[],
    log: (msg: string, prog: number) => void
): Promise<string> => {
    const activeEngine = getActiveSearchEngine();
    
    // Check if we have materials to analyze
    if (materials.length === 0) return "";

    const engineName = activeEngine === 'google_native' ? 'Google Native (AI Search)' : 
                       activeEngine === 'baidu_search1' ? '百度 (Search1)' : 
                       activeEngine === 'tavily' ? 'Tavily AI' : 'Google (Serper)';

    log(`[联网模式] 正在调用: ${engineName}`, 12);

    try {
        log("正在扫描文档以提取缺失知识点的检索关键词...", 15);
        const parts = materials.map(m => ({ inlineData: { mimeType: m.mimeType, data: m.data } }));
        
        // Map types to user-friendly labels for the prompt
        const typeMapping: Record<string, string> = {
            'SINGLE_CHOICE': '选择题',
            'MULTI_CHOICE': '选择题',
            'TRUE_FALSE': '判断题',
            'MATCHING': '连线题',
            'ORDERING': '排序题',
            'FILL_IN_BLANK': '填空题',
            'SHORT_ANSWER': '简答题/问答题',
            'NOUN_EXPLANATION': '名词解释/术语定义',
            'ANALYSIS': '鉴析题/案例分析/论述题',
            'FLASHCARD': '知识点卡片'
        };
        const allowedTypeLabels = allowedTypes.map(t => typeMapping[t] || t).join('、');

        // Step 1: Extract keywords for missing parts
        // UPDATED: Prompt includes filtering logic based on user's selected types.
        const keywordResp = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { 
                parts: [...parts, { text: `
                请快速扫描文档，判断是否存在题目缺少详细答案的情况（例如标注了“略”、“未提供”、“见教材”或只有名词没有解释）。
                
                *** 智能过滤规则 (重要) ***
                用户本次考试**仅选择**了以下题型：【${allowedTypeLabels}】。
                
                请执行以下判断逻辑：
                1. 识别文档中内容缺失（无答案/无解析）的部分。
                2. 判断该缺失部分对应的题型。
                3. 如果该内容的题型**不属于**用户选择的范围，请**直接忽略**，不要提取关键词。
                   (例如：文档中有一道“简答题”答案略，但用户只选了“选择题”，则必须忽略该简答题的缺失情况)。
                4. 仅当缺失内容属于用户**已选择**的题型时，提取核心术语用于搜索引擎检索以补全答案。

                返回格式：
                - 如果没有符合上述规则的缺失内容（即所需题型内容完整，或缺失内容属于未选题型），直接返回单词 "NONE"。
                - 否则，仅返回关键词，用空格分隔，不要包含任何解释性文字。
                ` }] 
            }
        });
        
        let keywords = keywordResp.text?.trim() || "";
        
        // Clean up common prefixes if the model ignores the "no explanation" rule
        keywords = keywords.replace(/^(关键词|Keywords)[:：]/i, '').trim();

        // Logic to detect if the response implies completeness or is invalid for search
        const isNone = keywords === 'NONE' || keywords === 'None' || keywords === 'none';
        const isChattyCompleteness = keywords.length > 40 && (keywords.includes("完整") || keywords.includes("提供") || keywords.includes("没有缺失") || keywords.includes("无需"));
        
        if (!keywords || isNone || isChattyCompleteness) {
            log("所需题型内容完整或无缺失，跳过联网检索步骤。", 20);
            return "";
        }

        log(`检索关键词(已过滤): 【${keywords}】`, 18);
        log(`正在发起 API 实时检索以补全缺失内容...`, 20);

        // Step 2: Perform Search
        let searchContext = "";
        
        if (activeEngine === 'google_native') {
             // Use Gemini's built-in Google Search tool
             const searchResp = await ai.models.generateContent({
                 model: "gemini-3-flash-preview",
                 contents: `请搜索以下关键词的详细定义和相关知识，用于补全考试题目的答案：${keywords}`,
                 config: {
                     tools: [{ googleSearch: {} }]
                 }
             });
             // Extract text from the response which contains grounded info
             searchContext = searchResp.text || "";
             
             // Also try to extract chunks if available (though .text usually has the synthesis)
             const chunks = searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks;
             if (chunks) {
                 searchContext += "\n[来源]: " + chunks.map((c: any) => c.web?.title).filter((t: any) => t).join(", ");
             }

        } else {
            // Use external APIs
            let results = [];
            if (activeEngine === 'baidu_search1') {
                results = await searchBaidu(keywords);
            } else if (activeEngine === 'tavily') {
                results = await searchTavily(keywords);
            } else {
                results = await searchGoogleSerper(keywords);
            }
            
            if (results.length > 0) {
                 searchContext = results.map((r, i) => `[参考源 ${i+1}] 标题: ${r.title}\n摘要内容: ${r.snippet}`).join('\n');
            }
        }

        if (searchContext) {
            log(`联网检索完成，已获取补全参考资料`, 25);
            return `
            \n--- 外部网络参考资料 (优先使用此资料补全“略”或“无答案”的题目) ---
            ${searchContext}
            \n--- 资料结束 ---\n
            `;
        }
    } catch (e) {
        console.error(e);
        log("联网搜索接口调用失败，自动切换为纯文档模式。", 25);
    }
    return "";
};

// Schema for generating questions
const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: [
              'SINGLE_CHOICE',
              'MULTI_CHOICE',
              'TRUE_FALSE',
              'MATCHING',
              'ORDERING',
              'FILL_IN_BLANK',
              'SHORT_ANSWER',
              'NOUN_EXPLANATION',
              'ANALYSIS',
              'FLASHCARD'
            ]
          },
          questionText: { 
              type: Type.STRING,
              description: "题目文本。如果是文档中已有的原题，必须原字不差地摘录。" 
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "单选/多选/排序/连线的原始或乱序选项列表。"
          },
          correctAnswer: {
             type: Type.STRING,
             description: "正确答案。如果是原文摘录，必须包含 Markdown 格式。"
          },
          explanation: { type: Type.STRING, description: "详细解析或来源说明。" }
        },
        required: ['type', 'questionText', 'correctAnswer', 'explanation']
      }
    }
  }
};

/**
 * 分片生成单个批次的题目
 */
const generateBatchQuestions = async (
    parts: any[],
    count: number,
    types: QuestionType[],
    difficulty: string,
    externalContext: string,
    batchIndex: number,
    totalBatches: number,
    onBatchLog?: (msg: string) => void
): Promise<Question[]> => {
    const typeString = types.join(', ');
    const prompt = `
    你是一位极其严谨的考试题目**提取与整理**专家。请根据附件文档内容处理 ${count} 道题目（这是总任务的第 ${batchIndex + 1}/${totalBatches} 个分片）。

    *** 核心指令：原文提取优先于生成 (最高优先级) ***
    1. **识别现有题库**：
       - 仔细扫描文档。如果文档本身就是一份试卷、复习资料或题库（例如包含“一、名词解释”、“二、简答题”、“三、鉴析题”等明确板块），你必须**严格优先提取**这些现有的题目。
       - **对于【鉴析题】、【名词解释】、【简答题】等各类题型：如果文档中只提供了 3 道该类型的题目，而用户要求生成 10 道，请只输出这 3 道原题。不要重复输出相同的题目来凑数。**
       - **严禁凑数**：绝对不要为了满足 ${count} 的数量要求而凭空编造题目，或者将不相关的文本强行伪装成该类型的题目。宁可返回少于请求数量的题目，也不要制造幻觉或重复。
    
    2. **纯教材处理**：
       - 仅当文档是纯文本教材（没有习题板块）时，你才被允许根据知识点“生成”新题目。

    3. **精准答案匹配**：
       - 重点：对于【鉴析题】、【简答题】、【名词解释】，如果文档中该题干下方出现了“【解题思路】”、“【解析】”、“【答案】”、“【参考答案】”或类似小标题，请务必原封不动地直接将该标题下的【所有详细内容】（包括分点1、2、3等）完整摘录到 'correctAnswer' 字段中。
       - 严禁忽略“解题思路”下方出现的内容。	 
    
    4. **缺失答案的联网补全逻辑**：
       - 若文档中出现了题干（如“简述...”、“名词解释...”），但其下方答案为“略”、“未提供”、“见教材”或直接空白，或者你无法在**紧邻的上下文**中找到明确答案：：
         a) 禁止脑补：不要去文档其他部分拼凑。
         b) 必须利用搜索方式搜索 [外部网络参考资料] 来生成标准答案。
         c) 标注规范：explanation 字段必须以“(材料中未提供答案，已由 AI 联网补全)”开头，明确告知用户此答案并非原文摘录。

    --- 字段规范 (必须严格遵守) ---
    - MULTI_CHOICE (多选): JSON 数组字符串，例如 '["选项A", "选项B"]'。
    - FILL_IN_BLANK (填空): 
        - questionText: 请务必在需要填空的位置使用 "______" (根据题目几个需要填空的位置就使用几个下划线，一一对应) 或 "( )" 作为占位符。不要把答案直接写在横线上。
        - correctAnswer: 必须是包含所有空缺处答案的 JSON 数组字符串，顺序对应。例如 '["答案1", "答案2"]'。如果只有一个空，也要封装成数组 '["答案1"]'。
    - TRUE_FALSE (判断): 字符串 "True" (正确) 或 "False" (错误)。
    - ORDERING (排序): 正确顺序的 JSON 数组字符串，例如 '["步骤1", "步骤2", "步骤3"]'。
    - MATCHING (连线): JSON 数组字符串，格式为 "左项目 :: 右项目"，例如 '["北京 :: 中国", "东京 :: 日本"]'。
    - NOUN_EXPLANATION / SHORT_ANSWER / ANALYSIS: **correctAnswer** 答案必须直接来源于原文，填入文档中的完整“解题思路”或“参考答案”内容，必须保留 Markdown 格式（如分点）。

    --- 参数配置 ---
    - 目标难度: ${difficulty}。
    - 允许题型: ${typeString}。
    - 语言: 简体中文。

    请严格按照 JSON Schema 格式输出，确保数据 100% 结构化。
    ${externalContext}
    `;

    const response = await callWithRetry<GenerateContentResponse>(
        () => ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...parts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: questionSchema,
                temperature: 0.1, // Lower temperature for stricter adherence
            }
        }),
        `生成第 ${batchIndex + 1} 组题目`,
        3,
        2000,
        onBatchLog
    );

    const text = response.text;
    if (!text) throw new Error(`Batch ${batchIndex + 1} returned no text`);

    const parsed = JSON.parse(text);
    return parsed.questions.map((q: any, index: number) => {
        let cleanAnswer = q.correctAnswer;
        try {
            // 解析复杂题型的 JSON 答案 (包括 FILL_IN_BLANK)
            if (['MULTI_CHOICE', 'ORDERING', 'MATCHING', 'FILL_IN_BLANK'].includes(q.type)) {
                if (typeof q.correctAnswer === 'string') {
                    if (q.correctAnswer.trim().startsWith('[') || q.correctAnswer.includes(',')) {
                        try {
                            cleanAnswer = JSON.parse(q.correctAnswer);
                        } catch {
                            // Fallback for comma separated strings if parse fails
                            cleanAnswer = q.correctAnswer.split(/[,，、]/).map((s: string) => s.trim());
                        }
                    } else {
                        // Single item, wrap in array if it's one of these types
                        cleanAnswer = [q.correctAnswer];
                    }
                }
            }
        } catch (e) { console.warn("Parse detail warning", e); }

        return {
            id: `q-${Date.now()}-${batchIndex}-${index}`,
            type: q.type as QuestionType,
            questionText: q.questionText,
            options: q.options || [],
            correctAnswer: cleanAnswer,
            explanation: q.explanation
        };
    });
};

/**
 * 智能清洗题目序号前缀
 * 移除: "1.", "1、", "(1)", "Q1:", "Question 1:", "题目:", "问题:" 等多种前缀
 */
const cleanQuestionPrefix = (text: string): string => {
    let cleaned = text.trim();
    
    // 移除 Q1, Question 1, 题目1, 问题1, Case 1, 案例1 等带数字的前缀
    // 支持中文顿号、点、冒号、短横线
    cleaned = cleaned.replace(/^(Q|Question|题目|问题|Case|案例|习题)\s*\d+[\s\.\:\：\-\u3001]*\s*/i, '');

    // 移除 1., 2、, (1), [1], 1), ① 等数字序号
    cleaned = cleaned.replace(/^[\(【\[]?\d+[\)\]】]?\s*[、\.\．\:\：\)\-\u3001]\s*/, '');
    cleaned = cleaned.replace(/^①\s*/, ''); // 特殊符号序号

    // 移除不带数字的 "题目：", "问题：" 前缀 (防止序号识别失败后的残留)
    cleaned = cleaned.replace(/^(题目|问题|Question)[:：]\s*/i, '');

    return cleaned.trim();
};

export const generateExamQuestions = async (
  materials: Material[],
  count: number,
  types: QuestionType[],
  difficulty: string,
  shuffle: boolean,
  onLog?: (message: string, progress: number) => void
): Promise<Question[]> => {
  
  const log = (msg: string, prog: number) => onLog && onLog(msg, prog);

  // 获取用户性能配置
  const userBatchSize = getBatchSize();
  const userRequestDelay = getRequestDelay();
  const shardingMode = getShardingMode();

  log("正在启动 AI 出题引擎...", 5);
  
  // 联网内容补全逻辑 (Updated: Always pass types to filter intelligently inside the scan)
  const externalContext = await fetchExternalContext(materials, "Exam", types, log);

  log(`正在执行“复印机式”文档分片解析...`, 30);

  const parts = materials.map(m => ({
    inlineData: { mimeType: m.mimeType, data: m.data }
  }));

  // --- 任务分片逻辑 (Sharding) ---
  const batchCounts: number[] = [];
  let remaining = count;
  while (remaining > 0) {
      const currentBatch = Math.min(remaining, userBatchSize);
      batchCounts.push(currentBatch);
      remaining -= currentBatch;
  }

  const modeLabel = shardingMode === 'SERIAL' ? '串行模式 (顺序等待)' : '并行模式 (交错启动)';
  log(`配置详情: 分片大小 ${userBatchSize}, 总片数 ${batchCounts.length}, 间隔 ${userRequestDelay}ms, 模式 ${modeLabel}`, 35);

  let currentProgress = 40;
  let questions: Question[] = [];

  try {
    if (shardingMode === 'SERIAL') {
        // --- 串行模式: 一个完成后再开始下一个，中间插入延迟 ---
        for (let i = 0; i < batchCounts.length; i++) {
            if (i > 0 && userRequestDelay > 0) {
                log(`串行间隔: 等待 ${userRequestDelay}ms...`, currentProgress);
                await new Promise(resolve => setTimeout(resolve, userRequestDelay));
            }

            log(`正在提取/生成分片 ${i + 1}/${batchCounts.length}...`, currentProgress);
            
            const batchQuestions = await generateBatchQuestions(
                parts, 
                batchCounts[i], 
                types, 
                difficulty, 
                externalContext, 
                i, 
                batchCounts.length,
                (msg) => log(msg, currentProgress)
            );

            questions.push(...batchQuestions);
            currentProgress = 40 + Math.round(((i + 1) / batchCounts.length) * 50);
            log(`已完成进度: ${questions.length} / ${count} 题`, currentProgress);
        }
    } else {
        // --- 并行模式 (带延迟启动): 错开时间启动所有请求，不等待前一个完成 ---
        log(`正在以 ${userRequestDelay}ms 间隔错开启动 ${batchCounts.length} 个请求...`, currentProgress);
        
        const batchPromises: Promise<Question[]>[] = [];
        
        for (let i = 0; i < batchCounts.length; i++) {
            if (i > 0 && userRequestDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, userRequestDelay));
            }
            
            log(`启动分片 ${i + 1}/${batchCounts.length}...`, currentProgress);
            const p = generateBatchQuestions(
                parts, 
                batchCounts[i], 
                types, 
                difficulty, 
                externalContext, 
                i, 
                batchCounts.length,
                (msg) => { if (i === 0) log(msg, currentProgress); }
            );
            batchPromises.push(p);
        }

        log(`所有分片已投递，正在等待 AI 响应汇总...`, 80);
        const results = await Promise.all(batchPromises);
        questions = results.flat();
        currentProgress = 90;
    }

    log("所有分片生成完毕，正在进行智能清洗与去重...", 95);

    // --- Deduplication & Cleaning Logic (Enhanced) ---
    const uniqueQuestions: Question[] = [];
    const acceptedFingerprints: string[] = [];

    // 使用三层去重策略：
    // 1. 精确匹配 (Exact Match)
    // 2. 包含关系 (Inclusion) - 针对 "简述X" 和 "请简述X"
    // 3. 前缀匹配 (Prefix) - 针对长题目末尾标点或细微差异
    
    for (const q of questions) {
        // 1. 深度清洗题目文本
        q.questionText = cleanQuestionPrefix(q.questionText);
        
        // 2. 生成指纹 (移除标点、空格、特殊符号，仅保留汉字和字母数字)
        const currentFingerprint = q.questionText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');

        // 3. 过滤无效空题
        if (currentFingerprint.length === 0) {
             continue; 
        }

        let isDuplicate = false;

        for (const existingFP of acceptedFingerprints) {
            // 策略 1：精确指纹匹配
            if (currentFingerprint === existingFP) {
                isDuplicate = true;
                break;
            }

            // 仅对有一定长度的题目启用模糊匹配，避免误杀短题目 (如 "名词解释")
            const MIN_LEN_FOR_FUZZY = 10; 

            if (currentFingerprint.length > MIN_LEN_FOR_FUZZY && existingFP.length > MIN_LEN_FOR_FUZZY) {
                 // 策略 2：包含关系检测
                 // 如果指纹存在包含关系 (例如 "什么是React" 被包含在 "请问什么是React")
                 if (currentFingerprint.includes(existingFP) || existingFP.includes(currentFingerprint)) {
                     isDuplicate = true;
                     break;
                 }

                 // 策略 3：前缀模糊匹配
                 // 如果前 15 个有效字符完全一致，视为重复 (忽略末尾差异)
                 const prefixLen = 15;
                 const p1 = currentFingerprint.substring(0, prefixLen);
                 const p2 = existingFP.substring(0, prefixLen);
                 if (p1 === p2) {
                     isDuplicate = true;
                     break;
                 }
            }
        }

        if (!isDuplicate) {
            uniqueQuestions.push(q);
            acceptedFingerprints.push(currentFingerprint);
        }
    }

    if (uniqueQuestions.length < questions.length) {
        log(`已智能过滤 ${questions.length - uniqueQuestions.length} 道重复题目 (保留 ${uniqueQuestions.length} 题)`, 98);
    }

    log("试卷生成成功！", 100);
    
    // Return unique questions.
    return shuffle ? uniqueQuestions.sort(() => Math.random() - 0.5) : uniqueQuestions;

  } catch (error) {
    throw error;
  }
};

/**
 * 智能判断题型逻辑
 */
export const recommendQuestionTypes = async (materials: Material[]): Promise<QuestionType[]> => {
    if (!materials || materials.length === 0) return [];
    
    const parts = materials.slice(0, 3).map(m => ({
        inlineData: { mimeType: m.mimeType, data: m.data.substring(0, 1048576) }
    }));

    const prompt = `
        分析附件文档，根据以下【三层判断策略】推荐最适合的考试题型：
        
        第一层：【原文精确匹配】(最高优先级)
        - 若文档中显式出现了“名词解释”、“术语定义”，必须勾选 NOUN_EXPLANATION。
        - 若显式出现“判断题”、“对错题”，必须勾选 TRUE_FALSE。
        - 若显式出现“填空题”，必须勾选 FILL_IN_BLANK。
        - 若显式出现“连线题”，必须勾选 MATCHING。
        - 若显式出现“排序题”，必须勾选 ORDERING。
        - 若显式出现“鉴析题”、“案例分析”，必须勾选 ANALYSIS。

        第二层：【近义词逻辑映射】
        - “简述题”、“简答题”、“问答题”、“描述题” -> 统一映射为 SHORT_ANSWER。
        - “论述题”、“分析题” -> 若偏向理论则映射为 SHORT_ANSWER，偏向实例则映射为 ANALYSIS。
        - “选择题” (带有 A/B/C/D 选项) -> SINGLE_CHOICE 或 MULTI_CHOICE。

        第三层：【AI 深度推理适配】
        - 若文档主要是零散的知识点、事实、日期 -> 建议单选 (SINGLE_CHOICE) 和填空 (FILL_IN_BLANK)。
        - 若文档包含大量复杂概念定义 -> 建议名词解释 (NOUN_EXPLANATION)。
        
        输出要求：
        - 请返回一个 JSON 数组，包含所有识别到的题型枚举值。
        - 示例: ["SHORT_ANSWER", "NOUN_EXPLANATION", "SINGLE_CHOICE"]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...parts, { text: prompt }] },
            config: { 
                responseMimeType: "application/json",
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const text = response.text || "[]";
        return JSON.parse(text) as QuestionType[];
    } catch (e) {
        console.error("Smart Analysis Error:", e);
        return [QuestionType.SINGLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.SHORT_ANSWER];
    }
};

const gradingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.INTEGER },
        feedback: { type: Type.STRING }
    }
}

export const gradeShortAnswer = async (
  question: string,
  correctAnswer: string,
  userAnswer: string
): Promise<{ score: number; feedback: string }> => {
  const model = "gemini-3-flash-preview";
  const prompt = `对比参考答案和学生回答，给出 0-100 评分和简短中文评语。\n问题: "${question}"\n参考答案: "${correctAnswer}"\n学生回答: "${userAnswer}"`;

  try {
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: gradingSchema }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { score: 0, feedback: "AI 评分失败。" };
  }
};

export const chatWithTutor = async (
  question: Question,
  history: ChatMessage[],
  userMessage: string,
  engine: SearchEngine = 'google_native'
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const historyText = history.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n');
  
  try {
    let externalContext = "";
    if (engine === 'baidu_search1') {
        const results = await searchBaidu(userMessage);
        if (results.length > 0) externalContext = `\n[Baidu Search]: ${results.map(r => r.snippet).join('\n')}`;
    } else if (engine === 'google_serper') {
        const results = await searchGoogleSerper(userMessage);
        if (results.length > 0) externalContext = `\n[Google Search]: ${results.map(r => r.snippet).join('\n')}`;
    } else if (engine === 'tavily') {
        const results = await searchTavily(userMessage);
        if (results.length > 0) externalContext = `\n[Tavily Search]: ${results.map(r => r.snippet).join('\n')}`;
    }

    const prompt = `你是一位耐心的 AI 助教。请根据以下上下文回答学生问题：\n题目: ${question.questionText}\n正确原文答案: ${JSON.stringify(question.correctAnswer)}\n${externalContext}\n对话历史:\n${historyText}\n学生: ${userMessage}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: engine === 'google_native' ? { tools: [{ googleSearch: {} }] } : undefined
    });
    
    let text = response.text || "";
    if (engine === 'google_native') {
        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (grounding && grounding.length > 0) {
            const sources = grounding.filter((c: any) => c.web?.uri).map((c: any, idx: number) => `[${idx+1}] ${c.web.title}: ${c.web.uri}`).slice(0, 3).join('\n');
            if (sources) text += `\n\n参考来源:\n${sources}`;
        }
    }
    return text;
  } catch (e) { return "网络请求失败。"; }
};

export const askDocument = async (
  materials: Material[],
  question: string,
  history: ChatMessage[]
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const parts = materials.map(m => ({ inlineData: { mimeType: m.mimeType, data: m.data } }));
  const prompt = `直接摘录文档原文回答问题，禁止总结。若文档中无答案，回复：‘根据参考材料，我无法找到相关答案。’\n问题: "${question}"`;

  try {
    const response = await ai.models.generateContent({ model, contents: { parts: [...parts, { text: prompt }] } });
    return response.text || "无法生成回答。";
  } catch (e) { return "出错了，请重试。"; }
};

export const askWeb = async (
  question: string,
  history: ChatMessage[],
  engine: SearchEngine = 'google_native'
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  try {
    let externalContext = "";
    if (engine === 'baidu_search1') {
         const results = await searchBaidu(question);
         externalContext = `根据搜索结果回答: ${results.map(r => r.snippet).join('\n')}`;
    } else if (engine === 'google_serper') {
        const results = await searchGoogleSerper(question);
        externalContext = `根据搜索结果回答: ${results.map(r => r.snippet).join('\n')}`;
    } else if (engine === 'tavily') {
        const results = await searchTavily(question);
        externalContext = `根据搜索结果回答: ${results.map(r => r.snippet).join('\n')}`;
    } 

    if (externalContext) {
        const response = await ai.models.generateContent({ model, contents: `${externalContext}\n问题: ${question}` });
        return response.text || "无法找到答案。";
    } else {
        // Fallback to native
        const response = await ai.models.generateContent({ model, contents: question, config: { tools: [{ googleSearch: {} }] } });
        return response.text || "无法找到答案。";
    }
  } catch (e) { return "搜索失败。"; }
};

export const askSmart = async (
  materials: Material[],
  question: string,
  history: ChatMessage[],
  engine: SearchEngine = 'google_native'
): Promise<string> => {
    const docAnswer = await askDocument(materials, question, history);
    if (docAnswer.includes("无法找到相关答案")) return await askWeb(question, history, engine);
    return docAnswer;
};

export const translateText = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Translate to Chinese: ${text}` });
        return response.text || "翻译失败";
    } catch (e) { return "翻译服务不可用"; }
}

const studyGuideResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        markdownContent: { type: Type.STRING },
        keyConcepts: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    term: { type: Type.STRING },
                    definition: { type: Type.STRING }
                },
                required: ["term", "definition"]
            }
        },
        mindMapTree: {
            type: Type.OBJECT,
            properties: {
                label: { type: Type.STRING },
                summary: { type: Type.STRING },
                children: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING },
                            summary: { type: Type.STRING },
                            children: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        label: { type: Type.STRING },
                                        summary: { type: Type.STRING },
                                        children: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    label: { type: Type.STRING },
                                                    summary: { type: Type.STRING },
                                                },
                                                required: ["label"]
                                            }
                                        }
                                    },
                                    required: ["label"]
                                }
                            }
                        },
                        required: ["label"]
                    }
                }
            },
            required: ["label", "children"]
        }
    },
    required: ["markdownContent", "keyConcepts", "mindMapTree"]
};

export const generateStudyGuide = async (materials: Material[]): Promise<StudyGuide> => {
  const model = "gemini-3-flash-preview";
  const parts = materials.map(m => ({ inlineData: { mimeType: m.mimeType, data: m.data } }));

  const prompt = `
  你需要基于提供的文档资料，生成一份高质量的学习指南。请严格按照以下要求生成内容：

  1. **Markdown 笔记 (markdownContent)**: 
     - 提取文档的核心知识点，整理成结构清晰的 Markdown 笔记。
     - 使用各级标题、列表、粗体等格式。
  
  2. **思维导图 (mindMapTree)**:
     - 必须生成一个 **3 到 4 层** 的树形结构。
     - 根节点 (Root) 是文档的主题。
     - 第一层子节点是主要章节或核心模块。
     - 第二层子节点是具体的知识点或概念。
     - 第三层子节点（叶子节点）是该知识点的关键属性、数值或简短描述。
     - **重要**：所有节点的 'label' 字段不能为空。'summary' 字段作为补充说明。

  3. **核心考点卡片 (keyConcepts)**:
     - 提取 **至少 18 个**（建议 20-30 个）核心术语、定义、公式或关键结论。
     - 这些卡片将用于制作抽认卡，供用户分组背诵。
     - 'term' 是卡片正面（标题），必须简洁有力，**不能为空**。
     - 'definition' 是卡片背面（内容），解释要详尽准确。

  请以 JSON 格式输出。
  `;

  try {
    const response = await callWithRetry<GenerateContentResponse>(
        () => ai.models.generateContent({
            model,
            contents: { parts: [...parts, { text: prompt }] },
            config: { 
                responseMimeType: "application/json",
                responseSchema: studyGuideResponseSchema,
                thinkingConfig: { thinkingBudget: 0 } // Explicitly disable thinking to avoid timeouts on large JSON
            }
        }),
        "生成学习指南",
        3, 
        2000
    );
    const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text || "{}") as StudyGuide;
  } catch (e) {
    console.error("Study Guide Generation Error", e);
    return { markdownContent: "# 生成失败\n请稍后重试。", mindMapTree: { label: "数据错误" }, keyConcepts: [] };
  }
};