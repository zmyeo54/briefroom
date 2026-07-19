import { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckCircle,
  FileArrowUp,
  LinkSimple,
  SpinnerGap,
  Trash,
  ClipboardText,
} from "@phosphor-icons/react";
import { extractTextFromFile } from "../lib/ocr";
import { extractTextFromUrl } from "../lib/fetchUrl";
import { cleanJobTitle, extractJobTitle } from "../lib/jobMeta";
import { useI18n } from "../lib/I18nContext";

export default function DocumentField({
  title,
  hint,
  value,
  sourceMeta = null,
  onChange,
  placeholder,
  allowUrl = false,
  displayTitle = "",
  displaySubtitle = "",
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [url, setUrl] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [urlReplaceOpen, setUrlReplaceOpen] = useState(false);

  const loaded = Boolean(value?.trim());

  function applyValue(text, meta) {
    onChange(text, meta);
  }

  function clearAll() {
    onChange("");
    setFileName("");
    setSourceUrl("");
    setStatus("");
    setError("");
    setUrl("");
    setPasteOpen(false);
    setPasteDraft("");
    setUrlReplaceOpen(false);
  }

  async function onFiles(fileList) {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length) return;
    setBusy(true);
    setError("");
    setSourceUrl("");
    setPasteOpen(false);
    const names = files.map((f) => f.name);
    const activeName = names.length === 1 ? names[0] : t("doc.multiFiles", { n: names.length });
    setFileName(activeName);
    setStatus(t("doc.reading"));
    try {
      const parts = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatus(
          files.length > 1
            ? t("doc.readingN", { n: i + 1, total: files.length, name: file.name })
            : t("doc.reading")
        );
        const text = await extractTextFromFile(file, setStatus);
        if (text?.trim()) {
          parts.push(
            files.length > 1 ? `--- ${file.name} ---\n${text.trim()}` : text.trim()
          );
        }
      }
      if (!parts.length) {
        throw new Error("No text extracted. Try a clearer scan or paste manually.");
      }
      applyValue(parts.join("\n\n"), {
        source: "upload",
        fileName: activeName,
      });
      setStatus("Ready");
    } catch (e) {
      setError(e.message || "Upload failed");
      setStatus("");
      applyValue("", null);
    } finally {
      setBusy(false);
    }
  }

  async function onFetchUrl() {
    setBusy(true);
    setError("");
    setFileName("");
    setPasteOpen(false);
    setStatus(t("doc.fetching"));
    try {
      const result = await extractTextFromUrl(url, setStatus);
      const body = String(result?.text ?? "").trim();
      if (!body) {
        throw new Error("No text found at that URL.");
      }
      const title =
        cleanJobTitle(result?.title) || extractJobTitle(body);
      if (!title) {
        throw new Error(
          "Couldn't find a job title at that link. Paste the posting instead."
        );
      }
      applyValue(title, {
        source: "url",
        body,
        title,
        company: cleanJobTitle(result?.company) || "",
      });
      setSourceUrl(url.trim());
      setStatus("Ready");
      setUrlReplaceOpen(false);
    } catch (e) {
      setError(
        e.message ||
          "Could not fetch that URL. Some sites block extraction — paste the text instead."
      );
      setStatus("");
      applyValue("");
      setSourceUrl("");
    } finally {
      setBusy(false);
    }
  }

  function applyPaste() {
    const text = pasteDraft.trim();
    if (!text) {
      setError("Paste some text first.");
      return;
    }
    applyValue(text);
    setFileName("");
    setSourceUrl("");
    setStatus("Ready");
    setError("");
    setPasteOpen(false);
    setPasteDraft("");
  }

  const uploadName = fileName || (sourceMeta?.source === "upload" ? sourceMeta.fileName : "");
  const sourceFriendly = uploadName
    ? `${t("doc.fromUpload")} · ${uploadName}`
    : sourceUrl
      ? `${t("doc.fromLink")} · ${sourceUrl}`
      : loaded
        ? t("doc.fromPaste")
        : "";

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.18, ease: "easeOut" }
      }
      className="panel doc-card"
    >
      <div className="doc-card-head">
        <div className="min-w-0 flex-1 pr-2">
          <h2 className="display text-lg title text-balance md:text-xl">{title}</h2>
          {hint ? (
            <p className="mute mt-0.5 text-xs leading-relaxed text-pretty md:text-sm">{hint}</p>
          ) : null}
        </div>
        {loaded ? (
          <button
            type="button"
            className="btn-ghost btn shrink-0 px-2 py-1 text-xs"
            onClick={clearAll}
            aria-label={t("doc.clear")}
            title={t("doc.clear")}
          >
            <Trash size={15} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="doc-card-body">
        {loaded && !busy ? (
          <div className="doc-card-ready">
            <div className="flex items-start gap-2.5 md:gap-3">
              <CheckCircle
                size={20}
                weight="fill"
                className="mt-0.5 shrink-0 text-[#4a7ff8]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold title leading-snug">
                  {t("doc.ready", { title })}
                </p>
                {sourceFriendly ? (
                  <p className="mute mt-0.5 text-xs">{sourceFriendly}</p>
                ) : null}
                {displayTitle?.trim() ? (
                  <div className="doc-role-info">
                    <div className="doc-role-row">
                      <span className="doc-role-label">{t("doc.positionLabel")}</span>
                      <span className="doc-role-value">{displayTitle}</span>
                    </div>
                    {displaySubtitle?.trim() ? (
                      <>
                        <div className="doc-role-divider" />
                        <div className="doc-role-row">
                          <span className="doc-role-label">{t("doc.companyLabel")}</span>
                          <span className="doc-role-value doc-role-value--sub">{displaySubtitle}</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-3">
              <button
                type="button"
                className="btn text-xs"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <FileArrowUp size={14} weight="bold" aria-hidden />
                {t("doc.changeFile")}
              </button>
              {allowUrl ? (
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => {
                    setPasteOpen(false);
                    setUrlReplaceOpen(true);
                    setUrl(sourceUrl || "");
                  }}
                >
                  <LinkSimple size={14} weight="bold" aria-hidden />
                  {t("doc.changeLink")}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-ghost btn text-xs"
                onClick={() => {
                  setPasteOpen(true);
                  setPasteDraft("");
                }}
              >
                <ClipboardText size={14} weight="bold" aria-hidden />
                {t("doc.pasteInstead")}
              </button>
            </div>
          </div>
        ) : (
          <>
            {allowUrl ? (
              <div className="doc-card-slot">
                <div className="flex h-full flex-col gap-2 sm:flex-row sm:items-stretch">
                  <input
                    className="field flex-1 font-mono font-medium"
                    type="url"
                    value={url}
                    disabled={busy}
                    aria-label={t("doc.urlLabel")}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${title}-doc-error` : undefined}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onFetchUrl();
                      }
                    }}
                    placeholder={t("doc.urlPlaceholder")}
                  />
                  <button
                    type="button"
                    className="btn shrink-0"
                    disabled={busy || !url.trim()}
                    onClick={onFetchUrl}
                  >
                    {busy ? (
                      <SpinnerGap size={16} className="animate-spin" aria-hidden />
                    ) : (
                      <LinkSimple size={16} weight="bold" aria-hidden />
                    )}
                    {t("doc.extract")}
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const list = e.dataTransfer.files;
                if (list?.length) onFiles(list);
              }}
              className="dropzone doc-card-drop"
            >
              {busy ? (
                <SpinnerGap size={24} className="animate-spin text-[#4a7ff8]" aria-hidden />
              ) : (
                <FileArrowUp size={28} className="text-[#4a7ff8]" weight="duotone" aria-hidden />
              )}
              <span className="title mt-2 text-sm font-semibold">
                {busy ? t("doc.extracting") : t("doc.drop")}
              </span>
              <span className="mute mt-1 text-xs">
                {t("doc.formats")}
                {allowUrl ? t("doc.orUrl") : ""}
              </span>
            </button>

            <div className="doc-card-foot">
              <button
                type="button"
                className="btn-ghost btn self-start text-xs"
                disabled={busy}
                onClick={() => setPasteOpen((v) => !v)}
              >
                <ClipboardText size={14} weight="bold" aria-hidden />
                {pasteOpen ? t("doc.hidePaste") : t("doc.showPaste")}
              </button>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.bmp"
          aria-label={t("doc.fileLabel")}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <AnimatePresence initial={false}>
          {pasteOpen ? (
            <motion.div
              key="paste"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: "easeOut" }}
            >
              <div className="mt-3 space-y-2">
                <p className="mute text-xs">{t("doc.pasteHint")}</p>
                <textarea
                  className="field min-h-[96px] resize-y text-sm leading-relaxed md:min-h-[120px]"
                  value={pasteDraft}
                  onChange={(e) => setPasteDraft(e.target.value)}
                  placeholder={placeholder}
                  aria-label={t("doc.pasteLabel")}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${title}-doc-error` : undefined}
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary text-xs"
                    onClick={applyPaste}
                  >
                    {t("doc.applyPaste")}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn text-xs"
                    onClick={() => {
                      setPasteOpen(false);
                      setPasteDraft("");
                    }}
                  >
                    {t("doc.cancel")}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {loaded && allowUrl && urlReplaceOpen ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="field flex-1 font-mono"
              type="url"
              value={url}
              disabled={busy}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("doc.urlPlaceholder")}
              aria-label={t("doc.urlLabel")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${title}-doc-error` : undefined}
              autoFocus
            />
            <button
              type="button"
              className="btn shrink-0 text-xs"
              disabled={busy || !url.trim()}
              onClick={onFetchUrl}
            >
              {t("doc.extract")}
            </button>
            <button
              type="button"
              className="btn-ghost btn text-xs"
              onClick={() => setUrlReplaceOpen(false)}
            >
              {t("doc.cancel")}
            </button>
          </div>
        ) : null}

        {status && busy ? (
          <p className="ok mt-3 text-xs font-semibold" role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
        {error ? (
          <p
            id={`${title}-doc-error`}
            className="err mt-3 text-xs font-semibold"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </motion.section>
  );
}
