import { useRef, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "../lib/I18nContext";

const BRANCH_COLORS = ["#c49a3c", "#4a7ff8", "#ff7648", "#c5b4e3", "#4a9ff8"];

/**
 * MindmapTree — renders a horizontal node-tree diagram from mindmap data.
 * Supports color-coded branches, dual language (topicZh/labelZh), and rich content.
 *
 * @param {Object} props.map - {
 *   topic: string, topicZh?: string,
 *   branches: [{ label: string, labelZh?: string, detail?: string, example?: string }]
 * }
 */
export default function MindmapTree({ map }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const containerRef = useRef(null);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    if (!containerRef.current || !map?.branches?.length) return;

    const measure = () => {
      const container = containerRef.current;
      if (!container) return;

      const centerNode = container.querySelector(".mindmap-center");
      const branchNodes = container.querySelectorAll(".mindmap-branch-card");

      if (!centerNode || !branchNodes.length) return;

      const containerRect = container.getBoundingClientRect();
      const centerRect = centerNode.getBoundingClientRect();

      const newPositions = Array.from(branchNodes).map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          startX: centerRect.right - containerRect.left,
          startY: centerRect.top + centerRect.height / 2 - containerRect.top,
          endX: rect.left - containerRect.left,
          endY: rect.top + rect.height / 2 - containerRect.top,
          color: node.dataset.color || "#c49a3c",
        };
      });

      setPositions(newPositions);
    };

    requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [map]);

  if (!map || !map.topic) {
    return (
      <div className="mindmap-empty">
        <p className="mute text-xs">{t("qa.noMindmap")}</p>
      </div>
    );
  }

  const branches = Array.isArray(map.branches) ? map.branches : [];

  return (
    <div className="mindmap-tree" ref={containerRef}>
      {/* SVG connections */}
      <svg className="mindmap-connections" aria-hidden="true">
        {positions.map((pos, i) => {
          const midX = (pos.startX + pos.endX) / 2;
          const d = `M ${pos.startX} ${pos.startY} C ${midX} ${pos.startY}, ${midX} ${pos.endY}, ${pos.endX} ${pos.endY}`;
          return (
            <motion.path
              key={i}
              d={d}
              initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={reduce ? { duration: 0 } : { duration: 0.4, delay: i * 0.08 }}
              stroke={pos.color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Center node */}
      <motion.div
        className="mindmap-center"
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.3 }}
      >
        <span className="mindmap-center-text">{map.topic}</span>
        {map.topicZh ? (
          <span className="mindmap-center-zh">{map.topicZh}</span>
        ) : null}
      </motion.div>

      {/* Branch nodes */}
      <div className="mindmap-branches">
        {branches.map((branch, i) => {
          const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
          return (
            <motion.div
              key={i}
              className="mindmap-branch-card"
              data-color={color}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 0.1 + i * 0.08 }}
            >
              <div className="mindmap-branch-header">
                <span className="mindmap-branch-dot" style={{ background: color }} />
                <span className="mindmap-branch-label">{branch.label}</span>
              </div>
              {branch.labelZh ? (
                <span className="mindmap-branch-zh">{branch.labelZh}</span>
              ) : null}
              {branch.detail ? (
                <span className="mindmap-branch-detail">{branch.detail}</span>
              ) : null}
              {branch.example ? (
                <span className="mindmap-branch-example">{branch.example}</span>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
