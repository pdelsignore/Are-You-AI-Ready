/** Skills Framework reference — derived from source/skills-framework.pdf */

export const SKILLS_FRAMEWORK = {
  summary:
    'A Skills Framework rates signal strength from profile evidence. Points are assigned per input type and proficiency level, then summed per skill (scores target 100, may exceed).',

  proficiencyLevels: [
    {
      id: 'beginner',
      label: 'Beginner',
      description:
        'Neither background knowledge nor prior experience required; accessible to novices.',
    },
    {
      id: 'advancedBeginner',
      label: 'Advanced Beginner',
      description:
        'Basic understanding of topic required; accessible to beginners.',
    },
    {
      id: 'competent',
      label: 'Competent',
      description:
        'Some prior experience and generalized understanding required.',
    },
    {
      id: 'proficient',
      label: 'Proficient',
      description:
        'Prior experience and knowledge required; can make decisions on topic.',
    },
    {
      id: 'expert',
      label: 'Expert',
      description:
        'Advanced experience and knowledge required; can adapt and innovate in the domain.',
    },
  ],

  credentialTypes: {
    attendance: {
      label: 'Attendance',
      description: 'Event exposure (conferences, webinars)',
      points: [1, 1, 2, 2, 3],
    },
    learning: {
      label: 'Learning',
      description: 'Structured, unmeasured learning (courses, trainings)',
      points: [2, 4, 6, 8, 10],
    },
    validation: {
      label: 'Validation',
      description: 'Measured and validated learning (assessments)',
      points: [4, 8, 12, 16, 20],
    },
    experience: {
      label: 'Experience',
      description: 'Real-world demonstration validated by managers or experts',
      points: [8, 16, 24, 32, 40],
    },
    certification: {
      label: 'Certification',
      description: 'Industry-recognized validated achievement',
      points: [10, 20, 30, 40, 50],
    },
  },

  workExperience: {
    currentRole: {
      label: 'Current role',
      description: 'Proficiency based on O*NET-style role expertise',
      points: [20, 40, 60, 80, 100],
    },
    pastRoles: {
      label: 'Past roles',
      description: 'Prior roles demonstrating skill use',
      points: [10, 20, 30, 40, 50],
    },
  },

  education: {
    label: 'Education',
    description: 'Degree-level proficiency assumptions',
    points: [12, 24, 36, 48, 62],
    degreeMapping: {
      beginner: 'Certificate (not credentialed)',
      advancedBeginner: 'Associate / trade degree',
      competent: "Bachelor's",
      proficient: "Master's",
      expert: 'Doctoral',
    },
  },

  weightingRules: {
    credentials:
      '1–5 skills per credential. First 2 skills at 100%, bottom 3 at 50%.',
    jobRoles:
      '8 skills per role. First 3 skills at 100%, bottom 5 at 50%.',
    education:
      '8 skills per degree. First 3 skills at 100%, bottom 5 at 50%.',
  },
};

export function buildFrameworkPromptSection() {
  const f = SKILLS_FRAMEWORK;
  const levelLabels = f.proficiencyLevels.map((l) => l.label).join(', ');

  const credentialRows = Object.entries(f.credentialTypes)
    .map(([key, c]) => `${c.label}: [${c.points.join(', ')}] — ${c.description}`)
    .join('\n');

  return `SKILLS FRAMEWORK (use this to score each identified skill):

${f.summary}

Proficiency levels (index order for point arrays): ${levelLabels}

Credential input points by proficiency level:
${credentialRows}

Work experience points by proficiency level:
- ${f.workExperience.currentRole.label}: [${f.workExperience.currentRole.points.join(', ')}]
- ${f.workExperience.pastRoles.label}: [${f.workExperience.pastRoles.points.join(', ')}]

Education points by proficiency level: [${f.education.points.join(', ')}]
Education degree mapping: ${Object.entries(f.education.degreeMapping).map(([k, v]) => `${k}: ${v}`).join('; ')}

Weighting when mapping evidence to skills:
- Credentials: ${f.weightingRules.credentials}
- Job roles: ${f.weightingRules.jobRoles}
- Education: ${f.weightingRules.education}

Scoring method:
1. Extract AI-relevant skills evidenced in the profile (technical, strategic, ethical, human skills).
2. For each skill, identify the strongest evidence (credential, current role, past role, or education).
3. Assign a proficiency level for that evidence using framework definitions.
4. Look up base points from the matching input type and proficiency index.
5. Apply weighting if the skill is primary or secondary within that evidence bundle.
6. Sum contributing signals per skill. Cap display score at 100 unless evidence clearly exceeds expert level (then allow up to 120).
7. Map each skill to one of the four AI readiness capability areas where appropriate.`;
}
