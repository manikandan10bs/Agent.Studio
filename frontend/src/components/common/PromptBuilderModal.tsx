import React, { useState } from 'react';
import { Modal } from './Modal';
import { Check, Wand2 } from 'lucide-react';

interface PromptBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPrompt: (prompt: string) => void;
}

const TEMPLATES = [
  {
    id: 'support',
    title: 'Customer Support Specialist',
    description: 'Empathetic, clear, and resolution-focused assistance.',
    role: 'Customer Support Specialist',
    tone: 'Warm, professional, and patient',
    rules: [
      'Always greet the customer warmly and confirm their question.',
      'Check provided documentation first for exact answers.',
      'Provide step-by-step guidance whenever explaining a solution.',
      'If information is missing from documents, politely offer to escalate.'
    ]
  },
  {
    id: 'analyst',
    title: 'Precision Research Analyst',
    description: 'Analytical, rigorous, and citation-oriented inquiry.',
    role: 'Senior Research Analyst',
    tone: 'Objective, analytical, and precise',
    rules: [
      'Base every conclusion directly on verified evidence.',
      'Cite document sources and specific sections for key statistics.',
      'Synthesize complex data into structured bullet points or tables.',
      'Highlight areas of uncertainty or missing data explicitly.'
    ]
  },
  {
    id: 'developer',
    title: 'Software Architect & Engineer',
    description: 'Technical, idiomatic code generation and architectural review.',
    role: 'Principal Software Engineer',
    tone: 'Concise, authoritative, and practical',
    rules: [
      'Write production-grade, typed, and well-structured code snippets.',
      'Explain architectural decisions and performance trade-offs.',
      'Follow modern industry best practices and clean code principles.',
      'Keep conversational filler minimal; focus on solutions.'
    ]
  },
  {
    id: 'executive',
    title: 'Executive Briefing Advisor',
    description: 'High-level executive summaries and strategic insights.',
    role: 'Executive Strategy Advisor',
    tone: 'Strategic, crisp, and high-impact',
    rules: [
      'Lead with executive summary and key findings.',
      'Organize recommendations by impact, timeline, and risk.',
      'Keep prose punchy, clear, and free of unnecessary jargon.',
      'Highlight actionable next steps and critical milestones.'
    ]
  }
];

export const PromptBuilderModal: React.FC<PromptBuilderModalProps> = ({
  isOpen,
  onClose,
  onApplyPrompt,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [customGoal, setCustomGoal] = useState('');

  const generatePrompt = () => {
    let prompt = `You are a precision-engineered AI Agent configured as a ${selectedTemplate.role}.\n\n`;
    prompt += `PRIMARY TONE & MANNER:\n- ${selectedTemplate.tone}\n\n`;
    if (customGoal.trim()) {
      prompt += `SPECIFIC MISSION OBJECTIVE:\n- ${customGoal.trim()}\n\n`;
    }
    prompt += `OPERATING PRINCIPLES:\n`;
    selectedTemplate.rules.forEach((rule, idx) => {
      prompt += `${idx + 1}. ${rule}\n`;
    });
    prompt += `\nGROUNDING & SAFETY:\n- Do not fabricate facts. If context does not contain the answer, explicitly state that.`;
    return prompt;
  };

  const handleApply = () => {
    onApplyPrompt(generatePrompt());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Prompt Builder & Persona Studio" maxWidth="max-w-2xl">
      <div className="space-y-5 text-slate-800">
        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
            Select Agent Persona
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setSelectedTemplate(tmpl)}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                  selectedTemplate.id === tmpl.id
                    ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-xs text-slate-900">{tmpl.title}</span>
                  {selectedTemplate.id === tmpl.id && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500">{tmpl.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
            Specific Business Goal or Domain (Optional)
          </label>
          <input
            type="text"
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            placeholder="e.g. Help customers troubleshoot billing issues, or analyze quarterly financial statements"
            className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
            Generated Instruction Preview
          </label>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 font-mono whitespace-pre-wrap max-h-44 overflow-y-auto">
            {generatePrompt()}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Apply Instructions
          </button>
        </div>
      </div>
    </Modal>
  );
};
