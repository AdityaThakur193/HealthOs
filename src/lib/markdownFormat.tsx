import React from "react";

/**
 * Parses and formats simple AI markdown (headers, bullets, bolding) into React elements
 */
export function formatMessageContent(content: string, isUser = false): React.ReactNode[] {
  return content.split("\n").map((line, lineIdx) => {
    let cleanLine = line.trim();
    if (!cleanLine) return <div key={lineIdx} className="h-2" />;

    // Handle headers (### or ## or #)
    let isHeader = false;
    let headerText = cleanLine;
    if (cleanLine.startsWith("### ")) {
      headerText = cleanLine.substring(4);
      isHeader = true;
    } else if (cleanLine.startsWith("## ")) {
      headerText = cleanLine.substring(3);
      isHeader = true;
    } else if (cleanLine.startsWith("# ")) {
      headerText = cleanLine.substring(2);
      isHeader = true;
    }

    if (isHeader) {
      // Strip any inner bold markings inside header
      const title = headerText.replace(/\*\*/g, "");
      return (
        <h5 
          key={lineIdx} 
          className={`font-bold text-[10px] uppercase tracking-wider mt-3 mb-1.5 ${
            isUser ? "text-zinc-950" : "text-[#8ba893]"
          }`}
        >
          {title}
        </h5>
      );
    }

    // Handle bullet points
    let isBullet = false;
    if (cleanLine.startsWith("* ") || cleanLine.startsWith("- ")) {
      cleanLine = cleanLine.substring(2);
      isBullet = true;
    }

    // Handle inline bolding (**text**)
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(cleanLine)) !== null) {
      const textBefore = cleanLine.substring(lastIndex, match.index);
      const boldText = match[1];
      
      if (textBefore) parts.push(textBefore);
      parts.push(
        <strong key={match.index} className={`font-bold ${isUser ? "text-zinc-950" : "text-white"}`}>
          {boldText}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    const textAfter = cleanLine.substring(lastIndex);
    if (textAfter) parts.push(textAfter);

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex items-start gap-1 ml-1 my-0.5">
          <span className={`${isUser ? "text-zinc-900" : "text-[#8ba893]"} text-[10px] mt-1 mr-0.5 flex-shrink-0`}>•</span>
          <span className={`flex-1 ${isUser ? "text-zinc-900" : "text-zinc-300"}`}>{parts}</span>
        </div>
      );
    }

    return <p key={lineIdx} className="my-0.5 leading-relaxed">{parts}</p>;
  });
}
