
export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTI_CHOICE = 'MULTI_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE', 
  MATCHING = 'MATCHING',     
  ORDERING = 'ORDERING',     
  FILL_IN_BLANK = 'FILL_IN_BLANK',
  SHORT_ANSWER = 'SHORT_ANSWER',
  NOUN_EXPLANATION = 'NOUN_EXPLANATION', // New: 名词解释
  ANALYSIS = 'ANALYSIS',                 // New: 鉴析题
  FLASHCARD = 'FLASHCARD'
}

export type ExamMode = 'EXAM' | 'PRACTICE';

export type SearchEngine = 'google_native' | 'baidu_search1' | 'google_serper' | 'tavily';

export interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  options?: string[]; // For Single/Multi choice, or shuffled items for Ordering/Matching
  correctAnswer: string | string[]; // Adaptable based on type
  explanation?: string; // Explanation for the answer
}

export interface Material {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 encoded data
  size: number;
}

export interface ExamConfig {
  materialIds: string[];
  questionTypes: QuestionType[];
  questionCount: number;
  difficulty: '简单' | '中等' | '困难';
  timeLimit?: number; // In minutes, 0 or undefined means no limit
  shuffleQuestions?: boolean;
  mode: ExamMode; 
  answerSheetStyle?: 'GROUPED' | 'SEQUENTIAL'; // New field for answer sheet layout
}

export interface UserAnswer {
  questionId: string;
  answer: string | string[];
  isCorrect?: boolean; // For auto-graded questions
  score?: number; // 0-100 for short answers
  feedback?: string; // AI feedback for short answers
  isMarked?: boolean; // New field for flagging questions
}

export interface ExamSession {
  id: string;
  config: ExamConfig;
  questions: Question[];
  answers: Record<string, UserAnswer>; // Map questionId to answer
  status: 'IDLE' | 'GENERATING' | 'IN_PROGRESS' | 'GRADING' | 'COMPLETED';
  score: number;
  totalPossibleScore: number;
  startTime: number;
  endTime?: number;
  materialNames?: string[]; // Added field for history display
  generationTimeMs?: number; // 新增：记录生成试卷所花费的时间（毫秒）
}

export interface MistakeRecord {
  id: string; // Unique ID for the record
  question: Question;
  userWrongAnswer: string | string[];
  timestamp: number;
  reviewCount?: number; // Future feature: Spaced repetition
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface QASession {
  id: string;
  timestamp: number;
  lastUpdated: number;
  messages: ChatMessage[];
  materialNames: string[];
  preview: string; // First user query
}

export interface KeyConcept {
  term: string;
  definition: string;
}

// New Interface for Recursive Mind Map
export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
  summary?: string; // Optional detail for tooltip
}

export interface StudyGuide {
  markdownContent: string;
  mindMapTree: MindMapNode; // Changed from SVG string to Tree Object
  keyConcepts: KeyConcept[];
}