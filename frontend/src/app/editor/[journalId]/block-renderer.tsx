"use client";

import HeadingBlock from "./blocks/heading-block";
import ParagraphBlock from "./blocks/paragraph-block";
import TableBlock from "./blocks/table-block";
import ImageBlock from "./blocks/image-block";
import CodeBlock from "./blocks/code-block";
import ObservationBlock from "./blocks/observation-block";
import ResultBlock from "./blocks/result-block";
import ReferenceBlock from "./blocks/reference-block";
import EquationBlock from "./blocks/equation-block";

interface BlockRendererProps {
  id: string;
  type: string;
  content: any;
  previewMode: boolean;
}

export default function BlockRenderer({ id, type, content, previewMode }: BlockRendererProps) {
  switch (type) {
    case "heading":
      return <HeadingBlock id={id} content={content} previewMode={previewMode} />;
    case "paragraph":
      return <ParagraphBlock id={id} content={content} previewMode={previewMode} />;
    case "table":
      return <TableBlock id={id} content={content} previewMode={previewMode} />;
    case "image":
      return <ImageBlock id={id} content={content} previewMode={previewMode} />;
    case "code":
      return <CodeBlock id={id} content={content} previewMode={previewMode} />;
    case "observation":
      return <ObservationBlock id={id} content={content} previewMode={previewMode} />;
    case "result":
      return <ResultBlock id={id} content={content} previewMode={previewMode} />;
    case "reference":
      return <ReferenceBlock id={id} content={content} previewMode={previewMode} />;
    case "equation":
      return <EquationBlock id={id} content={content} previewMode={previewMode} />;
    case "divider":
      return <hr className="border-t-2 border-border/60 my-6 w-full" />;
    case "page_break":
      if (previewMode) {
        return (
          <div className="relative flex items-center justify-center my-8 select-none print:hidden">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-dashed border-primary/20"></div>
            </div>
            <span className="relative px-3 bg-background text-[10px] font-bold tracking-wider text-primary/45 uppercase border border-primary/15 rounded-full py-0.5">
              Page Break
            </span>
          </div>
        );
      }
      return (
        <div className="relative flex items-center justify-center my-6 select-none">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-dashed border-primary/30"></div>
          </div>
          <span className="relative px-3 bg-muted text-[10px] font-bold tracking-wider text-primary/50 uppercase border border-primary/20 rounded-full py-0.5 shadow-xs">
            PDF Page Break
          </span>
        </div>
      );
    default:
      return (
        <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
          Unknown block type: <span className="font-bold">{type}</span>
        </div>
      );
  }
}
