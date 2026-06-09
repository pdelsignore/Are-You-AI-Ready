/* ═══════════════════════════════════════════════════════════════════
   AI READINESS ASSESSMENT — CONTENT DATA
   Loaded by ai-ready.html (same pattern as ai-readiness/diagnostic.html).

   • QUESTIONS / DOMAINS / DQ — assessment copy and scoring
   • DOMAIN_STRATEGY — result action steps (from strategy.md)
═══════════════════════════════════════════════════════════════════ */

const DOMAINS = [
  { id: 0, name: 'Functional Proficiency', emoji: '⚡', color: '#56E2E1',
    blurb: 'Using AI tools effectively in day-to-day work.' },
  { id: 1, name: 'Strategic Intelligence', emoji: '🎯', color: '#FFCE00',
    blurb: 'Spotting where AI adds value and exercising judgment.' },
  { id: 2, name: 'Ethical Stewardship', emoji: '🛡️', color: '#DF41CF',
    blurb: 'Responsible, privacy-aware, and fair use of AI.' },
  { id: 3, name: 'Critical Human Skills', emoji: '🧠', color: '#CAB7FF',
    blurb: 'Adaptability, collaboration, and human-centered problem solving.' },
];

const QUESTIONS = [
  { domain: 0, text: 'When using an AI tool at work, you typically…',
    options: [
      { text: 'Use default prompts and accept the first output as-is', score: 1 },
      { text: "Refine your prompt if the first output isn't quite right", score: 2 },
      { text: 'Craft structured, specific prompts and verify outputs before using them', score: 3 },
    ] },
  { domain: 0, text: 'How would you describe your understanding of how AI language models work?',
    options: [
      { text: 'I know they generate text, but the technical details are unclear to me', score: 1 },
      { text: 'I understand concepts like training data, context windows, and model limitations', score: 2 },
      { text: 'I can explain how models are trained, what shapes their outputs, and where they commonly fail', score: 3 },
    ] },
  { domain: 0, text: 'When you need AI to help with a complex, multi-step task, you…',
    options: [
      { text: 'Describe it in a few sentences and work with whatever comes back', score: 1 },
      { text: 'Break it into steps and give the AI some context before asking', score: 2 },
      { text: 'Use structured techniques (role, context, format, examples) and iterate systematically', score: 3 },
    ] },
  /* ── 16-question mode: 4th Functional Proficiency ───────────────── */
  /* { domain: 0, text: 'Which best describes how AI tools fit into your current work?',
    options: [
      { text: "Rarely or never — I'm still exploring where they fit", score: 1 },
      { text: 'Occasionally, for specific tasks like drafting, summarizing, or research', score: 2 },
      { text: 'Regularly integrated across multiple workflows as a core part of how I work', score: 3 },
    ] }, */
  { domain: 1, text: 'When your team is deciding whether to use AI for a new project, you…',
    options: [
      { text: 'Defer to colleagues who know more about AI', score: 1 },
      { text: 'Can suggest areas where AI might save time or effort', score: 2 },
      { text: 'Proactively evaluate where AI genuinely adds value vs. creates risk or complexity', score: 3 },
    ] },
  { domain: 1, text: "How well do you understand AI's impact on your specific industry?",
    options: [
      { text: "I know AI is changing things but I'm not sure of the specifics", score: 1 },
      { text: 'I can identify a few key areas where AI is reshaping my field', score: 2 },
      { text: 'I can map AI trends to specific workflow and business model changes in my sector', score: 3 },
    ] },
  { domain: 1, text: 'When an AI tool gives you a recommendation or analysis, you…',
    options: [
      { text: "Usually accept it — if the AI generated it, it's probably reliable", score: 1 },
      { text: 'Check whether it seems reasonable before acting on it', score: 2 },
      { text: 'Apply critical judgment: verify sources, check for bias, and consider alternatives', score: 3 },
    ] },
  /* ── 16-question mode: 4th Strategic Intelligence ───────────────── */
  /* { domain: 1, text: 'In your current role, your ability to work alongside AI systems is…',
    options: [
      { text: 'Limited — I mostly work independently without AI involvement', score: 1 },
      { text: "Developing — I use AI for some tasks and adjust when outputs aren't right", score: 2 },
      { text: 'Strong — I integrate AI fluidly and know when to direct, override, or redirect it', score: 3 },
    ] }, */
  { domain: 2, text: 'When AI outputs contain errors or potentially biased information, you…',
    options: [
      { text: 'Might not always catch it — AI seems generally accurate enough', score: 1 },
      { text: 'Spot obvious errors but may miss subtler factual or bias issues', score: 2 },
      { text: 'Systematically fact-check important outputs and flag potential bias before sharing them', score: 3 },
    ] },
  { domain: 2, text: 'Your awareness of AI bias and fairness issues is…',
    options: [
      { text: "Limited — I know bias in AI exists but don't know much about it", score: 1 },
      { text: 'Moderate — I understand common bias types and some of their root causes', score: 2 },
      { text: 'Strong — I can identify bias risks in specific use cases and apply mitigation strategies', score: 3 },
    ] },
  { domain: 2, text: 'When it comes to data privacy and responsible AI use at work, you…',
    options: [
      { text: "Follow policies when reminded, but it's not always top of mind", score: 1 },
      { text: 'Understand the key rules and follow them consistently', score: 2 },
      { text: 'Actively apply privacy principles and proactively flag ethical risks to your team', score: 3 },
    ] },
  /* ── 16-question mode: 4th Ethical Stewardship ──────────────────── */
  /* { domain: 2, text: 'When you share deliverables that relied heavily on AI assistance, you…',
    options: [
      { text: 'Rarely mention it — I treat AI like any other productivity tool', score: 1 },
      { text: 'Disclose when policies or stakeholders clearly require it', score: 2 },
      { text: 'Make deliberate transparency choices based on context, accuracy risks, and audience expectations', score: 3 },
    ] }, */
  { domain: 3, text: 'When AI tools change rapidly or new ones emerge, you…',
    options: [
      { text: 'Feel overwhelmed and tend to be slow to adapt', score: 1 },
      { text: 'Adjust over time with some effort and trial-and-error', score: 2 },
      { text: 'Embrace change quickly and see it as a learning opportunity', score: 3 },
    ] },
  { domain: 3, text: 'In collaborative work environments, your communication and teamwork are…',
    options: [
      { text: "Something I'm still actively developing", score: 1 },
      { text: 'Solid — I contribute effectively in most team settings', score: 2 },
      { text: 'A core strength — I facilitate alignment, navigate complexity, and communicate with clarity', score: 3 },
    ] },
  { domain: 3, text: "When facing a complex workplace problem that AI can't fully solve, you…",
    options: [
      { text: "Find it difficult to make progress without AI's assistance", score: 1 },
      { text: 'Can work through it, though you rely on established approaches', score: 2 },
      { text: 'Apply creative, human-centered thinking to generate novel and nuanced solutions', score: 3 },
    ] },
  /* ── 16-question mode: 4th Critical Human Skills (last in list) ─── */
  /* { domain: 3, text: 'As the skills that matter in your role evolve alongside AI, you…',
    options: [
      { text: 'Mostly wait for formal training or direction before changing how you work', score: 1 },
      { text: 'Update your practices when a concrete need pushes you to learn something new', score: 2 },
      { text: 'Continuously experiment, learn from peers, and refine where you add distinct human value', score: 3 },
    ] }, */
];

