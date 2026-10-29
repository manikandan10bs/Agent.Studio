import React, { useState } from 'react';
import { Modal } from './Modal';
import { Copy, Check, ExternalLink, Code } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentSlug: string;
  agentName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  agentSlug,
  agentName,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const publicUrl = `${window.location.origin}/chat/${agentSlug}`;
  const embedSnippet = `<iframe\n  src="${publicUrl}"\n  width="100%"\n  height="650"\n  frameborder="0"\n  style="border-radius: 16px; border: 1px solid #CBD5E1;"\n></iframe>`;

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share ${agentName}`}>
      <div className="space-y-5 text-slate-800">
        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
            Public Web Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-700 font-mono focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(publicUrl, true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-all"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied' : 'Copy'}
            </button>
            <a
              href={`/chat/${agentSlug}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
            Embed Widget (IFrame Snippet)
          </label>
          <div className="relative">
            <pre className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 font-mono overflow-x-auto whitespace-pre">
              {embedSnippet}
            </pre>
            <button
              onClick={() => copyToClipboard(embedSnippet, false)}
              className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs transition-colors shadow-sm"
            >
              {copiedEmbed ? <Check className="w-3 h-3 text-emerald-600" /> : <Code className="w-3 h-3" />}
              {copiedEmbed ? 'Copied' : 'Copy Snippet'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
