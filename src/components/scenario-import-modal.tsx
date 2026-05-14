import { ClipboardPaste, Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { UiText } from "../App";

export type ScenarioExampleDownload = {
  label: string;
  filename: string;
  content: string;
};

export function ScenarioImportModal({
  open,
  ui,
  examples,
  onClose,
  onImport,
}: {
  open: boolean;
  ui: UiText;
  examples: ScenarioExampleDownload[];
  onClose: () => void;
  onImport: (rawText: string) => { ok: true } | { ok: false; error: string };
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleImport = () => {
    const result = onImport(text);
    if (result.ok) {
      onClose();
      return;
    }
    setError(result.error);
  };

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label={ui.modals.insertScenario}>
      <div className="modalShell modalShellWide">
        <div className="modalHeader">
          <div>
            <h2>{ui.modals.insertScenario}</h2>
            <p>{ui.modals.insertScenarioDescription}</p>
          </div>
          <button className="iconButton" onClick={onClose} aria-label={ui.modals.closeScenarioImport}>
            <X size={18} />
          </button>
        </div>

        <div className="modalContent singleColumn">
          <section className="panel">
            <div className="scenarioImportBody">
              <textarea
                className="scenarioImportTextarea"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  if (error) setError(null);
                }}
                placeholder={ui.modals.insertScenarioPlaceholder}
                spellCheck={false}
              />
              {error ? <p className="scenarioImportError">{error}</p> : null}
              <div className="scenarioImportExamples">
                {examples.map((example) => {
                  const href = `data:application/json;charset=utf-8,${encodeURIComponent(example.content)}`;
                  return (
                    <a key={example.filename} className="scenarioImportExampleLink" href={href} download={example.filename}>
                      <Download size={14} />
                      <span>{example.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="actions scenarioImportActions">
            <button className="primary" onClick={handleImport} disabled={!text.trim()}>
              <ClipboardPaste size={16} />
              {ui.sidebar.insertScenario}
            </button>
            <button onClick={onClose}>{ui.modals.closeScenarioImport}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