/** Questions per domain — must match active QUESTIONS per domain (3 for 12-Q mode; use 4,4,4,4 when restoring 16-Q) */
const DQ = [3, 3, 3, 3];

/**
 * Improvement actions per domain (from strategy.md).
 * Optional resources: add { label, url }[] to show link chips on results/strategy.
 */
const DOMAIN_STRATEGY = [
  {
    subtitle: 'Build consistent practice, showcase applied work, and reuse strong prompts.',
    steps: [
      'Start a daily AI tool practice habit: Practice one AI tool every day for a real work task, such as drafting, summarizing, researching, or organizing information.',
      'Create a Project Portfolio: Compile a list of completed projects that demonstrate how you have applied standard AI tools to specific professional workflows.',
      'Build a Prompt Library: Develop and document a set of "reusable prompt templates" that use specific personas and constraints to improve the "effectiveness" of your AI instructions.',
    ],
    resources: [
      { label: 'Google Prompting Essentials', url: 'https://www.coursera.org/specializations/prompting-essentials-google' },
      { label: 'Learn Prompting', url: 'https://learnprompting.org/' },
      { label: 'IBM Generative AI: Prompt Engineering Basics', url: 'https://www.coursera.org/learn/generative-ai-prompt-engineering-for-everyone' },
    ],
  },
  {
    subtitle: 'Make AI part of how you scope work, map value, and read your industry.',
    steps: [
      "Build a habit: before starting any significant task, ask 'Could AI help with any part of this?'",
      'Map AI value: Pick one workflow in your job. Break it into steps and label each as: automate, augment, or human-only. Focus on where AI changes decisions, not just speed.',
      "Start mapping AI to your industry: read 2–3 articles per week about AI's impact on your specific sector. Search '[your industry] + AI use cases'",
    ],
    resources: [
      { label: 'Elements of AI', url: 'https://www.elementsofai.com/' },
      { label: 'Wharton AI Strategy and Governance', url: 'https://www.coursera.org/learn/wharton-ai-strategy-governance' },
      { label: 'MIT Sloan Management Review – AI & Machine Learning', url: 'https://sloanreview.mit.edu/topic/ai-machine-learning/' },
    ],
  },
  {
    subtitle: 'Review outputs rigorously, stress-test prompts, and deepen ethics training.',
    steps: [
      'Create a personal checklist: Use a checklist for reviewing AI outputs: accuracy, bias, privacy, and source quality.',
      'Complete a formal AI ethics or responsible AI training: Courses like MIT\'s "Ethics of AI" or Google\'s Responsible AI practices give you frameworks for bias detection, fairness assessment, and data privacy',
      'Rephrase prompts: Test the same prompt with different wording or perspectives to see whether the model gives biased or uneven results.',
    ],
    resources: [
      { label: 'fast.ai Practical Data Ethics', url: 'https://ethics.fast.ai/' },
      { label: 'Kaggle Intro to AI Ethics', url: 'https://www.kaggle.com/learn/intro-to-ai-ethics' },
      { label: 'DataCamp AI Ethics', url: 'https://www.datacamp.com/courses/ai-ethics' },
    ],
  },
  {
    subtitle: 'Strengthen explanation, adaptability, and human-led facilitation with AI.',
    steps: [
      'Practice Communication: explain an AI-generated idea to another person or AI companion in simple terms, then refine it based on their feedback.',
      'Divergent thinking: Work on one unfamiliar tool, topic, or workflow each week to build adaptability and comfort with change.',
      'Lead Human-AI Brainstorming: Facilitate a team session where AI generates raw ideas, but you use "creative thinking" and "emotional intelligence" to refine them for a specific "human purpose"',
    ],
    resources: [
      { label: 'Learning How to Learn', url: 'https://www.coursera.org/learn/learning-how-to-learn' },
      { label: 'Creative Thinking: Techniques and Tools for Success', url: 'https://www.coursera.org/learn/creative-thinking-techniques-and-tools-for-success' },
      { label: 'IBM Solving Problems with Creative and Critical Thinking', url: 'https://www.coursera.org/learn/solving-problems-with-creative-and-critical-thinking' },
    ],
  },
];
